// ============================================================
//  بيانات "الكوبون السحري" في الـ Hero: عرض حقيقي من قاعدة البيانات له قيمة
//  عادية وقيمة Premium أكبر (يُفضَّل نوع "تخفيض" ليظهر الوجه الأمامي بلون التخفيض).
//  إن لم يوجد عرض مناسب → مثال توضيحي معلَن (يظهر عليه وسم "مثال توضيحي").
// ============================================================

import { parseVal } from "../../../lib/values.js";
import { getTypeMeta, getTypeKey } from "../../../lib/types.js";
import { successRank } from "../../../lib/offerFilters.js";
import { companyCategoryRecord, categoryName } from "../../../lib/slug.js";

const DISCOUNT = "تخفيض";

/** يختار العرض الأنسب للكوبون السحري أو null. */
export function pickHeroOffer(companies, voteStats) {
  const usable = (companies || [])
    .filter((c) => c.supports_premium !== false && c.discount && c.premium_discount)
    .map((c) => ({ c, n: parseVal(c.discount), p: parseVal(c.premium_discount) }))
    .filter((x) => x.n && x.p && x.p.num > x.n.num && x.n.suffix.trim() === x.p.suffix.trim());
  if (!usable.length) return null;
  const score = (x) =>
    (x.c.type === DISCOUNT ? 1e9 : 0) + successRank(voteStats, x.c.id) * 1000 + (x.c.clicks || 0) * 10 + (x.p.num - x.n.num);
  usable.sort((a, b) => score(b) - score(a));
  return usable[0].c;
}

/**
 * يبني ما يُعرض على وجهي الكوبون (عادي/Premium) بلغة العرض.
 * real=false → المثال التوضيحي (قيم المواصفة: 20% ثم 30% + كاش باك).
 */
export function buildCouponFaces(company, { t, lang, byId, categories }) {
  if (!company) {
    return {
      real: false,
      name: t("hero.magic.exampleName"),
      category: t("hero.magic.example"),
      logo: null,
      typeKey: "discount",
      color: getTypeMeta(DISCOUNT).color,
      normal: t("hero.magic.exampleNormal"),
      premium: t("hero.magic.examplePremium"),
      code: "CODPROMO",
      delta: null,
      extraBadge: t("types.cashback"),
    };
  }
  const loc = (field) => (lang !== "ar" && company[`${field}_${lang}`]) || company[field] || "";
  const rec = companyCategoryRecord(company, byId, categories);
  const normal = loc("discount");
  const premium = loc("premium_discount");
  const n = parseVal(normal);
  const p = parseVal(premium);
  const delta = n && p && p.num > n.num ? `+${Math.round(p.num - n.num)}${p.suffix.trim()}` : null;
  return {
    real: true,
    id: company.id,
    name: company.name,
    category: rec ? categoryName(rec, lang) : loc("category"),
    logo: company.logo || null,
    typeKey: getTypeKey(company.type),
    color: getTypeMeta(company.type).color,
    normal,
    premium,
    code: company.code || "",
    delta,
    extraBadge: null,
  };
}
