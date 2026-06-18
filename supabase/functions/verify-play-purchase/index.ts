// ============================================================
//  CODpromo — Edge Function: verify-play-purchase
//  يتحقّق من اشتراك Google Play خادمياً ويفعّل Premium في profiles.
//  Google Play Developer API = مصدر الحقيقة. لا يُمنح Premium إطلاقاً قبل
//  تحقّق ناجح من Google + اشتراك فعّال. المستخدم يُحدَّد من الـ JWT فقط.
//  المدخلات: POST { purchaseToken, productId } + Authorization (JWT المستخدم).
// ============================================================
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// اسم الحزمة الخاص بتطبيق TWA (يجب أن يطابق Google Play Console)
const PACKAGE_NAME = "com.codpromo.twa";

// المنتجات المقبولة فقط → خريطة معرّف المنتج إلى نوع الباقة في profiles
const PRODUCT_TO_PLAN: Record<string, string> = {
  premium_monthly: "month",
  premium_quarterly: "quarter",
  premium_yearly: "year",
};

// حالات الاشتراك التي تُعتبر فعّالة (نمنح Premium لها فقط)
const ACTIVE_STATES = new Set([
  "SUBSCRIPTION_STATE_ACTIVE",
  "SUBSCRIPTION_STATE_IN_GRACE_PERIOD",
]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
}

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

    // مدخلات الطلب
    const { purchaseToken, productId } = await req.json().catch(() => ({}));
    if (!purchaseToken || !productId) {
      return json({ error: "missing purchaseToken or productId" }, 400);
    }
    // المنتج يجب أن يكون من القائمة المسموحة
    const planType = PRODUCT_TO_PLAN[String(productId)];
    if (!planType) return json({ error: "invalid product" }, 400);

    const admin = adminClient();

    // 2) منع إعادة الاستخدام: إن كان الرمز مسجّلاً لحساب آخر → رفض
    const { data: existing } = await admin
      .from("google_play_purchases")
      .select("user_id")
      .eq("purchase_token", String(purchaseToken))
      .maybeSingle();
    if (existing && existing.user_id !== user.id) {
      return json({ error: "token already used" }, 409);
    }

    // 3) تحقّق من الاشتراك عبر Google Play Developer API v3 (subscriptionsv2)
    const accessToken = await getGoogleAccessToken();
    const url =
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/` +
      `${PACKAGE_NAME}/purchases/subscriptionsv2/tokens/` +
      encodeURIComponent(String(purchaseToken));
    const gRes = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const sub = await gRes.json().catch(() => ({}));
    if (!gRes.ok) {
      return json({ error: "verification failed" }, 400);
    }

    // 4) اقبل فقط إن كان الاشتراك فعّالاً والمنتج يطابق المرسَل
    const state = sub?.subscriptionState as string | undefined;
    if (!state || !ACTIVE_STATES.has(state)) {
      return json({ success: false, error: "subscription not active" }, 200);
    }

    const lineItems: Array<{ productId?: string; expiryTime?: string }> =
      Array.isArray(sub?.lineItems) ? sub.lineItems : [];
    // المنتج المُحقَّق من Google يجب أن يطابق productId المرسَل بالضبط
    const matched = lineItems.find((li) => li.productId === String(productId));
    if (!matched) {
      return json({ success: false, error: "product mismatch" }, 200);
    }

    // تاريخ الانتهاء من ردّ Google (مصدر الحقيقة)
    const premiumUntil = matched.expiryTime
      ? new Date(matched.expiryTime).toISOString()
      : null;
    if (!premiumUntil) {
      return json({ success: false, error: "no expiry" }, 200);
    }

    // 5) إن كان الإقرار معلّقاً → أقرّ الشراء عبر API (مطلوب من Google)
    if (sub?.acknowledgementState === "ACKNOWLEDGEMENT_STATE_PENDING") {
      const ackUrl =
        `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/` +
        `${PACKAGE_NAME}/purchases/subscriptions/${encodeURIComponent(String(productId))}` +
        `/tokens/${encodeURIComponent(String(purchaseToken))}:acknowledge`;
      await fetch(ackUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: "{}",
      }).catch(() => {
        /* الإقرار غير حرج للمنح؛ نتجاهل فشله بهدوء */
      });
    }

    // 6) منح Premium خادمياً (service role) — premium_until من Google
    await admin
      .from("profiles")
      .update({
        is_premium: true,
        premium_until: premiumUntil,
        plan_type: planType,
        payment_provider: "google_play",
        subscription_status: "active",
      })
      .eq("id", user.id);

    // 7) تسجيل/تحديث رمز الشراء (idempotent — لا يُمنح مرّتين لحساب آخر)
    await admin
      .from("google_play_purchases")
      .upsert(
        {
          purchase_token: String(purchaseToken),
          user_id: user.id,
          product_id: String(productId),
          premium_until: premiumUntil,
          status: "active",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "purchase_token" },
      );

    // 8) ردّ واضح
    return json({ success: true, ok: true, premium_until: premiumUntil });
  } catch (e) {
    // رسالة عامة فقط — لا نسرّب أسرار ولا الرمز كاملاً
    return json({ error: (e as Error).message || "error" }, 400);
  }
});
