// ============================================================
//  CODpromo — Edge Function: create-checkout-session
//  جسر آمن: ينشئ جلسة Stripe Checkout لاشتراك Premium متجدّد بالدولار.
//  ثلاث باقات (شهر 10$ / 3 أشهر 25$ / سنة 90$) — كلٌّ بـ Price ID من secrets.
//  المفتاح السري لـ Stripe يبقى في secrets الخاصة بالدالة فقط.
// ============================================================
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// خريطة الباقة → Price ID (مصدر الحقيقة للسعر/الفترة من Stripe، لا من المتصفّح).
// الشهر يستعمل STRIPE_PRICE_ID الحالي (توافق رجعي).
function priceIdFor(plan: string): string {
  const ids: Record<string, string | undefined> = {
    month: Deno.env.get("STRIPE_PRICE_ID") ?? undefined,
    quarter: Deno.env.get("STRIPE_PRICE_ID_QUARTER") ?? undefined,
    year: Deno.env.get("STRIPE_PRICE_ID_YEAR") ?? undefined,
  };
  return ids[plan] ?? "";
}

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // 1) تحقّق من هوية المستخدم عبر JWT المرسَل من الموقع
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    // 1.5) حدّد الباقة (شهر افتراضياً للتوافق الرجعي) واجلب Price ID المناسب
    const { plan } = await req.json().catch(() => ({}));
    const planType = ["month", "quarter", "year"].includes(plan as string)
      ? (plan as string)
      : "month";
    const priceId = priceIdFor(planType);
    if (!priceId) return json({ error: "باقة غير متاحة حالياً" }, 400);

    // عميل بصلاحيات كاملة (service role) لقراءة/كتابة الملف الشخصي بأمان
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // 2) اجلب أو أنشئ عميل Stripe، واحفظ معرّفه في profiles
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
      await admin
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
    }

    // 3) أنشئ جلسة Checkout لاشتراك شهري
    const siteUrl =
      Deno.env.get("SITE_URL") || req.headers.get("origin") || "http://localhost:5173";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      // فرض الدولار لكل الزوّار بغضّ النظر عن موقعهم (تعطيل التسعير التكيّفي)
      currency: "usd",
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: { metadata: { supabase_user_id: user.id, plan_type: planType } },
      metadata: { supabase_user_id: user.id, plan_type: planType },
      allow_promotion_codes: true,
      success_url: `${siteUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/payment-cancel`,
    });

    return json({ url: session.url });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
