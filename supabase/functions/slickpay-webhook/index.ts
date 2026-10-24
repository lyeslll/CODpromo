// ============================================================
//  CODpromo — Edge Function: slickpay-webhook
//  يستقبل إشعار SlickPay عند تغيّر حالة الدفع.
//  الأمان متعدّد الطبقات:
//   1) التحقق من webhook_signature المرسَل.
//   2) ربط الفاتورة بمستخدم حقيقي عبر جدولنا slickpay_invoices.
//   3) إعادة التحقق من الحالة والمبلغ عبر GET /users/invoices/{id} بمفتاحنا السري
//      (لا نثق بجسم الإشعار وحده — هذا يمنع التزوير)، والمبلغ لازم يطابق الفاتورة المحفوظة.
//  بلا verify_jwt (SlickPay لا يرسل JWT) — انظر config.toml.
// ============================================================
import { adminClient, json } from "../_shared/lifetime.ts";
import { activateInvoice, fetchInvoice, INVOICE_COLUMNS, type InvoiceRow } from "../_shared/slickpay.ts";

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

    // 2) استخرج معرّف الفاتورة
    const invoiceId = String(body?.id ?? body?.data?.id ?? "");
    if (!invoiceId) return json({ error: "missing invoice id" }, 400);

    // 3) الفاتورة في جدولنا (الربط الموثوق بالمستخدم والمبلغ و tier)
    const admin = adminClient();
    const { data: invoice } = await admin
      .from("slickpay_invoices")
      .select(INVOICE_COLUMNS)
      .eq("invoice_id", invoiceId)
      .maybeSingle();
    if (!invoice) return json({ error: "unknown invoice" }, 404);

    // 4) إعادة التحقق الموثوق من SlickPay بمفتاحنا السري
    const remote = await fetchInvoice(invoiceId);
    if (remote.completed) {
      await activateInvoice(admin, invoice as InvoiceRow, remote.amount);
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
