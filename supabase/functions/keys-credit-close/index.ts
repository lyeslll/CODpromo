// ============================================================
//  CODpromo — Edge Function: keys-credit-close (phase38)
//  تسكّر عند البوابة دفع Premium بالرصيد اللي تلغى (الوقت فات، دفع جديد، استرداد المفاتيح، الأدمن):
//   - Stripe: الجلسة مفتوحة → expire. مدفوعة → keys_credit_settle_late (الشراء يتسجّل كيما stripe-webhook).
//   - SlickPay: مدفوعة → keys_credit_settle_late. ماشي مدفوعة → DELETE /users/invoices/{id}، ومن بعد نتأكّدو
//     (404 = مسكّرة؛ مازالت كاينة → نعاودو نشوفو حتى 30 يوم، والدفعة كي توصل تتشاف).
//   - PayPal: ما نلتقطوش (paypal-capture-order يرفض الطلب بلا tier = ما يتخصم والو). نشوفو الطلب 6 ساعات
//     (التقاط بدا قبل الإلغاء) ومن بعد مسكّر؛ COMPLETED → keys_credit_settle_late.
//  ينادوها غير القاعدة (pg_net من cron: keys_credit_gate_kick) برأس x-email-secret (نفس EMAIL_HOOK_SECRET). بلا JWT.
//  المبالغ والحالة من البوابة بمفاتيحنا برك؛ الجسم ما فيه والو.
// ============================================================
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { adminClient, json } from "../_shared/lifetime.ts";
import { SLICKPAY_BASE, slickpayHeaders } from "../_shared/slickpay.ts";
import { PAYPAL_BASE, completedCapture, getAccessToken } from "../_shared/paypal.ts";
import { stripeClient } from "../_shared/keys.ts";

const PAYPAL_WATCH_MS = 6 * 60 * 60 * 1000;

interface Job {
  id: number;
  provider: "stripe" | "slickpay" | "paypal";
  ref: string;
  currency: string;
  amount_due: number;
  voided_at: string | null;
  attempts: number;
  since: string;
}

type Result = { result: "closed" | "watch"; error?: string };

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const admin = adminClient();

async function settle(job: Job, amount: unknown, currency: string, paymentRef: string | null): Promise<Result> {
  const { error } = await admin.rpc("keys_credit_settle_late", {
    p_provider: job.provider,
    p_ref: job.ref,
    p_amount: Number(amount),
    p_currency: currency,
    p_payment_ref: paymentRef,
  });
  return error ? { result: "watch", error: `settle: ${error.message}` } : { result: "closed" };
}

async function closeStripe(stripe: Stripe, job: Job): Promise<Result> {
  let s = await stripe.checkout.sessions.retrieve(job.ref);
  if (s.status === "open") {
    try {
      s = await stripe.checkout.sessions.expire(job.ref);
    } catch {
      s = await stripe.checkout.sessions.retrieve(job.ref); // تكمّلت في نفس اللحظة
    }
  }
  if (s.status === "expired") return { result: "closed" };
  if (s.status === "complete" && s.payment_status === "paid") {
    if (s.metadata?.kind !== "lifetime" || (s.currency || "").toLowerCase() !== "usd") return { result: "watch", error: "unexpected session" };
    const pi = typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id ?? null;
    return await settle(job, (s.amount_total ?? 0) / 100, "USD", pi);
  }
  return { result: "watch", error: `stripe ${s.status}/${s.payment_status}` };
}

async function slickpayInvoice(id: string) {
  const res = await fetch(`${SLICKPAY_BASE}/users/invoices/${encodeURIComponent(id)}`, { headers: slickpayHeaders() });
  const data = await res.json().catch(() => ({}));
  const d = data?.data ?? {};
  return {
    code: res.status,
    completed: data?.completed === 1 || d?.completed === 1,
    amount: d?.amount ?? data?.amount ?? d?.total ?? null,
  };
}

async function closeSlickpay(job: Job): Promise<Result> {
  let inv = await slickpayInvoice(job.ref);
  if (inv.code === 404) return { result: "closed" };
  if (inv.code !== 200) return { result: "watch", error: `slickpay get ${inv.code}` };
  if (inv.completed) return await settle(job, inv.amount, "DZD", null);
  const del = await fetch(`${SLICKPAY_BASE}/users/invoices/${encodeURIComponent(job.ref)}`, {
    method: "DELETE",
    headers: slickpayHeaders(),
  });
  inv = await slickpayInvoice(job.ref);
  if (inv.code === 404) return { result: "closed" };
  if (inv.code === 200 && inv.completed) return await settle(job, inv.amount, "DZD", null);
  return { result: "watch", error: `slickpay delete ${del.status} → get ${inv.code}` };
}

async function closePaypal(job: Job): Promise<Result> {
  const token = await getAccessToken();
  const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${encodeURIComponent(job.ref)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return { result: "closed" };
  const order = await res.json().catch(() => ({}));
  if (!res.ok) return { result: "watch", error: `paypal get ${res.status}` };
  if (order?.status === "COMPLETED") {
    const cap = completedCapture(order);
    if (cap) return await settle(job, cap.amount?.value, cap.amount?.currency_code ?? "", cap.id);
  }
  const voided = job.voided_at ? Date.parse(job.voided_at) : Date.parse(job.since);
  if (Date.now() - voided > PAYPAL_WATCH_MS) return { result: "closed" };
  return { result: "watch", error: `paypal ${order?.status ?? "?"}` };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const secret = Deno.env.get("EMAIL_HOOK_SECRET") ?? "";
  if (!secret || !safeEqual(req.headers.get("x-email-secret") ?? "", secret)) return json({ error: "forbidden" }, 403);

  const { data: jobs, error } = await admin.rpc("keys_credit_gate_claim", { p_limit: 10 });
  if (error) return json({ error: "claim" }, 500);

  let stripe: Stripe | null = null;
  const out: Record<string, string> = {};
  for (const job of (jobs ?? []) as Job[]) {
    let r: Result;
    try {
      if (job.provider === "stripe") r = await closeStripe((stripe ??= stripeClient()), job);
      else if (job.provider === "slickpay") r = await closeSlickpay(job);
      else if (job.provider === "paypal") r = await closePaypal(job);
      else r = { result: "closed" };
    } catch (e) {
      r = { result: "watch", error: (e as Error).message };
    }
    await admin.rpc("keys_credit_gate_done", { p_id: job.id, p_result: r.result, p_error: r.error?.slice(0, 300) ?? null });
    out[String(job.id)] = r.result;
  }
  return json({ processed: Object.keys(out).length, results: out });
});
