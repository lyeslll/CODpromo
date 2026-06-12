// ============================================================
//  CODpromo — منطق السيو المشترك (روابط، عناوين، أوصاف، JSON-LD)
//  يُستعمل من مكوّن <Seo> ومن صفحات المتجر/الفئة.
//  ملاحظة: دوال خادم Vercel (/api) تكرّر جزءاً من هذا المنطق لأنها سياق Node منفصل.
// ============================================================

import { slugify } from "./slug.js";

export const SITE_URL = "https://codpromo.com";
export const SITE_NAME = "CODpromo";
// صورة المشاركة الافتراضية (عند غياب لوجو الشركة)
export const DEFAULT_OG_IMAGE = `${SITE_URL}/logo-dark.png`;

export const SEO_LANGS = ["ar", "en", "fr"];
const OG_LOCALE = { ar: "ar_AR", en: "en_US", fr: "fr_FR" };
export const ogLocale = (lang) => OG_LOCALE[lang] || "ar_AR";
export const dirOfLang = (lang) => (lang === "ar" ? "rtl" : "ltr");

// ===================== الروابط =====================

/** بادئة اللغة في المسار: العربية افتراضية بلا بادئة. */
const langPrefix = (lang) => (lang && lang !== "ar" ? `/${lang}` : "");

export const homePath = (lang) => `${langPrefix(lang)}/` || "/";
export const storePath = (slug, lang) => `${langPrefix(lang)}/store/${slug}`;
export const categoryPath = (slug, lang) => `${langPrefix(lang)}/category/${slug}`;

export const absUrl = (path) => `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`;

export const storeUrl = (slug, lang) => absUrl(storePath(slug, lang));
export const categoryUrl = (slug, lang) => absUrl(categoryPath(slug, lang));
export const homeUrl = (lang) => absUrl(homePath(lang));

/** روابط hreflang المتبادلة لصفحة (المتجر/الفئة/الرئيسية) عبر اللغات الثلاث. */
export function buildAlternates(kind, slug) {
  const urlFor = (lang) =>
    kind === "store" ? storeUrl(slug, lang)
    : kind === "category" ? categoryUrl(slug, lang)
    : homeUrl(lang);
  return SEO_LANGS.map((lang) => ({ lang, url: urlFor(lang) }));
}

// ===================== اختيار نسخة اللغة =====================

/** يعيد قيمة الحقل بلغة العرض مع fallback للعربية الأصلية (نفس منطق البطاقة). */
export function loc(obj, field, lang) {
  if (!obj) return "";
  return (lang !== "ar" && obj[`${field}_${lang}`]) || obj[field] || "";
}

/** اسم الشهر والسنة الحالية محلّياً (مثل "يونيو 2026" / "June 2026" / "juin 2026"). */
export function monthYear(lang) {
  try {
    return new Intl.DateTimeFormat(lang === "ar" ? "ar" : lang, {
      month: "long",
      year: "numeric",
    }).format(new Date());
  } catch {
    return String(new Date().getFullYear());
  }
}

// ===================== عناوين وأوصاف الشركة =====================

/** عنوان SEO لصفحة شركة: حقل الأدمن إن وُجد، وإلا قالب جذّاب تلقائي. */
export function storeTitle(company, lang) {
  const custom = loc(company, "seo_title", lang);
  if (custom) return custom;
  const name = company.name || SITE_NAME;
  const discount = loc(company, "discount", lang);
  const my = monthYear(lang);
  if (lang === "en")
    return `${name} Promo Code ${my}${discount ? ` — ${discount} Off` : ""} | ${SITE_NAME}`;
  if (lang === "fr")
    return `Code Promo ${name} ${my}${discount ? ` — ${discount} de réduction` : ""} | ${SITE_NAME}`;
  return `كود خصم ${name} ${my}${discount ? ` - خصم ${discount}` : ""} | ${SITE_NAME}`;
}

/** وصف SEO لصفحة شركة: حقل الأدمن، وإلا الوصف، وإلا قالب تلقائي. */
export function storeDescription(company, lang) {
  const custom = loc(company, "seo_description", lang);
  if (custom) return custom;
  const desc = loc(company, "description", lang);
  if (desc) return desc.length > 300 ? `${desc.slice(0, 297)}…` : desc;
  const name = company.name || SITE_NAME;
  const discount = loc(company, "discount", lang);
  if (lang === "en")
    return `Get the latest ${name} promo codes and coupons${discount ? ` — save ${discount}` : ""}. Verified working discount codes on ${SITE_NAME}.`;
  if (lang === "fr")
    return `Obtenez les derniers codes promo et coupons ${name}${discount ? ` — économisez ${discount}` : ""}. Codes de réduction vérifiés sur ${SITE_NAME}.`;
  return `أحدث أكواد خصم وكوبونات ${name}${discount ? ` — وفّر ${discount}` : ""}. أكواد مفعّلة ومجرّبة على ${SITE_NAME}.`;
}

export function storeKeywords(company, lang) {
  const custom = loc(company, "seo_keywords", lang);
  if (custom) return custom;
  const name = company.name || "";
  if (lang === "en") return `${name}, ${name} promo code, ${name} coupon, discount, cashback, ${SITE_NAME}`;
  if (lang === "fr") return `${name}, code promo ${name}, coupon ${name}, réduction, cashback, ${SITE_NAME}`;
  return `${name}, كود خصم ${name}, كوبون ${name}, تخفيضات, كاش باك, ${SITE_NAME}`;
}

/** صورة المشاركة لصفحة شركة: لوجو الشركة إن كان رابط صورة، وإلا الافتراضي. */
export function storeImage(company) {
  const logo = company?.logo || "";
  return /^https?:\/\//i.test(logo) ? logo : DEFAULT_OG_IMAGE;
}

// ===================== عناوين وأوصاف الفئة =====================

export function categoryTitle(label, lang) {
  if (lang === "en") return `${label} Promo Codes & Coupons | ${SITE_NAME}`;
  if (lang === "fr") return `Codes Promo & Coupons ${label} | ${SITE_NAME}`;
  return `أكواد خصم وكوبونات ${label} | ${SITE_NAME}`;
}

export function categoryDescription(label, count, lang) {
  if (lang === "en")
    return `Browse ${count} verified ${label} promo codes, coupons and cashback offers on ${SITE_NAME}.`;
  if (lang === "fr")
    return `Découvrez ${count} codes promo, coupons et offres cashback ${label} vérifiés sur ${SITE_NAME}.`;
  return `تصفّح ${count} كود خصم وكوبون وعروض كاش باك في فئة ${label} على ${SITE_NAME}.`;
}

// ===================== JSON-LD (بيانات منظّمة) =====================

export function organizationLd(company, lang, url) {
  const ld = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: company.name,
    url,
    description: storeDescription(company, lang),
  };
  if (/^https?:\/\//i.test(company.logo || "")) ld.logo = company.logo;
  if (company.link) ld.sameAs = [company.link];
  return ld;
}

/** عرض/كوبون كـ Offer (مدعوم في schema.org). */
export function offerLd(company, lang, url) {
  const discount = loc(company, "discount", lang);
  return {
    "@context": "https://schema.org",
    "@type": "Offer",
    name: storeTitle(company, lang),
    description: storeDescription(company, lang),
    url,
    category: loc(company, "category", lang) || undefined,
    seller: { "@type": "Organization", name: company.name },
    ...(discount ? { priceSpecification: { "@type": "PriceSpecification", description: discount } } : {}),
    availability: "https://schema.org/InStock",
  };
}

export function faqLd(faqs, lang) {
  const list = (faqs || [])
    .map((f) => ({
      q: (lang !== "ar" && f[`question_${lang}`]) || f.question,
      a: (lang !== "ar" && f[`answer_${lang}`]) || f.answer,
    }))
    .filter((f) => f.q && f.a);
  if (list.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: list.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

/** فتات الخبز (breadcrumbs) — مصفوفة { name, url }. */
export function breadcrumbLd(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}

export { slugify };
