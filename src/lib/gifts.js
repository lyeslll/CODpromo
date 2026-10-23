import { supabase } from "./supabaseClient.js";
import { SITE_URL } from "./seo.js";

// ============================================================
//  نظام الهدايا (phase30): روابط تعطي Premium مجاني لمدة محدّدة.
//  منفصل تماماً على الدفع وعلى Stork: ما يكتب حتى حاجة في profiles — Premium الهدية
//  يعيش في gift_redemptions ويتقرا خادمياً عبر has_premium_access.
//  الجداول مقفولة (RLS بلا سياسات): كل شي يمرّ عبر دوال RPC.
// ============================================================

/** الكود: 16 حرفاً من 31 (بلا 0/O و 1/I/L)، يتخزّن بلا "-" ويتعرض بمجموعات من 4. */
export const normalizeGiftCode = (s) =>
  String(s || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 32);
export const formatGiftCode = (code) => normalizeGiftCode(code).replace(/(.{4})(?=.)/g, "$1-");
export const giftPath = (code) => `/gift/${formatGiftCode(code)}`;
/** الرابط اللي يتشارك (دايماً على codpromo.com، حتى من نسخة محلية). */
export const giftUrl = (code) => `${SITE_URL}${giftPath(code)}`;

// ===================== الكود المعلّق (زائر بلا حساب) =====================
// يتحفظ في صفحة الهدية، ومن بعد الدخول / التسجيل (حتى بـ Google) الهدية تتفعّل وحدها.
const PENDING_KEY = "codpromo:gift-pending";

export function setPendingGift(code) {
  try {
    sessionStorage.setItem(PENDING_KEY, normalizeGiftCode(code));
  } catch {
    /* sessionStorage غير متاح — الزائر يفتح الرابط مرة أخرى */
  }
}

export function getPendingGift() {
  try {
    return normalizeGiftCode(sessionStorage.getItem(PENDING_KEY)) || null;
  } catch {
    return null;
  }
}

export function clearPendingGift() {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* تجاهل آمن */
  }
}

/** مسار صفحة الهدية المعلّقة (لتحويل الزائر بعد الدخول) أو null. */
export const pendingGiftPath = () => {
  const code = getPendingGift();
  return code ? giftPath(code) : null;
};

// ===================== المدة =====================
/** أيام → { unit: "months" | "days", count } (30 = شهر، 365 = 12 شهراً، وإلا بالأيام). */
export function giftDuration(days) {
  const d = Math.max(0, Math.round(Number(days) || 0));
  if (d && d % 365 === 0) return { unit: "months", count: (d / 365) * 12 };
  if (d && d % 30 === 0) return { unit: "months", count: d / 30 };
  return { unit: "days", count: d };
}

/** هدية نشطة: ما تسحبتش وما كملتش مدّتها (نفس has_active_gift في القاعدة). */
export const isGiftActive = (g) => !!(g && !g.revoked && g.premium_until && new Date(g.premium_until) > new Date());

const DAY = 86400000;
/** الأيام الباقية (تقريب للأعلى)، 0 إذا انتهت. */
export const giftDaysLeft = (g) => (g?.premium_until ? Math.max(0, Math.ceil((new Date(g.premium_until) - Date.now()) / DAY)) : 0);

// ===================== المستخدم =====================
async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}

/**
 * معاينة رابط (حتى للزائر): { status, kind?, duration_days?, premium_until?, active? }.
 * status: ok | invalid | inactive | expired | exhausted | yours | already_redeemed | has_premium | rate_limited
 */
export const previewGift = (code) => rpc("gift_preview", { p_code: normalizeGiftCode(code) });

/** تفعيل الهدية (حساب داخل): نفس الحالات + auth، و ok يرجّع premium_until. */
export const redeemGift = (code) => rpc("redeem_gift", { p_code: normalizeGiftCode(code) });

/** هدية الحساب الحالي: { redeemed_at, premium_until, duration_days, revoked, active } أو null. */
export const fetchMyGift = () => rpc("my_gift");

// ===================== الأدمن (كل دالة تتحقق من is_admin في القاعدة) =====================
/** { active_accounts, active_links, uses_month } */
export const fetchGiftStats = () => rpc("admin_gift_stats");

/** كل الروابط (الأحدث أولاً) مع الحالة: active | inactive | expired | exhausted. */
export const listGifts = async () => (await rpc("admin_list_gifts")) || [];

/** رابط جديد — الكود يتولّد في القاعدة. */
export const createGift = ({ kind, durationDays, maxUses = null, expiresAt = null, label = "" }) =>
  rpc("admin_create_gift", {
    p_kind: kind,
    p_duration_days: durationDays,
    p_max_uses: kind === "group" ? maxUses : null,
    p_expires_at: expiresAt || null,
    p_label: label || null,
  });

export const setGiftActive = (id, active) => rpc("admin_set_gift_active", { p_id: id, p_active: active });

/** شكون استعمل رابط: { id, user_id, full_name, email, redeemed_at, premium_until, revoked_at, active }[] */
export const listGiftRedemptions = async (campaignId) => (await rpc("admin_gift_redemptions", { p_campaign: campaignId })) || [];

/** سحب الهدية (نهائي): Premium يتوقف في الحين. */
export const revokeGift = (redemptionId) => rpc("admin_revoke_gift", { p_id: redemptionId });
