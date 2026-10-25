// ============================================================
//  CODpromo — محتوى صفحة الشركة (/store/:slug)
//  ملف بلا أي import: نفس الدوال في الواجهة (StorePage) وفي api/prerender.js، باش النص
//  اللي يشوفو Google في الـ HTML هو نفس النص اللي يشوفو الزائر.
//  t(key, vars) = دالة الترجمة (i18next في الواجهة، الملفات نفسها في الخادم).
// ============================================================

/** نوع الشركة (الخطوات + علامات التقييم). نفس الجدول في SQL: company_kind() (phase34). */
export const STORE_KINDS = ["platform", "delivery", "store", "tool", "payment", "service"];
const KIND_BY_CATEGORY = {
  "e-commerce-platform": "platform",
  "store-management-erp": "platform",
  "delivery-shipping": "delivery",
  "selling-in-tunisia": "delivery",
  "payment-cards": "payment",
  "media-buying-agencies": "service",
  "exhibitions-events": "service",
  "order-confirmation": "service",
  "spy-tools": "tool",
  "ai-tools": "tool",
  "ai-advertising": "tool",
  "profit-analysis": "tool",
  "sms-automation": "tool",
};
export function storeKind(company, categorySlug) {
  if (company?.store_kind && STORE_KINDS.includes(company.store_kind)) return company.store_kind;
  return KIND_BY_CATEGORY[categorySlug] || null;
}

/** العلامات المسموحة حسب النوع. نفس القائمة في SQL: rating_tags_for() (phase34). */
export const RATING_TAGS = {
  platform: ["easy_setup", "many_features", "fair_price", "fast_support", "stable"],
  delivery: ["on_time", "careful_handling", "wide_coverage", "fast_payout", "fast_support", "fair_price"],
  store: ["quality_products", "fast_shipping", "fair_price", "fast_support", "as_described"],
  tool: ["accurate_data", "easy_to_use", "time_saver", "fair_price", "fast_support"],
  payment: ["fast_activation", "low_fees", "reliable", "fast_support", "easy_to_use"],
  service: ["professional", "good_results", "fast_support", "fair_price", "on_time"],
  default: ["easy_to_use", "fair_price", "fast_support", "reliable", "good_value"],
};
export const ratingTagsFor = (kind) => RATING_TAGS[kind] || RATING_TAGS.default;
/** المعدّل يبان من 3 تقييمات حقيقية، و AggregateRating (JSON-LD) من 5. */
export const RATING_MIN_AVG = 3;
export const RATING_MIN_LD = 5;

/** نسخة اللغة مع fallback للعربية (نفس loc في seo.js). */
export function locText(obj, field, lang) {
  if (!obj) return "";
  return (lang !== "ar" && obj[`${field}_${lang}`]) || obj[field] || "";
}

/** سطور نص (ميزة / خطوة في كل سطر)، بلا الرموز في البداية (- • 1.). */
export function textLines(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-–•*·]|\d+[.)-])\s*/, "").trim())
    .filter(Boolean);
}

const TYPE_KEYS = { "تخفيض": "discount", "كوبون": "coupon", "كاش باك": "cashback" };
export const offerTypeKey = (type) => TYPE_KEYS[type] || "discount";

/**
 * "العرض قريباً" (phase coming-soon): companies.coming_soon = true → العرض مازال ما وصلش (بلا قيمة ولا كود).
 * العنوان والوصف والأسئلة والخطوات يقولو "قريباً" بالصح، و JSON-LD بلا Offer (ما نعطيوش لجوجل عرض مزيّف).
 * premium_coming_soon = عرض Premium قريب حتى هو (غير مع coming_soon).
 */
export const storeComingSoon = (c) => c?.coming_soon === true;

/** عنده عرض Premium؟ (نفس hasPremiumOffer: كود Premium عامر و supports_premium مش false، وماشي "قريباً"). */
export const storeHasPremium = (c) => !!c?.has_premium_code && c?.supports_premium !== false && !storeComingSoon(c);

/** التاريخ بالأرقام اللاتينية (نفس الأرقام في كل الموقع). */
export function formatDay(iso, lang) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const locale = lang === "ar" ? "ar-DZ-u-nu-latn" : lang === "fr" ? "fr-FR" : "en-GB";
  try {
    return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/**
 * خطوات الاستعمال: خطوات الأدمن (usage_steps) إذا كاينين، وإلا حسب نوع العرض ونوع الشركة.
 * يرجع { custom, steps: [{ title, desc }] }.
 */
export function storeSteps(company, { t, lang, kind }) {
  const name = company?.name || "";
  // "قريباً": سجّل من رابطنا دروك ← "أعلمني" ← استعمل العرض كي يتطلق (بلا رابط = بلا الخطوة الأولى)
  if (storeComingSoon(company)) {
    const keys = company?.link ? ["link", "notify", "use"] : ["notify", "use"];
    return { custom: false, steps: keys.map((k) => ({ title: t(`storePage.soon.steps.${k}Title`, { name }), desc: t(`storePage.soon.steps.${k}Desc`, { name }) })) };
  }
  const code = company?.code || "";
  const custom = textLines(locText(company, "usage_steps", lang));
  if (custom.length) return { custom: true, steps: custom.map((desc) => ({ title: "", desc })) };
  const type = offerTypeKey(company?.type);
  const k = kind && STORE_KINDS.includes(kind) ? kind : "default";
  const v = { name, code };
  const open = { title: t(`storePage.steps.open.${k}Title`, v), desc: t(`storePage.steps.open.${k}Desc`, v) };
  if (type === "cashback") {
    return {
      custom: false,
      steps: [
        { title: t("storePage.steps.linkTitle", v), desc: t("storePage.steps.linkDesc", v) },
        open,
        { title: t("storePage.steps.cashbackTitle", v), desc: t("storePage.steps.cashbackDesc", v) },
      ],
    };
  }
  return {
    custom: false,
    steps: [
      { title: t("storePage.steps.copyTitle", v), desc: t("storePage.steps.copyDesc", v) },
      open,
      { title: t("storePage.steps.applyTitle", v), desc: t("storePage.steps.applyDesc", v) },
    ],
  };
}

/**
 * الأسئلة الشائعة من البيانات الحقيقية (+ أسئلة الأدمن من company_faqs بعدها).
 * ما فيهاش حتى معلومة ماشي في القاعدة.
 */
export function storeFaq(company, { t, lang, steps, adminFaqs = [] }) {
  const name = company?.name || "";
  const value = locText(company, "discount", lang);
  const premium = locText(company, "premium_discount", lang);
  const out = [];
  // "قريباً": ماشي "الكود الحالي هو…" — العرض مازال ما وصلش
  if (storeComingSoon(company)) {
    out.push({ q: t("storePage.soon.faq.q", { name }), a: t(company?.link ? "storePage.soon.faq.a" : "storePage.soon.faq.aNoLink", { name }) });
    if (steps?.length) {
      out.push({ q: t("storePage.soon.faq.howQ", { name }), a: steps.map((s, i) => `${i + 1}. ${s.title ? `${s.title}: ` : ""}${s.desc}`).join(" ") });
    }
    out.push({ q: t("storePage.faq.premiumQ", { name }), a: company?.premium_coming_soon ? t("storePage.soon.faq.premiumSoon", { name }) : t("storePage.faq.premiumNo", { name }) });
    for (const f of adminFaqs || []) {
      const q = locText({ q: f.question, q_en: f.question_en, q_fr: f.question_fr }, "q", lang);
      const a = locText({ a: f.answer, a_en: f.answer_en, a_fr: f.answer_fr }, "a", lang);
      if (q && a) out.push({ q, a });
    }
    return out;
  }
  if (company?.code) {
    const checked = formatDay(company.code_checked_at, lang);
    out.push({
      q: t("storePage.faq.hasCodeQ", { name }),
      a: [t("storePage.faq.hasCodeA", { name, code: company.code, value }), checked ? t("storePage.faq.hasCodeChecked", { date: checked }) : ""].filter(Boolean).join(" "),
    });
  }
  if (steps?.length) {
    out.push({
      q: t("storePage.faq.howQ", { name }),
      a: steps.map((s, i) => `${i + 1}. ${s.title ? `${s.title}: ` : ""}${s.desc}`).join(" "),
    });
  }
  out.push({
    q: t("storePage.faq.premiumQ", { name }),
    a: storeHasPremium(company) && premium ? t("storePage.faq.premiumYes", { name, premium, normal: value }) : t("storePage.faq.premiumNo", { name }),
  });
  if (company?.code) out.push({ q: t("storePage.faq.freeQ", { name }), a: t("storePage.faq.freeA", { name }) });
  for (const f of adminFaqs || []) {
    const q = locText({ q: f.question, q_en: f.question_en, q_fr: f.question_fr }, "q", lang);
    const a = locText({ a: f.answer, a_en: f.answer_en, a_fr: f.answer_fr }, "a", lang);
    if (q && a) out.push({ q, a });
  }
  return out;
}

/**
 * شركات مشابهة: نفس الفئة أولاً، ثم الباقي (الأحدث). count مضاعف لعدد الأعمدة (بلا فراغات في الشبكة).
 */
export function similarStores(company, all, max = 8) {
  if (!company) return [];
  const others = (all || []).filter((c) => c.id !== company.id && c.slug && (c.status || "active") === "active");
  const same = others.filter((c) => company.category_id && c.category_id === company.category_id);
  const rest = others.filter((c) => !same.includes(c));
  // "قريباً" ديما بعد العروض اللي تخدم
  const list = [...same, ...rest];
  return [...list.filter((c) => !storeComingSoon(c)), ...list.filter(storeComingSoon)].slice(0, max);
}

// ===================== SEO (نفس الدوال في الواجهة و prerender) =====================
const SITE = "CODpromo";
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/**
 * العنوان: حقل الأدمن، وإلا "كود خصم JustSell: 10%، و20% مع Premium | CODpromo".
 * "قريباً" (t لازم): "كود خصم X قريباً | CODpromo" — حتى حقل الأدمن ما يتقراش (عنوان قديم = عرض مزيّف).
 */
export function storeSeoTitle(c, lang, t) {
  if (storeComingSoon(c)) return t ? t("storePage.soon.seoTitle", { name: c?.name || SITE }) : `${c?.name || SITE} | ${SITE}`;
  const custom = locText(c, "seo_title", lang);
  if (custom) return custom;
  const name = c?.name || SITE;
  const d = locText(c, "discount", lang);
  const pd = storeHasPremium(c) ? locText(c, "premium_discount", lang) : "";
  const type = offerTypeKey(c?.type);
  if (lang === "en") {
    const head = type === "cashback" ? `${name} cashback` : type === "coupon" ? `${name} coupon` : `${name} promo code`;
    const off = d && /%$/.test(d.trim()) && type === "discount" ? `${d} off` : d;
    return `${head}${off ? `: ${off}` : ""}${pd ? `, ${pd} with Premium` : ""} | ${SITE}`;
  }
  if (lang === "fr") {
    const head = type === "cashback" ? `Cashback ${name}` : type === "coupon" ? `Coupon ${name}` : `Code promo ${name}`;
    return `${head}${d ? ` : ${d}` : ""}${pd ? `, ${pd} avec Premium` : ""} | ${SITE}`;
  }
  const head = type === "cashback" ? `كاش باك ${name}` : type === "coupon" ? `كوبون ${name}` : `كود خصم ${name}`;
  return `${head}${d ? `: ${d}` : ""}${pd ? `، و${pd} مع Premium` : ""} | ${SITE}`;
}

/** الوصف: حقل الأدمن، وإلا الكود + القيمة + Premium + وصف العرض (≤ 160 حرف تقريباً). "قريباً": t لازم. */
export function storeSeoDescription(c, lang, t) {
  if (storeComingSoon(c)) {
    const head = t ? t(c?.link ? "storePage.soon.seoDesc" : "storePage.soon.seoDescNoLink", { name: c?.name || SITE }) : "";
    const about = locText(c, "description", lang);
    return clip([head, about].filter(Boolean).join(" "), 300);
  }
  const custom = locText(c, "seo_description", lang);
  if (custom) return custom;
  const name = c?.name || SITE;
  const d = locText(c, "discount", lang);
  const pd = storeHasPremium(c) ? locText(c, "premium_discount", lang) : "";
  const desc = locText(c, "description", lang);
  let head;
  if (lang === "en") head = `Copy the ${name} code${c?.code ? ` ${c.code}` : ""}${d ? ` and get ${d}` : ""}.${pd ? ` ${pd} with CODpromo Premium.` : ""}`;
  else if (lang === "fr") head = `Copiez le code ${name}${c?.code ? ` ${c.code}` : ""}${d ? ` et obtenez ${d}` : ""}.${pd ? ` ${pd} avec CODpromo Premium.` : ""}`;
  else head = `انسخ كود ${name}${c?.code ? ` ${c.code}` : ""}${d ? ` واحصل على ${d}` : ""}.${pd ? ` ${pd} مع CODpromo Premium.` : ""}`;
  return clip(desc ? `${head} ${desc}` : head, 300);
}

/**
 * JSON-LD لصفحة الشركة: Organization (+ AggregateRating من 5 تقييمات حقيقية)، العروض (Offer)،
 * FAQPage (نفس الأسئلة الظاهرة)، BreadcrumbList.
 */
export function storeJsonLd(c, { lang, url, faq = [], rating = null, breadcrumb = [], t }) {
  const out = [];
  const logo = /^https?:\/\//i.test(c?.logo || "") ? c.logo : null;
  const org = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: c.name,
    url,
    description: storeSeoDescription(c, lang, t),
    ...(logo ? { logo } : {}),
    ...(c.link ? { sameAs: [c.link] } : {}),
  };
  const n = Number(rating?.count) || 0;
  if (n >= RATING_MIN_LD && rating?.avg != null) {
    org.aggregateRating = { "@type": "AggregateRating", ratingValue: String(rating.avg), ratingCount: n, bestRating: "5", worstRating: "1" };
  }
  out.push(org);
  const offers = [];
  // "قريباً": حتى Offer (لا قيمة لا كود بعد)
  const d = storeComingSoon(c) ? "" : locText(c, "discount", lang);
  if (d) offers.push({ "@type": "Offer", name: `${c.name} — ${d}`, description: locText(c, "description", lang) || undefined, url, availability: "https://schema.org/InStock", seller: { "@type": "Organization", name: c.name } });
  const pd = storeHasPremium(c) ? locText(c, "premium_discount", lang) : "";
  if (pd) offers.push({ "@type": "Offer", name: `${c.name} — ${pd} (CODpromo Premium)`, description: locText(c, "premium_description", lang) || undefined, url, availability: "https://schema.org/InStock", seller: { "@type": "Organization", name: c.name } });
  if (offers.length) out.push({ "@context": "https://schema.org", "@type": "ItemList", name: storeSeoTitle(c, lang), itemListElement: offers.map((o, i) => ({ "@type": "ListItem", position: i + 1, item: o })) });
  if (faq.length) out.push({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) });
  if (breadcrumb.length) out.push({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: breadcrumb.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: it.url })) });
  return out;
}
