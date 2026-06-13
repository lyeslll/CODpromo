import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, Check, ArrowLeft, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

import { fetchCompanyBySlug, fetchCompanies, trackClick } from "../lib/supabase.js";
import { fetchFavoriteIds, addFavorite, removeFavorite } from "../lib/favorites.js";
import { useAuth } from "../lib/auth.jsx";
import { usePremium } from "../lib/premium.jsx";
import { getTypeMeta, getTypeKey } from "../lib/types.js";
import { categorySlug, companyCategoryRecord, categoryRecordSlug, categoryName } from "../lib/slug.js";
import { useCategories } from "../lib/categories.jsx";
import {
  storeTitle, storeDescription, storeKeywords, storeImage, storeUrl, categoryUrl, homeUrl,
  buildAlternates, loc, organizationLd, offerLd, faqLd, breadcrumbLd,
} from "../lib/seo.js";

import Navbar from "../components/Navbar.jsx";
import Footer from "../components/Footer.jsx";
import CompanyCard from "../components/CompanyCard.jsx";
import CompanyLogo from "../components/CompanyLogo.jsx";
import PremiumModal from "../components/PremiumModal.jsx";
import Seo from "../components/Seo.jsx";
import Breadcrumbs from "../components/seo/Breadcrumbs.jsx";
import ShareButtons from "../components/seo/ShareButtons.jsx";
import FaqSection from "../components/seo/FaqSection.jsx";

export default function StorePage({ lang = "ar" }) {
  const { slug } = useParams();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { unlocked } = usePremium();
  const navigate = useNavigate();

  const [company, setCompany] = useState(null);
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [toast, setToast] = useState(null);
  const [premiumModal, setPremiumModal] = useState(false);
  const toastTimer = useRef(null);

  // ملاحظة: لغة/اتجاه الواجهة تُضبط مركزياً في RouteLangSync (App.jsx) من المسار.

  // تحميل الشركة + كل الشركات (للمشابهة)
  useEffect(() => {
    let active = true;
    setLoading(true);
    setNotFound(false);
    window.scrollTo(0, 0);
    fetchCompanyBySlug(slug)
      .then((c) => {
        if (!active) return;
        if (!c) setNotFound(true);
        setCompany(c || null);
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

  useEffect(() => {
    if (!user) {
      setFavorites([]);
      return;
    }
    fetchFavoriteIds(user.id).then(setFavorites).catch(() => setFavorites([]));
  }, [user]);

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

  const handleCopy = useCallback((c, code = c.code) => {
    navigator.clipboard?.writeText(code).catch(() => {});
    trackClick(c.id, c.clicks);
    setToast(code);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  const { byId, categories } = useCategories();
  const meta = company ? getTypeMeta(company.type) : null;
  // الفئة من category_id عبر الجدول (المصدر)، مع fallback للنص الحر القديم
  const catRecord = company ? companyCategoryRecord(company, byId, categories) : null;
  const catLabel = catRecord ? categoryName(catRecord, lang) : company ? loc(company, "category", lang) : "";
  const catSlug = catRecord ? categoryRecordSlug(catRecord) : company ? categorySlug(company) : "";
  const description = company ? loc(company, "description", lang) : "";

  // شركات مشابهة: نفس الفئة عبر category_id (المصدر)، مع fallback للنص الحر القديم
  const similar = useMemo(() => {
    if (!company) return [];
    return all
      .filter((c) => {
        if (c.id === company.id) return false;
        if (company.category_id) return c.category_id === company.category_id;
        return c.category && c.category === company.category;
      })
      .slice(0, 6);
  }, [all, company]);

  // ===== حالات التحميل / عدم الوجود =====
  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-ink)] text-[var(--text)]">
        <Navbar />
        <div className="mx-auto grid min-h-[60vh] max-w-6xl place-items-center px-4">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[var(--color-ink-line)] border-t-[var(--color-lime)]" />
        </div>
      </div>
    );
  }

  if (notFound || !company) {
    return (
      <div className="min-h-screen bg-[var(--color-ink)] text-[var(--text)]">
        <Seo lang={lang} title={`${t("store.notFoundTitle")} | CODpromo`} description={t("store.notFoundDesc")} noindex canonical={storeUrl(slug, lang)} />
        <Navbar />
        <div className="mx-auto grid min-h-[60vh] max-w-6xl place-items-center px-4 text-center">
          <div>
            <h1 className="text-[24px] font-black">{t("store.notFoundTitle")}</h1>
            <p className="mt-2 text-[14px] text-[var(--color-mute)]">{t("store.notFoundDesc")}</p>
            <Link to="/" className="mt-5 inline-flex items-center gap-1.5 rounded-xl px-5 py-3 text-[14px] font-extrabold text-[#0a0a0a]" style={{ background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" }}>
              <ArrowLeft size={16} className="ltr:rotate-180" /> {t("store.backHome")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const accent = meta.color;
  const canonical = storeUrl(company.slug, lang);
  const TypeIcon = meta.icon;
  const supportsPremium = company.supports_premium !== false;

  const breadcrumbItems = [
    { name: t("store.breadcrumbHome"), to: lang === "ar" ? "/" : `/${lang}` },
    ...(catLabel && catSlug
      ? [{ name: catLabel, to: lang === "ar" ? `/category/${catSlug}` : `/${lang}/category/${catSlug}` }]
      : []),
    { name: company.name },
  ];

  const jsonLd = [
    organizationLd(company, lang, canonical),
    offerLd(company, lang, canonical),
    faqLd(company.company_faqs, lang),
    breadcrumbLd([
      { name: t("store.breadcrumbHome"), url: homeUrl(lang) },
      ...(catLabel && catSlug ? [{ name: catLabel, url: categoryUrl(catSlug, lang) }] : []),
      { name: company.name, url: canonical },
    ]),
  ];

  return (
    <div className="min-h-screen bg-[var(--color-ink)] text-[var(--text)]">
      <Seo
        lang={lang}
        title={storeTitle(company, lang)}
        description={storeDescription(company, lang)}
        keywords={storeKeywords(company, lang)}
        canonical={canonical}
        image={storeImage(company)}
        type="website"
        alternates={buildAlternates("store", company.slug)}
        jsonLd={jsonLd}
      />
      <Navbar onPremium={() => setPremiumModal(true)} />

      <main className="mx-auto max-w-5xl px-4 pb-10 pt-[96px] sm:pt-[104px]">
        <Breadcrumbs items={breadcrumbItems} />

        {/* ===== رأس الصفحة (هيرو الشركة) ===== */}
        <header className="relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] p-6 sm:p-8">
          <span className="pointer-events-none absolute -top-px left-1/2 h-px w-2/3 -translate-x-1/2 opacity-70" style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
          <span className="pointer-events-none absolute inset-0 opacity-[0.06]" style={{ background: `radial-gradient(120% 60% at 50% 0%, ${accent}, transparent 60%)` }} />

          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start">
            <CompanyLogo logo={company.logo} name={company.name} size={96} accent={accent} className="!rounded-2xl" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-[26px] font-black leading-tight tracking-tight sm:text-[32px]">{company.name}</h1>
                <span className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-bold" style={{ background: `${accent}1a`, color: accent }}>
                  <TypeIcon size={13} /> {t(`types.${getTypeKey(company.type)}`)}
                </span>
              </div>
              {catLabel && (
                <p className="mt-1.5 text-[13.5px] font-medium text-[var(--color-mute)]">{catLabel}</p>
              )}
              {description && (
                <p className="mt-3 max-w-2xl text-[14.5px] leading-[1.7] text-[var(--text-soft)]">{description}</p>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-3">
                {company.link && (
                  <a
                    href={company.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-[14px] font-extrabold text-[#0a0a0a]"
                    style={{ background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" }}
                  >
                    <ExternalLink size={16} /> {t("card.visit")}
                  </a>
                )}
                <ShareButtons url={canonical} title={storeTitle(company, lang)} />
              </div>
            </div>
          </div>
        </header>

        {/* ===== العروض المتاحة (العادي + Premium بنظام الخدش) ===== */}
        <section className="mt-8">
          <h2 className="mb-4 text-[20px] font-black tracking-tight sm:text-[22px]">{t("store.offers")}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <CompanyCard
              company={company}
              index={0}
              isFavorite={favorites.includes(company.id)}
              onToggleFav={toggleFav}
              onCopy={handleCopy}
              premium={false}
              unlocked={unlocked}
              onUnlock={() => setPremiumModal(true)}
              linkToStore={false}
            />
            {supportsPremium && (
              <CompanyCard
                company={company}
                index={1}
                isFavorite={favorites.includes(company.id)}
                onToggleFav={toggleFav}
                onCopy={handleCopy}
                premium
                unlocked={unlocked}
                onUnlock={() => setPremiumModal(true)}
                linkToStore={false}
              />
            )}
          </div>
        </section>

        {/* ===== كيف تستخدم كود الخصم ===== */}
        <section className="mt-10">
          <h2 className="mb-4 text-[20px] font-black tracking-tight sm:text-[22px]">{t("store.howTitle")}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="rounded-2xl border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] p-5">
                <span className="grid h-9 w-9 place-items-center rounded-xl text-[15px] font-black text-[#0a0a0a]" style={{ background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" }}>
                  {n}
                </span>
                <h3 className="mt-3 text-[14.5px] font-extrabold">{t(`store.how${n}Title`)}</h3>
                <p className="mt-1.5 text-[13px] leading-[1.6] text-[var(--text-soft)]">{t(`store.how${n}Desc`, { name: company.name })}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ===== الأسئلة الشائعة ===== */}
        <FaqSection faqs={company.company_faqs} lang={lang} />

        {/* ===== شركات مشابهة ===== */}
        {similar.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-4 text-[20px] font-black tracking-tight sm:text-[22px]">{t("store.similarTitle")}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {similar.map((c) => (
                <SimilarCard key={c.id} company={c} lang={lang} />
              ))}
            </div>
          </section>
        )}
      </main>

      <Footer onPremium={() => setPremiumModal(true)} />

      {/* توست النسخ */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2.5 rounded-2xl border border-[var(--color-ink-line)] bg-[var(--elev)]/95 px-4 py-3 shadow-[0_16px_50px_-12px_rgba(0,0,0,0.45)] backdrop-blur-xl"
          >
            <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--color-lime)] text-[#0a0a0a]">
              <Check size={16} strokeWidth={3} />
            </span>
            <span className="text-[14px] font-semibold text-[var(--text)]">
              {t("home.copiedToast")} <span className="font-mono font-extrabold text-[var(--accent-text)]">{toast}</span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <PremiumModal open={premiumModal} onClose={() => setPremiumModal(false)} />
    </div>
  );
}

/* ===== بطاقة شركة مصغّرة (شركات مشابهة) — رابط داخلي للسيو ===== */
function SimilarCard({ company, lang }) {
  const meta = getTypeMeta(company.type);
  const to = lang === "ar" ? `/store/${company.slug}` : `/${lang}/store/${company.slug}`;
  const discount = loc(company, "discount", lang);
  return (
    <Link
      to={to}
      className="group flex flex-col items-center gap-2.5 rounded-2xl border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] p-4 text-center transition-colors hover:border-[var(--color-lime)]/40"
    >
      <CompanyLogo logo={company.logo} name={company.name} size={52} accent={meta.color} />
      <span className="line-clamp-1 text-[13.5px] font-extrabold text-[var(--text)]">{company.name}</span>
      {discount && (
        <span className="text-[13px] font-black" style={{ color: meta.color }}>{discount}</span>
      )}
    </Link>
  );
}
