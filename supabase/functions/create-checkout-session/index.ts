// ============================================================
//  CODpromo — Edge Function: create-checkout-session
//  ينشئ جلسة Stripe Checkout لدفعة وحدة (mode 'payment') = Premium مدى الحياة بالدولار.
//  السعر يتقرّر هنا من pricing_settings (إطلاق / عادي حسب المقاعد الباقية)، أبداً من المتصفّح.
//  الـ Prices من secrets: STRIPE_PRICE_LIFETIME_LAUNCH / STRIPE_PRICE_LIFETIME_REGULAR. إذا السعر
//  تبدّل في الأدمن وما بقاش يطابق الـ Price، نستعملو price_data بنفس المنتوج والمبلغ الجديد.
//  المفتاح السري لـ Stripe يبقى في secrets الخاصة بالدالة فقط.
// ============================================================
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import {
  adminClient,
  alreadyPremium,
  authUser,
  corsHeaders,
  getPricing,
  json,
  siteUrl,
  usdFor,
} from "../_shared/lifetime.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  httpClient: Stripe.createFetchHttpClient(),
});

// الجلسة تنتهي بعد ساعة: اللي بدا بسعر الإطلاق يكمّل بيه "بشوية" برك، ماشي أيام من بعد
const SESSION_TTL_SECONDS = 60 * 60;

/** سطر الشراء: الـ Price المحفوظ إذا يطابق السعر الحالي، وإلا price_data بنفس المنتوج. */
async function lineItemFor(priceId: string, cents: number) {
  if (!priceId) throw new Error("price not configured");
  const price = await stripe.prices.retrieve(priceId);
  if (price.active && !price.recurring && price.currency === "usd" && price.unit_amount === cents) {
    return { price: price.id, quantity: 1 };
  }
  const product = typeof price.product === "string" ? price.product : price.product.id;
  return { price_data: { currency: "usd", unit_amount: cents, product }, quantity: 1 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // 1) هوية المستخدم من الـ JWT
    const user = await authUser(req);
    if (!user) return json({ error: "unauthorized" }, 401);

    // واجهة قديمة (باقات شهر/فصل/سنة): مرفوضة باش ما يتخلّصش حتى واحد بسعر ما شافوش
    const body = await req.json().catch(() => ({}));
    if (body?.plan) return json({ error: "تم تحديث نظام الدفع — حدّث الصفحة", code: "legacy_ui" }, 409);

    const admin = adminClient();

    // 2) حارس الدفع المزدوج (Premium مدى الحياة / مدفوع / أدمن)
    if (await alreadyPremium(admin, user.id)) return json({ error: "already_premium" }, 409);

    // 3) السعر من الخادم
    const pricing = await getPricing(admin);
    const tier = pricing.tier;
    const cents = Math.round(usdFor(pricing, tier) * 100);
    const priceId =
      Deno.env.get(tier === "launch" ? "STRIPE_PRICE_LIFETIME_LAUNCH" : "STRIPE_PRICE_LIFETIME_REGULAR") ?? "";
    const lineItem = await lineItemFor(priceId, cents);

    // 4) عميل Stripe (يتحفظ في profiles عبر service role — الحقل محمي من العميل)
    const { data: profile } = await admin
      .from("profiles")
      .select("stripe_customer_id, email")
      .eq("id", user.id)
      .maybeSingle();

    let customerId = profile?.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? profile?.email ?? undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await admin.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
    }

    // 5) جلسة دفع لمرة وحدة. expected_amount = المبلغ قبل الخصم (يتحقق منو الـ webhook)
    const site = siteUrl(req);
    const meta = { supabase_user_id: user.id, kind: "lifetime", tier, expected_amount: String(cents) };
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      client_reference_id: user.id,
      // فرض الدولار لكل الزوّار بغضّ النظر عن موقعهم (تعطيل التسعير التكيّفي)
      currency: "usd",
      // البطاقات برك (Apple Pay / Google Pay يبقاو، هوما بطاقات): الدفع يتأكّد في الحين والتفعيل فوري.
      // طرق الدفع المتأخّرة (تحويل بنكي…) كانت تخلّي Premium يستنى async_payment_succeeded.
      payment_method_types: ["card"],
      line_items: [lineItem],
      metadata: meta,
      payment_intent_data: { metadata: meta },
      // أكواد الخصم مقفولة افتراضياً: كوبون قديم (100%) من أيام الاشتراكات كان يعطي مدى الحياة مجاناً.
      // للتجربة بكوبون محدود: secret STRIPE_ALLOW_PROMOTION_CODES=true، ومن بعد نحيّوه.
      allow_promotion_codes: Deno.env.get("STRIPE_ALLOW_PROMOTION_CODES") === "true",
      expires_at: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
      success_url: `${site}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${site}/payment-cancel`,
    });

    return json({ lifetime: true, url: session.url });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
