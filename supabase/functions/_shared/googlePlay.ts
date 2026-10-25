// ============================================================
//  CODpromo — Google Play Developer API (حساب الخدمة) للمفاتيح الماسية (phase37)
//  نفس المصادقة اللي في verify-play-purchase (JWT موقّع بحساب الخدمة GOOGLE_PLAY_SERVICE_ACCOUNT_JSON،
//  ما يتطبعش أبداً) — نسخة مستقلة باش verify-play-purchase تبقى كيما راهي.
// ============================================================

export const PACKAGE_NAME = "com.codpromo.twa";
export const PLAY_API = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}`;

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("pkcs8", der.buffer, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
}

export async function googleAccessToken(): Promise<string> {
  const raw = Deno.env.get("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON") ?? "";
  if (!raw) throw new Error("missing service account");
  const sa = JSON.parse(raw) as { client_email: string; private_key: string };
  const now = Math.floor(Date.now() / 1000);
  const enc = new TextEncoder();
  const signingInput =
    b64url(enc.encode(JSON.stringify({ alg: "RS256", typ: "JWT" }))) +
    "." +
    b64url(
      enc.encode(
        JSON.stringify({
          iss: sa.client_email,
          scope: "https://www.googleapis.com/auth/androidpublisher",
          aud: "https://oauth2.googleapis.com/token",
          iat: now,
          exp: now + 3600,
        }),
      ),
    );
  const key = await importPrivateKey(sa.private_key);
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(signingInput)));
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=" + encodeURIComponent(`${signingInput}.${b64url(sig)}`),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.access_token) throw new Error("google auth failed");
  return data.access_token as string;
}

const tokenPath = (sku: string, token: string) =>
  `${PLAY_API}/purchases/products/${encodeURIComponent(sku)}/tokens/${encodeURIComponent(token)}`;

/** purchases.products.get — مصدر الحقيقة (purchaseState، purchaseType، acknowledgementState، consumptionState). */
export async function getProductPurchase(accessToken: string, sku: string, token: string) {
  const res = await fetch(tokenPath(sku, token), { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

/** acknowledge ثم consume (منتوج consumable: يتشرى بزاف المرات). أي فشل يتعاود في المزامنة الجاية. */
export async function acknowledgeAndConsume(accessToken: string, sku: string, token: string, p: { acknowledgementState?: number; consumptionState?: number }) {
  const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
  let acknowledged = p.acknowledgementState === 1;
  let consumed = p.consumptionState === 1;
  if (!acknowledged) {
    const r = await fetch(`${tokenPath(sku, token)}:acknowledge`, { method: "POST", headers, body: "{}" }).catch(() => null);
    acknowledged = !!r?.ok;
  }
  if (!consumed) {
    const r = await fetch(`${tokenPath(sku, token)}:consume`, { method: "POST", headers }).catch(() => null);
    consumed = !!r?.ok;
  }
  return { acknowledged, consumed };
}
