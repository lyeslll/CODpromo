import { supabase } from "./supabaseClient.js";
import { FREE_KEY_SOURCES } from "./freeKey.js";
import { premiumPath } from "./seo.js";

// ============================================================
//  المفاتيح الماسية (phase37): مفاتيح تتشرى — كل مفتاح يفتح كود Premium تاع شركة وحدة، للأبد.
//  الرصيد في دفتر حركات في القاعدة (key_ledger) ما يتبدّلش من المتصفّح: كل شي عبر RPCs و Edge Functions.
//  السعر، الحدّ، والرصيد اللي ينقص من Premium يتحسبو في الخادم — المتصفّح ما يبعث حتى مبلغ.
//
//  معاينة بلا دفع (preview تاع Vercel و npm run dev برك — KEYS_DEMO): الشراء ما يمشيش للبوابة أبداً
//  (يروح لـ /keys/return?demo=…)، والبيانات تجريبية (3 مفاتيح، تاريخ، رصيد) ما دام ?keys_demo=0 ما تحطّش.
//  في build الإنتاج KEYS_DEMO = false وكل هاد الكود يتنحّى.
// ============================================================

export const KEYS_DEMO = import.meta.env.DEV || __PURCHASE_DEMO__;
const DEMO_FLAG = "codpromo:keys-demo";

/** المعاينة: البيانات التجريبية مشغولة (افتراضياً) — ?keys_demo=0 يطفيها، ?keys_demo=1 يرجّعها. */
export function keysDemoOn() {
  if (!KEYS_DEMO || typeof window === "undefined") return false;
  try {
    const q = new URLSearchParams(window.location.search).get("keys_demo");
    if (q === "0" || q === "1") sessionStorage.setItem(DEMO_FLAG, q);
    return sessionStorage.getItem(DEMO_FLAG) !== "0";
  } catch {
    return true;
  }
}

async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    const e = new Error(error.message);
    e.code = error.code;
    throw e;
  }
  return data;
}

// ===================== القراءة =====================
// null يبقى null (Number(null) = 0): الزائر ما عندوش حدّ (max_keys = null)، ماشي حدّ 0
const num = (v) => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** { blocked, locked, balance, pending, maxKeys, testExpiresAt, packs: [{ id, keys, priceDzd, priceUsd, tier, fits, playProductId }] } */
export async function fetchKeyPacks() {
  const d = await rpc("my_key_packs");
  return {
    blocked: d?.blocked === true,
    locked: num(d?.locked),
    balance: num(d?.balance),
    pending: num(d?.pending),
    maxKeys: num(d?.max_keys),
    testExpiresAt: d?.test_expires_at || null,
    packs: (d?.packs || []).map((p) => ({
      id: p.id,
      keys: Number(p.keys),
      priceDzd: num(p.price_dzd),
      priceUsd: num(p.price_usd),
      tier: p.tier === "test" ? "test" : "regular",
      fits: p.fits !== false,
      playProductId: p.play_product_id,
    })),
  };
}

/** الرصيد اللي ينقص من Premium (الموقع برك) — للعرض، الخادم يعاود يحسب عند الدفع. */
export function mapCredit(c) {
  if (!c || c.status !== "ok") return null;
  return {
    tier: c.tier,
    priceDzd: num(c.price_dzd),
    priceUsd: num(c.price_usd),
    paidDzd: num(c.paid_dzd),
    paidUsd: num(c.paid_usd),
    creditDzd: num(c.credit_dzd) ?? 0,
    creditUsd: num(c.credit_usd) ?? 0,
    appliedDzd: num(c.applied_dzd) ?? 0,
    appliedUsd: num(c.applied_usd) ?? 0,
    dueDzd: num(c.due_dzd),
    dueUsd: num(c.due_usd),
    covered: c.covered === true,
  };
}

/** حالة مفاتيحي: { status: "guest" | "ok", balance, blocked, locked, pending, unlocked: [id], history: [...], credit } */
export async function fetchMyKeys() {
  const d = await rpc("my_keys");
  if (!d || d.status !== "ok") return { status: "guest" };
  return {
    status: "ok",
    balance: Number(d.balance) || 0,
    blocked: d.blocked === true,
    locked: num(d.locked),
    pending: num(d.pending) || 0,
    unlocked: (d.unlocked || []).map(Number),
    history: d.history || [],
    credit: mapCredit(d.credit),
  };
}

export const fetchCreditQuote = async () => mapCredit(await rpc("keys_credit_quote"));

/** status: ok | yours | free_key | no_keys | has_premium | unavailable | auth (+ premium_code / premium_url، balance) */
export const spendDiamondKey = (companyId, source) =>
  rpc("use_diamond_key", { p_company_id: companyId, p_source: FREE_KEY_SOURCES.includes(source) ? source : "other" });

/** كود شركة مفتوحة بمفتاح ماسي (نفس الحساب برك) → { premium_code, premium_url } ولا null. */
export async function fetchDiamondCode(companyId) {
  const rows = await rpc("get_diamond_code", { p_company_id: companyId });
  return Array.isArray(rows) ? rows[0] || null : rows || null;
}

/** Premium بالرصيد كامل (الموقع برك): status ok | not_covered | has_premium | auth */
export const redeemPremiumWithCredit = () => rpc("keys_premium_redeem");

/** آخر تفعيل Premium بالرصيد (صفحة النجاح) ولا null */
export const fetchMyCreditUpgrade = () => rpc("my_credit_upgrade");

// ===================== الدفع (Edge Functions) =====================
async function invoke(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let payload = null;
    try {
      payload = await error.context?.json?.();
    } catch {
      /* ردّ بلا JSON */
    }
    const e = new Error(payload?.error || error.message || "payment");
    e.code = payload?.code || payload?.error || null;
    e.maxKeys = payload?.max_keys ?? null;
    throw e;
  }
  return data;
}

const ORDER_KEY = "codpromo:keys-order";

/** يبدا شراء باقة: provider = stripe | slickpay | paypal. المعاينة → صفحة الرجوع التجريبية بلا بوابة. */
export async function startKeysCheckout(provider, packId) {
  if (KEYS_DEMO) {
    window.location.assign(`/keys/return?demo=${provider}&pack=${encodeURIComponent(packId)}`);
    return;
  }
  const data = await invoke("keys-checkout", { provider, pack: packId });
  if (!data?.keys || !data?.url) {
    const e = new Error("outdated");
    e.code = "outdated";
    throw e;
  }
  try {
    sessionStorage.setItem(ORDER_KEY, JSON.stringify({ provider, ref: data.ref, at: Date.now() }));
  } catch {
    /* صفحة الرجوع تلقى آخر طلب معلّق في الخادم */
  }
  window.location.href = data.url;
}

export function readKeysOrder() {
  try {
    const o = JSON.parse(sessionStorage.getItem(ORDER_KEY) || "null");
    return o && Date.now() - Number(o.at) < 6 * 3600 * 1000 ? o : null;
  } catch {
    return null;
  }
}

export function clearKeysOrder() {
  try {
    sessionStorage.removeItem(ORDER_KEY);
  } catch {
    /* تجاهل آمن */
  }
}

/** بعد الرجوع: { status: paid | pending | failed | mismatch, count } */
export const confirmKeysOrder = (provider, ref) => invoke("keys-confirm", { provider, ref: ref || null });

/** الطلبات المعلّقة (دفع كمل والمتصفّح تسكّر) → { paid } */
export const syncKeysOrders = () => invoke("keys-confirm", { provider: "sync" });

/**
 * Premium بالرصيد عبر البوابة (الباقي برك). نفس صفحات الرجوع تاع Premium. covered / no_credit → e.code.
 * المعاينة: صفحة نجاح تجريبية.
 */
export async function startCreditCheckout(provider) {
  if (KEYS_DEMO) {
    window.location.assign(`/payment-success?demo=${provider}&credit=1`);
    return;
  }
  const data = await invoke("premium-credit-checkout", { provider });
  if (!data?.lifetime || !data?.url) {
    const e = new Error("outdated");
    e.code = "outdated";
    throw e;
  }
  try {
    if (data.invoice_id) sessionStorage.setItem("codpromo:slickpay-invoice", data.invoice_id);
    if (data.order_id) sessionStorage.setItem("codpromo:paypal-order", data.order_id);
  } catch {
    /* صفحات الرجوع تقرا من الخادم */
  }
  window.location.href = data.url;
}

// ===================== الباقة المعلّقة (زائر بلا حساب) =====================
// الزائر يختار باقة → التسجيل / الدخول → يرجع لـ /premium?keys=<pack> (قسم المفاتيح + النافذة تتحلّ).
// بلا # في الرابط: رابط الرجوع تاع Google / تأكيد الإيميل يمرّ على Supabase Auth.
const PENDING_KEY = "codpromo:keys-pending";
const PENDING_TTL = 60 * 60 * 1000;

export function setPendingKeys(packId, lang = "ar") {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ pack: String(packId || ""), lang, at: Date.now() }));
  } catch {
    /* يرجع للباقات بيدو */
  }
}

export function clearPendingKeys() {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* تجاهل آمن */
  }
}

/** مسار الرجوع بعد الدخول / التسجيل ولا null */
export function pendingKeysPath() {
  try {
    const p = JSON.parse(sessionStorage.getItem(PENDING_KEY) || "null");
    if (!p || !(Date.now() - Number(p.at) < PENDING_TTL)) return null;
    const lang = ["ar", "en", "fr"].includes(p.lang) ? p.lang : "ar";
    const pack = /^[a-z0-9_]{2,40}$/.test(p.pack || "") ? p.pack : "";
    return `${premiumPath(lang)}?keys=${pack || "1"}`;
  } catch {
    return null;
  }
}

// ===================== المعاينة =====================
/** بيانات تجريبية (المعاينة برك): 3 مفاتيح، تاريخ قصير، رصيد 2,300 دج من سعر Premium الحالي. */
export function demoKeys(pricing) {
  const priceDzd = pricing?.dzd ?? null;
  const priceUsd = pricing?.usd ?? null;
  const paidDzd = 2300;
  const ratio = pricing?.dzd && pricing?.usd ? pricing.dzd / pricing.usd : null;
  const creditUsd = ratio ? Math.floor((paidDzd / ratio) * 100) / 100 : 0;
  const now = Date.now();
  return {
    status: "ok",
    demo: true,
    balance: 3,
    blocked: false,
    locked: null,
    pending: 0,
    unlocked: [],
    history: [
      { id: -3, kind: "purchase", delta: 5, created_at: new Date(now - 2 * 864e5).toISOString(), provider: "slickpay", order_keys: 5 },
      { id: -2, kind: "use", delta: -1, created_at: new Date(now - 864e5).toISOString(), company: null },
      { id: -1, kind: "gift", delta: 2, created_at: new Date(now - 36e5).toISOString() },
    ],
    credit:
      priceDzd != null
        ? {
            tier: pricing.tier,
            priceDzd,
            priceUsd,
            paidDzd,
            paidUsd: 0,
            creditDzd: paidDzd,
            creditUsd,
            appliedDzd: Math.min(paidDzd, priceDzd),
            appliedUsd: Math.min(creditUsd, priceUsd ?? 0),
            dueDzd: Math.max(priceDzd - paidDzd, 0),
            dueUsd: priceUsd != null ? Math.round(Math.max(priceUsd - creditUsd, 0) * 100) / 100 : null,
            covered: false,
          }
        : null,
  };
}

export function demoPacks() {
  return {
    blocked: false,
    locked: null,
    balance: 3,
    pending: 0,
    maxKeys: null,
    testExpiresAt: null,
    packs: [
      { id: "pack3", keys: 3, priceDzd: 900, priceUsd: 4, tier: "regular", fits: true, playProductId: "codpromo_keys_3" },
      { id: "pack5", keys: 5, priceDzd: 1400, priceUsd: 6, tier: "regular", fits: true, playProductId: "codpromo_keys_5" },
    ],
  };
}
