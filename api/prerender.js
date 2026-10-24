// ============================================================
//  CODpromo — حقن وسوم السيو من الخادم (دالة Vercel Serverless)
//  لماذا: زواحف فيسبوك/واتساب/X لا تنفّذ JavaScript، فلا ترى الوسوم
//  التي يحقنها react-helmet-async. هذه الدالة تجلب بيانات الشركة/الفئة
//  وتحقن title + description + Open Graph + JSON-LD داخل HTML قبل إرساله.
//  جوجل يستفيد أيضاً (فهرسة أسرع). المستخدم العادي يتلقّى نفس الـ HTML
//  ثم يُكمل تطبيق React عمله طبيعياً (hydration).
//
//  مرتبط عبر vercel.json:
//    /store/:slug        → /api/prerender?type=store&lang=ar&slug=:slug
//    /en/store/:slug     → ...lang=en...   (وكذلك fr، والفئات)
//    /offers             → /api/prerender?type=offers&lang=ar   (وكذلك /en و/fr)
//    /partners           → /api/prerender?type=partners&lang=ar (وكذلك /en و/fr)
//    /premium            → /api/prerender?type=premium&lang=ar  (وكذلك /en و/fr)
// ============================================================

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { storeKind, storeSteps, storeFaq, similarStores, storeSeoTitle, storeSeoDescription, storeJsonLd, locText, storeHasPremium, RATING_MIN_AVG } from "../src/lib/storeContent.js";

const SITE_URL = "https://codpromo.com";
const SITE_NAME = "CODpromo";
const DEFAULT_OG_IMAGE = `${SITE_URL}/logo-dark.png`;
const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || "https://uulcgvdsqivgkiulurhk.supabase.co";
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  "sb_publishable_kxiLaS2RxTEeZA6TrJQR_w_ws8twFBt";

const OG_LOCALE = { ar: "ar_AR", en: "en_US", fr: "fr_FR" };
const dirOf = (l) => (l === "ar" ? "rtl" : "ltr");

// ذاكرة مؤقتة لقالب index.html (لكل host) عبر الاستدعاءات الساخنة.
const templateCache = {};

// أعمدة companies الآمنة (بدون premium_code/premium_url المقفلين خادمياً منذ phase17b).
// لا يستعمل البريرندر أعمدة Premium السرّية أصلاً؛ نطلب الأعمدة الصريحة فقط حتى لا يفشل
// select=* بعد منع قراءة العمودين عن المفتاح العام (anon).
const COMPANY_PUBLIC_COLUMNS =
  "id,created_at,clicks,name,logo,category,category_id,code,discount,premium_discount," +
  "supports_premium,type,description,link,status," +
  "description_en,description_fr,category_en,category_fr," +
  "discount_en,discount_fr,premium_discount_en,premium_discount_fr," +
  "slug,seo_title,seo_title_en,seo_title_fr," +
  "seo_description,seo_description_en,seo_description_fr," +
  "seo_keywords,seo_keywords_en,seo_keywords_fr," +
  "has_premium_code,premium_description,premium_description_en,premium_description_fr," +
  "store_kind,code_checked_at,logo_bg,about,about_en,about_fr,features,features_en,features_fr,usage_steps,usage_steps_en,usage_steps_fr";
// للقوائم (شركات مشابهة / الفئة): خفيفة
const COMPANY_LIST_COLUMNS = "id,slug,name,type,category_id,status,discount,discount_en,discount_fr,created_at";

function slugify(v) {
  return String(v || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-{2,}/g, "-").replace(/^-+|-+$/g, "");
}
function loc(obj, field, lang) {
  if (!obj) return "";
  return (lang !== "ar" && obj[`${field}_${lang}`]) || obj[field] || "";
}
function esc(s) {
  return String(s == null ? "" : s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
}

function categoryTitle(label, lang) {
  if (lang === "en") return `${label} Promo Codes & Coupons | ${SITE_NAME}`;
  if (lang === "fr") return `Codes Promo & Coupons ${label} | ${SITE_NAME}`;
  return `أكواد خصم وكوبونات ${label} | ${SITE_NAME}`;
}
function categoryDescription(label, count, lang) {
  if (lang === "en") return `Browse ${count} verified ${label} promo codes, coupons and cashback offers on ${SITE_NAME}.`;
  if (lang === "fr") return `Découvrez ${count} codes promo, coupons et offres cashback ${label} vérifiés sur ${SITE_NAME}.`;
  return `تصفّح ${count} كود خصم وكوبون وعروض كاش باك في فئة ${label} على ${SITE_NAME}.`;
}

const prefix = (l) => (l === "ar" ? "" : `/${l}`);
const storeUrl = (slug, l) => `${SITE_URL}${prefix(l)}/store/${slug}`;
const categoryUrl = (slug, l) => `${SITE_URL}${prefix(l)}/category/${slug}`;
const offersUrl = (l) => `${SITE_URL}${prefix(l)}/offers`;
const partnersUrl = (l) => `${SITE_URL}${prefix(l)}/partners`;
const premiumUrl = (l) => `${SITE_URL}${prefix(l)}/premium`;

/** "{{x}}" → قيمة (نفس صيغة i18next في ملفات الترجمة). */
const fill = (str, vars) => String(str || "").replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] ?? ""));
/** نفس formatNumber في الواجهة: العربية والإنجليزية 9,900 — الفرنسية 9 900. */
const num = (n, l) => new Intl.NumberFormat(l === "fr" ? "fr-FR" : "en-US", { maximumFractionDigits: 0 }).format(n);

// نصوص الصفحات العامة من ملفات الترجمة نفسها (src/i18n/locales — مضمّنة عبر
// functions.includeFiles في vercel.json) حتى لا تتكرّر النصوص هنا.
const localeCache = {};
function locale(lang) {
  if (lang in localeCache) return localeCache[lang];
  const file = `${lang}.json`;
  const candidates = [
    () => new URL(`../src/i18n/locales/${file}`, import.meta.url),
    () => join(process.cwd(), "src", "i18n", "locales", file),
  ];
  localeCache[lang] = null;
  for (const at of candidates) {
    try {
      localeCache[lang] = JSON.parse(readFileSync(at(), "utf8"));
      break;
    } catch {
      /* نجرّب المسار التالي */
    }
  }
  return localeCache[lang];
}

// cookie: روابط preview تاع Vercel محمية بالدخول → نمرّرو كوكي الزائر لنفس الـ host، وإلا يرجع
// القالب صفحة دخول Vercel. القالب يتحفظ غير إذا هو index.html تاعنا (فيه #root).
async function getTemplate(host, cookie) {
  if (templateCache[host]) return templateCache[host];
  const r = await fetch(`https://${host}/index.html`, cookie ? { headers: { cookie } } : undefined);
  const html = await r.text();
  if (!r.ok || !html.includes('id="root"')) throw new Error("template");
  templateCache[host] = html;
  return html;
}

function buildHead({ lang, title, description, canonical, image, alternates, jsonLd }) {
  const og = OG_LOCALE[lang] || "ar_AR";
  let out = "";
  out += `<link rel="canonical" href="${esc(canonical)}"/>`;
  for (const a of alternates) out += `<link rel="alternate" hreflang="${a.lang}" href="${esc(a.url)}"/>`;
  out += `<link rel="alternate" hreflang="x-default" href="${esc(alternates[0].url)}"/>`;
  out += `<meta property="og:site_name" content="${esc(SITE_NAME)}"/>`;
  out += `<meta property="og:type" content="website"/>`;
  out += `<meta property="og:title" content="${esc(title)}"/>`;
  out += `<meta property="og:description" content="${esc(description)}"/>`;
  out += `<meta property="og:url" content="${esc(canonical)}"/>`;
  out += `<meta property="og:image" content="${esc(image)}"/>`;
  out += `<meta property="og:locale" content="${og}"/>`;
  out += `<meta name="twitter:card" content="summary_large_image"/>`;
  out += `<meta name="twitter:title" content="${esc(title)}"/>`;
  out += `<meta name="twitter:description" content="${esc(description)}"/>`;
  out += `<meta name="twitter:image" content="${esc(image)}"/>`;
  for (const obj of jsonLd.filter(Boolean)) {
    out += `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c")}</script>`;
  }
  return out;
}

function inject(template, { lang, title, description, headExtra, body = "" }) {
  let html = template;
  // المحتوى في الـ HTML (للزواحف): React يبدّلو وقت يتركّب (نفس المحتوى)، وشاشة #boot تغطيه قبلها.
  if (body) html = html.replace(/<div id="root"><\/div>/i, `<div id="root">${body}</div>`);
  html = html.replace(/<html[^>]*>/i, `<html lang="${lang}" dir="${dirOf(lang)}">`);
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(title)}</title>`);
  html = html.replace(/<meta\s+name="description"[\s\S]*?\/>/i, `<meta name="description" content="${esc(description)}"/>`);
  html = html.replace(/<\/head>/i, `${headExtra}</head>`);
  return html;
}

async function fetchJson(url) {
  const r = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
  return r.ok ? r.json() : null;
}

export default async function handler(req, res) {
  const host = req.headers["x-forwarded-host"] || req.headers.host || "codpromo.com";
  const { type = "store", lang: rawLang = "ar", slug = "" } = req.query || {};
  const lang = ["ar", "en", "fr"].includes(rawLang) ? rawLang : "ar";

  let template;
  try {
    template = await getTemplate(host, req.headers.cookie);
  } catch {
    // تعذّر جلب القالب — لا نكسر الصفحة: نُعيد توجيه بسيط لخدمة SPA.
    res.status(302).setHeader("Location", "/index.html");
    return res.end();
  }

  try {
    if (type === "store") {
      const [data, all] = await Promise.all([
        fetchJson(`${SUPABASE_URL}/rest/v1/companies?slug=eq.${encodeURIComponent(slug)}&select=${COMPANY_PUBLIC_COLUMNS},company_faqs(*)`),
        fetchJson(`${SUPABASE_URL}/rest/v1/companies?select=${COMPANY_LIST_COLUMNS}&order=created_at.desc`),
      ]);
      const c = Array.isArray(data) ? data[0] : null;
      if (!c) return serveTemplate(res, template);

      const L = locale(lang) || locale("ar");
      const t = makeT(L, locale("ar"));
      const [cats, rating] = await Promise.all([
        c.category_id ? fetchJson(`${SUPABASE_URL}/rest/v1/categories?id=eq.${c.category_id}&select=slug,name_ar,name_en,name_fr`) : null,
        postJson(`${SUPABASE_URL}/rest/v1/rpc/company_rating_summary`, { p_company_id: c.id }),
      ]);
      const cat = Array.isArray(cats) ? cats[0] : null;
      const catSlug = cat?.slug || slugify(c.category_en) || slugify(c.category);
      const catLabel = cat ? (lang !== "ar" && cat[`name_${lang}`]) || cat.name_ar : loc(c, "category", lang);
      const kind = storeKind(c, catSlug);
      const { steps } = storeSteps(c, { t, lang, kind });
      if (Array.isArray(c.company_faqs)) c.company_faqs.sort((x, y) => (x.sort_order ?? 0) - (y.sort_order ?? 0) || x.id - y.id);
      const faq = storeFaq(c, { t, lang, steps, adminFaqs: c.company_faqs });
      const similar = similarStores(c, Array.isArray(all) ? all : [], 8);

      const title = storeSeoTitle(c, lang);
      const description = storeSeoDescription(c, lang);
      const image = /^https?:\/\//i.test(c.logo || "") ? c.logo : DEFAULT_OG_IMAGE;
      const canonical = storeUrl(c.slug, lang);
      const alternates = ["ar", "en", "fr"].map((l) => ({ lang: l, url: storeUrl(c.slug, l) }));
      const home = { name: L.store?.breadcrumbHome || SITE_NAME, url: `${SITE_URL}${prefix(lang)}/` };
      const crumbs = [home, ...(catLabel && cat ? [{ name: catLabel, url: categoryUrl(catSlug, lang) }] : []), { name: c.name, url: canonical }];
      const jsonLd = storeJsonLd(c, { lang, url: canonical, faq, rating, breadcrumb: crumbs });
      const body = storeBody({ c, lang, t, L, catLabel, catUrl: cat ? categoryUrl(catSlug, lang) : null, crumbs, steps, faq, similar, rating });
      const headExtra = buildHead({ lang, title, description, canonical, image, alternates, jsonLd });
      return serveTemplate(res, inject(template, { lang, title, description, headExtra, body }));
    }

    if (type === "category") {
      let label = "";
      let count = 0;
      let descText = "";
      let catCompanies = [];

      // المصدر الحقيقي: سجلّ الفئة من جدول categories حسب slug
      const cats = await fetchJson(
        `${SUPABASE_URL}/rest/v1/categories?slug=eq.${encodeURIComponent(slug)}&select=*`
      );
      const cat = Array.isArray(cats) ? cats[0] : null;

      if (cat) {
        label = (lang !== "ar" && cat[`name_${lang}`]) || cat.name_ar || cat.slug;
        descText = (lang !== "ar" && cat[`description_${lang}`]) || cat.description_ar || "";
        // العدّ بـ category_id (المصدر)، مع fallback للنص العربي القديم
        const linked = await fetchJson(
          `${SUPABASE_URL}/rest/v1/companies?category_id=eq.${cat.id}&select=${COMPANY_LIST_COLUMNS}&order=created_at.desc`
        );
        count = Array.isArray(linked) ? linked.length : 0;
        catCompanies = Array.isArray(linked) ? linked.filter((x) => x.slug) : [];
        if (count === 0 && cat.name_ar) {
          const legacy = await fetchJson(
            `${SUPABASE_URL}/rest/v1/companies?category=eq.${encodeURIComponent(cat.name_ar)}&select=id`
          );
          count = Array.isArray(legacy) ? legacy.length : 0;
        }
      } else {
        // قبل الهجرة / لا سجلّ في الجدول: fallback للنص الحر القديم كي لا يختفي شيء
        const companies = (await fetchJson(
          `${SUPABASE_URL}/rest/v1/companies?select=category,category_en,category_fr`
        )) || [];
        for (const c of companies) {
          const cs = slugify(c.category_en) || slugify(c.category);
          if (cs === slug) {
            count += 1;
            if (!label) label = loc(c, "category", lang) || c.category;
          }
        }
      }
      if (!label) return serveTemplate(res, template);

      const title = categoryTitle(label, lang);
      const description = descText || categoryDescription(label, count, lang);
      const canonical = categoryUrl(slug, lang);
      const alternates = ["ar", "en", "fr"].map((l) => ({ lang: l, url: categoryUrl(slug, l) }));
      const jsonLd = [
        breadcrumbOf([
          { name: SITE_NAME, url: `${SITE_URL}${prefix(lang)}/` },
          { name: label, url: canonical },
        ]),
      ];
      const headExtra = buildHead({ lang, title, description, canonical, image: DEFAULT_OG_IMAGE, alternates, jsonLd });
      // الفئة تربط لشركاتها في الـ HTML (روابط داخلية للسيو)
      const body = catCompanies.length
        ? `<main dir="${dirOf(lang)}" style="${BODY_STYLE}"><h1>${esc(title.replace(/ \| CODpromo$/, ""))}</h1>${descText ? `<p>${esc(descText)}</p>` : ""}<ul>${catCompanies
            .map((x) => `<li><a href="${storeUrl(x.slug, lang)}">${esc(x.name)}</a>${loc(x, "discount", lang) ? ` — ${esc(loc(x, "discount", lang))}` : ""}</li>`)
            .join("")}</ul></main>`
        : "";
      return serveTemplate(res, inject(template, { lang, title, description, headExtra, body }));
    }

    if (type === "offers") {
      const L = locale(lang) || locale("ar");
      if (!L?.seo?.offers) return serveTemplate(res, template);
      const title = L.seo.offers.title;
      const description = L.seo.offers.description;
      const canonical = offersUrl(lang);
      const alternates = ["ar", "en", "fr"].map((l) => ({ lang: l, url: offersUrl(l) }));
      const list = await fetchJson(
        `${SUPABASE_URL}/rest/v1/companies?select=slug,name&order=created_at.desc&limit=30`
      );
      const items = (Array.isArray(list) ? list : []).filter((c) => c.slug);
      const jsonLd = [
        {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: title,
          description,
          url: canonical,
          inLanguage: lang,
          ...(items.length
            ? {
                mainEntity: {
                  "@type": "ItemList",
                  itemListElement: items.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, url: storeUrl(c.slug, lang) })),
                },
              }
            : {}),
        },
        breadcrumbOf([
          { name: L.store?.breadcrumbHome || SITE_NAME, url: `${SITE_URL}${prefix(lang)}/` },
          { name: L.offers?.title || title, url: canonical },
        ]),
      ];
      const headExtra = buildHead({ lang, title, description, canonical, image: DEFAULT_OG_IMAGE, alternates, jsonLd });
      return serveTemplate(res, inject(template, { lang, title, description, headExtra }));
    }

    if (type === "partners") {
      const L = locale(lang) || locale("ar");
      const P = L?.partners;
      if (!P?.seo) return serveTemplate(res, template);
      const title = P.seo.title;
      const description = P.seo.description;
      const canonical = partnersUrl(lang);
      const alternates = ["ar", "en", "fr"].map((l) => ({ lang: l, url: partnersUrl(l) }));
      const faq = ["cost", "who", "time", "codes", "edit", "stats"]
        .map((k) => P.faq?.[k])
        .filter((f) => f?.q && f?.a);
      const jsonLd = [
        { "@context": "https://schema.org", "@type": "WebPage", name: title, description, url: canonical, inLanguage: lang },
        ...(faq.length
          ? [{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }]
          : []),
        breadcrumbOf([
          { name: L.store?.breadcrumbHome || SITE_NAME, url: `${SITE_URL}${prefix(lang)}/` },
          { name: P.breadcrumb || title, url: canonical },
        ]),
      ];
      const headExtra = buildHead({ lang, title, description, canonical, image: DEFAULT_OG_IMAGE, alternates, jsonLd });
      return serveTemplate(res, inject(template, { lang, title, description, headExtra }));
    }

    if (type === "premium") {
      const L = locale(lang) || locale("ar");
      const P = L?.premiumPage;
      if (!P?.seo) return serveTemplate(res, template);
      const title = P.seo.title;
      const description = P.seo.description;
      const canonical = premiumUrl(lang);
      const alternates = ["ar", "en", "fr"].map((l) => ({ lang: l, url: premiumUrl(l) }));
      // السعر الحقيقي (pricing_public) + هل المفتاح الذهبي شغّال — بلا أرقام في الكود
      const [pr, ss] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/rpc/pricing_public`, {
          method: "POST",
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
          body: "{}",
        }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetchJson(`${SUPABASE_URL}/rest/v1/site_stats?select=free_key_enabled`).catch(() => null),
      ]);
      const price = (d, u) => fill(L.pricing?.format, { dzd: num(d, lang), usd: num(u, lang) });
      const faqKeys = ["lifetime", "price", "account", "methods", "refund", "renewal", "frozen", "newCodes", ...(ss?.[0]?.free_key_enabled ? ["goldenKey"] : []), "stork"];
      const faq = faqKeys
        .map((k) => {
          if (k === "price") {
            if (!pr) return null;
            const a = pr.tier === "launch" ? L.premiumFaq?.price?.aLaunch : L.premiumFaq?.price?.aRegular;
            return { q: L.premiumFaq?.price?.q, a: fill(a, { launch: price(pr.launch_dzd, pr.launch_usd), regular: price(pr.regular_dzd, pr.regular_usd), seats: num(pr.seats_total, lang), left: num(pr.seats_left, lang) }) };
          }
          const f = L.premiumFaq?.[k] || P.faq?.[k];
          return f ? { q: f.q, a: f.a } : null;
        })
        .filter((f) => f?.q && f?.a);
      const jsonLd = [
        {
          "@context": "https://schema.org",
          "@type": "Product",
          name: L.pricing?.productName || title,
          description: P.seo.productDesc || description,
          image: DEFAULT_OG_IMAGE,
          brand: { "@type": "Brand", name: SITE_NAME },
          url: canonical,
          ...(pr
            ? {
                offers: [
                  { currency: "USD", price: pr.price_usd },
                  { currency: "DZD", price: pr.price_dzd },
                ].map((o) => ({ "@type": "Offer", price: String(o.price), priceCurrency: o.currency, availability: "https://schema.org/InStock", url: canonical, seller: { "@type": "Organization", name: SITE_NAME } })),
              }
            : {}),
        },
        ...(faq.length
          ? [{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }]
          : []),
        breadcrumbOf([
          { name: L.store?.breadcrumbHome || SITE_NAME, url: `${SITE_URL}${prefix(lang)}/` },
          { name: P.breadcrumb || "Premium", url: canonical },
        ]),
      ];
      const headExtra = buildHead({ lang, title, description, canonical, image: DEFAULT_OG_IMAGE, alternates, jsonLd });
      return serveTemplate(res, inject(template, { lang, title, description, headExtra }));
    }

    return serveTemplate(res, template);
  } catch {
    // أي خطأ → نخدم القالب كما هو (يعمل التطبيق من جهة المتصفّح طبيعياً).
    return serveTemplate(res, template);
  }
}

/** t(key, vars) من ملفات الترجمة (fallback للعربية) — نفس صيغة i18next ({{x}} + _one/_other). */
function makeT(L, AR) {
  const get = (obj, key) => key.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
  return (key, vars = {}) => {
    let v = get(L, key) ?? get(AR, key);
    if (v == null && vars.count != null) v = get(L, `${key}_${vars.count === 1 ? "one" : "other"}`) ?? get(AR, `${key}_other`);
    return fill(v ?? "", vars);
  };
}

async function postJson(url, body) {
  try {
    const r = await fetch(url, { method: "POST", headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return r.ok ? r.json() : null;
  } catch {
    return null;
  }
}

const BODY_STYLE = "max-width:960px;margin:0 auto;padding:110px 16px 40px;color:#c9c9cf;font-family:Tajawal,Inter,sans-serif;line-height:1.7";
const TYPE_OF = { "تخفيض": "discount", "كوبون": "coupon", "كاش باك": "cashback" };

/** صفحة الشركة كـ HTML بسيط (نفس النصوص اللي يعرضها React): العنوان، العروض، الخطوات، النبذة، الأسئلة، المشابهة. */
function storeBody({ c, lang, t, L, catLabel, catUrl, crumbs, steps, faq, similar, rating }) {
  const value = locText(c, "discount", lang);
  const premium = storeHasPremium(c) ? locText(c, "premium_discount", lang) : "";
  const about = locText(c, "about", lang);
  const lines = (txt) => String(txt || "").split(/\r?\n/).map((x) => x.replace(/^\s*(?:[-–•*·]|\d+[.)-])\s*/, "").trim()).filter(Boolean);
  const features = lines(locText(c, "features", lang));
  const typeLabel = L.types?.[TYPE_OF[c.type] || "discount"] || "";
  const n = Number(rating?.count) || 0;
  let h = `<main dir="${dirOf(lang)}" style="${BODY_STYLE}">`;
  h += `<nav aria-label="breadcrumb">${crumbs.map((x, i) => (i < crumbs.length - 1 ? `<a href="${esc(x.url)}">${esc(x.name)}</a> › ` : `<span>${esc(x.name)}</span>`)).join("")}</nav>`;
  h += `<h1>${esc(c.name)}</h1><p>${esc(typeLabel)}${catLabel ? ` · ${catUrl ? `<a href="${esc(catUrl)}">${esc(catLabel)}</a>` : esc(catLabel)}` : ""}</p>`;
  if (n >= RATING_MIN_AVG && rating?.avg != null) h += `<p>★ ${esc(rating.avg)} / 5 · ${esc(t("storePage.rating.count", { count: n }))}</p>`;
  if (locText(c, "description", lang)) h += `<p>${esc(locText(c, "description", lang))}</p>`;
  h += `<section><h2>${esc(t("storePage.offersTitle", { name: c.name }))}</h2>`;
  if (value) h += `<p><strong>${esc(value)}</strong>${c.code ? ` — ${esc(t("storePage.codeLabel"))}: <code>${esc(c.code)}</code>` : ""}</p>`;
  if (premium) h += `<p>${esc(t("storePage.premiumWith"))}: <strong>${esc(premium)}</strong>${locText(c, "premium_description", lang) ? ` — ${esc(locText(c, "premium_description", lang))}` : ""}</p>`;
  h += `</section>`;
  if (steps.length) h += `<section><h2>${esc(t("storePage.stepsTitle", { name: c.name }))}</h2><ol>${steps.map((st) => `<li>${st.title ? `<strong>${esc(st.title)}</strong>: ` : ""}${esc(st.desc)}</li>`).join("")}</ol></section>`;
  if (about || features.length) {
    h += `<section><h2>${esc(t("storePage.aboutTitle", { name: c.name }))}</h2>`;
    h += lines(about).map((p) => `<p>${esc(p)}</p>`).join("");
    if (features.length) h += `<ul>${features.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
    h += `</section>`;
  }
  if (faq.length) h += `<section><h2>${esc(t("storePage.faq.title", { name: c.name }))}</h2>${faq.map((q) => `<h3>${esc(q.q)}</h3><p>${esc(q.a)}</p>`).join("")}</section>`;
  if (similar.length) {
    h += `<section><h2>${esc(t("storePage.similarTitle"))}</h2><ul>${similar
      .map((x) => `<li><a href="${esc(storeUrl(x.slug, lang))}">${esc(x.name)}</a>${loc(x, "discount", lang) ? ` — ${esc(loc(x, "discount", lang))}` : ""}</li>`)
      .join("")}</ul>${catUrl && catLabel ? `<p><a href="${esc(catUrl)}">${esc(t("storePage.similarAll", { category: catLabel }))}</a></p>` : ""}</section>`;
  }
  return h + "</main>";
}

function breadcrumbOf(items) {
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: it.url })) };
}
function serveTemplate(res, html) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=600, stale-while-revalidate=86400");
  res.status(200).send(html);
}
