import { useState, useEffect, useMemo } from "react";
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

import Navbar from "../components/Navbar.jsx";
import Footer, { SOCIALS } from "../components/Footer.jsx";
import Seo from "../components/Seo.jsx";
import PremiumModal from "../components/PremiumModal.jsx";
import EmailPopup from "../components/EmailPopup.jsx";
import CopyToast from "../components/CopyToast.jsx";
import LandingHero from "../components/landing/LandingHero.jsx";
import StatsStrip from "../components/landing/StatsStrip.jsx";
import NameStory from "../components/landing/NameStory.jsx";
import Pillars from "../components/landing/Pillars.jsx";
import CardAnatomy from "../components/landing/CardAnatomy.jsx";
import PremiumCompare from "../components/landing/PremiumCompare.jsx";
import CategoryGrid from "../components/landing/CategoryGrid.jsx";
import HowSteps from "../components/landing/HowSteps.jsx";
import TrustSection from "../components/landing/TrustSection.jsx";
import SampleOffers from "../components/landing/SampleOffers.jsx";
import FinalCta from "../components/landing/FinalCta.jsx";

// ============================================================
//  الصفحة الرئيسية = صفحة تعريف (landing) لتجّار الدفع عند الاستلام.
//  كل العروض والفلاتر في /offers. كل رقم هنا من site_stats أو من قاعدة البيانات.
// ============================================================
export default function Home() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const navigate = useNavigate();
  const location = useLocation();
  const { unlocked, isPremiumActive } = usePremium();
  const { stats: voteStats } = useVoteStats();
  const { categories, byId } = useCategories();

  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [siteStats, setSiteStats] = useState(null);
  const [premiumModal, setPremiumModal] = useState(false);
  const { favorites, toggleFav, handleCopy, toast } = useOfferActions(setCompanies);
  const openPremium = () => setPremiumModal(true);

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
    fetchSiteStats().then((s) => active && setSiteStats(s));
    return () => {
      active = false;
    };
  }, []);

  const cats = useMemo(() => activeCategories(categories), [categories]);
  const counts = useMemo(() => countByCategory(companies, cats), [companies, cats]);

  // روابط #how و #categories (من الهيدر أو روابط قديمة) — نمرّر بعد ظهور القسم
  useEffect(() => {
    const id = location.hash?.slice(1);
    if (!id || id === "stores") return;
    const tmr = setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    return () => clearTimeout(tmr);
  }, [location.hash, location.key, cats.length, loading]);

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
      <Navbar onPremium={openPremium} />

      <main>
        <LandingHero
          companies={companies}
          loading={loading}
          voteStats={voteStats}
          categories={cats}
          byId={byId}
          counts={counts}
          onOpenPremium={openPremium}
          isPremiumActive={isPremiumActive}
        />
        <StatsStrip stats={siteStats} />
        <NameStory />
        <Pillars companies={companies} voteStats={voteStats} />
        <CardAnatomy
          company={anatomyCompany}
          isFavorite={anatomyCompany ? favorites.includes(anatomyCompany.id) : false}
          onToggleFav={toggleFav}
          onCopy={handleCopy}
          unlocked={unlocked}
          onUnlock={openPremium}
        />
        <PremiumCompare company={compareCompany} stats={siteStats} onOpenPremium={openPremium} isPremiumActive={isPremiumActive} />
        <CategoryGrid categories={cats} counts={counts} />
        <HowSteps />
        <TrustSection companies={companies} voteStats={voteStats} />
        <SampleOffers
          companies={companies}
          voteStats={voteStats}
          favorites={favorites}
          onToggleFav={toggleFav}
          onCopy={handleCopy}
          unlocked={unlocked}
          onUnlock={openPremium}
        />
        <FinalCta />
      </main>

      <Footer onPremium={openPremium} />
      <CopyToast code={toast} />
      <PremiumModal open={premiumModal} onClose={() => setPremiumModal(false)} />
      <EmailPopup />
    </div>
  );
}
