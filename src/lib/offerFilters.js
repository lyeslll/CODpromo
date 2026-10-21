// ============================================================
//  CODpromo — منطق فلترة العروض المشترك (صفحة /offers + أقسام الصفحة الرئيسية)
//  قيم الرابط لاتينية ثابتة (type=discount|coupon|cashback) وتُربط بقيم
//  قاعدة البيانات العربية ("تخفيض" / "كوبون" / "كاش باك") دون تغييرها.
// ============================================================

import { categoryRecordSlug, companyCategoryRecord, categoryName } from "./slug.js";

/** قيمة type في الرابط ← قيمة النوع في قاعدة البيانات. */
export const TYPE_PARAMS = {
  discount: "تخفيض",
  coupon: "كوبون",
  cashback: "كاش باك",
};

/** قيمة النوع في قاعدة البيانات ← قيمة type في الرابط (أو null). */
export function typeParamOf(dbType) {
  for (const [param, value] of Object.entries(TYPE_PARAMS)) if (value === dbType) return param;
  return null;
}

/** الفئات النشطة مرتّبة حسب sort_order. */
export function activeCategories(categories) {
  return (categories || [])
    .filter((c) => c.is_active !== false)
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

/** عدد العروض لكل فئة (category_id، مع fallback لمطابقة النص العربي القديم). */
export function countByCategory(companies, categories) {
  const byId = {};
  for (const cat of categories || []) byId[cat.id] = cat;
  const map = {};
  for (const cat of categories || []) map[cat.id] = 0;
  for (const c of companies || []) {
    const rec = companyCategoryRecord(c, byId, categories);
    if (rec && map[rec.id] != null) map[rec.id] += 1;
  }
  return map;
}

/** slug فئة الشركة (أو "" إن لم تُربط بفئة). */
export function companyCategorySlug(company, byId, categories) {
  const rec = companyCategoryRecord(company, byId, categories);
  return rec ? categoryRecordSlug(rec) : "";
}

/** هل تطابق الشركة نص البحث (الاسم، الكود، الفئة بلغة العرض، الوصف بلغة العرض)؟ */
export function matchesSearch(company, query, lang, byId, categories) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  const loc = (field) => (lang !== "ar" && company[`${field}_${lang}`]) || company[field] || "";
  const rec = companyCategoryRecord(company, byId, categories);
  const cat = rec ? categoryName(rec, lang) : loc("category");
  return [company.name, company.code, cat, company.category, loc("description"), company.description]
    .filter(Boolean)
    .some((v) => String(v).toLowerCase().includes(q));
}

/** ترتيب "الأكثر نجاحاً": النسبة ثم عدد الأصوات؛ بلا أصوات → في الأسفل. */
export function successRank(stats, id) {
  const s = stats?.[id];
  if (!s || !s.total_count) return -1;
  return s.success_rate * 1000 + Math.min(s.total_count, 999);
}

/** يعيد أنجح عرض (حسب التصويت) لنوع معيّن، وإلا الأحدث منه. */
export function topOfType(companies, dbType, stats) {
  const list = (companies || []).filter((c) => c.type === dbType);
  if (!list.length) return null;
  return list.slice().sort((a, b) => successRank(stats, b.id) - successRank(stats, a.id))[0];
}
