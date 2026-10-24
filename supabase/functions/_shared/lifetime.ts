// ============================================================
//  CODpromo — أدوات مشتركة للدفعة الوحدة (Premium مدى الحياة)
//  السعر يتقرّر هنا في الخادم عند إنشاء الدفع (pricing_public في القاعدة)، أبداً في المتصفّح.
//  التسجيل والمنح عبر RPC grant_lifetime_purchase (service_role برك، معاملة وحدة، idempotent).
// ============================================================
import { createClient, SupabaseClient, User } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

/** المستخدم من الـ JWT برك — لا نثق بأي userId من المتصفّح. */
export async function authUser(req: Request): Promise<User | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await userClient.auth.getUser();
  return user ?? null;
}

export function siteUrl(req: Request) {
  return Deno.env.get("SITE_URL") || req.headers.get("origin") || "http://localhost:5173";
}

export type Tier = "launch" | "regular";

export interface Pricing {
  tier: Tier;
  price_usd: number;
  price_dzd: number;
  launch_usd: number;
  launch_dzd: number;
  regular_usd: number;
  regular_dzd: number;
  seats_total: number;
  seats_left: number;
}

/** السعر الحالي من القاعدة (مقاعد الإطلاق محسوبة من purchases). */
export async function getPricing(admin: SupabaseClient): Promise<Pricing> {
  const { data, error } = await admin.rpc("pricing_public");
  if (error || !data) throw new Error("pricing unavailable");
  return data as Pricing;
}

export const usdFor = (p: Pricing, tier: Tier) => Number(tier === "launch" ? p.launch_usd : p.regular_usd);
export const dzdFor = (p: Pricing, tier: Tier) => Number(tier === "launch" ? p.launch_dzd : p.regular_dzd);

/**
 * حارس الدفع المزدوج: Premium من الملف (مدفوع / Stork / مدى الحياة) أو أدمن، أو شراء مدى الحياة.
 * مول الهدية يقدر يشري (الهدية مؤقتة).
 */
export async function alreadyPremium(admin: SupabaseClient, uid: string): Promise<boolean> {
  const [{ data: profile }, { count }] = await Promise.all([
    admin.from("profiles").select("is_premium, premium_until, is_admin").eq("id", uid).maybeSingle(),
    admin.from("purchases").select("id", { count: "exact", head: true }).eq("user_id", uid).is("refunded_at", null),
  ]);
  if ((count ?? 0) > 0) return true;
  if (!profile) return false;
  if (profile.is_admin) return true;
  return !!profile.is_premium && (!profile.premium_until || new Date(profile.premium_until) > new Date());
}

/** تسجيل الشراء + Premium مدى الحياة. يرجّع 'granted' أو 'duplicate' (نفس الدفعة مرّة ثانية). */
export async function grantLifetime(
  admin: SupabaseClient,
  a: {
    provider: "stripe" | "slickpay" | "paypal" | "google_play";
    ref: string;
    userId: string;
    amount: number;
    currency: string;
    tier: Tier;
    paymentRef?: string | null;
  },
): Promise<string> {
  const { data, error } = await admin.rpc("grant_lifetime_purchase", {
    p_provider: a.provider,
    p_ref: a.ref,
    p_user: a.userId,
    p_amount: a.amount,
    p_currency: a.currency,
    p_tier: a.tier,
    p_payment_ref: a.paymentRef ?? null,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

/** الاسترداد (من webhook): refunded_at + Premium يتنحّى إذا ما بقالو حتى شراء نشط. */
export async function revokeLifetime(admin: SupabaseClient, provider: string, ref: string): Promise<string> {
  const { data, error } = await admin.rpc("revoke_lifetime_purchase", { p_provider: provider, p_ref: ref });
  if (error) throw new Error(error.message);
  return data as string;
}

export const PRODUCT_LABEL = "CODpromo Premium — مدى الحياة";

/** مقارنة مبلغين بالسنتيم (تفادي أخطاء الفاصلة العائمة). */
export const sameAmount = (a: unknown, b: unknown) => {
  const x = Number(a);
  const y = Number(b);
  return Number.isFinite(x) && Number.isFinite(y) && Math.round(x * 100) === Math.round(y * 100);
};
