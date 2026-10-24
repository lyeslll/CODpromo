// ============================================================
//  CODpromo — Edge Function: slickpay-invoice-status
//  تستدعيها صفحة /payment-return للتحقق الفوري من حالة الدفع (دون انتظار الـ webhook).
//  تتأكد أن الفاتورة تخصّ المستخدم الطالب، تستعلم SlickPay بمفتاحنا، والمبلغ لازم يطابق،
//  ثم تسجّل الشراء وتفعّل Premium مدى الحياة كاحتياط (idempotent مع الـ webhook).
// ============================================================
import { adminClient, authUser, corsHeaders, json } from "../_shared/lifetime.ts";
import { activateInvoice, fetchInvoice, INVOICE_COLUMNS, type InvoiceRow } from "../_shared/slickpay.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const user = await authUser(req);
    if (!user) return json({ error: "unauthorized" }, 401);

    const { invoice_id } = await req.json().catch(() => ({}));
    if (!invoice_id) return json({ error: "missing invoice_id" }, 400);

    // تأكّد أن الفاتورة تخصّ هذا المستخدم
    const admin = adminClient();
    const { data: invoice } = await admin
      .from("slickpay_invoices")
      .select(INVOICE_COLUMNS)
      .eq("invoice_id", String(invoice_id))
      .maybeSingle();
    if (!invoice || invoice.user_id !== user.id) return json({ error: "not found" }, 404);

    // الحالة الموثوقة من SlickPay
    const remote = await fetchInvoice(String(invoice_id));
    let completed = false;
    let reason = remote.reason;
    if (remote.completed) {
      const r = await activateInvoice(admin, invoice as InvoiceRow, remote.amount);
      completed = r === "granted" || r === "duplicate";
      if (!completed) reason = r;
    }

    return json({ completed, lifetime: completed, status: remote.status, reason });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
