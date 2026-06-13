// ============================================================
//  CODpromo — sitemap.xml ديناميكي (دالة Vercel Serverless)
//  يُولّد عند كل طلب من بيانات Supabase الحالية، فيتحدّث تلقائياً
//  عند إضافة أي شركة — بلا إعادة بناء/نشر.
//  مرتبط عبر vercel.json: /sitemap.xml → /api/sitemap
// ============================================================

const SITE_URL = "https://codpromo.com";
const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || "https://uulcgvdsqivgkiulurhk.supabase.co";
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  "sb_publishable_kxiLaS2RxTEeZA6TrJQR_w_ws8twFBt";

const LANGS = ["ar", "en", "fr"];

function slugify(v) {
  return String(v || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

const prefix = (lang) => (lang === "ar" ? "" : `/${lang}`);
const storeUrl = (slug, lang) => `${SITE_URL}${prefix(lang)}/store/${slug}`;
const categoryUrl = (slug, lang) => `${SITE_URL}${prefix(lang)}/category/${slug}`;
const homeUrl = (lang) => `${SITE_URL}${prefix(lang)}/`;

function xmlEscape(s) {
  return String(s || "").replace(/[<>&'"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c])
  );
}

/** عقدة <url> واحدة مع روابط hreflang المتبادلة + x-default. */
function urlNode(loc, urlFor, lastmod) {
  const alts = LANGS.map(
    (l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${xmlEscape(urlFor(l))}"/>`
  ).join("");
  const xdefault = `<xhtml:link rel="alternate" hreflang="x-default" href="${xmlEscape(urlFor("ar"))}"/>`;
  return (
    `<url><loc>${xmlEscape(loc)}</loc>` +
    (lastmod ? `<lastmod>${xmlEscape(lastmod)}</lastmod>` : "") +
    alts +
    xdefault +
    `</url>`
  );
}

export default async function handler(req, res) {
  try {
    const sbHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/companies?select=slug,category,category_en,created_at&order=created_at.desc`,
      { headers: sbHeaders }
    );
    const companies = r.ok ? await r.json() : [];

    // الفئات من الجدول (المصدر الحقيقي) — المفعّلة فقط
    const cr = await fetch(
      `${SUPABASE_URL}/rest/v1/categories?select=slug,is_active&is_active=eq.true&order=sort_order.asc`,
      { headers: sbHeaders }
    );
    const categories = cr.ok ? await cr.json() : [];

    const nodes = [];

    // الصفحة الرئيسية بالثلاث لغات
    for (const lang of LANGS) {
      nodes.push(urlNode(homeUrl(lang), (l) => homeUrl(l), null));
    }

    // صفحات الفئات (فريدة) — من جدول categories، مع fallback للنص الحر القديم
    const seenCat = new Set();
    const addCat = (cslug) => {
      if (!cslug || seenCat.has(cslug)) return;
      seenCat.add(cslug);
      for (const lang of LANGS) {
        nodes.push(urlNode(categoryUrl(cslug, lang), (l) => categoryUrl(cslug, l), null));
      }
    };
    if (categories.length > 0) {
      for (const cat of categories) addCat(cat.slug);
    } else {
      // قبل الهجرة / تعذّر جلب الجدول: اشتقّ من النص الحر للشركات كي لا تختفي الفئات
      for (const c of companies) addCat(slugify(c.category_en) || slugify(c.category));
    }

    // صفحات الشركات
    for (const c of companies) {
      if (!c.slug) continue;
      const lastmod = c.created_at ? new Date(c.created_at).toISOString() : null;
      for (const lang of LANGS) {
        nodes.push(urlNode(storeUrl(c.slug, lang), (l) => storeUrl(c.slug, l), lastmod));
      }
    }

    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ` +
      `xmlns:xhtml="http://www.w3.org/1999/xhtml">` +
      nodes.join("") +
      `</urlset>`;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400");
    res.status(200).send(xml);
  } catch (e) {
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.status(200).send(
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${SITE_URL}/</loc></url></urlset>`
    );
  }
}
