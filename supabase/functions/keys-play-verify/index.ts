// ============================================================
//  CODpromo — Edge Function: keys-play-verify (المفاتيح الماسية داخل تطبيق Android، phase37)
//  منتوجات Google Play consumable (تتشرى بزاف المرات): codpromo_keys_3، codpromo_keys_5 (key_packs.play_product_id).
//  التحقق في الخادم (purchases.products.get، purchaseState = 0)، التسجيل (keys_play_grant: نفس الرمز مرّتين =
//  duplicate، رمز ولا orderId تاع حساب آخر = مرفوض)، ومن بعد acknowledge و consume. شراء تجريبي
//  (License testing، purchaseType = 0) = tier test بـ 0. Premium (codpromo_lifetime…) هنا = invalid product،
//  ومنتوجات المفاتيح في verify-play-purchase = invalid product: الزوج ما يتخلطوش.
//  المدخلات: POST { purchaseToken, productId } + JWT (المستخدم من الـ JWT برك).
// ============================================================
import { adminClient, authUser, corsHeaders, json } from "../_shared/lifetime.ts";
import { acknowledgeAndConsume, getProductPurchase, googleAccessToken } from "../_shared/googlePlay.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const user = await authUser(req);
    if (!user) return json({ error: "unauthorized" }, 401);

    const { purchaseToken, productId } = await req.json().catch(() => ({}));
    if (!purchaseToken || !productId) return json({ error: "missing purchaseToken or productId" }, 400);
    const sku = String(productId);
    const token = String(purchaseToken);
    if (!/^[a-z0-9][a-z0-9_.]{0,99}$/.test(sku) || token.length > 500) return json({ error: "invalid product" }, 400);

    const admin = adminClient();
    const { data: pack } = await admin.from("key_packs").select("id").eq("play_product_id", sku).maybeSingle();
    if (!pack) return json({ error: "invalid product" }, 400);

    // رمز مسجّل لحساب آخر → رفض قبل حتى نداء لـ Google
    const { data: existing } = await admin.from("key_orders").select("user_id").eq("provider", "google_play").eq("provider_ref", token).maybeSingle();
    if (existing && existing.user_id !== user.id) return json({ error: "token already used" }, 409);

    const accessToken = await googleAccessToken();
    const { ok, data: purchase } = await getProductPurchase(accessToken, sku, token);
    if (!ok) return json({ error: "verification failed" }, 400);
    if (purchase?.purchaseState === 2) return json({ ok: false, pending: true });
    if (purchase?.purchaseState !== 0) return json({ ok: false, error: "not purchased" });

    const { data: status, error } = await admin.rpc("keys_play_grant", {
      p_uid: user.id,
      p_product: sku,
      p_token: token,
      p_order_ref: purchase?.orderId ?? null,
      p_test: purchase?.purchaseType === 0,
    });
    if (error) return json({ error: "grant failed" }, 500);
    if (status === "other_user") return json({ error: "token already used" }, 409);
    // Premium حقيقي ولا فوق حدّ الأكواد المقفولة: ما نقرّوش الشراء → Google يرجّع الدراهم وحدو (3 أيام)
    if (status === "has_premium" || status === "limit") return json({ ok: false, error: status });
    if (status !== "granted" && status !== "duplicate") return json({ error: String(status) }, 400);

    // بعد التسجيل برك: acknowledge ثم consume (شراء ما تقرّش في 3 أيام → Google يرجّع الدراهم)
    const done = await acknowledgeAndConsume(accessToken, sku, token, purchase);
    return json({ ok: true, keys: true, status, consumed: done.consumed });
  } catch (e) {
    return json({ error: (e as Error).message || "error" }, 400);
  }
});
