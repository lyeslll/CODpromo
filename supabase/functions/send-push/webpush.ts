// ============================================================
//  CODpromo — Web Push بلا مكتبة: WebCrypto برك (Deno / المتصفّح / Node 20+).
//  - التشفير: RFC 8291 (aes128gcm، RFC 8188) — الرسالة ما يقراها حتى واحد غير الجهاز.
//  - التعريف: VAPID (RFC 8292) — JWT ES256 بالمفتاح الخاص (secret VAPID_PRIVATE_KEY برك).
//  مجرّب بمثال RFC 8291 (الملحق A): نفس البايتات بالضبط.
// ============================================================

const enc = new TextEncoder();

export function b64urlToBytes(s: string): Uint8Array {
  let b = s.replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
  while (b.length % 4) b += "=";
  const bin = atob(b);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToB64url(bytes: Uint8Array): string {
  let s = "";
  for (const x of bytes) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8));
}

/** مفتاح P-256 من الشكل الخام (65 بايت للعام، 32 للخاص) — JWK لـ WebCrypto. */
function ecJwk(publicRaw: Uint8Array, privateRaw?: Uint8Array): JsonWebKey {
  return {
    kty: "EC",
    crv: "P-256",
    x: bytesToB64url(publicRaw.slice(1, 33)),
    y: bytesToB64url(publicRaw.slice(33, 65)),
    ...(privateRaw ? { d: bytesToB64url(privateRaw) } : {}),
    ext: true,
  };
}

export interface EncryptOptions {
  /** للاختبار برك (مثال RFC): مفتاح الخادم المؤقت والملح. في الإرسال الحقيقي يتولّدو عشوائياً كل مرة. */
  asPublic?: Uint8Array;
  asPrivate?: Uint8Array;
  salt?: Uint8Array;
  recordSize?: number;
}

/** يشفّر الرسالة لجهاز واحد (p256dh + auth من اشتراكو). يرجّع جسم الطلب كامل (رأس aes128gcm + النص المشفّر). */
export async function encryptPayload(payload: Uint8Array, p256dh: string, authSecret: string, opts: EncryptOptions = {}): Promise<Uint8Array> {
  const uaPublic = b64urlToBytes(p256dh);
  const auth = b64urlToBytes(authSecret);
  if (uaPublic.length !== 65 || uaPublic[0] !== 4 || auth.length !== 16) throw new Error("bad_subscription_keys");

  let asPrivateKey: CryptoKey;
  let asPublic: Uint8Array;
  if (opts.asPrivate && opts.asPublic) {
    asPublic = opts.asPublic;
    asPrivateKey = await crypto.subtle.importKey("jwk", ecJwk(asPublic, opts.asPrivate), { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
  } else {
    const pair = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
    asPrivateKey = pair.privateKey;
    asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  }
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, asPrivateKey, 256));

  const keyInfo = concat(enc.encode("WebPush: info\0"), uaPublic, asPublic);
  const ikm = await hkdf(auth, ecdhSecret, keyInfo, 32);
  const salt = opts.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);

  // سجل واحد: الرسالة + 0x02 (آخر سجل)، بلا حشو
  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, concat(payload, new Uint8Array([2]))));

  const header = new Uint8Array(16 + 4 + 1 + asPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, opts.recordSize ?? 4096);
  header[20] = asPublic.length;
  header.set(asPublic, 21);
  return concat(header, cipher);
}

export interface VapidKeys {
  publicKey: string; // b64url، 65 بايت (نفس اللي في الواجهة: applicationServerKey)
  privateKey: string; // b64url، 32 بايت (secret برك)
  subject: string; // mailto: ولا https:
}

const signingKeys = new Map<string, Promise<CryptoKey>>();
const jwtCache = new Map<string, { value: string; exp: number }>();

function signingKey(keys: VapidKeys): Promise<CryptoKey> {
  let k = signingKeys.get(keys.publicKey);
  if (!k) {
    k = crypto.subtle.importKey(
      "jwk",
      ecJwk(b64urlToBytes(keys.publicKey), b64urlToBytes(keys.privateKey)),
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"],
    );
    signingKeys.set(keys.publicKey, k);
  }
  return k;
}

/** رأس Authorization لخدمة push (JWT واحد لكل خدمة، 12 ساعة، محفوظ في الذاكرة). */
export async function vapidAuthorization(endpoint: string, keys: VapidKeys): Promise<string> {
  const aud = new URL(endpoint).origin;
  const now = Math.floor(Date.now() / 1000);
  const hit = jwtCache.get(aud);
  if (hit && hit.exp - now > 600) return `vapid t=${hit.value}, k=${keys.publicKey}`;
  const exp = now + 12 * 3600;
  const head = bytesToB64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = bytesToB64url(enc.encode(JSON.stringify({ aud, exp, sub: keys.subject })));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, await signingKey(keys), enc.encode(`${head}.${body}`)));
  const value = `${head}.${body}.${bytesToB64url(sig)}`;
  jwtCache.set(aud, { value, exp });
  return `vapid t=${value}, k=${keys.publicKey}`;
}

export type PushResult = "ok" | "gone" | "failed";

/** يبعث رسالة مشفّرة لجهاز. 404/410 = الجهاز ما بقاش (يتوقّف)، الباقي فشل مؤقت. */
export async function sendWebPush(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: unknown,
  keys: VapidKeys,
  ttlSeconds = 86400,
): Promise<{ result: PushResult; status: number }> {
  try {
    const body = await encryptPayload(enc.encode(JSON.stringify(payload)), sub.p256dh, sub.auth);
    const res = await fetch(sub.endpoint, {
      method: "POST",
      headers: {
        Authorization: await vapidAuthorization(sub.endpoint, keys),
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: String(ttlSeconds),
        Urgency: "normal",
      },
      body,
      redirect: "manual",
    });
    await res.body?.cancel();
    if (res.status >= 200 && res.status < 300) return { result: "ok", status: res.status };
    if (res.status === 404 || res.status === 410) return { result: "gone", status: res.status };
    return { result: "failed", status: res.status };
  } catch (e) {
    return { result: (e as Error).message === "bad_subscription_keys" ? "gone" : "failed", status: 0 };
  }
}
