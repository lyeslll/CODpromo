import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ArrowLeft, LayoutGrid } from "lucide-react";
import { useTranslation } from "react-i18next";

import { fetchCompanies, trackClick } from "../lib/supabase.js";
import { fetchFavoriteIds, addFavorite, removeFavorite } from "../lib/favorites.js";
import { useAuth } from "../lib/auth.jsx";
import { usePremium } from "../lib/premium.jsx";
import { useCategories } from "../lib/categories.jsx";
import {
  findCategoryRecordBySlug, categoryName, categoryDesc, categorySlug,
} from "../lib/slug.js";
import {
  categoryTitle, categoryDescription, categoryUrl, homeUrl,
  buildAlternates, loc, breadcrumbLd,
} from "../lib/seo.js";

import Navbar from "../components/Navbar.jsx";
import Footer from "../components/Footer.jsx";
import CompanyCard from "../components/CompanyCard.jsx";
import PremiumModal from "../components/PremiumModal.jsx";
import Seo from "../components/Seo.jsx";
import Breadcrumbs from "../components/seo/Breadcrumbs.jsx";

export default function CategoryPage({ lang = "ar" }) {
  const { slug } = useParams();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { unlocked } = usePremium();
  const { categories, loading: catsLoading } = useCategories();
  const navigate = useNavigate();

  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState([]);
  const [toast, setToast] = useState(null);
  const [premiumModal, setPremiumModal] = useState(false);
  const toastTimer = useRef(null);

  // ملاحظة: لغة/اتجاه الواجهة تُضبط مركزياً في RouteLangSync (App.jsx) من المسار.

  useEffect(() => {
    let active = true;
    setLoading(true);
    window.scrollTo(0, 0);
    fetchCompanies()
      .then((d) => active && setAll(Array.isArray(d) ? d : []))
      .catch(() => active && setAll([]))
      .finally(() => active && setLoading(false));
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

  // سجلّ الفئة من الجدول (المصدر الحقيقي) المطابق للـ slug
  const catRecord = useMemo(() => findCategoryRecordBySlug(categories, slug), [categories, slug]);

  // الشركات ضمن الفئة: بالأساس عبر category_id، مع fallback للنص العربي القديم
  // للشركات غير المربوطة بعد. وإن لم يوجد سجلّ فئة في الجدول إطلاقاً (قبل الهجرة)
  // نرجع للنص الحر القديم عبر slug حتى لا تختفي الصفحة.
  const companies = useMemo(() => {
    if (catRecord) {
      return all.filter(
        (c) =>
          c.category_id === catRecord.id ||
          (!c.category_id && c.category && c.category === catRecord.name_ar)
      );
    }
    const target = String(slug || "").toLowerCase();
    return all.filter((c) => c.category && categorySlug(c) === target);
  }, [all, catRecord, slug]);

  // اسم/وصف الفئة بلغة العرض: من الجدول إن وُجد، وإلا من أول شركة (نص حر)
  const label = useMemo(() => {
    if (catRecord) return categoryName(catRecord, lang);
    const first = companies[0];
    return (first && loc(first, "category", lang)) || slug;
  }, [catRecord, companies, slug, lang]);

  const headerDesc = catRecord ? categoryDesc(catRecord, lang) : "";
  const headerIcon = catRecord?.icon || "";

  const canonical = categoryUrl(slug, lang);

  if (loading || catsLoading) {
    return (
      <div className="min-h-screen bg-[var(--color-ink)] text-[var(--text)]">
        <Navbar />
        <div className="mx-auto grid min-h-[60vh] max-w-6xl place-items-center px-4">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[var(--color-ink-line)] border-t-[var(--color-lime)]" />
        </div>
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <div className="min-h-screen bg-[var(--color-ink)] text-[var(--text)]">
        <Seo lang={lang} title={`${t("category.notFoundTitle")} | CODpromo`} description={t("category.notFoundDesc")} noindex canonical={canonical} />
        <Navbar />
        <div className="mx-auto grid min-h-[60vh] max-w-6xl place-items-center px-4 text-center">
          <div>
            <h1 className="text-[24px] font-black">{t("category.notFoundTitle")}</h1>
            <p className="mt-2 text-[14px] text-[var(--color-mute)]">{t("category.notFoundDesc")}</p>
            <Link to="/" className="mt-5 inline-flex items-center gap-1.5 rounded-xl px-5 py-3 text-[14px] font-extrabold text-[#0a0a0a]" style={{ background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" }}>
              <ArrowLeft size={16} className="ltr:rotate-180" /> {t("store.backHome")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const jsonLd = [
    breadcrumbLd([
      { name: t("store.breadcrumbHome"), url: homeUrl(lang) },
      { name: label, url: canonical },
    ]),
  ];

  return (
    <div className="min-h-screen bg-[var(--color-ink)] text-[var(--text)]">
      <Seo
        lang={lang}
        title={categoryTitle(label, lang)}
        description={headerDesc || categoryDescription(label, companies.length, lang)}
        canonical={canonical}
        alternates={buildAlternates("category", slug)}
        jsonLd={jsonLd}
      />
      <Navbar onPremium={() => setPremiumModal(true)} />

      <main className="mx-auto max-w-6xl px-4 pb-10 pt-[96px] sm:pt-[104px]">
        <Breadcrumbs
          items={[
            { name: t("store.breadcrumbHome"), to: lang === "ar" ? "/" : `/${lang}` },
            { name: label },
          ]}
        />

        <header className="mb-6">
          <h1 className="flex items-center gap-2.5 text-[26px] font-black tracking-tight sm:text-[32px]">
            {headerIcon ? (
              <span className="text-[26px] leading-none sm:text-[30px]">{headerIcon}</span>
            ) : (
              <LayoutGrid size={26} className="text-[var(--accent-text)]" />
            )}
            {label}
          </h1>
          {headerDesc && (
            <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-[var(--color-mute)]">
              {headerDesc}
            </p>
          )}
          <p className="mt-1.5 text-[14px] text-[var(--color-mute)]">
            {t("category.count", { count: companies.length })}
          </p>
        </header>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {companies.map((c, i) => (
              <CompanyCard
                key={c.id}
                company={c}
                index={i}
                isFavorite={favorites.includes(c.id)}
                onToggleFav={toggleFav}
                onCopy={handleCopy}
                premium={false}
                unlocked={unlocked}
                onUnlock={() => setPremiumModal(true)}
              />
            ))}
          </AnimatePresence>
        </div>
      </main>

      <Footer onPremium={() => setPremiumModal(true)} />

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
