// ============================================================
//  CODpromo — Edge Function: paypal-create-order
//  ينشئ طلب دفع PayPal (لمرة واحدة بالدولار) لباقة Premium مختارة،
//  ويعيد رابط موافقة PayPal لتوجيه المستخدم. المفتاح السري في secrets فقط.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  PLANS,
  PAYPAL_BASE,
  corsHeaders,
  json,
  adminClient,
  getAccessToken,
} from "../_shared/paypal.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // 1) تحقّق من هوية المستخدم عبر JWT
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

    // 2) تحقّق من الباقة (المبلغ والمدة من الخادم فقط)
    const { plan } = await req.json().catch(() => ({}));
    const cfg = PLANS[plan as string];
    if (!cfg) return json({ error: "باقة غير صالحة" }, 400);

    // 3) أنشئ طلب PayPal
    const token = await getAccessToken();
    const siteUrl =
      Deno.env.get("SITE_URL") || req.headers.get("origin") || "http://localhost:5173";

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
            amount: { currency_code: "USD", value: cfg.amount },
            description: cfg.label,
            custom_id: user.id,
          },
        ],
        application_context: {
          brand_name: "CODpromo",
          user_action: "PAY_NOW",
          shipping_preference: "NO_SHIPPING",
          return_url: `${siteUrl}/payment-return-paypal`,
          cancel_url: `${siteUrl}/payment-cancel`,
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

    // 4) احفظ الطلب (ربط موثوق: order → user + plan) عبر service role
    const admin = adminClient();
    await admin.from("paypal_orders").insert({
      order_id: order.id,
      user_id: user.id,
      plan_type: plan,
      amount_usd: Number(cfg.amount),
      status: "pending",
    });

    return json({ url: approve, order_id: order.id });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
