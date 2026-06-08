// ============================================================
//  CODpromo — Edge Function: slickpay-webhook
//  يستقبل إشعار SlickPay عند تغيّر حالة الدفع.
//  الأمان متعدّد الطبقات:
//   1) التحقق من webhook_signature المرسَل.
//   2) ربط الفاتورة بمستخدم حقيقي عبر جدولنا slickpay_invoices.
//   3) إعادة التحقق من الحالة عبر GET /users/invoices/{id} بمفتاحنا السري
//      (لا نثق بحقل completed في جسم الإشعار وحده — هذا يمنع التزوير).
//  بلا verify_jwt (SlickPay لا يرسل JWT) — انظر config.toml.
// ============================================================
import {
  SLICKPAY_BASE,
  json,
  slickpayHeaders,
  adminClient,
  activatePremium,
} from "../_shared/slickpay.ts";

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));

    // 1) تحقّق من التوقيع (من الجسم أو الترويسة)
    const expected = Deno.env.get("SLICKPAY_WEBHOOK_SIGNATURE") ?? "";
    const provided =
      body?.webhook_signature ||
      req.headers.get("webhook-signature") ||
      req.headers.get("x-webhook-signature") ||
      req.headers.get("signature") ||
      "";
    if (expected && provided && provided !== expected) {
      return json({ error: "invalid signature" }, 401);
    }

    // 2) استخرج معرّف الفاتورة (من الجسم أو الميتاداتا)
    const invoiceId = String(body?.id ?? body?.data?.id ?? "");
    if (!invoiceId) return json({ error: "missing invoice id" }, 400);

    // 3) ابحث عن الفاتورة في جدولنا (الربط الموثوق بالمستخدم والباقة)
    const admin = adminClient();
    const { data: invoice } = await admin
      .from("slickpay_invoices")
      .select("invoice_id, user_id, plan_type, status")
      .eq("invoice_id", invoiceId)
      .maybeSingle();
    if (!invoice) return json({ error: "unknown invoice" }, 404);

    // 4) إعادة التحقق الموثوق من SlickPay بمفتاحنا السري
    const verifyRes = await fetch(`${SLICKPAY_BASE}/users/invoices/${invoiceId}`, {
      headers: slickpayHeaders(),
    });
    const verify = await verifyRes.json().catch(() => ({}));
    const completed = verify?.completed === 1 || verify?.data?.completed === 1;

    if (completed) {
      await activatePremium(admin, invoice);
    } else {
      // فشل/إلغاء — علّم الفاتورة (لا نلمس Premium)
      await admin
        .from("slickpay_invoices")
        .update({ status: "failed" })
        .eq("invoice_id", invoiceId)
        .eq("status", "pending");
    }

    return json({ received: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
