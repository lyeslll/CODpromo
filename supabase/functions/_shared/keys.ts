// ============================================================
//  CODpromo — أدوات مشتركة للمفاتيح الماسية (phase37)
//  مسار منفصل تماماً على Premium: الطلبات في key_orders (ماشي purchases / slickpay_invoices / paypal_orders)،
//  و metadata.kind = "keys" في Stripe — الـ webhooks تاع Premium ما يقدروش يفهموها شراء Premium، والعكس.
//  السعر وحدّ الشراء يتقرّرو في القاعدة (keys_order_quote / keys_order_open)؛ المتصفّح يبعث غير الباقة والبوابة.
//  المفاتيح تتزاد مرة وحدة برك (keys_order_paid: المبلغ والعملة لازم يطابقو الطلب المحفوظ).
// ============================================================
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { PAYPAL_BASE, completedCapture, getAccessToken } from "./paypal.ts";
import { fetchInvoice } from "./slickpay.ts";

export const KEYS_KIND = "keys";
export const KEYS_PROVIDERS = ["stripe", "slickpay", "paypal"] as const;
export type KeysProvider = (typeof KEYS_PROVIDERS)[number];
export const isKeysProvider = (p: unknown): p is KeysProvider => KEYS_PROVIDERS.includes(p as KeysProvider);
export const validPack = (p: unknown): p is string => typeof p === "string" && /^[a-z0-9_]{2,40}$/.test(p);

// الجلسة / الطلب ينتهي بعد ساعة (نفس Premium)؛ الطلبات المعلّقة تتحسب في حدّ الشراء 3 ساعات
export const SESSION_TTL_SECONDS = 60 * 60;

export const stripeClient = () =>
  new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", { httpClient: Stripe.createFetchHttpClient() });

export interface KeysQuote {
  status: "ok" | "has_premium" | "inactive" | "limit" | "auth";
  keys?: number;
  tier?: "regular" | "test";
  price_dzd?: number;
  price_usd?: number;
  max_keys?: number;
}

async function rpc<T>(admin: SupabaseClient, name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await admin.rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}

/** الباقة بسعر هاد الحساب (سعر التجربة إذا نشط) + الحدّ (ما نبيعوش أكثر من الأكواد المقفولة). */
export const keysQuote = (admin: SupabaseClient, uid: string, pack: string) =>
  rpc<KeysQuote>(admin, "keys_order_quote", { p_uid: uid, p_pack: pack });

/** طلب pending بعد ما البوابة صنعت الدفع: القاعدة تعاود تتحقق (الحدّ، Premium، المبلغ = السعر). */
export const keysOpen = (
  admin: SupabaseClient,
  a: { uid: string; pack: string; provider: KeysProvider; ref: string; amount: number; currency: "DZD" | "USD"; tier: string },
) =>
  rpc<number>(admin, "keys_order_open", {
    p_uid: a.uid,
    p_pack: a.pack,
    p_provider: a.provider,
    p_ref: a.ref,
    p_amount: a.amount,
    p_currency: a.currency,
    p_tier: a.tier,
  });

/** 'granted' | 'duplicate' | 'mismatch' | 'not_found' | 'no_user' */
export const keysPaid = (admin: SupabaseClient, provider: string, ref: string, amount: unknown, currency: string, paymentRef: string | null) =>
  rpc<string>(admin, "keys_order_paid", {
    p_provider: provider,
    p_ref: ref,
    p_amount: Number(amount),
    p_currency: currency,
    p_payment_ref: paymentRef,
  });

export const keysFailed = (admin: SupabaseClient, provider: string, ref: string) =>
  rpc<null>(admin, "keys_order_failed", { p_provider: provider, p_ref: ref });

/** أي استرداد (كامل ولا جزئي) على طلب مفاتيح: المفاتيح اللي ما تستعملوش تتنحّى. ref مجهول → 'not_found'. */
export const keysRefundGateway = (admin: SupabaseClient, provider: "stripe" | "paypal", ref: string, refunded: number) =>
  rpc<string>(admin, "keys_order_refund_gateway", { p_provider: provider, p_ref: ref, p_refunded: refunded });

/** طلب مفاتيح تاع هاد الحساب (بالمرجع، ولا آخر طلب معلّق لهاد البوابة). */
export async function ownOrder(admin: SupabaseClient, uid: string, provider: KeysProvider, ref?: string | null) {
  let q = admin
    .from("key_orders")
    .select("id, user_id, provider, provider_ref, keys, amount, currency, status")
    .eq("user_id", uid)
    .eq("provider", provider);
  q = ref ? q.eq("provider_ref", String(ref)) : q.eq("status", "pending").order("created_at", { ascending: false });
  const { data } = await q.limit(1).maybeSingle();
  return data as
    | { id: number; user_id: string; provider: KeysProvider; provider_ref: string; keys: number; amount: number; currency: string; status: string }
    | null;
}

// ===================== Stripe =====================
/**
 * جلسة Checkout تاع مفاتيح (metadata.kind = "keys") مدفوعة → المفاتيح. كل شي يتحقق: mode، مدفوع، USD،
 * المبلغ قبل وبعد الخصم = المبلغ اللي حدّدو الخادم (ما كاينش أكواد خصم في جلسات المفاتيح).
 * يرجّع حالة keys_order_paid ولا سبب الرفض ("not keys" / "not paid yet" / …).
 */
export async function keysStripeSession(admin: SupabaseClient, s: Stripe.Checkout.Session): Promise<string> {
  if (s.mode !== "payment" || s.metadata?.kind !== KEYS_KIND) return "not keys";
  if (s.payment_status !== "paid") return "not paid yet";
  const expected = Number(s.metadata?.expected_amount);
  if (!(expected > 0)) return "bad metadata";
  if ((s.currency || "").toLowerCase() !== "usd") return "wrong currency";
  if (s.amount_subtotal !== expected || s.amount_total !== expected) return "amount mismatch";
  const pi = typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id ?? null;
  return await keysPaid(admin, "stripe", s.id, (s.amount_total ?? 0) / 100, "USD", pi);
}

// ===================== SlickPay =====================
/** الحالة الموثوقة عند SlickPay (بمفتاحنا) → المفاتيح، ولا pending / failed. */
export async function keysSlickpayConfirm(admin: SupabaseClient, invoiceId: string): Promise<string> {
  const remote = await fetchInvoice(invoiceId);
  if (remote.completed) return await keysPaid(admin, "slickpay", invoiceId, remote.amount, "DZD", null);
  if (remote.ok && remote.status && /fail|cancel|reject|expire/i.test(String(remote.status))) {
    await keysFailed(admin, "slickpay", invoiceId);
    return "failed";
  }
  return "pending";
}

// ===================== PayPal =====================
/** يلتقط الطلب (ولا يقرا حالتو إذا التُقط من قبل) → المفاتيح. */
export async function keysPaypalCapture(admin: SupabaseClient, orderId: string): Promise<{ status: string; reason: string | null }> {
  const token = await getAccessToken();
  const id = encodeURIComponent(orderId);
  const capRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${id}/capture`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const capData = await capRes.json().catch(() => ({}));
  let capture = capData?.status === "COMPLETED" ? completedCapture(capData) : null;
  const reason = capData?.details?.[0]?.issue || capData?.name || null;
  if (!capture) {
    const getRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    const getData = await getRes.json().catch(() => ({}));
    if (getData?.status === "COMPLETED") capture = completedCapture(getData);
    else if (getData?.status === "APPROVED" || getData?.status === "CREATED" || getData?.status === "PAYER_ACTION_REQUIRED") {
      return { status: "pending", reason };
    }
  }
  if (!capture) {
    await keysFailed(admin, "paypal", orderId);
    return { status: "failed", reason };
  }
  if (capture.amount?.currency_code !== "USD") return { status: "mismatch", reason: "currency" };
  const r = await keysPaid(admin, "paypal", orderId, capture.amount?.value, "USD", capture.id);
  return { status: r, reason: null };
}

/** اسم السطر في البوابة (اللغة العربية، نفس PRODUCT_LABEL تاع Premium). */
export const keysLabel = (keys: number) => `CODpromo — ${keys} مفاتيح ماسية`;
