import { supabase } from "./supabaseClient.js";
import { offersLink } from "./seo.js";

// ============================================================
//  المفتاح الذهبي (phase31): كل حساب يكشف كود Premium واحد مجاناً، مرة وحدة في حياتو،
//  على الشركة اللي يختارها. المفتاح ما يعطيش Premium: الشركات الأخرى تبقى مقفولة.
//  الجدول free_reveals مقفول (RLS بلا سياسات): كل شي يمرّ عبر دوال RPC.
// ============================================================

/** مصادر الكشف المقبولة في القاعدة (نفس قيم code_copies.source). */
export const FREE_KEY_SOURCES = ["home", "offers", "featured", "store", "category", "favorites", "dashboard", "other"];

// ===================== الشركة المعلّقة (زائر بلا حساب) =====================
// الزائر يضغط على البطاقة المقفولة → نحفظو الشركة، ومن بعد الدخول / التسجيل (حتى بـ Google،
// ولا رابط تأكيد الإيميل) يرجع لنفس البطاقة في /offers?mode=premium&fk=<id> والتأكيد يتحلّ وحدو.
const PENDING_KEY = "codpromo:free-key-pending";
const PENDING_TTL = 60 * 60 * 1000;

const validId = (v) => {
  const n = Number(v);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};

/** companyId = null → بلا شركة (زر "سجّل واحصل على مفتاحك" في الرئيسية). */
export function setPendingFreeKey(companyId, lang = "ar") {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ id: validId(companyId), lang, at: Date.now() }));
  } catch {
    /* sessionStorage غير متاح — الزائر يرجع للبطاقة بيدو */
  }
}

export function getPendingFreeKey() {
  try {
    const p = JSON.parse(sessionStorage.getItem(PENDING_KEY) || "null");
    if (!p || typeof p !== "object" || !(Date.now() - Number(p.at) < PENDING_TTL)) return null;
    return { id: validId(p.id), lang: ["ar", "en", "fr"].includes(p.lang) ? p.lang : "ar" };
  } catch {
    return null;
  }
}

export function clearPendingFreeKey() {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* تجاهل آمن */
  }
}

/** صفحة الرجوع: البطاقة نفسها في /offers (وضع Premium)، fk = الشركة اللي ضغط عليها. */
export const freeKeyReturnPath = (companyId, lang = "ar") => {
  const base = offersLink(lang, { mode: "premium" });
  const id = validId(companyId);
  return id ? `${base}&fk=${id}` : base;
};

/** مسار الرجوع المعلّق (لتحويل الزائر بعد الدخول) أو null. */
export const pendingFreeKeyPath = () => {
  const p = getPendingFreeKey();
  return p ? freeKeyReturnPath(p.id, p.lang) : null;
};

/** ?fk=<id> في الرابط → الشركة اللي نرجّعو ليها، وإلا null. */
export const readFreeKeyParam = (search) => validId(new URLSearchParams(search || "").get("fk"));

// ===================== المستخدم =====================
async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}

/** للجميع: { enabled, reveals } — reveals = عدد الكشوفات المجانية (null تحت 50). */
export const fetchFreeKeyPublic = () => rpc("free_key_public");

/**
 * حالة مفتاحي: { status: "available" | "used" | "premium", enabled, company_id?, company?, created_at?, inbox? }.
 * company = { id, name, slug, logo, type } للشركة اللي كشفها (null إذا تمسحت).
 * inbox = true: حساب آخر بنفس البريد (نقاط Gmail / "+") استعمل المفتاح — مفتاح واحد لكل بريد (phase31c).
 */
export const fetchMyFreeKey = () => rpc("get_my_free_key");

/**
 * استعمال المفتاح على شركة. status: ok | yours | auth | used | inbox_used | disabled | has_premium | unavailable
 * | disposable | unconfirmed. ok / yours يرجّعو premium_code و premium_url.
 */
export const claimFreeReveal = (companyId, source) =>
  rpc("claim_free_reveal", { p_company_id: companyId, p_source: FREE_KEY_SOURCES.includes(source) ? source : "other" });

// ===================== الأدمن (كل دالة تتحقق من is_admin في القاعدة) =====================
/** { enabled, today, week, total, series, series_unit, top_companies, converted, ip_alerts } */
export const fetchFreeKeyStats = () => rpc("admin_free_key_stats");

/** آخر الكشوفات: { id, user_id, full_name, email, company_id, company_name, company_logo, company_type, source, ip, created_at, total_count }[] */
export const listFreeReveals = async (limit = 50, offset = 0) => (await rpc("admin_free_key_reveals", { p_limit: limit, p_offset: offset })) || [];

/** السويتش العام → القيمة الجديدة. */
export const setFreeKeyEnabled = (enabled) => rpc("admin_set_free_key_enabled", { p_enabled: !!enabled });

/** "متاح للمفتاح الذهبي" لشركة. */
export const setCompanyFreeReveal = (companyId, enabled) =>
  rpc("admin_set_company_free_reveal", { p_company_id: companyId, p_enabled: !!enabled });
