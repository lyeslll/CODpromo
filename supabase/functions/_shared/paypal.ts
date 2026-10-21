// ============================================================
//  CODpromo — أدوات مشتركة لدوال PayPal
//  الباقات (مصدر الحقيقة للأسعار والمدد — لا يُوثق بأي مبلغ من المتصفّح)
//  دفع لمرة واحدة بالدولار، كل دفعة تفعّل Premium لمدتها.
// ============================================================
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const PLANS: Record<string, { amount: string; days: number; label: string }> = {
  month: { amount: "10.00", days: 30, label: "اشتراك Premium — شهر" },
  quarter: { amount: "25.00", days: 90, label: "اشتراك Premium — 3 أشهر" },
  year: { amount: "90.00", days: 365, label: "اشتراك Premium — سنة" },
};

// قاعدة عنوان PayPal: sandbox افتراضياً للأمان — بدّلها لـ live عبر secret
export const PAYPAL_BASE =
  Deno.env.get("PAYPAL_BASE_URL") || "https://api-m.sandbox.paypal.com";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
}

// مصادقة OAuth2 مع PayPal للحصول على access token (المفتاح السري في secrets فقط)
export async function getAccessToken(): Promise<string> {
  const id = Deno.env.get("PAYPAL_CLIENT_ID") ?? "";
  const secret = Deno.env.get("PAYPAL_SECRET") ?? "";
  const auth = btoa(`${id}:${secret}`);
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.access_token) {
    throw new Error(data?.error_description || "تعذّر المصادقة مع PayPal");
  }
  return data.access_token as string;
}

/**
 * يفعّل Premium بعد تأكيد الدفع عند المزوّد (idempotent).
 * كلّش في معاملة وحدة عبر RPC activate_paid_premium (phase25، service_role فقط):
 * حجز الطلب (status ≠ completed) + منح Premium + حساب المدة في القاعدة.
 * طلبان متزامنان ما يمنحوش مرّتين، وإن فشل المنح ما يبقاش الطلب "completed" بلا Premium.
 */
export async function activatePremium(
  admin: SupabaseClient,
  order: { order_id: string; user_id: string; plan_type: string; status: string },
) {
  if (order.status === "completed") return; // سبق تفعيلها
  const plan = PLANS[order.plan_type];
  if (!plan) return;

  const { error } = await admin.rpc("activate_paid_premium", {
    p_provider: "paypal",
    p_ref: order.order_id,
    p_days: plan.days,
  });
  if (error) throw new Error(error.message);
}
