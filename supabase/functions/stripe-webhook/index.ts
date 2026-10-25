// ============================================================
//  CODpromo — Edge Function: stripe-webhook
//  يستقبل أحداث Stripe للدفعة الوحدة (Premium مدى الحياة):
//   - checkout.session.completed / async_payment_succeeded → تسجيل الشراء + Premium مدى الحياة
//     (بعد التحقق: mode payment، مدفوع، USD، والمبلغ قبل الخصم = المبلغ اللي حدّدو الخادم).
//   - charge.refunded (استرداد كامل) → refunded_at + Premium يتنحّى.
//  يتحقّق من توقيع الـ webhook قبل أي حاجة. بلا verify_jwt (Stripe لا يرسل JWT) — انظر config.toml.
// ============================================================
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { adminClient, grantLifetime, isTier, revokeLifetime } from "../_shared/lifetime.ts";
// المفاتيح الماسية (phase37): مسار وحدو — metadata.kind = "keys" + طلب في key_orders. ماشي Premium أبداً.
import { KEYS_KIND, keysRefundGateway, keysStripeSession } from "../_shared/keys.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  httpClient: Stripe.createFetchHttpClient(),
});
// مزوّد تشفير غير متزامن للتحقق من التوقيع في بيئة Deno
const cryptoProvider = Stripe.createSubtleCryptoProvider();
const admin = adminClient();

const ok = () =>
  new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

/** يسجّل الشراء إذا الجلسة مدفوعة وكل الأرقام مطابقة. يرجّع سبب الرفض (للسجلّ) ولا null. */
async function handleSession(s: Stripe.Checkout.Session): Promise<string | null> {
  if (s.mode !== "payment" || s.metadata?.kind !== "lifetime") return "not lifetime";
  // دفع متأخّر (unpaid): نستناو async_payment_succeeded
  if (s.payment_status !== "paid" && s.payment_status !== "no_payment_required") return "not paid yet";

  const userId = s.metadata?.supabase_user_id || s.client_reference_id;
  const tier = s.metadata?.tier;
  const expected = Number(s.metadata?.expected_amount);
  if (!userId || !isTier(tier) || !(expected > 0)) return "bad metadata";
  if ((s.currency || "").toLowerCase() !== "usd") return "wrong currency";
  if (s.amount_subtotal !== expected) return "amount mismatch";

  const paymentIntent = typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id ?? null;
  await grantLifetime(admin, {
    provider: "stripe",
    ref: s.id,
    userId,
    amount: (s.amount_total ?? 0) / 100, // المدفوع فعلاً (بعد كوبون الخصم إن وُجد)
    currency: "USD",
    tier,
    paymentRef: paymentIntent,
  });
  return null;
}

Deno.serve(async (req) => {
  const signature = req.headers.get("Stripe-Signature");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature ?? "",
      Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "",
      undefined,
      cryptoProvider,
    );
  } catch (err) {
    return new Response(`signature verification failed: ${(err as Error).message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const keysSession = event.data.object as Stripe.Checkout.Session;
        if (keysSession.metadata?.kind === KEYS_KIND) {
          const r = await keysStripeSession(admin, keysSession);
          // الطلب مازال ما تسجّلش (لحظة بعد صنع الجلسة) → 500 باش Stripe يعاود يبعث
          if (r === "not_found") return new Response("keys order not found yet", { status: 500 });
          if (r !== "granted" && r !== "duplicate" && r !== "not paid yet") console.error(`stripe-webhook: keys session ${keysSession.id}: ${r}`);
          break;
        }
        const reason = await handleSession(event.data.object as Stripe.Checkout.Session);
        if (reason && reason !== "not lifetime" && reason !== "not paid yet") {
          console.error(`stripe-webhook: session ${(event.data.object as Stripe.Checkout.Session).id} rejected: ${reason}`);
        }
        break;
      }
      // استرداد: كامل برك (charge.refunded = true). الجزئي ما ينحّيش Premium.
      case "charge.refunded": {
        const ch = event.data.object as Stripe.Charge;
        const pi = typeof ch.payment_intent === "string" ? ch.payment_intent : ch.payment_intent?.id;
        if (ch.refunded && pi) await revokeLifetime(admin, "stripe", pi);
        // مفاتيح: أي استرداد (حتى جزئي) → المفاتيح اللي ما تستعملوش من هاد الطلب تتنحّى (payment_intent مجهول = بلا أثر)
        if (pi && (ch.amount_refunded ?? 0) > 0) await keysRefundGateway(admin, "stripe", pi, (ch.amount_refunded ?? 0) / 100);
        break;
      }
    }
    return ok();
  } catch (e) {
    // 500 → Stripe يعاود يبعث الحدث (التسجيل idempotent)
    return new Response(`handler error: ${(e as Error).message}`, { status: 500 });
  }
});
