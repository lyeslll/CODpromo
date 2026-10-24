import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Crown } from "lucide-react";
import { useTranslation } from "react-i18next";

import { fetchCompanyBySlug, fetchCompanies } from "../lib/supabase.js";
import { fetchFavoriteIds, addFavorite, removeFavorite } from "../lib/favorites.js";
import { useAuth } from "../lib/auth.jsx";
import { usePremium } from "../lib/premium.jsx";
import { useFreeKey } from "../lib/freeKeyContext.jsx";
import { useVoteStats } from "../lib/voteStats.jsx";
import { useScrollVisibility } from "../lib/scrollVisibility.jsx";
import { getTypeMeta, getTypeKey } from "../lib/types.js";
import { categorySlug, companyCategoryRecord, categoryRecordSlug, categoryName } from "../lib/slug.js";
import { useCategories } from "../lib/categories.jsx";
import { logCodeCopy } from "../lib/copies.js";
import { fetchRatingSummary } from "../lib/ratings.js";
import { supabase } from "../lib/supabaseClient.js";
import {
  storeTitle, storeDescription, storeKeywords, storeImage, storeUrl, categoryUrl, homeUrl, categoryPath, homePath, premiumPath,
  buildAlternates, loc, storeLd,
} from "../lib/seo.js";
import { storeKind, storeSteps, storeFaq, similarStores, storeHasPremium } from "../lib/storeContent.js";

import Navbar from "../components/Navbar.jsx";
import Footer from "../components/Footer.jsx";
import CompanyCard from "../components/CompanyCard.jsx";
import CopyToast from "../components/CopyToast.jsx";
import { useGoPremium } from "../lib/goPremium.js";
import Seo from "../components/Seo.jsx";
import Breadcrumbs from "../components/seo/Breadcrumbs.jsx";
import StoreHero, { accentVars } from "../components/store/StoreHero.jsx";
import StoreRating from "../components/store/StoreRating.jsx";
import { SectionTitle, StoreSteps, StoreAbout, StoreFaq, SimilarStores } from "../components/store/StoreSections.jsx";
import "../components/store/store.css";

// ============================================================
//  صفحة الشركة (/store/:slug — نفس الروابط): التذكرة الكبيرة (أحسن عرض + انسخ الكود)،
//  العروض (عادي + Premium بنفس البطاقة)، الخطوات حسب نوع العرض والشركة، عن الشركة (الأدمن)،
//  التقييم، الأسئلة، شركات مشابهة. نفس النصوص تتولّد في api/prerender.js (src/lib/storeContent.js).
// ============================================================
export default function StorePage({ lang = "ar" }) {
  const { slug } = useParams();
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const { unlocked, premiumReady } = usePremium();
  const fk = useFreeKey();
  const { stats: voteStats } = useVoteStats();
  const navigate = useNavigate();
  const goPremium = useGoPremium();

  const [company, setCompany] = useState(null);
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [toast, setToast] = useState(null);
  const [rating, setRating] = useState(null);
  const [ratingsMap, setRatingsMap] = useState({});
  const toastTimer = useRef(null);
  const copyRef = useRef(null);
  const premiumRef = useRef(null);

  // تحميل الشركة + كل الشركات (للمشابهة) + التقييمات
  useEffect(() => {
    let active = true;
    setLoading(true);
    setNotFound(false);
    setRating(null);
    window.scrollTo(0, 0);
    fetchCompanyBySlug(slug)
      .then((c) => {
        if (!active) return;
        if (!c) setNotFound(true);
        setCompany(c || null);
        if (c) fetchRatingSummary(c.id).then((r) => active && setRating(r)).catch(() => {});
      })
      .catch(() => active && setNotFound(true))
      .finally(() => active && setLoading(false));
    fetchCompanies()
      .then((d) => active && setAll(Array.isArray(d) ? d : []))
      .catch(() => active && setAll([]));
    return () => {
      active = false;
    };
  }, [slug]);

  // معدّلات الشركات المشابهة (مرة وحدة)
  useEffect(() => {
    let active = true;
    supabase
      .rpc("company_rating_summaries")
      .then(({ data }) => {
        if (!active || !Array.isArray(data)) return;
        setRatingsMap(Object.fromEntries(data.map((r) => [r.company_id, { count: Number(r.rating_count), avg: r.rating_avg }])));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setFavorites([]);
      return;
    }
    fetchFavoriteIds(user.id).then(setFavorites).catch(() => setFavorites([]));
  }, [user]);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const toggleFav = (id) => {
    if (!user) {
      navigate("/login");
      return;
    }
    const isFav = favorites.includes(id);
    setFavorites((p) => (isFav ? p.filter((f) => f !== id) : [...p, id]));
    const op = isFav ? removeFavorite(user.id, id) : addFavorite(user.id, id);
    op.catch(() => setFavorites((p) => (isFav ? [...p, id] : p.filter((f) => f !== id))));
  };

  const showToast = useCallback((code) => {
    setToast(code);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  // نسخ من البطاقات (CompanyCard يسجّل النسخة وحدو)
  const handleCopy = useCallback(
    (c, code = c.code) => {
      navigator.clipboard?.writeText(code).catch(() => {});
      showToast(code);
    },
    [showToast]
  );
  // نسخ من التذكرة الكبيرة / الشريط الثابت (الكود العادي، علني)
  const copyNormal = useCallback(
    (code) => {
      navigator.clipboard?.writeText(code).catch(() => {});
      logCodeCopy(company?.id, false, "store");
      showToast(code);
    },
    [company?.id, showToast]
  );
  const revealPremium = () => premiumRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });

  const { byId, categories } = useCategories();
  const meta = company ? getTypeMeta(company.type) : null;
  const catRecord = company ? companyCategoryRecord(company, byId, categories) : null;
  const catLabel = catRecord ? categoryName(catRecord, lang) : company ? loc(company, "category", lang) : "";
  const catSlug = catRecord ? categoryRecordSlug(catRecord) : company ? categorySlug(company) : "";
  const kind = company ? storeKind(company, catSlug) : null;
  const hasPremiumOffer = company ? storeHasPremium(company) : false;

  const { steps, custom } = useMemo(() => (company ? storeSteps(company, { t, lang, kind }) : { steps: [], custom: false }), [company, t, lang, kind]);
  const faqItems = useMemo(
    () => (company ? storeFaq(company, { t, lang, steps, adminFaqs: company.company_faqs }) : []),
    [company, t, lang, steps]
  );
  const similar = useMemo(() => similarStores(company, all, 8), [all, company]);

  // ===== حالات التحميل / عدم الوجود =====
  // الـ Hero يتبدّل حسب الحالة (الكود المقفول للزائر ولا مكشوف للعضو) → الهيكل حتى نعرفوها، بلا قفزة
  if (loading || authLoading || !premiumReady) return <StoreSkeleton />;

  if (notFound || !company) {
    return (
      <div className="min-h-screen bg-[var(--color-ink)] text-[var(--text)]">
        <Seo lang={lang} title={`${t("store.notFoundTitle")} | CODpromo`} description={t("store.notFoundDesc")} noindex canonical={storeUrl(slug, lang)} />
        <Navbar />
        <div className="mx-auto grid min-h-[60vh] max-w-6xl place-items-center px-4 text-center">
          <div>
            <h1 className="text-[24px] font-black">{t("store.notFoundTitle")}</h1>
            <p className="mt-2 text-[14px] text-[var(--color-mute)]">{t("store.notFoundDesc")}</p>
            <Link to={homePath(lang)} className="mt-5 inline-flex min-h-[48px] items-center gap-1.5 rounded-xl px-5 text-[14px] font-extrabold text-[#0a0a0a]" style={{ background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" }}>
              <ArrowLeft size={16} className="ltr:rotate-180" /> {t("store.backHome")}
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const accent = meta.color;
  const canonical = storeUrl(company.slug, lang);
  const catTo = catSlug && catRecord ? categoryPath(catSlug, lang) : null;
  const supportsPremium = company.supports_premium !== false;
  const typeLabel = t(`types.${getTypeKey(company.type)}`);
  const title = storeTitle(company, lang);
  const premiumValue = loc(company, "premium_discount", lang);
  const normalValue = loc(company, "discount", lang);
  const keyUsable = fk.enabled && ["guest", "available"].includes(fk.status) && company.free_reveal_enabled !== false;

  const breadcrumbItems = [
    { name: t("store.breadcrumbHome"), to: homePath(lang) },
    ...(catLabel && catTo ? [{ name: catLabel, to: catTo }] : []),
    { name: company.name },
  ];

  const jsonLd = storeLd(company, {
    lang,
    url: canonical,
    faq: faqItems,
    rating,
    breadcrumb: [
      { name: t("store.breadcrumbHome"), url: homeUrl(lang) },
      ...(catLabel && catTo ? [{ name: catLabel, url: categoryUrl(catSlug, lang) }] : []),
      { name: company.name, url: canonical },
    ],
  });

  return (
    <div className="min-h-screen bg-[var(--color-ink)] text-[var(--text)]">
      <Seo
        lang={lang}
        title={title}
        description={storeDescription(company, lang)}
        keywords={storeKeywords(company, lang)}
        canonical={canonical}
        image={storeImage(company)}
        type="website"
        alternates={buildAlternates("store", company.slug)}
        jsonLd={jsonLd}
      />
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-[92px] sm:pt-[104px]" style={accentVars(accent)}>
        <Breadcrumbs items={breadcrumbItems} />

        <StoreHero
          company={company}
          lang={lang}
          accent={accent}
          typeLabel={typeLabel}
          TypeIcon={meta.icon}
          catLabel={catLabel}
          catTo={catTo}
          rating={rating}
          voteRow={voteStats?.[company.id]}
          hasPremiumOffer={hasPremiumOffer}
          unlocked={unlocked}
          onCopy={copyNormal}
          onPremium={goPremium}
          onRevealPremium={revealPremium}
          canonical={canonical}
          shareTitle={title}
          copyRef={copyRef}
        />

        {/* ===== العروض: العادي و Premium بنفس شكل الكوبون ===== */}
        <section aria-labelledby="store-offers-title" className="mt-14">
          <SectionTitle id="store-offers-title">{t("storePage.offersTitle", { name: company.name })}</SectionTitle>
          <div className={supportsPremium ? "grid grid-cols-1 gap-4 md:grid-cols-2" : "mx-auto max-w-[520px]"}>
            <CompanyCard
              company={company}
              index={0}
              isFavorite={favorites.includes(company.id)}
              onToggleFav={toggleFav}
              onCopy={handleCopy}
              premium={false}
              unlocked={unlocked}
              onUnlock={goPremium}
              linkToStore={false}
              copySource="store"
            />
            {supportsPremium && (
              <div ref={premiumRef} className="scroll-mt-28">
                <CompanyCard
                  company={company}
                  index={1}
                  isFavorite={favorites.includes(company.id)}
                  onToggleFav={toggleFav}
                  onCopy={handleCopy}
                  premium
                  unlocked={unlocked}
                  onUnlock={goPremium}
                  linkToStore={false}
                  copySource="store"
                />
              </div>
            )}
          </div>
          {hasPremiumOffer && !unlocked && premiumValue && (
            <p className="mt-4 flex items-start gap-2.5 rounded-2xl border border-[#f0c63c]/25 bg-[#f0c63c]/[0.06] px-4 py-3.5 text-[13.5px] leading-[1.7] text-[var(--text-soft)]">
              <Crown size={17} className="mt-0.5 shrink-0 text-[#f0c63c]" />
              <span>
                {t(keyUsable ? "storePage.premiumExplain" : "storePage.premiumExplainNoKey", { premium: premiumValue, normal: normalValue })}{" "}
                <Link to={premiumPath(lang)} className="font-bold text-[#ffe486] underline-offset-4 hover:underline">
                  {t("storePage.premiumLink")}
                </Link>
              </span>
            </p>
          )}
        </section>

        <StoreSteps company={company} steps={steps} custom={custom} lang={lang} />
        <StoreAbout company={company} lang={lang} />
        <StoreRating company={company} kind={kind} summary={rating} onSummary={setRating} lang={lang} />
        <StoreFaq company={company} items={faqItems} lang={lang} />
        <SimilarStores items={similar} lang={lang} ratings={ratingsMap} catLabel={catLabel} catTo={catTo} />
      </main>

      <StickyCopy company={company} anchorRef={copyRef} onCopy={copyNormal} accent={accent} hasPremiumOffer={hasPremiumOffer} unlocked={unlocked} onRevealPremium={revealPremium} />
      <Footer />
      <CopyToast code={toast} />
    </div>
  );
}

/* ===== الهاتف: "انسخ الكود" ثابت فوق شريط التنقّل كي تخرج التذكرة من الشاشة ===== */
function StickyCopy({ company, anchorRef, onCopy, accent, hasPremiumOffer, unlocked, onRevealPremium }) {
  const { t } = useTranslation();
  const { hidden: navHidden } = useScrollVisibility();
  const [past, setPast] = useState(false);
  useEffect(() => {
    const el = anchorRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setPast(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [anchorRef, company?.id]);
  // قرب الفوتر: يتخبّى (ما يغطّيش روابط الفوتر)
  const [nearEnd, setNearEnd] = useState(false);
  useEffect(() => {
    const footer = document.querySelector("footer");
    if (!footer || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setNearEnd(e.isIntersecting), { rootMargin: "0px 0px -40% 0px" });
    io.observe(footer);
    return () => io.disconnect();
  }, []);
  const on = past && !nearEnd && !!company.code;
  useEffect(() => {
    document.body.classList.toggle("has-store-sticky", on);
    return () => document.body.classList.remove("has-store-sticky");
  }, [on]);
  if (!company.code) return null;
  const premiumFirst = hasPremiumOffer && unlocked;
  return (
    <div className={`store-sticky fixed inset-x-3 z-30 md:hidden ${navHidden ? "nav-hidden" : ""} ${on ? "" : "off"}`} style={accentVars(accent)} aria-hidden={!on}>
      <div className="flex items-center gap-2.5 rounded-2xl border border-[var(--color-ink-line)] bg-[var(--elev)]/95 p-2 ps-3.5 shadow-[0_18px_44px_-14px_rgba(0,0,0,0.8)] backdrop-blur-xl">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-bold text-[var(--color-mute)]">
            <bdi>{company.name}</bdi>
          </p>
          <p dir="ltr" className="truncate text-start font-mono text-[15px] font-extrabold tracking-[0.06em] text-[var(--text)] rtl:text-end">
            {company.code}
          </p>
        </div>
        {premiumFirst ? (
          <button type="button" tabIndex={on ? 0 : -1} onClick={onRevealPremium} className="flex min-h-[46px] shrink-0 items-center gap-1.5 rounded-xl px-4 text-[14px] font-black text-[#0a0a0a]" style={{ background: "linear-gradient(135deg, #ffe486, #f0c63c 55%, #cf9a1e)" }}>
            <Crown size={16} /> {t("storePage.premiumReveal")}
          </button>
        ) : (
          <button type="button" tabIndex={on ? 0 : -1} onClick={() => onCopy(company.code)} className="store-copy flex min-h-[46px] shrink-0 items-center gap-1.5 rounded-xl px-4 text-[14.5px] font-black">
            <Copy size={16} /> {t("storePage.copy")}
          </button>
        )}
      </div>
    </div>
  );
}

/* ===== هيكل التحميل (نفس أبعاد الصفحة تقريباً → بلا قفزة) ===== */
function StoreSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--color-ink)] text-[var(--text)]">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-[92px] sm:pt-[104px]" aria-busy="true">
        <div className="mb-5 h-4 w-48 animate-pulse rounded bg-[var(--fill-strong)]" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:gap-10">
          <div className="flex items-center gap-4">
            <div className="h-[72px] w-[72px] animate-pulse rounded-[20px] bg-[var(--fill-strong)]" />
            <div className="flex-1 space-y-2.5">
              <div className="h-7 w-40 animate-pulse rounded bg-[var(--fill-strong)]" />
              <div className="h-4 w-56 animate-pulse rounded bg-[var(--fill)]" />
            </div>
          </div>
          <div className="h-[300px] animate-pulse rounded-[var(--radius-card)] bg-[var(--color-ink-card)]" />
        </div>
      </main>
    </div>
  );
}
