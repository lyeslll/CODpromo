// ============================================================
//  CODpromo — Edge Function: paypal-create-order
//  ينشئ طلب PayPal (دفعة وحدة بالدولار) = Premium مدى الحياة، ويعيد رابط موافقة PayPal.
//  المبلغ (سعر الإطلاق ولا العادي) يتقرّر هنا من pricing_settings. المفتاح السري في secrets فقط.
// ============================================================
import {
  adminClient,
  alreadyPremium,
  authUser,
  corsHeaders,
  getPricing,
  json,
  PRODUCT_LABEL,
  siteUrl,
  usdFor,
} from "../_shared/lifetime.ts";
import { PAYPAL_BASE, getAccessToken } from "../_shared/paypal.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // 1) هوية المستخدم عبر JWT
    const user = await authUser(req);
    if (!user) return json({ error: "unauthorized" }, 401);

    // واجهة قديمة (باقات شهر/فصل/سنة): مرفوضة باش ما يتخلّصش حتى واحد بسعر ما شافوش
    const body = await req.json().catch(() => ({}));
    if (body?.plan) return json({ error: "تم تحديث نظام الدفع — حدّث الصفحة", code: "legacy_ui" }, 409);

    const admin = adminClient();
    if (await alreadyPremium(admin, user.id)) return json({ error: "already_premium" }, 409);

    // 2) السعر من الخادم
    const pricing = await getPricing(admin);
    const tier = pricing.tier;
    const amount = usdFor(pricing, tier);
    const value = amount.toFixed(2);

    // 3) أنشئ طلب PayPal
    const token = await getAccessToken();
    const site = siteUrl(req);
    const orderRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: { currency_code: "USD", value },
            description: PRODUCT_LABEL,
            custom_id: user.id,
          },
        ],
        application_context: {
          brand_name: "CODpromo",
          user_action: "PAY_NOW",
          shipping_preference: "NO_SHIPPING",
          return_url: `${site}/payment-return-paypal`,
          cancel_url: `${site}/payment-cancel`,
        },
      }),
    });
    const order = await orderRes.json().catch(() => ({}));

    const approve = (order?.links ?? []).find(
      (l: { rel: string; href: string }) => l.rel === "approve" || l.rel === "payer-action",
    )?.href;

    if (!orderRes.ok || !order?.id || !approve) {
      return json({ error: order?.message || "تعذّر إنشاء طلب الدفع" }, 400);
    }

    // 4) الربط الموثوق: الطلب → الحساب + tier + المبلغ المنتظر. بلاه ما نعطيوش رابط الدفع.
    const { error: insErr } = await admin.from("paypal_orders").insert({
      order_id: order.id,
      user_id: user.id,
      plan_type: "lifetime",
      tier,
      amount_usd: Number(value),
      status: "pending",
    });
    if (insErr) return json({ error: "تعذّر حفظ الطلب" }, 500);

    return json({ lifetime: true, url: approve, order_id: order.id });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
