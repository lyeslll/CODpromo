import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowDown, Crown, Gift, KeyRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ensureLang } from "../i18n/index.js";
import Navbar from "../components/Navbar.jsx";
import Footer from "../components/Footer.jsx";
import Seo from "../components/Seo.jsx";
import PremiumModal from "../components/PremiumModal.jsx";
import GoldenPass from "../components/premium-page/GoldenPass.jsx";
import CompareLedger from "../components/premium-page/CompareLedger.jsx";
import PartnerLogos from "../components/premium-page/PartnerLogos.jsx";
import HowItWorks from "../components/premium-page/HowItWorks.jsx";
import PriceSection from "../components/premium-page/PriceSection.jsx";
import PremiumPageFaq, { premiumPageFaqItems, stripServerFaqQuestions } from "../components/premium-page/PremiumPageFaq.jsx";
import StickyBuy from "../components/premium-page/StickyBuy.jsx";
import KeysSection from "../components/keys/KeysSection.jsx";
import { useMobileFx } from "../components/featured/mobile.js";
import { loadHeaderOffers, useSharedStats } from "../components/header/headerData.js";
import { useAuth } from "../lib/auth.jsx";
import { usePremium } from "../lib/premium.jsx";
import { usePricing, usePricingRefresh, formatPrice } from "../lib/pricing.jsx";
import { useFreeKey } from "../lib/freeKeyContext.jsx";
import { useAndroidApp } from "../lib/androidApp.js";
import { canUseFx } from "../lib/fxCapability.js";
import { hasPremiumOffer } from "../lib/premiumOffer.js";
import { clearPendingPremium } from "../lib/goPremium.js";
import { formatNumber } from "../lib/values.js";
import { buildAlternates, premiumUrl, homeUrl, offersLink, DEFAULT_OG_IMAGE, SITE_NAME } from "../lib/seo.js";

const GOLD_SOFT = "#ffe486";
const GOLD_BG = "linear-gradient(135deg, #ffe486, #f0c63c 55%, #cf9a1e)";

/** يراقب عنصر: true ما دام ظاهر في الشاشة (للشريط العائم). */
function useOnScreen(ref, enabled = true) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    const io = new IntersectionObserver(([e]) => setOn(e.isIntersecting), { rootMargin: "0px 0px -60px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, enabled]);
  return on;
}

/**
 * صفحة بيع Premium (/premium، /en/premium، /fr/premium): كل زر Premium في الموقع يوصّل هنا،
 * ونافذة الدفع تتحلّ غير من زر الشراء. كل الأرقام حقيقية: السعر والمقاعد (pricing_public)،
 * الشركات واللوغوهات والقيم (companies)، القيمة والمضاعف (site_stats). بلا آراء زبائن (ما عندناش).
 */
export default function PremiumPage({ lang = "ar" }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, loading: authLoading } = useAuth();
  const { isPremiumActive, isLifetime, isGift, gift, premiumReady } = usePremium();
  // الـ Hero يتبدّل كامل حسب الحالة (زائر / عضو / هدية): قبل ما نعرفوها، بلاصتو محجوزة ومخفية — بلاها العضو يشوف
  // نسخة الزائر (السعر وزر الشراء) ومن بعد تتبدّل قدّامو (CLS 0.37 في التطبيق). الزائر: فوري.
  const heroPending = authLoading || !premiumReady;
  const pricing = usePricing();
  const refreshPricing = usePricingRefresh();
  const stats = useSharedStats();
  const { status: freeKeyStatus } = useFreeKey();
  const appMode = useAndroidApp();
  const mobile = useMobileFx();
  const [fxOk] = useState(canUseFx);
  const fx = !mobile && fxOk;

  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pricingReady, setPricingReady] = useState(false);
  const [modal, setModal] = useState(null); // null | "home" | "stork"

  const heroRef = useRef(null);
  const heroCtaRef = useRef(null);
  const priceCtaRef = useRef(null);
  const finalRef = useRef(null);

  useEffect(() => {
    let active = true;
    loadHeaderOffers().then((d) => {
      if (!active) return;
      setCompanies(d);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  // السعر يتعاود يتجاب عند فتح الصفحة (العدّاد حقيقي في هاد اللحظة)
  useEffect(() => {
    refreshPricing().finally(() => setPricingReady(true));
  }, [refreshPricing]);

  // رجع من التسجيل / الدخول بعد ما ضغط "اشترِ" (?checkout=1) → النافذة تتحلّ وحدها
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("checkout") !== "1" || authLoading) return;
    clearPendingPremium();
    navigate(location.pathname, { replace: true });
    if (user && !isPremiumActive) setModal("home");
  }, [location.search, location.pathname, authLoading, user, isPremiumActive, navigate]);

  // /premium#keys (بطاقة "مفاتيحك"، لوحة المفاتيح، الداشبورد، البطاقة المقفولة…) → قسم المفاتيح بعد ما تظهر الصفحة
  // (كيما /terms#keys والرئيسية)، ويتعاود كي يتحمّل اللي فوقو (الشركات، السعر، الأرقام، حالة الحساب)
  useEffect(() => {
    if (location.hash !== "#keys") return;
    const tmr = setTimeout(() => document.getElementById("keys")?.scrollIntoView({ block: "start" }), 150);
    return () => clearTimeout(tmr);
  }, [location.hash, location.key, loading, pricingReady, heroPending, stats]);

  const premiumCos = useMemo(() => companies.filter(hasPremiumOffer), [companies]);
  const n = premiumCos.length;
  const companiesText = n ? t("premiumPage.companies", { count: n, n: formatNumber(n, lang) }) : null;
  const logos = useMemo(() => premiumCos.filter((c) => /^https?:\/\//i.test(c.logo || "")), [premiumCos]);
  const holder = profile?.full_name || user?.user_metadata?.full_name || null;
  const member = isPremiumActive;
  const offersTo = offersLink(lang, { mode: "premium" });
  const fmtDay = (d) => new Date(d).toLocaleDateString(i18n.language, { day: "numeric", month: "long", year: "numeric" });

  const buy = () => setModal("home");
  const stork = () => setModal("stork");

  // الشريط العائم: بعد زر الـ Hero، وما دام زر السعر والـ CTA الأخير ماهمش قدّامك
  const heroCtaOn = useOnScreen(heroCtaRef, !member);
  const priceCtaOn = useOnScreen(priceCtaRef, !member);
  const finalOn = useOnScreen(finalRef, !member);
  // قسم المفاتيح الماسية قدّامك: الشريط العائم تاع Premium يتخبّى (كان يغطّي زر الباقة)
  const keysRef = useRef(null);
  useEffect(() => {
    keysRef.current = document.getElementById("keys");
  });
  const keysOn = useOnScreen(keysRef, !member);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 320);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const stickyVisible = !member && scrolled && !heroCtaOn && !priceCtaOn && !finalOn && !keysOn && modal === null;

  // داخل التطبيق برك (نفس كشف androidApp.js): البيانات المخفية بلا سؤال طرق الدفع — حتى اللي حطّها الخادم
  // (api/prerender.js، فيها جواب الويب). Google وزوار المتصفح يلقاوها كاملة.
  useEffect(() => {
    if (appMode !== "app") return;
    // en / fr تتحمّل غير كي تلزم (i18n/index.js) → نحمّلوهم قبل ما نقارنو النصوص
    Promise.all(["en", "fr"].map(ensureLang))
      .catch(() => {})
      .then(() => stripServerFaqQuestions(["ar", "en", "fr"].map((l) => i18n.getFixedT(l)("premiumFaq.methods.q"))));
  }, [appMode, i18n]);

  // SEO: Product (السعر الحقيقي بالدولار والدينار) + FAQPage (نفس الأسئلة الظاهرة؛ في التطبيق بلا طرق الدفع) + Breadcrumb
  const canonical = premiumUrl(lang);
  const faqItems = premiumPageFaqItems(t, lang, pricing, appMode, freeKeyStatus !== "off");
  const ldFaqItems = appMode === "app" ? faqItems.filter((f) => f.k !== "methods") : faqItems;
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: t("pricing.productName"),
      description: t("premiumPage.seo.productDesc"),
      image: DEFAULT_OG_IMAGE,
      brand: { "@type": "Brand", name: SITE_NAME },
      url: canonical,
      ...(pricing && !pricing.isTest
        ? {
            offers: [
              { currency: "USD", price: pricing.usd },
              { currency: "DZD", price: pricing.dzd },
            ].map((o) => ({
              "@type": "Offer",
              price: String(o.price),
              priceCurrency: o.currency,
              availability: "https://schema.org/InStock",
              url: canonical,
              seller: { "@type": "Organization", name: SITE_NAME },
            })),
          }
        : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: ldFaqItems.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: t("store.breadcrumbHome"), item: homeUrl(lang) },
        { "@type": "ListItem", position: 2, name: t("premiumPage.breadcrumb"), item: canonical },
      ],
    },
  ];

  // نص الـ Hero حسب الحالة: عضو / هدية / زائر
  let pill = null;
  let title = t("premiumPage.hero.title");
  let sub = companiesText ? t("premiumPage.hero.sub", { companies: companiesText }) : t("premiumPage.hero.subLoading");
  // قبل ما يوصل عدد الشركات: الجملة النهائية (بعدد محجوز 88) مخفية تحت نص التحميل → نفس الطول، الأزرار ما يقفزوش
  let subGhost = companiesText ? null : t("premiumPage.hero.sub", { companies: t("premiumPage.companies", { count: 88, n: formatNumber(88, lang) }) });
  if (member) {
    pill = { icon: Crown, text: t("premiumPage.hero.memberPill") };
    title = t("premiumPage.hero.memberTitle");
    sub = isLifetime || !profile?.premium_until ? t("premiumPage.hero.memberLifetime") : t("premiumPage.hero.memberUntil", { date: fmtDay(profile.premium_until) });
    subGhost = null;
  } else if (isGift && gift?.premium_until) {
    pill = { icon: Gift, text: t("premiumPage.hero.giftPill", { date: fmtDay(gift.premium_until) }) };
    title = t("premiumPage.hero.giftTitle");
    sub = t("premiumPage.hero.giftSub", { date: fmtDay(gift.premium_until) });
    subGhost = null;
  } else if (pricing?.isLaunch) {
    pill = { icon: null, text: t("premiumPage.hero.launchPill"), dot: true };
  } else if (!pricing) {
    // السعر مازال ما وصلش: الوسم مخفي في بلاصتو (الإطلاق = الحالة العادية دروك) باش العنوان والأزرار ما يقفزوش
    pill = { icon: null, text: t("premiumPage.hero.launchPill"), dot: true, ghost: true };
  }

  return (
    <div className="min-h-screen overflow-x-hidden text-[var(--text)]">
      <Seo
        lang={lang}
        title={t("premiumPage.seo.title")}
        description={t("premiumPage.seo.description")}
        canonical={canonical}
        alternates={buildAlternates("premium")}
        jsonLd={jsonLd}
        type="product"
      />
      <Navbar />

      {/* Hero */}
      <section ref={heroRef} className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(50% 60% at 78% 30%, rgba(240,198,60,0.14), transparent 70%), radial-gradient(40% 40% at 10% 90%, rgba(240,198,60,0.05), transparent 70%)" }}
        />
        <div
          aria-busy={heroPending || undefined}
          className={`relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-[112px] sm:pt-[136px] lg:grid-cols-[1.08fr_0.92fr] lg:gap-16 lg:pb-24 ${heroPending ? "invisible" : ""}`}
        >
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
            {pill && (
              <span aria-hidden={pill.ghost || undefined} className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] font-extrabold ${pill.ghost ? "invisible" : ""}`} style={{ borderColor: "rgba(240,198,60,0.4)", color: GOLD_SOFT, background: "rgba(240,198,60,0.08)" }}>
                {pill.icon ? <pill.icon size={14} /> : <span className="h-2 w-2 rounded-full bg-[#f0c63c]" />}
                {pill.text}
              </span>
            )}
            <h1 className="mt-5 text-balance text-[clamp(32px,8.4vw,40px)] font-black leading-[1.12] tracking-tight sm:text-[52px] lg:text-[58px]">{title}</h1>
            <p className="mt-5 grid max-w-xl text-[16.5px] leading-[1.85] text-[var(--text-soft)] sm:text-[18px]">
              <span className="[grid-area:1/1]">{sub}</span>
              {subGhost && (
                <span aria-hidden className="invisible [grid-area:1/1]">
                  {subGhost}
                </span>
              )}
            </p>

            {/* السعر في أول شاشة (كان يبان غير في البطاقة الذهبية تحت) — من pricing_public، بلا رقم قبل ما يوصل */}
            {/* قبل ما يوصل السعر: نفس السطر مخفي (visibility) باش الأزرار ما يقفزوش — 88… = مكان محجوز برك */}
            {!member && !isGift && (
              <p aria-hidden={!pricing || undefined} className={`mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1 ${pricing ? "" : "invisible"}`}>
                {(pricing ? pricing.isLaunch && pricing.regularDzd != null : true) && (
                  <s className="text-[14px] font-bold text-[var(--text-soft)] decoration-[var(--color-mute)]">
                    <bdi>{pricing ? formatPrice(t, lang, pricing.regularDzd, pricing.regularUsd) : formatPrice(t, lang, 88888, 88)}</bdi>
                  </s>
                )}
                <bdi className="text-[24px] font-black leading-none text-[#ffe486] sm:text-[28px]">
                  {pricing ? formatPrice(t, lang, pricing.dzd, pricing.usd) : formatPrice(t, lang, 8888, 88)}
                </bdi>
                <span className="text-[13.5px] font-bold text-[var(--text-soft)]">{t("premiumPage.hero.priceNote")}</span>
              </p>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              {member ? (
                <Link to={offersTo} className="inline-flex items-center justify-center gap-2 rounded-2xl px-7 py-4 text-[16.5px] font-extrabold text-[#1d1403]" style={{ background: GOLD_BG }}>
                  <Crown size={18} /> {t("premiumPage.hero.memberCta")}
                </Link>
              ) : (
                <>
                  <button
                    ref={heroCtaRef}
                    type="button"
                    onClick={buy}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl px-7 py-4 text-[16.5px] font-extrabold text-[#1d1403] transition-transform hover:scale-[1.02] active:scale-[0.99]"
                    style={{ background: GOLD_BG, boxShadow: "0 18px 44px -16px rgba(240,198,60,0.7)" }}
                  >
                    <Crown size={18} /> {isGift ? t("premiumPage.hero.giftCta") : t("premiumPage.hero.cta")}
                  </button>
                  {isGift ? (
                    <Link to={offersTo} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#f0c63c]/40 px-6 py-4 text-[15.5px] font-extrabold text-[#ffe486] transition-colors hover:bg-[#f0c63c]/10">
                      {t("premiumPage.hero.memberCta")}
                    </Link>
                  ) : (
                    <a href="#compare" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-ink-line)] px-6 py-4 text-[15.5px] font-bold text-[var(--text)] transition-colors hover:bg-[var(--fill)]">
                      {t("premiumPage.hero.seeDiff")} <ArrowDown size={16} />
                    </a>
                  )}
                </>
              )}
            </div>

            {!member && (
              <>
                <p className="mt-5 max-w-lg text-[13.5px] leading-relaxed text-[var(--text-soft)]">{t("premiumPage.hero.assurance")}</p>
                <button type="button" onClick={stork} className="mt-3 inline-flex items-center gap-1.5 text-[13.5px] font-bold text-[var(--text-soft)] underline decoration-dotted underline-offset-4 transition-colors hover:text-[var(--text)]">
                  <KeyRound size={14} className="text-[#cf9a1e]" /> {t("premium.storkMemberBtn")}
                </button>
              </>
            )}
          </motion.div>

          <div className="flex justify-center lg:justify-end">
            <GoldenPass pricing={pricing} logos={logos} companiesText={companiesText} holder={holder} member={member} fx={fx} trackRef={heroRef} />
          </div>
        </div>
      </section>

      <CompareLedger companies={companies} loading={loading} />
      <HowItWorks pricing={pricing} />
      <PartnerLogos companies={premiumCos} countText={n ? formatNumber(n, lang) : null} />
      <PriceSection
        ref={priceCtaRef}
        pricing={pricing}
        pricingReady={pricingReady}
        onRetry={() => refreshPricing()}
        stats={stats}
        member={member}
        onBuy={buy}
        offersTo={offersTo}
      />
      {/* المفاتيح الماسية (phase37): الخيار الثاني تحت Premium — Premium حقيقي ما يشوفوش */}
      <KeysSection member={member} />
      <PremiumPageFaq items={faqItems} />

      {/* الخطوة التالية */}
      <section className="mx-auto max-w-5xl px-4 pb-24 pt-4">
        <div className="ticket ticket-premium relative" style={{ "--r": "16px", "--edge-base": "rgba(240,198,60,0.4)", "--perf": "rgba(240,198,60,0.55)" }}>
          <div className="ticket-top relative px-6 py-12 text-center sm:px-12" style={{ background: "radial-gradient(70% 90% at 50% 0%, rgba(240,198,60,0.16), transparent 70%), var(--color-ink-card)" }}>
            <h2 className="mx-auto max-w-2xl text-balance text-[28px] font-black leading-tight sm:text-[40px]">
              {member ? t("premiumPage.hero.memberTitle") : t("premiumPage.final.title")}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-[15.5px] leading-[1.8] text-[var(--text-soft)]">{member ? t("premiumPage.hero.memberLifetime") : t("premiumPage.final.sub")}</p>
          </div>
          <div ref={finalRef} className="ticket-stub relative flex flex-col items-center gap-3 px-6 py-6 sm:flex-row sm:justify-center" style={{ background: "rgba(240,198,60,0.06)" }}>
            <span className="ticket-ring ticket-ring-l" />
            <span className="ticket-ring ticket-ring-r" />
            <span className="ticket-perf" />
            {member ? (
              <Link to={offersTo} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl px-7 py-4 text-[16px] font-extrabold text-[#1d1403] sm:w-auto" style={{ background: GOLD_BG }}>
                <Crown size={18} /> {t("premiumPage.hero.memberCta")}
              </Link>
            ) : (
              <>
                <button type="button" onClick={buy} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl px-7 py-4 text-[16px] font-extrabold text-[#1d1403] sm:w-auto" style={{ background: GOLD_BG }}>
                  <Crown size={18} /> {t("premiumPage.hero.cta")}
                </button>
                <button type="button" onClick={stork} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--color-ink-line)] px-6 py-4 text-[15px] font-bold text-[var(--text)] transition-colors hover:bg-[var(--fill)] sm:w-auto">
                  <KeyRound size={16} className="text-[#cf9a1e]" /> {t("premium.storkMemberBtn")}
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      <Footer showCta={false} />

      <StickyBuy visible={stickyVisible} pricing={pricing} onBuy={buy} />
      <PremiumModal open={modal !== null} initialStep={modal || "home"} onClose={() => setModal(null)} />
    </div>
  );
}
