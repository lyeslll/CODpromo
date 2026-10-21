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
 * يفعّل Premium بعد تأكيد الدفع عند المزوّد (idempotent).
 * كلّش في معاملة وحدة عبر RPC activate_paid_premium (phase25، service_role فقط):
 * حجز الفاتورة (status ≠ completed) + منح Premium + حساب المدة في القاعدة.
 * طلبان متزامنان ما يمنحوش مرّتين، وإن فشل المنح ما يبقاش الفاتورة "completed" بلا Premium.
 */
export async function activatePremium(
  admin: SupabaseClient,
  invoice: { invoice_id: string; user_id: string; plan_type: string; status: string },
) {
  if (invoice.status === "completed") return; // سبق تفعيلها
  const plan = PLANS[invoice.plan_type];
  if (!plan) return;

  const { error } = await admin.rpc("activate_paid_premium", {
    p_provider: "slickpay",
    p_ref: invoice.invoice_id,
    p_days: plan.days,
  });
  if (error) throw new Error(error.message);
}
