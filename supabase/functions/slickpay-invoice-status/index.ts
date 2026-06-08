// ============================================================
//  CODpromo — Edge Function: slickpay-invoice-status
//  تستدعيها صفحة /payment-return للتحقق الفوري من حالة الدفع
//  (دون انتظار الـ webhook). تتأكد أن الفاتورة تخصّ المستخدم الطالب،
//  تستعلم GET /users/invoices/{id} بمفتاحنا، وتفعّل Premium كاحتياط.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  PLANS,
  SLICKPAY_BASE,
  corsHeaders,
  json,
  slickpayHeaders,
  adminClient,
  activatePremium,
} from "../_shared/slickpay.ts";

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

    const { invoice_id } = await req.json().catch(() => ({}));
    if (!invoice_id) return json({ error: "missing invoice_id" }, 400);

    // تأكّد أن الفاتورة تخصّ هذا المستخدم
    const admin = adminClient();
    const { data: invoice } = await admin
      .from("slickpay_invoices")
      .select("invoice_id, user_id, plan_type, status")
      .eq("invoice_id", String(invoice_id))
      .maybeSingle();
    if (!invoice || invoice.user_id !== user.id) {
      return json({ error: "not found" }, 404);
    }

    // استعلم الحالة الموثوقة من SlickPay
    const res = await fetch(`${SLICKPAY_BASE}/users/invoices/${invoice_id}`, {
      headers: slickpayHeaders(),
    });
    const data = await res.json().catch(() => ({}));
    const completed = data?.completed === 1 || data?.data?.completed === 1;

    if (completed) await activatePremium(admin, invoice);

    const plan = PLANS[invoice.plan_type];
    return json({
      completed,
      plan_type: invoice.plan_type,
      days: plan?.days ?? null,
      status: data?.data?.status ?? data?.status ?? null,
      reason: data?.data?.rejection_reason ?? null,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
