// ============================================================
//  CODpromo — Edge Function: verify-play-purchase
//  يتحقّق من شراء Google Play (منتوج يتشرا مرة وحدة، non-consumable) خادمياً ويفعّل
//  Premium مدى الحياة. Google Play Developer API = مصدر الحقيقة. المستخدم من الـ JWT برك.
//  المنتوجات: codpromo_lifetime_launch (سعر الإطلاق) و codpromo_lifetime (السعر العادي).
//  السعر يحدّدو Google لكل منتوج، فنتحقّقو من المنتوج نفسو: منتوج الإطلاق يتقبل غير إذا
//  تشرا قبل ما تتسكّر مقاعد الإطلاق (+ ساعة سماح). الإقرار (acknowledge) بعد التسجيل برك:
//  شراء ما تقرّش → Google يرجّع الدراهم وحدو بعد 3 أيام.
//  المدخلات: POST { purchaseToken, productId } + Authorization (JWT المستخدم).
// ============================================================
import { adminClient, authUser, corsHeaders, getPricing, grantLifetime, json, usdFor, type Tier } from "../_shared/lifetime.ts";

// اسم الحزمة الخاص بتطبيق TWA (يجب أن يطابق Google Play Console)
const PACKAGE_NAME = "com.codpromo.twa";

// المنتجات المقبولة فقط → tier
const PRODUCT_TIER: Record<string, Tier> = {
  codpromo_lifetime_launch: "launch",
  codpromo_lifetime: "regular",
};

// سماح بعد ما تتسكّر مقاعد الإطلاق (اللي بدا الدفع قبل يتحسبلو بسعر الإطلاق)
const LAUNCH_GRACE_MS = 60 * 60 * 1000;

const API = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}`;

// ------------------------------------------------------------
//  مصادقة Google: نوقّع JWT بحساب الخدمة ونبادله بـ access token.
//  حساب الخدمة في السرّ GOOGLE_PLAY_SERVICE_ACCOUNT_JSON (لا يُطبع أبداً).
// ------------------------------------------------------------
function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// يحوّل مفتاح PEM (PKCS8) إلى مفتاح توقيع RSASSA-PKCS1-v1_5 / SHA-256
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    der.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function getGoogleAccessToken(): Promise<string> {
  const raw = Deno.env.get("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON") ?? "";
  if (!raw) throw new Error("missing service account");
  const sa = JSON.parse(raw) as { client_email: string; private_key: string };

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const enc = new TextEncoder();
  const signingInput =
    b64url(enc.encode(JSON.stringify(header))) +
    "." +
    b64url(enc.encode(JSON.stringify(claims)));

  const key = await importPrivateKey(sa.private_key);
  const sig = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(signingInput)),
  );
  const assertion = signingInput + "." + b64url(sig);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:
      "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=" +
      encodeURIComponent(assertion),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.access_token) {
    // لا نطبع تفاصيل السرّ — رسالة عامة فقط
    throw new Error("google auth failed");
  }
  return data.access_token as string;
}


// ------------------------------------------------------------
//  الدالة الرئيسية
// ------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // 1) المستخدم من الـ JWT فقط — لا نثق بأي userId من الكلاينت
    const user = await authUser(req);
    if (!user) return json({ error: "unauthorized" }, 401);

    const { purchaseToken, productId } = await req.json().catch(() => ({}));
    if (!purchaseToken || !productId) return json({ error: "missing purchaseToken or productId" }, 400);
    const sku = String(productId);
    const token = String(purchaseToken);
    const tier = PRODUCT_TIER[sku];
    if (!tier) return json({ error: "invalid product" }, 400);

    const admin = adminClient();

    // 2) منع إعادة الاستخدام: رمز مسجّل لحساب آخر → رفض
    const { data: existing } = await admin
      .from("purchases")
      .select("user_id")
      .eq("provider_ref", token)
      .maybeSingle();
    if (existing && existing.user_id !== user.id) return json({ error: "token already used" }, 409);

    // 3) التحقق عند Google (purchases.products)
    const accessToken = await getGoogleAccessToken();
    const pRes = await fetch(
      `${API}/purchases/products/${encodeURIComponent(sku)}/tokens/${encodeURIComponent(token)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const purchase = await pRes.json().catch(() => ({}));
    if (!pRes.ok) return json({ error: "verification failed" }, 400);

    // purchaseState: 0 = مدفوع، 1 = ملغى، 2 = معلّق (دفع نقدي…)
    if (purchase?.purchaseState === 2) return json({ ok: false, pending: true }, 200);
    if (purchase?.purchaseState !== 0) return json({ ok: false, error: "not purchased" }, 200);

    // 4) منتوج الإطلاق بعد ما تسكّرت المقاعد (تطبيق قديم مثلاً) → مرفوض بلا إقرار (Google يرجّع الدراهم)
    if (tier === "launch") {
      const { data: closedAt } = await admin.rpc("pricing_launch_closed_at");
      const boughtAt = Number(purchase?.purchaseTimeMillis) || Date.now();
      if (closedAt && boughtAt > new Date(closedAt as string).getTime() + LAUNCH_GRACE_MS) {
        return json({ ok: false, error: "price_changed" }, 200);
      }
    }

    // 5) التسجيل + Premium مدى الحياة (idempotent). Google ما يعطيش المبلغ المدفوع:
    //    نسجّلو سعر المنتوج بالدولار، وشراء تجريبي (purchaseType = 0، حسابات الاختبار) بـ 0.
    const pricing = await getPricing(admin);
    const amount = purchase?.purchaseType === 0 ? 0 : usdFor(pricing, tier);
    await grantLifetime(admin, {
      provider: "google_play",
      ref: token,
      userId: user.id,
      amount,
      currency: "USD",
      tier,
      paymentRef: purchase?.orderId ?? null,
    });

    // 6) الإقرار (مطلوب من Google في 3 أيام) — بعد التسجيل برك
    if (purchase?.acknowledgementState === 0) {
      await fetch(
        `${API}/purchases/products/${encodeURIComponent(sku)}/tokens/${encodeURIComponent(token)}:acknowledge`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: "{}",
        },
      ).catch(() => {
        /* يتعاود في التحقق الجاي (syncPlayPurchases في التطبيق) */
      });
    }

    return json({ success: true, ok: true, lifetime: true });
  } catch (e) {
    // رسالة عامة فقط — لا نسرّب أسرار ولا الرمز كاملاً
    return json({ error: (e as Error).message || "error" }, 400);
  }
});
