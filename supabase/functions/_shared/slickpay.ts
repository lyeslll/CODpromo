// ============================================================
//  CODpromo — أدوات مشتركة لدوال SlickPay
//  الباقات (مصدر الحقيقة للأسعار والمدد — لا يُوثق بأي مبلغ من المتصفّح)
// ============================================================
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const PLANS: Record<string, { amount: number; days: number; label: string }> = {
  month: { amount: 2500, days: 30, label: "اشتراك Premium — شهر" },
  quarter: { amount: 6500, days: 90, label: "اشتراك Premium — 3 أشهر" },
  year: { amount: 24000, days: 365, label: "اشتراك Premium — سنة" },
};

// قاعدة عنوان SlickPay: sandbox افتراضياً (devapi) للأمان — بدّلها لـ prod عبر secret
export const SLICKPAY_BASE =
  Deno.env.get("SLICKPAY_BASE_URL") || "https://devapi.slick-pay.com/api/v2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function slickpayHeaders() {
  return {
    Authorization: `Bearer ${Deno.env.get("SLICKPAY_PUBLIC_KEY") ?? ""}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
}

/**
 * يفعّل Premium لمستخدم بناءً على فاتورة مدفوعة (idempotent).
 * يمدّد من تاريخ الانتهاء الحالي إن كان لا يزال سارياً (تجديد لطيف).
 * يتجاهل الفواتير المكتملة مسبقاً لمنع التمديد المزدوج.
 */
export async function activatePremium(
  admin: SupabaseClient,
  invoice: { invoice_id: string; user_id: string; plan_type: string; status: string },
) {
  if (invoice.status === "completed") return; // سبق تفعيلها
  const plan = PLANS[invoice.plan_type];
  if (!plan) return;

  const { data: prof } = await admin
    .from("profiles")
    .select("premium_until")
    .eq("id", invoice.user_id)
    .maybeSingle();

  const now = Date.now();
  const current = prof?.premium_until ? new Date(prof.premium_until).getTime() : 0;
  const base = current > now ? current : now;
  const until = new Date(base + plan.days * 86400000).toISOString();

  await admin
    .from("profiles")
    .update({
      is_premium: true,
      premium_until: until,
      plan_type: invoice.plan_type,
      payment_provider: "slickpay",
      slickpay_invoice_id: invoice.invoice_id,
      subscription_status: "active",
    })
    .eq("id", invoice.user_id);

  await admin
    .from("slickpay_invoices")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("invoice_id", invoice.invoice_id);
}
