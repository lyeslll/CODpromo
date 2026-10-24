import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { fetchCompanies } from "../lib/supabase.js";
import { fetchSiteStats } from "../lib/siteStats.js";
import { usePremium } from "../lib/premium.jsx";
import { useVoteStats } from "../lib/voteStats.jsx";
import { useCategories } from "../lib/categories.jsx";
import { useOfferActions } from "../lib/useOfferActions.js";
import { activeCategories, countByCategory, successRank } from "../lib/offerFilters.js";
import { SITE_NAME, SITE_URL, DEFAULT_OG_IMAGE, homeUrl, offersPath, offersUrl, buildAlternates } from "../lib/seo.js";
import { pickHeroOffer } from "../components/landing/magic/couponData.js";
import { useFeaturedRows, joinFeatured } from "../lib/featured.js";

import Navbar from "../components/Navbar.jsx";
import Footer, { SOCIALS } from "../components/Footer.jsx";
import Seo from "../components/Seo.jsx";
import { useGoPremium } from "../lib/goPremium.js";
import EmailPopup from "../components/EmailPopup.jsx";
import CopyToast from "../components/CopyToast.jsx";
import LandingHero from "../components/landing/LandingHero.jsx";
import StatsStrip from "../components/landing/StatsStrip.jsx";
import FeaturedSection from "../components/featured/FeaturedSection.jsx";
import { premiumFaqItems } from "../components/landing/PremiumFaq.jsx";
import { usePricing } from "../lib/pricing.jsx";
import { useAndroidApp } from "../lib/androidApp.js";

// الأقسام تحت أول شاشة: chunk وحدو يتحمّل مباشرة بعد أول رسم (شوف HomeBelow.jsx)
const HomeBelow = lazy(() => import("../components/landing/HomeBelow.jsx"));

// ============================================================
//  الصفحة الرئيسية = صفحة تعريف (landing) لتجّار الدفع عند الاستلام.
//  كل العروض والفلاتر في /offers. كل رقم هنا من site_stats أو من قاعدة البيانات.
// ============================================================
export default function Home() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const navigate = useNavigate();
  const location = useLocation();
  const { unlocked, hasPremium } = usePremium();
  const { stats: voteStats } = useVoteStats();
  const { categories, byId } = useCategories();

  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [siteStats, setSiteStats] = useState(null);
  const goPremium = useGoPremium();
  const { favorites, toggleFav, handleCopy, toast } = useOfferActions(setCompanies);

  // الروابط القديمة لقسم العروض في الرئيسية (/#stores) تتحوّل لصفحة /offers
  useEffect(() => {
    if (location.hash === "#stores") navigate(offersPath(lang), { replace: true });
  }, [location.hash, navigate, lang]);

  useEffect(() => {
    let active = true;
    fetchCompanies()
      .then((data) => active && setCompanies(Array.isArray(data) ? data : []))
      .catch(() => active && setCompanies([]))
      .finally(() => active && setLoading(false));
    // فشل = {} (ماشي null): الأقسام تبطّل الانتظار وتخبّي الأرقام بلا ما تبقى فارغة
    fetchSiteStats().then((s) => active && setSiteStats(s || {}));
    return () => {
      active = false;
    };
  }, []);

  // العروض المميّزة (يختارها الأدمن) — لا تتكرّر في عيّنة آخر الصفحة
  const featuredRows = useFeaturedRows();
  const featured = useMemo(() => joinFeatured(featuredRows, companies), [featuredRows, companies]);
  const featuredIds = useMemo(() => new Set(featured.map((f) => f.company.id)), [featured]);

  const cats = useMemo(() => activeCategories(categories), [categories]);
  const counts = useMemo(() => countByCategory(companies, cats), [companies, cats]);
  const [belowReady, setBelowReady] = useState(false);
  const markBelowReady = useCallback(() => setBelowReady(true), []);

  // روابط #how و #categories (من الهيدر أو روابط قديمة) — نمرّر بعد ظهور القسم
  useEffect(() => {
    const id = location.hash?.slice(1);
    if (!id || id === "stores") return;
    const tmr = setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    return () => clearTimeout(tmr);
  }, [location.hash, location.key, cats.length, loading, belowReady]);

  // نفس العرض الحقيقي للكوبون السحري يُستعمل في مقارنة عادي/Premium
  const heroOffer = useMemo(() => pickHeroOffer(companies, voteStats), [companies, voteStats]);
  const compareCompany = useMemo(
    () => heroOffer || companies.find((c) => c.supports_premium !== false && c.premium_discount) || null,
    [heroOffer, companies]
  );
  // بطاقة التشريح: أنجح عرض له كود ورابط
  const anatomyCompany = useMemo(() => {
    const list = companies.filter((c) => c.code && c.link);
    if (!list.length) return companies[0] || null;
    return list.slice().sort((a, b) => successRank(voteStats, b.id) - successRank(voteStats, a.id))[0];
  }, [companies, voteStats]);

  // ===== السيو =====
  const pricing = usePricing();
  const inAndroidApp = useAndroidApp() === "app";
  const faqItems = premiumFaqItems(t, lang, pricing, inAndroidApp);
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
      logo: DEFAULT_OG_IMAGE,
      description: t("seo.home.description"),
      sameAs: SOCIALS.filter((s) => /^https?:/.test(s.href)).map((s) => s.href),
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE_NAME,
      url: homeUrl(lang),
      inLanguage: lang,
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: `${offersUrl(lang)}?q={search_term_string}` },
        "query-input": "required name=search_term_string",
      },
    },
    // Premium مدى الحياة: دفعة واحدة بالسعر الحالي (إطلاق / عادي من pricing_settings)
    ...(pricing
      ? [
          {
            "@context": "https://schema.org",
            "@type": "Product",
            name: t("pricing.productName"),
            description: t("premiumFaq.lifetime.a"),
            image: DEFAULT_OG_IMAGE,
            brand: { "@type": "Brand", name: SITE_NAME },
            offers: [
              { currency: "USD", price: pricing.usd },
              { currency: "DZD", price: pricing.dzd },
            ].map((o) => ({
              "@type": "Offer",
              price: String(o.price),
              priceCurrency: o.currency,
              availability: "https://schema.org/InStock",
              url: homeUrl(lang),
              seller: { "@type": "Organization", name: SITE_NAME },
            })),
          },
        ]
      : []),
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqItems.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-ink)] text-[var(--text)]">
      <Seo
        lang={lang}
        title={t("seo.home.title")}
        description={t("seo.home.description")}
        canonical={homeUrl(lang)}
        alternates={buildAlternates("home")}
        jsonLd={jsonLd}
      />
      <Navbar />

      <main>
        <LandingHero
          companies={companies}
          loading={loading}
          voteStats={voteStats}
          categories={cats}
          byId={byId}
          counts={counts}
          stats={siteStats}
          onOpenPremium={goPremium}
          isPremiumActive={hasPremium}
        />
        <StatsStrip stats={siteStats} />
        <FeaturedSection
          items={featured}
          pending={featuredRows === null || (featuredRows.length > 0 && loading)}
          favorites={favorites}
          onToggleFav={toggleFav}
          onCopy={handleCopy}
          unlocked={unlocked}
          onUnlock={goPremium}
        />
        {/* مكان محجوز طويل (تحت الشاشة) حتى يوصل الـ chunk — الفوتر ما يطلعش للفوق */}
        <Suspense fallback={<div aria-hidden className="min-h-[260vh]" />}>
          <HomeBelow
            companies={companies}
            voteStats={voteStats}
            cats={cats}
            counts={counts}
            siteStats={siteStats}
            anatomyCompany={anatomyCompany}
            compareCompany={compareCompany}
            featuredIds={featuredIds}
            favorites={favorites}
            toggleFav={toggleFav}
            handleCopy={handleCopy}
            unlocked={unlocked}
            goPremium={goPremium}
            hasPremium={hasPremium}
            pricing={pricing}
            onReady={markBelowReady}
          />
        </Suspense>
      </main>

      <Footer />
      <CopyToast code={toast} />
      <EmailPopup />
    </div>
  );
}
