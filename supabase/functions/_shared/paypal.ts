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
 * يفعّل Premium بناءً على طلب PayPal مدفوع (idempotent).
 * يمدّد من تاريخ الانتهاء الحالي إن كان سارياً، ويتجاهل الطلبات المكتملة مسبقاً.
 */
export async function activatePremium(
  admin: SupabaseClient,
  order: { order_id: string; user_id: string; plan_type: string; status: string },
) {
  if (order.status === "completed") return;
  const plan = PLANS[order.plan_type];
  if (!plan) return;

  const { data: prof } = await admin
    .from("profiles")
    .select("premium_until")
    .eq("id", order.user_id)
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
      plan_type: order.plan_type,
      payment_provider: "paypal",
      subscription_status: "active",
    })
    .eq("id", order.user_id);

  await admin
    .from("paypal_orders")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("order_id", order.order_id);
}
