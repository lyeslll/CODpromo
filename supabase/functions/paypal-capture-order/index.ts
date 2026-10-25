// ============================================================
//  CODpromo — Edge Function: paypal-capture-order
//  يلتقط الدفع بعد موافقة المستخدم على PayPal، يتأكد أن الطلب يخصّه، وعند COMPLETED
//  (والمبلغ والعملة مطابقين للطلب المحفوظ) يسجّل الشراء ويفعّل Premium مدى الحياة.
//  الالتقاط بمفتاحنا السري هو المصدر الموثوق. الاسترداد → paypal-webhook.
// ============================================================
import { adminClient, authUser, corsHeaders, isTier, json } from "../_shared/lifetime.ts";
import {
  PAYPAL_BASE,
  activateOrder,
  completedCapture,
  getAccessToken,
  ORDER_COLUMNS,
  type OrderRow,
} from "../_shared/paypal.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const user = await authUser(req);
    if (!user) return json({ error: "unauthorized" }, 401);

    const { order_id } = await req.json().catch(() => ({}));
    if (!order_id) return json({ error: "missing order_id" }, 400);

    // تأكّد أن الطلب يخصّ هذا المستخدم
    const admin = adminClient();
    const { data: order } = await admin
      .from("paypal_orders")
      .select(ORDER_COLUMNS)
      .eq("order_id", String(order_id))
      .maybeSingle();
    if (!order || order.user_id !== user.id) return json({ error: "not found" }, 404);

    // طلب بلا tier (اشتراك قديم، ولا دفع Premium بالرصيد تلغى — phase38): ما نلتقطوش → ما يتخصم حتى سنتيم
    if (!isTier((order as OrderRow).tier)) return json({ completed: false, lifetime: false, reason: "cancelled" });

    // التقط الدفع
    const token = await getAccessToken();
    const capRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${encodeURIComponent(String(order_id))}/capture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    const capData = await capRes.json().catch(() => ({}));
    let capture = capData?.status === "COMPLETED" ? completedCapture(capData) : null;
    // سبب الفشل المختصر من PayPal (issue) — يُعرض للمستخدم كي لا يفشل بصمت
    let reason = capData?.details?.[0]?.issue || capData?.name || null;

    // قد يكون التُقط مسبقاً (إعادة تحميل صفحة العودة) → تحقّق بحالة الطلب الفعلية
    if (!capture) {
      const getRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${encodeURIComponent(String(order_id))}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const getData = await getRes.json().catch(() => ({}));
      if (getData?.status === "COMPLETED") capture = completedCapture(getData);
    }

    let completed = false;
    if (capture) {
      const r = await activateOrder(admin, order as OrderRow, capture);
      completed = r === "granted" || r === "duplicate";
      reason = completed ? null : r;
    } else {
      // علّم الطلب كفاشل (لا نلمس Premium)
      await admin
        .from("paypal_orders")
        .update({ status: "failed" })
        .eq("order_id", String(order_id))
        .eq("status", "pending");
    }

    return json({ completed, lifetime: completed, reason });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
