// ============================================================
//  CODpromo — ملف العروض العام لـ ilyesderradji.com (schema codpromo.offers.v1)
//  ملف بلا أي import: نفس الكود في api/offers-feed.js و api/go.js و scripts/test-offers-feed.mjs.
//  العقد: docs/codpromo-feed.md تاع مشروع ilyesderradji.com. شكون يدخل = القاعدة برك
//  (offers_feed_v1 / offers_feed_ok في supabase-phase-offers-feed.sql)؛ هنا الشكل برك.
//  Premium ما يدخلش أصلاً: القاعدة ما ترجّعش حتى عمود Premium (غير has_premium نعم/لا).
// ============================================================

export const FEED_SCHEMA = "codpromo.offers.v1";
export const FEED_SITE = "https://codpromo.com";
export const FEED_SOURCE = `${FEED_SITE}/offers`;
export const FEED_MAX_OFFERS = 500;
// العقد: ≤ 512 KB — نخلّيو هامش صغير
export const FEED_MAX_BYTES = 512 * 1024 - 2048;
// ?src= في رابط التحويل: كلمة من هاد القائمة برك (والباقي = "other" في القاعدة)
export const FEED_SOURCES = ["ilyesderradji"];
// <slug>--<id> (نفس offers_feed_id في القاعدة): "--" ما يكونش في slug عرض بلا كود
export const FEED_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*--[0-9]{1,18}$/;

const BRAND_SLUG_RE = /^[a-z0-9-]{1,64}$/;
const CODE_RE = /^[A-Za-z0-9_-]{1,32}$/;
const TOP_KEYS = ["schema", "generated_at", "source", "count", "offers"];
// المفاتيح اللي تخرج في كل عرض — حتى مفتاح آخر ما يخرج (العقد + store_url و has_premium)
export const OFFER_KEYS = [
  "id", "brand", "brand_slug", "title_ar", "kind", "code", "url", "value", "category", "logo",
  "starts_at", "ends_at", "checked_at", "tier", "store_url", "has_premium",
];
const VALUE_KEYS = ["type", "amount", "currency", "label_ar"];

// نصوص صفحتي /go/<id> (العربية): نسخة من src/i18n/locales/ar.json (go.* و notFound.*) — الدالة
// Edge ما تقراش ملفات الترجمة. scripts/test-offers-feed.mjs يتأكّد بلي هوما نفس النص بالحرف.
export const GO_TEXT = {
  title: "جارٍ التحويل",
  redirectTo: "جارٍ تحويلك إلى {{name}}…",
  fallback: "لم يتمّ التحويل؟ اضغط هنا",
  error: "تعذّر الاتصال. تحقّق من الإنترنت ثم أعد المحاولة.",
  retry: "أعد المحاولة",
  kicker: "هذا الرابط لم يعد صالحاً",
  notFound: "الصفحة غير موجودة",
  notFoundDesc: "ربما تغيّر الرابط أو انتهى العرض. العروض الحالية كلها في صفحة العروض.",
  offers: "تصفّح العروض",
  home: "الرئيسية",
};
// المفتاح في ar.json لكل نص فوق
export const GO_TEXT_KEYS = {
  title: "go.title", redirectTo: "go.redirectTo", fallback: "go.fallback", error: "go.error", retry: "go.retry",
  kicker: "notFound.kicker", notFound: "notFound.title", notFoundDesc: "notFound.desc", offers: "notFound.offers", home: "notFound.home",
};

// ===================== التنظيف =====================
/** نص برك: بلا HTML، بلا حروف تحكّم (C0 / C1) ولا علامات اتجاه مدمجة، فراغ واحد. */
export function plainText(v) {
  const s = String(v == null ? "" : v).replace(/<[^>]*>/g, " ");
  let out = "";
  for (const ch of s) {
    const c = ch.codePointAt(0);
    const control = c < 32 || (c >= 127 && c < 160) || (c >= 0x202a && c <= 0x202e) || (c >= 0x2066 && c <= 0x2069);
    out += control ? " " : ch;
  }
  return out.replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
}

/** قصّ بالحروف (ماشي بالبايت)، نفس mb_substr في القارئ. */
export function clip(s, n) {
  const a = Array.from(String(s || ""));
  return a.length > n ? a.slice(0, n).join("").trim() : a.join("");
}

/** رابط https صالح (بلا اسم/كلمة سر داخل الرابط) ولا null. */
export function httpsUrl(v) {
  if (typeof v !== "string" || !/^https:\/\//.test(v)) return null;
  try {
    const u = new URL(v);
    if (u.protocol !== "https:" || u.username || u.password || !u.hostname.includes(".")) return null;
    return u.href;
  } catch {
    return null;
  }
}

// ===================== حقول العرض =====================
/** نفس offers_feed_id في القاعدة: "<slug>--<id>" (slug ماشي صالح → "offer"، 44 حرف كأقصى). */
export function feedOfferId(slug, id) {
  const s = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug || "") ? slug : "offer";
  return `${s.slice(0, 44).replace(/-+$/, "")}--${id}`;
}
export const feedGoUrl = (id) => `${FEED_SITE}/go/${id}?src=${FEED_SOURCES[0]}`;
export const feedStoreUrl = (slug) => (slug ? `${FEED_SITE}/store/${encodeURIComponent(slug)}` : null);

// اللوغوهات اللي يرفعهم الأدمين (bucket logos). partner-logos فيه معرّف حساب الشركة في المسار → ما يخرجش.
const LOGO_PREFIX = "https://uulcgvdsqivgkiulurhk.supabase.co/storage/v1/object/public/logos/";

/** اللوغو: من bucket logos برك، بالحجم (WebP وحدو كي يقبلو المتصفّح، نفس logoSrc)، ولا null. */
export function feedLogo(logo) {
  const url = httpsUrl(logo);
  if (!url || !url.startsWith(LOGO_PREFIX) || !/^[A-Za-z0-9._-]+$/.test(url.slice(LOGO_PREFIX.length))) return null;
  if (/\.svg$/i.test(url)) return url;
  return `${url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/")}?width=256&height=256&resize=contain&quality=80`;
}

const num = (s) => {
  const n = Number(String(s).replace(/,(?=\d{3}(?:\D|$))/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/** القيمة: "10%" → percent، "5$" / "500 دج" / "5€" → amount بالعملة، والباقي text. */
export function parseValue(raw) {
  const s = plainText(raw);
  let m = s.match(/^(\d+(?:[.,]\d+)?)\s*%$/);
  if (m) return { type: "percent", amount: num(m[1]), currency: null };
  m = s.match(/^(\d+(?:[.,]\d+)?)\s*\$$/) || s.match(/^\$\s*(\d+(?:[.,]\d+)?)$/);
  if (m) return { type: "amount", amount: num(m[1]), currency: "USD" };
  m = s.match(/^(\d+(?:[.,]\d+)?)\s*€$/) || s.match(/^€\s*(\d+(?:[.,]\d+)?)$/);
  if (m) return { type: "amount", amount: num(m[1]), currency: "EUR" };
  m = s.match(/^(\d+(?:[.,]\d+)?)\s*(?:دج|د\.ج|DA|DZD)$/i);
  if (m) return { type: "amount", amount: num(m[1]), currency: "DZD" };
  return { type: "text", amount: null, currency: null };
}

/** العنوان بالفصحى من نوع العرض وقيمتو العادية: "خصم 10%"، "كاش باك 10$"، "كوبون بقيمة 5$"، ولا القيمة كيما هي. */
export function feedTitle(type, raw, brand) {
  const d = plainText(raw);
  if (!d) return `كود خصم ${brand}`;
  const shape = parseValue(d).type;
  if (type === "كاش باك") return /كاش ?باك|cash ?back/i.test(d) ? d : `كاش باك ${d}`;
  if (shape === "percent") return `خصم ${d}`;
  if (shape === "amount") return type === "كوبون" ? `كوبون بقيمة ${d}` : `خصم ${d}`;
  return d;
}

const day = (v) => {
  if (!v) return null;
  const t = new Date(v);
  return Number.isNaN(t.getTime()) ? null : t.toISOString().slice(0, 10);
};

/**
 * سطر من offers_feed_v1() → عرض بالعقد، ولا null إذا ما يحترمش العقد.
 * الأعمدة المقروءة: feed_id، brand_slug، slug، name، type، discount، code، logo، code_checked_at، has_premium.
 */
export function buildOffer(r) {
  const id = String(r?.feed_id || "");
  const brandSlug = String(r?.brand_slug || "");
  const code = String(r?.code || "").trim();
  if (!FEED_ID_RE.test(id) || id.length > 64 || !BRAND_SLUG_RE.test(brandSlug) || !CODE_RE.test(code)) return null;
  const brand = clip(plainText(r.name), 80) || brandSlug;
  const title = clip(feedTitle(r.type, r.discount, brand), 140);
  const v = parseValue(r.discount);
  return {
    id,
    brand,
    brand_slug: brandSlug,
    title_ar: title,
    kind: "code",
    code,
    url: feedGoUrl(id),
    value: { type: v.type, amount: v.amount, currency: v.currency, label_ar: clip(title, 60) },
    category: null,
    logo: feedLogo(r.logo),
    starts_at: null,
    ends_at: null,
    checked_at: day(r.code_checked_at),
    tier: "regular",
    store_url: feedStoreUrl(r.slug),
    has_premium: r.has_premium === true,
  };
}

/** الملف كامل (≤ 500 عرض، بلا id مكرّر). */
export function buildFeed(rows, now = new Date()) {
  const seen = new Set();
  const offers = [];
  for (const r of rows || []) {
    const o = buildOffer(r);
    if (!o || seen.has(o.id)) continue;
    seen.add(o.id);
    offers.push(o);
    if (offers.length >= FEED_MAX_OFFERS) break;
  }
  return {
    schema: FEED_SCHEMA,
    generated_at: now.toISOString().replace(/\.\d{3}Z$/, "Z"),
    source: FEED_SOURCE,
    count: offers.length,
    offers,
  };
}

const bytes = (s) => new TextEncoder().encode(s).length;

/** JSON مضغوط ≤ 512 KB: إذا فات، نحيّدو آخر العروض (الأقدم) حتى يدخل. */
export function feedBody(feed) {
  let f = feed;
  let body = JSON.stringify(f);
  while (bytes(body) > FEED_MAX_BYTES && f.offers.length) {
    const offers = f.offers.slice(0, -1);
    f = { ...f, count: offers.length, offers };
    body = JSON.stringify(f);
  }
  return body;
}

// ===================== الفحص (نفس قواعد القارئ تاع ilyesderradji.com + حماية زايدة) =====================
const isDate = (v) => typeof v === "string" && !Number.isNaN(Date.parse(v));
// كلمات ما لازمش تبان أبداً في الملف (أعمدة داخلية، أعضاء، مفاتيح)
const FORBIDDEN = [
  "premium_code", "premium_url", "premium_discount", "premium_description", "premium_coming_soon",
  "coming_soon", "website_url", "whatsapp", "contact_", "commission", "affiliate_", "notes", "email",
  "user_id", "visitor", "clicks", "status", "ilyes_visible", "apikey", "sb_publishable", "service_role",
  "/rest/v1", "/rpc/", "partner-logos", "@",
];
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * يفحص نص الملف (body) حسب العقد ويرجّع قائمة المشاكل (فارغة = صالح).
 * opts.now للتجربة؛ opts.strictUrl = الرابط لازم /go/<id>?src=ilyesderradji (افتراضياً true).
 */
export function checkFeed(body, opts = {}) {
  const now = opts.now ? new Date(opts.now).getTime() : Date.now();
  const strictUrl = opts.strictUrl !== false;
  const problems = [];
  const bad = (m) => problems.push(m);
  if (typeof body !== "string") return ["body is not a string"];
  if (bytes(body) > 512 * 1024) bad(`size ${bytes(body)} > 512 KB`);
  let data;
  try {
    data = JSON.parse(body);
  } catch {
    return [...problems, "not JSON"];
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return [...problems, "not an object"];
  for (const k of Object.keys(data)) if (!TOP_KEYS.includes(k)) bad(`unknown top key ${k}`);
  if (data.schema !== FEED_SCHEMA) bad("schema");
  if (!isDate(data.generated_at) || !/Z$/.test(data.generated_at)) bad("generated_at (ISO UTC)");
  if (data.source !== FEED_SOURCE) bad("source");
  if (!Array.isArray(data.offers)) return [...problems, "offers is not a list"];
  if (data.offers.length > FEED_MAX_OFFERS) bad(`offers ${data.offers.length} > 500`);
  if (data.count !== data.offers.length) bad("count != offers.length");
  const low = body.toLowerCase();
  for (const w of FORBIDDEN) if (low.includes(w.toLowerCase())) bad(`forbidden text "${w}"`);
  // مفتاح JWT (يبدا بـ eyJ) ولا معرّف حساب (UUID)
  if (body.includes("eyJ")) bad('forbidden text "eyJ"');
  if (UUID_RE.test(body)) bad("a UUID (account id?) in the feed");
  const ids = new Set();
  data.offers.forEach((o, i) => {
    const at = `offer ${i} (${o?.id})`;
    if (!o || typeof o !== "object" || Array.isArray(o)) return bad(`${at}: not an object`);
    for (const k of Object.keys(o)) if (!OFFER_KEYS.includes(k)) bad(`${at}: unknown key ${k}`);
    for (const k of OFFER_KEYS) if (!(k in o)) bad(`${at}: missing ${k}`);
    if (o.tier !== "regular") bad(`${at}: tier`);
    if ("premium" in o) bad(`${at}: premium key`);
    if (typeof o.id !== "string" || !/^[a-z0-9-]{1,64}$/.test(o.id) || !FEED_ID_RE.test(o.id)) bad(`${at}: id`);
    if (ids.has(o.id)) bad(`${at}: duplicate id`);
    ids.add(o.id);
    if (typeof o.brand_slug !== "string" || !BRAND_SLUG_RE.test(o.brand_slug)) bad(`${at}: brand_slug`);
    if (o.kind !== "code") bad(`${at}: kind`);
    if (typeof o.code !== "string" || !CODE_RE.test(o.code)) bad(`${at}: code`);
    if (httpsUrl(o.url) !== o.url) bad(`${at}: url not https`);
    if (strictUrl && o.url !== feedGoUrl(o.id)) bad(`${at}: url is not ${FEED_SITE}/go/<id>?src=${FEED_SOURCES[0]}`);
    if (typeof o.brand !== "string" || !o.brand || Array.from(o.brand).length > 80) bad(`${at}: brand`);
    if (typeof o.title_ar !== "string" || !o.title_ar || Array.from(o.title_ar).length > 140 || plainText(o.title_ar) !== o.title_ar) bad(`${at}: title_ar`);
    const v = o.value;
    if (!v || typeof v !== "object") bad(`${at}: value`);
    else {
      for (const k of Object.keys(v)) if (!VALUE_KEYS.includes(k)) bad(`${at}: unknown value key ${k}`);
      if (!["percent", "amount", "text"].includes(v.type)) bad(`${at}: value.type`);
      if (!(v.amount === null || (typeof v.amount === "number" && Number.isFinite(v.amount)))) bad(`${at}: value.amount`);
      if (!(v.currency === null || ["USD", "EUR", "DZD"].includes(v.currency))) bad(`${at}: value.currency`);
      if (typeof v.label_ar !== "string" || Array.from(v.label_ar).length > 60) bad(`${at}: value.label_ar`);
      if (v.type !== "text" && v.amount === null) bad(`${at}: value.amount missing`);
    }
    if (!(o.category === null || (typeof o.category === "string" && /^[a-z0-9_-]{1,64}$/.test(o.category)))) bad(`${at}: category`);
    if (!(o.logo === null || httpsUrl(o.logo) === o.logo)) bad(`${at}: logo`);
    if (!(o.starts_at === null || isDate(o.starts_at))) bad(`${at}: starts_at`);
    if (!(o.ends_at === null || isDate(o.ends_at))) bad(`${at}: ends_at`);
    if (o.ends_at && Date.parse(o.ends_at) < now) bad(`${at}: expired`);
    if (!(o.checked_at === null || /^\d{4}-\d{2}-\d{2}$/.test(o.checked_at))) bad(`${at}: checked_at`);
    if (!(o.store_url === null || (httpsUrl(o.store_url) === o.store_url && o.store_url.startsWith(`${FEED_SITE}/store/`)))) bad(`${at}: store_url`);
    if (typeof o.has_premium !== "boolean") bad(`${at}: has_premium`);
  });
  return problems;
}
