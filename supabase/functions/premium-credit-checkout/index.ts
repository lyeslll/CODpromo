// ============================================================
//  CODpromo — Edge Function: premium-credit-checkout (النظام العادل، phase37 — الموقع برك)
//  Premium مدى الحياة بالرصيد: كل واش خلّصو الزبون في المفاتيح ينقص من السعر، والباقي يتخلّص بالبوابة.
//  المدخلات: POST { provider: "stripe" | "slickpay" | "paypal" } + JWT. الرصيد والباقي يتحسبو في القاعدة
//  (keys_credit_quote_for، ومن بعد keys_credit_open يعاود يحسب بقفل) — المتصفّح ما يبعث حتى مبلغ.
//  الرصيد يغطي السعر كامل → 409 covered (التفعيل بلا دفع = RPC keys_premium_redeem). بلا رصيد → 409 no_credit
//  (الواجهة تستعمل الدوال العادية). داخل التطبيق ما يتناداش (Google Play بالسعر الكامل).
//  الإكمال = نفس طريق Premium الكاين بلا أي تبديل: Stripe → stripe-webhook (kind = "lifetime"،
//  expected_amount = الباقي)، SlickPay → slickpay-invoice-status / slickpay-webhook (الفاتورة في
//  slickpay_invoices بالباقي)، PayPal → paypal-capture-order (الطلب في paypal_orders بالباقي).
// ============================================================
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { adminClient, alreadyPremium, authUser, corsHeaders, json, PRODUCT_LABEL, siteUrl } from "../_shared/lifetime.ts";
import { SLICKPAY_BASE, slickpayHeaders } from "../_shared/slickpay.ts";
import { PAYPAL_BASE, getAccessToken } from "../_shared/paypal.ts";
import { isKeysProvider, SESSION_TTL_SECONDS, stripeClient } from "../_shared/keys.ts";

/** نفس منتوج Premium في Stripe (من الـ Price المحفوظ في secrets) بالمبلغ الجديد. */
async function premiumLine(stripe: Stripe, tier: string, cents: number) {
  const priceId = Deno.env.get(tier === "regular" ? "STRIPE_PRICE_LIFETIME_REGULAR" : "STRIPE_PRICE_LIFETIME_LAUNCH") ?? "";
  if (!priceId) throw new Error("price not configured");
  const price = await stripe.prices.retrieve(priceId);
  const product = typeof price.product === "string" ? price.product : price.product.id;
  return { price_data: { currency: "usd", unit_amount: cents, product }, quantity: 1 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const user = await authUser(req);
    if (!user) return json({ error: "unauthorized" }, 401);
    const body = await req.json().catch(() => ({}));
    const provider = body?.provider;
    if (!isKeysProvider(provider)) return json({ error: "bad request" }, 400);

    const admin = adminClient();
    if (await alreadyPremium(admin, user.id)) return json({ error: "already_premium", code: "already_premium" }, 409);

    const { data: q, error: qErr } = await admin.rpc("keys_credit_quote_for", { uid: user.id });
    if (qErr || !q) return json({ error: "quote" }, 500);
    if (q.status === "has_premium") return json({ error: "already_premium", code: "already_premium" }, 409);
    if (q.status !== "ok") return json({ error: String(q.status) }, 409);
    if (q.covered) return json({ error: "covered", code: "covered" }, 409);

    const currency = provider === "slickpay" ? "DZD" : "USD";
    const credit = Number(currency === "DZD" ? q.applied_dzd : q.applied_usd);
    if (!(credit > 0)) return json({ error: "no_credit", code: "no_credit" }, 409);
    const due = Number(currency === "DZD" ? q.due_dzd : q.due_usd);
    const tier = String(q.tier);
    const site = siteUrl(req);
    let ref = "";
    let url = "";
    let extra: Record<string, string> = {};

    if (provider === "stripe") {
      const stripe = stripeClient();
      const cents = Math.round(due * 100);
      const { data: profile } = await admin.from("profiles").select("stripe_customer_id, email").eq("id", user.id).maybeSingle();
      let customerId = profile?.stripe_customer_id as string | null;
      if (!customerId) {
        const customer = await stripe.customers.create({ email: user.email ?? profile?.email ?? undefined, metadata: { supabase_user_id: user.id } });
        customerId = customer.id;
        await admin.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
      }
      // نفس metadata تاع Premium (stripe-webhook يكمّل بيها): expected_amount = الباقي بعد الرصيد
      const meta = { supabase_user_id: user.id, kind: "lifetime", tier, expected_amount: String(cents), key_credit: String(credit) };
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer: customerId,
        client_reference_id: user.id,
        currency: "usd",
        payment_method_types: ["card"],
        line_items: [await premiumLine(stripe, tier, cents)],
        metadata: meta,
        payment_intent_data: { metadata: meta },
        allow_promotion_codes: false,
        expires_at: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
        success_url: `${site}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${site}/payment-cancel`,
      });
      ref = session.id;
      url = session.url ?? "";
    } else if (provider === "slickpay") {
      let accountUuid = Deno.env.get("SLICKPAY_ACCOUNT_UUID") || "";
      if (!accountUuid) {
        const accRes = await fetch(`${SLICKPAY_BASE}/users/accounts`, { headers: slickpayHeaders() });
        const accJson = await accRes.json().catch(() => ({}));
        const accounts = accJson?.data ?? [];
        const def = accounts.find((a: { default: number }) => a.default === 1) ?? accounts[0];
        accountUuid = def?.uuid ?? "";
        if (!accountUuid) return json({ error: "slickpay account" }, 400);
      }
      const supaUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const res = await fetch(`${SLICKPAY_BASE}/users/invoices`, {
        method: "POST",
        headers: slickpayHeaders(),
        body: JSON.stringify({
          amount: due,
          account: accountUuid,
          url: `${site}/payment-return`,
          fees: 0,
          address: user.user_metadata?.address || "Algérie",
          items: [{ name: PRODUCT_LABEL, price: due, quantity: 1 }],
          firstname: user.user_metadata?.full_name || "CODpromo",
          lastname: "User",
          email: user.email ?? undefined,
          webhook_url: `${supaUrl}/functions/v1/slickpay-webhook`,
          webhook_signature: Deno.env.get("SLICKPAY_WEBHOOK_SIGNATURE") ?? "",
          webhook_meta_data: { user_id: user.id, tier },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.url || !data?.id) return json({ error: data?.message || "invoice" }, 400);
      ref = String(data.id);
      url = String(data.url);
      extra = { invoice_id: ref };
    } else {
      const token = await getAccessToken();
      const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [{ amount: { currency_code: "USD", value: due.toFixed(2) }, description: PRODUCT_LABEL, custom_id: user.id }],
          application_context: {
            brand_name: "CODpromo",
            user_action: "PAY_NOW",
            shipping_preference: "NO_SHIPPING",
            return_url: `${site}/payment-return-paypal`,
            cancel_url: `${site}/payment-cancel`,
          },
        }),
      });
      const order = await res.json().catch(() => ({}));
      const approve = (order?.links ?? []).find((l: { rel: string; href: string }) => l.rel === "approve" || l.rel === "payer-action")?.href;
      if (!res.ok || !order?.id || !approve) return json({ error: order?.message || "order" }, 400);
      ref = String(order.id);
      url = String(approve);
      extra = { order_id: ref };
    }

    if (!ref || !url) return json({ error: "gateway" }, 400);

    // القاعدة تعاود تحسب الرصيد والباقي (بقفل) وتسجّل: key_credit_uses + الفاتورة / الطلب تاع Premium
    const { error: openErr } = await admin.rpc("keys_credit_open", {
      p_uid: user.id,
      p_provider: provider,
      p_ref: ref,
      p_currency: currency,
      p_due: due,
      p_tier: tier,
    });
    if (openErr) return json({ error: "credit changed", code: "outdated" }, 409);

    return json({ lifetime: true, url, credit, due, currency, ...extra });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
