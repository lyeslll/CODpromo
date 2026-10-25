import { supabase } from "./supabaseClient.js";

// ============================================================
//  CODpromo — الإشعارات والتحديثات (phase "notifications")
//  القراءة عامة (notifications_feed)، "مقروء" للمسجّل في القاعدة (RPCs) وللزائر في المتصفّح.
//  صنع / تعديل / إخفاء: الأدمين برك (admin_* + admin_assert في القاعدة).
// ============================================================

/** شارة "جديد" على البطاقات: شركة / عرض تزاد في آخر 7 أيام. */
export const NEW_DAYS = 7;
/** نافذة "غير مقروء": إشعار أقدم من هذا ما يدخلش في العدّاد (حساب جديد ولا زائر أول مرة). */
export const UNREAD_DAYS = 14;
/** الزائر يرجع بعد غياب (ساعات) → رسالة "X عروض جديدة منذ آخر زيارة". */
export const RETURN_AFTER_HOURS = 6;
/** الأنواع اللي تتحسب "عرض جديد" في رسالة الرجوع. */
export const OFFER_KINDS = ["company", "code", "premium_code", "deal"];

const READ_KEY = "codpromo:notif-read:v1";
const DAY = 86400000;

/** تاريخ أحدث من N يوم؟ (شارة "جديد") */
export function isRecent(date, days = NEW_DAYS) {
  const t = date ? new Date(date).getTime() : NaN;
  return Number.isFinite(t) && Date.now() - t < days * DAY && t <= Date.now() + 60000;
}

// الصفحات العامة اللي عندها نسخة /en و /fr (نفس القائمة في send-push و api/prerender.js)
const LOCALIZED = /^\/(?:(?:store|category)\/[^/?#]|(?:categories|offers|partners|premium|new|favorites)(?:[/?#]|$))/;

/** نفس قاعدة send-push: الصفحات العامة ببادئة /en و /fr. */
export function localizePath(path, lang) {
  if (!path || lang === "ar" || !path.startsWith("/")) return path || "/";
  if (path === "/") return `/${lang}`;
  return LOCALIZED.test(path) ? `/${lang}${path}` : path;
}

/** رابط داخلي برك (نفس CHECK القاعدة) — أي حاجة أخرى = /new. */
export function safePath(url) {
  return typeof url === "string" && /^\/([^/\\]|$)/.test(url) && !/[\s\\<>"'`]/.test(url) ? url : "/new";
}

const pick = (row, field, lang) => ((lang !== "ar" && row?.[`${field}_${lang}`]?.trim()) || row?.[field]?.trim() || "");

/**
 * نص إشعار بلغة الواجهة (نفس قاعدة send-push): نص الأدمين إذا كاين، وإلا القالب حسب النوع
 * + اسم الشركة والعرض بلغة الواجهة. { title, body, name, logo, logoBg, tone }
 */
export function renderNotification(n, t, lang) {
  const ownTitle = pick(n, "title", lang);
  const ownBody = pick(n, "body", lang);
  const row = n.kind === "deal" ? n.deal : n.company;
  const name = row?.name?.trim() || "";
  const base = { name, logo: row?.logo || null, logoBg: n.company?.logo_bg || null, kind: n.kind };
  if (n.kind === "feature" || n.kind === "announcement") return { ...base, title: ownTitle, body: ownBody };
  const offer =
    n.kind === "deal" ? pick(row, "reward", lang) : n.kind === "premium_code" ? pick(row, "premium_discount", lang) : pick(row, "discount", lang);
  // "أعلمني عند التفعيل" (phase coming-soon): صاحب الحساب كان يستنى هاد العرض → "العرض الذي كنت تنتظره هنا"
  if (n.waited) {
    return {
      ...base,
      waited: true,
      title: t("notify.waited.title", { name }),
      body: offer ? t(`notify.kind.${n.kind}.body`, { offer }) : t(`notify.kind.${n.kind}.bodyNoOffer`),
    };
  }
  return {
    ...base,
    title: ownTitle || t(`notify.kind.${n.kind}.title`, { name }),
    body: ownBody || (offer ? t(`notify.kind.${n.kind}.body`, { offer }) : t(`notify.kind.${n.kind}.bodyNoOffer`)),
  };
}

/** رابط الإشعار بلغة الواجهة (رسائل push تزيد ?n=<id> باش يتعلّم مقروء كي يتحلّ — useNotifications). */
export function notificationHref(n, lang) {
  return localizePath(safePath(n.url), lang);
}

/** "منذ 5 دقائق" بلغة الواجهة. */
export function timeAgo(date, lang) {
  const t = new Date(date).getTime();
  if (!Number.isFinite(t)) return "";
  const sec = Math.round((t - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
  const abs = Math.abs(sec);
  if (abs < 60) return rtf.format(0, "second");
  if (abs < 3600) return rtf.format(Math.round(sec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(sec / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(sec / 86400), "day");
  return new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", year: "numeric" }).format(new Date(t));
}

// ===================== القراءة =====================

/**
 * آخر التحديثات. all = كل شي (صفحة /new)، وإلا حسب تفضيلات الحساب (الجرس).
 * يرجّع { items, readAllBefore, scope }. items[i].read = تاع صاحب الجلسة برك.
 */
export async function fetchFeed({ limit = 30, before = null, all = false } = {}) {
  const { data, error } = await supabase.rpc("notifications_feed", { p_limit: limit, p_before: before, p_all: all });
  if (error) throw new Error(error.message);
  return {
    items: Array.isArray(data?.items) ? data.items : [],
    readAllBefore: data?.read_all_before || null,
    scope: data?.scope || "all",
  };
}

export async function markReadRemote(ids) {
  const list = [...new Set(ids)].filter((x) => Number.isSafeInteger(x)).slice(0, 100);
  if (!list.length) return 0;
  const { data, error } = await supabase.rpc("notifications_mark_read", { p_ids: list });
  if (error) throw new Error(error.message);
  return data;
}

export async function markAllReadRemote() {
  const { data, error } = await supabase.rpc("notifications_mark_all_read");
  if (error) throw new Error(error.message);
  return data;
}

// ===================== "مقروء" للزائر (المتصفّح) =====================

/** { before: ISO | null, ids: number[] } — before = "كلش قبل هاد الوقت مقروء". */
export function readLocal() {
  try {
    const v = JSON.parse(localStorage.getItem(READ_KEY) || "null");
    if (v && typeof v === "object") return { before: typeof v.before === "string" ? v.before : null, ids: Array.isArray(v.ids) ? v.ids.filter(Number.isSafeInteger) : [] };
  } catch {
    /* تصفّح خاص… */
  }
  return { before: null, ids: [] };
}

export function writeLocal(v) {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify({ before: v.before || null, ids: (v.ids || []).slice(-200) }));
  } catch {
    /* تجاهل */
  }
}

// ===================== التفضيلات (الداشبورد) =====================

export async function fetchMyPrefs() {
  const { data, error } = await supabase.rpc("my_notification_prefs");
  if (error) throw new Error(error.message);
  return { scope: data?.scope || "all", categories: Array.isArray(data?.categories) ? data.categories : [] };
}

export async function saveMyPrefs(scope, categories = []) {
  const { data, error } = await supabase.rpc("set_notification_prefs", { p_scope: scope, p_categories: categories });
  if (error) throw new Error(error.message);
  return data;
}

// ===================== الأدمين =====================

export async function adminListNotifications(limit = 150) {
  const { data, error } = await supabase.rpc("admin_notifications", { p_limit: limit });
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? data : [];
}

export async function adminCreateNotification(p) {
  const { data, error } = await supabase.rpc("admin_create_notification", {
    p_kind: p.kind,
    p_company_id: p.companyId ?? null,
    p_deal_id: p.dealId ?? null,
    p_title: p.title ?? null,
    p_title_en: p.title_en ?? null,
    p_title_fr: p.title_fr ?? null,
    p_body: p.body ?? null,
    p_body_en: p.body_en ?? null,
    p_body_fr: p.body_fr ?? null,
    p_url: p.url ?? null,
    p_push: p.push !== false,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function adminUpdateNotification(id, p) {
  const { data, error } = await supabase.rpc("admin_update_notification", {
    p_id: id,
    p_title: p.title ?? null,
    p_title_en: p.title_en ?? null,
    p_title_fr: p.title_fr ?? null,
    p_body: p.body ?? null,
    p_body_en: p.body_en ?? null,
    p_body_fr: p.body_fr ?? null,
    p_url: p.url ?? null,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function adminSetNotificationHidden(id, hidden) {
  const { data, error } = await supabase.rpc("admin_set_notification_hidden", { p_id: id, p_hidden: hidden });
  if (error) throw new Error(error.message);
  return data;
}

export async function adminPushOverview() {
  const { data, error } = await supabase.rpc("admin_push_overview");
  if (error) throw new Error(error.message);
  return data;
}

export async function adminPushTest() {
  const { data, error } = await supabase.rpc("admin_push_test");
  if (error) throw new Error(error.message);
  return data;
}

export async function adminSetPushEnabled(on) {
  const { data, error } = await supabase.rpc("admin_set_push_enabled", { p_on: on });
  if (error) throw new Error(error.message);
  return data;
}
