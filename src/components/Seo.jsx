// ============================================================
//  CODpromo — مكوّن السيو لكل صفحة (meta + Open Graph + Twitter + JSON-LD)
//  يحقن الوسوم من جهة المتصفّح عبر react-helmet-async.
//  (دالة /api/prerender تحقن نفس الوسوم من الخادم لزواحف فيسبوك/واتساب/X.)
// ============================================================

import { Helmet } from "react-helmet-async";
import { SITE_NAME, ogLocale, dirOfLang, DEFAULT_OG_IMAGE } from "../lib/seo.js";

export default function Seo({
  lang = "ar",
  title,
  description,
  keywords,
  canonical,
  image = DEFAULT_OG_IMAGE,
  type = "website",
  alternates = [], // [{ lang, url }]
  jsonLd = [], // مصفوفة كائنات JSON-LD
  noindex = false,
}) {
  const xDefault = alternates.find((a) => a.lang === "ar")?.url || canonical;

  return (
    <Helmet>
      <html lang={lang} dir={dirOfLang(lang)} />
      <title>{title}</title>
      {description && <meta name="description" content={description} />}
      {keywords && <meta name="keywords" content={keywords} />}
      {canonical && <link rel="canonical" href={canonical} />}
      {noindex && <meta name="robots" content="noindex,nofollow" />}

      {/* hreflang المتبادلة */}
      {alternates.map((a) => (
        <link key={a.lang} rel="alternate" hrefLang={a.lang} href={a.url} />
      ))}
      {xDefault && <link rel="alternate" hrefLang="x-default" href={xDefault} />}

      {/* Open Graph */}
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={title} />
      {description && <meta property="og:description" content={description} />}
      {canonical && <meta property="og:url" content={canonical} />}
      <meta property="og:image" content={image} />
      <meta property="og:locale" content={ogLocale(lang)} />

      {/* Twitter / X */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      {description && <meta name="twitter:description" content={description} />}
      <meta name="twitter:image" content={image} />

      {/* JSON-LD */}
      {jsonLd.filter(Boolean).map((obj, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(obj)}
        </script>
      ))}
    </Helmet>
  );
}
