// ============================================================
//  CODpromo — Edge Function: keys-checkout (المفاتيح الماسية، phase37)
//  يصنع دفع باقة مفاتيح: Stripe (بطاقة دولية، بالدولار) / SlickPay (بطاقة جزائرية، بالدينار) / PayPal (بالدولار).
//  المدخلات: POST { provider, pack } + JWT. المبلغ يتقرّر في القاعدة (keys_order_quote: سعر الباقة، ولا
//  سعر التجربة لهاد الحساب) — المتصفّح ما يبعث حتى مبلغ. Premium حقيقي (مدفوع / Stork / أدمن) → مرفوض،
//  وما نبيعوش مفاتيح أكثر من الأكواد المقفولة على الحساب (max_keys).
//  مسار منفصل على Premium: الطلب في key_orders، Stripe بـ metadata.kind = "keys"، فاتورة SlickPay بـ
//  webhook_url تاع keys-slickpay-webhook، والرجوع لـ /keys/return. الـ webhooks تاع Premium يتجاهلوه.
// ============================================================
import { authUser, adminClient, corsHeaders, json, siteUrl } from "../_shared/lifetime.ts";
import { SLICKPAY_BASE, slickpayHeaders } from "../_shared/slickpay.ts";
import { PAYPAL_BASE, getAccessToken } from "../_shared/paypal.ts";
import { isKeysProvider, keysLabel, keysOpen, keysQuote, KEYS_KIND, SESSION_TTL_SECONDS, stripeClient, validPack } from "../_shared/keys.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const user = await authUser(req);
    if (!user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const provider = body?.provider;
    const pack = body?.pack;
    if (!isKeysProvider(provider) || !validPack(pack)) return json({ error: "bad request" }, 400);

    const admin = adminClient();
    const q = await keysQuote(admin, user.id, pack);
    if (q.status !== "ok") return json({ error: q.status, code: q.status, max_keys: q.max_keys ?? null }, 409);

    const currency = provider === "slickpay" ? "DZD" : "USD";
    const amount = Number(currency === "DZD" ? q.price_dzd : q.price_usd);
    const keys = Number(q.keys);
    const tier = String(q.tier);
    const site = siteUrl(req);
    let ref = "";
    let url = "";

    if (provider === "stripe") {
      const stripe = stripeClient();
      const cents = Math.round(amount * 100);
      const meta = { supabase_user_id: user.id, kind: KEYS_KIND, pack, keys: String(keys), tier, expected_amount: String(cents) };
      const product = Deno.env.get("STRIPE_KEYS_PRODUCT") || "";
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        client_reference_id: user.id,
        customer_email: user.email ?? undefined,
        currency: "usd",
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: product
              ? { currency: "usd", unit_amount: cents, product }
              : { currency: "usd", unit_amount: cents, product_data: { name: keysLabel(keys) } },
            quantity: 1,
          },
        ],
        metadata: meta,
        payment_intent_data: { metadata: meta },
        allow_promotion_codes: false,
        expires_at: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
        success_url: `${site}/keys/return?provider=stripe&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${site}/keys/return?cancel=1`,
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
          amount,
          account: accountUuid,
          url: `${site}/keys/return?provider=slickpay`,
          fees: 0,
          address: user.user_metadata?.address || "Algérie",
          items: [{ name: keysLabel(keys), price: amount, quantity: 1 }],
          firstname: user.user_metadata?.full_name || "CODpromo",
          lastname: "User",
          email: user.email ?? undefined,
          webhook_url: `${supaUrl}/functions/v1/keys-slickpay-webhook`,
          webhook_signature: Deno.env.get("SLICKPAY_WEBHOOK_SIGNATURE") ?? "",
          webhook_meta_data: { user_id: user.id, kind: KEYS_KIND, pack },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.url || !data?.id) return json({ error: data?.message || "invoice" }, 400);
      ref = String(data.id);
      url = String(data.url);
    } else {
      const token = await getAccessToken();
      const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [{ amount: { currency_code: "USD", value: amount.toFixed(2) }, description: keysLabel(keys), custom_id: user.id }],
          application_context: {
            brand_name: "CODpromo",
            user_action: "PAY_NOW",
            shipping_preference: "NO_SHIPPING",
            return_url: `${site}/keys/return?provider=paypal`,
            cancel_url: `${site}/keys/return?cancel=1`,
          },
        }),
      });
      const order = await res.json().catch(() => ({}));
      const approve = (order?.links ?? []).find((l: { rel: string; href: string }) => l.rel === "approve" || l.rel === "payer-action")?.href;
      if (!res.ok || !order?.id || !approve) return json({ error: order?.message || "order" }, 400);
      ref = String(order.id);
      url = String(approve);
    }

    if (!ref || !url) return json({ error: "gateway" }, 400);

    // الربط الموثوق: الطلب → الحساب + الباقة + المبلغ المنتظر. بلاه ما نعطيوش رابط الدفع.
    try {
      await keysOpen(admin, { uid: user.id, pack, provider, ref, amount, currency, tier });
    } catch (e) {
      const m = /quote: (\w+)/.exec((e as Error).message);
      return json({ error: m?.[1] || "order", code: m?.[1] || "order" }, 409);
    }

    return json({ keys: true, url, ref, provider });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
