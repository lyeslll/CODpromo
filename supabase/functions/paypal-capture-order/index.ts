// ============================================================
//  CODpromo — Edge Function: paypal-capture-order
//  يلتقط الدفع بعد موافقة المستخدم على PayPal، يتأكد أن الطلب يخصّه،
//  وعند COMPLETED يفعّل Premium للمدة الصحيحة. الالتقاط بمفتاحنا السري
//  هو المصدر الموثوق (لا حاجة لـ webhook).
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  PLANS,
  PAYPAL_BASE,
  corsHeaders,
  json,
  adminClient,
  getAccessToken,
  activatePremium,
} from "../_shared/paypal.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const { order_id } = await req.json().catch(() => ({}));
    if (!order_id) return json({ error: "missing order_id" }, 400);

    // تأكّد أن الطلب يخصّ هذا المستخدم
    const admin = adminClient();
    const { data: order } = await admin
      .from("paypal_orders")
      .select("order_id, user_id, plan_type, status")
      .eq("order_id", String(order_id))
      .maybeSingle();
    if (!order || order.user_id !== user.id) {
      return json({ error: "not found" }, 404);
    }

    // التقط الدفع
    const token = await getAccessToken();
    const capRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${order_id}/capture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    const capData = await capRes.json().catch(() => ({}));
    let completed = capData?.status === "COMPLETED";

    // قد يكون التُقط مسبقاً (إعادة تحميل صفحة العودة) → تحقّق بحالة الطلب
    if (!completed && capRes.status === 422) {
      const getRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${order_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const getData = await getRes.json().catch(() => ({}));
      completed = getData?.status === "COMPLETED";
    }

    if (completed) await activatePremium(admin, order);

    return json({
      completed,
      plan_type: order.plan_type,
      days: PLANS[order.plan_type]?.days ?? null,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
