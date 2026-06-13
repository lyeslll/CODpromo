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
// ============================================================

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

function slugify(v) {
  return String(v || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-{2,}/g, "-").replace(/^-+|-+$/g, "");
}
function loc(obj, field, lang) {
  if (!obj) return "";
  return (lang !== "ar" && obj[`${field}_${lang}`]) || obj[field] || "";
}
function monthYear(lang) {
  try {
    return new Intl.DateTimeFormat(lang === "ar" ? "ar" : lang, { month: "long", year: "numeric" }).format(new Date());
  } catch {
    return String(new Date().getFullYear());
  }
}
function esc(s) {
  return String(s == null ? "" : s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
}

function storeTitle(c, lang) {
  const custom = loc(c, "seo_title", lang);
  if (custom) return custom;
  const name = c.name || SITE_NAME;
  const d = loc(c, "discount", lang);
  const my = monthYear(lang);
  if (lang === "en") return `${name} Promo Code ${my}${d ? ` — ${d} Off` : ""} | ${SITE_NAME}`;
  if (lang === "fr") return `Code Promo ${name} ${my}${d ? ` — ${d} de réduction` : ""} | ${SITE_NAME}`;
  return `كود خصم ${name} ${my}${d ? ` - خصم ${d}` : ""} | ${SITE_NAME}`;
}
function storeDescription(c, lang) {
  const custom = loc(c, "seo_description", lang);
  if (custom) return custom;
  const desc = loc(c, "description", lang);
  if (desc) return desc.length > 300 ? `${desc.slice(0, 297)}…` : desc;
  const name = c.name || SITE_NAME;
  const d = loc(c, "discount", lang);
  if (lang === "en") return `Get the latest ${name} promo codes and coupons${d ? ` — save ${d}` : ""}. Verified working discount codes on ${SITE_NAME}.`;
  if (lang === "fr") return `Obtenez les derniers codes promo et coupons ${name}${d ? ` — économisez ${d}` : ""}. Codes de réduction vérifiés sur ${SITE_NAME}.`;
  return `أحدث أكواد خصم وكوبونات ${name}${d ? ` — وفّر ${d}` : ""}. أكواد مفعّلة ومجرّبة على ${SITE_NAME}.`;
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

async function getTemplate(host) {
  if (templateCache[host]) return templateCache[host];
  const r = await fetch(`https://${host}/index.html`);
  const html = await r.text();
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

function inject(template, { lang, title, description, headExtra }) {
  let html = template;
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
    template = await getTemplate(host);
  } catch {
    // تعذّر جلب القالب — لا نكسر الصفحة: نُعيد توجيه بسيط لخدمة SPA.
    res.status(302).setHeader("Location", "/index.html");
    return res.end();
  }

  try {
    if (type === "store") {
      const data = await fetchJson(
        `${SUPABASE_URL}/rest/v1/companies?slug=eq.${encodeURIComponent(slug)}&select=*,company_faqs(*)`
      );
      const c = Array.isArray(data) ? data[0] : null;
      if (!c) return serveTemplate(res, template);

      const title = storeTitle(c, lang);
      const description = storeDescription(c, lang);
      const image = /^https?:\/\//i.test(c.logo || "") ? c.logo : DEFAULT_OG_IMAGE;
      const canonical = storeUrl(c.slug, lang);
      const alternates = ["ar", "en", "fr"].map((l) => ({ lang: l, url: storeUrl(c.slug, l) }));
      const catLabel = loc(c, "category", lang);
      const jsonLd = [
        { "@context": "https://schema.org", "@type": "Organization", name: c.name, url: canonical, description, ...(/^https?:\/\//i.test(c.logo || "") ? { logo: c.logo } : {}), ...(c.link ? { sameAs: [c.link] } : {}) },
        { "@context": "https://schema.org", "@type": "Offer", name: title, description, url: canonical, ...(catLabel ? { category: catLabel } : {}), seller: { "@type": "Organization", name: c.name }, availability: "https://schema.org/InStock" },
        faqLdOf(c.company_faqs, lang),
        breadcrumbOf([
          { name: SITE_NAME, url: `${SITE_URL}${prefix(lang)}/` },
          { name: c.name, url: canonical },
        ]),
      ];
      const headExtra = buildHead({ lang, title, description, canonical, image, alternates, jsonLd });
      return serveTemplate(res, inject(template, { lang, title, description, headExtra }));
    }

    if (type === "category") {
      let label = "";
      let count = 0;
      let descText = "";

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
          `${SUPABASE_URL}/rest/v1/companies?category_id=eq.${cat.id}&select=id`
        );
        count = Array.isArray(linked) ? linked.length : 0;
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
      return serveTemplate(res, inject(template, { lang, title, description, headExtra }));
    }

    return serveTemplate(res, template);
  } catch {
    // أي خطأ → نخدم القالب كما هو (يعمل التطبيق من جهة المتصفّح طبيعياً).
    return serveTemplate(res, template);
  }
}

function faqLdOf(faqs, lang) {
  const list = (faqs || [])
    .map((f) => ({ q: (lang !== "ar" && f[`question_${lang}`]) || f.question, a: (lang !== "ar" && f[`answer_${lang}`]) || f.answer }))
    .filter((f) => f.q && f.a);
  if (!list.length) return null;
  return { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: list.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) };
}
function breadcrumbOf(items) {
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: it.url })) };
}
function serveTemplate(res, html) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=600, stale-while-revalidate=86400");
  res.status(200).send(html);
}
