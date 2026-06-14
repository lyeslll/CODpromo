import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";

import { fetchCompanies, trackClick } from "../lib/supabase.js";
import { getTypeKey } from "../lib/types.js";
import { useAuth } from "../lib/auth.jsx";
import { usePremium } from "../lib/premium.jsx";
import { useVoteStats } from "../lib/voteStats.jsx";
import { fetchFavoriteIds, addFavorite, removeFavorite } from "../lib/favorites.js";
import Navbar from "../components/Navbar.jsx";
import PremiumToggle from "../components/PremiumToggle.jsx";
import PremiumModal from "../components/PremiumModal.jsx";
import { Crown, Tag, Clock, TrendingUp } from "lucide-react";
import Hero from "../components/Hero.jsx";
import SearchFilter from "../components/SearchFilter.jsx";
import CompanyCard from "../components/CompanyCard.jsx";
import CategoryBrowse from "../components/CategoryBrowse.jsx";
import HowItWorks from "../components/HowItWorks.jsx";
import Footer from "../components/Footer.jsx";
import EmailPopup from "../components/EmailPopup.jsx";
import { SkeletonGrid, EmptyState, ErrorState } from "../components/States.jsx";

export default function Home() {
  const { user } = useAuth();
  const { unlocked } = usePremium();
  const { stats: voteStats } = useVoteStats();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [premiumView, setPremiumView] = useState("normal"); // عادي / Premium
  const [premiumModal, setPremiumModal] = useState(false);

  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("الكل");
  const [sortMode, setSortMode] = useState("newest"); // newest | success
  const [favorites, setFavorites] = useState([]); // معرّفات الشركات المفضّلة (للمسجّلين)
  const [toast, setToast] = useState(null);

  const storesRef = useRef(null);
  const toastTimer = useRef(null);

  // ===== تحميل البيانات =====
  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchCompanies()
      .then((data) => setCompanies(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ===== تحميل مفضّلة المستخدم المسجّل =====
  useEffect(() => {
    if (!user) {
      setFavorites([]);
      return;
    }
    fetchFavoriteIds(user.id)
      .then(setFavorites)
      .catch(() => setFavorites([]));
  }, [user]);

  // ===== الفلترة =====
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return companies.filter((c) => {
      const matchFilter = activeFilter === "الكل" || c.type === activeFilter;
      if (!matchFilter) return false;
      if (!q) return true;
      return (
        c.name?.toLowerCase().includes(q) ||
        c.code?.toLowerCase().includes(q) ||
        c.category?.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q)
      );
    });
  }, [companies, search, activeFilter]);

  // ===== الترتيب: الأحدث (الافتراضي) أو الأعلى نسبة نجاح =====
  const ordered = useMemo(() => {
    if (sortMode !== "success") return filtered;
    const rank = (c) => {
      const s = voteStats[c.id];
      // نرتّب حسب النسبة ثم عدد الأصوات؛ بلا أصوات → في الأسفل
      if (!s || !s.total_count) return -1;
      return s.success_rate * 1000 + Math.min(s.total_count, 999);
    };
    return [...filtered].sort((a, b) => rank(b) - rank(a));
  }, [filtered, sortMode, voteStats]);

  // ===== إحصائيات الـ Hero =====
  const stats = useMemo(
    () => ({
      codes: companies.length || 0,
      stores: companies.length || 0,
      rating: "4.9",
    }),
    [companies]
  );

  // ===== أفعال =====
  // المفضّلة للمسجّلين فقط — الزائر يُوجَّه لتسجيل الدخول
  const toggleFav = (id) => {
    if (!user) {
      navigate("/login");
      return;
    }
    const isFav = favorites.includes(id);
    setFavorites((prev) => (isFav ? prev.filter((f) => f !== id) : [...prev, id]));
    const op = isFav ? removeFavorite(user.id, id) : addFavorite(user.id, id);
    op.catch(() => {
      // تراجع عند الفشل
      setFavorites((prev) => (isFav ? [...prev, id] : prev.filter((f) => f !== id)));
    });
  };

  const handleCopy = (company, code = company.code) => {
    navigator.clipboard?.writeText(code).catch(() => {});
    trackClick(company.id, company.clicks);
    setCompanies((prev) =>
      prev.map((c) => (c.id === company.id ? { ...c, clicks: (c.clicks || 0) + 1 } : c))
    );
    setToast(code);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  const scrollToStores = () =>
    storesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const resetFilters = () => {
    setSearch("");
    setActiveFilter("الكل");
  };

  return (
    <div className="min-h-screen bg-[var(--color-ink)] text-[var(--text)]">
      <Navbar onPremium={() => setPremiumModal(true)} />
      <Hero stats={stats} onExplore={scrollToStores} />

      {/* ===== قسم المتاجر ===== */}
      <main id="stores" ref={storesRef} className="mx-auto max-w-6xl px-4 pt-6">
        <SearchFilter
          search={search}
          setSearch={setSearch}
          activeFilter={activeFilter}
          setActiveFilter={setActiveFilter}
          resultCount={filtered.length}
        />

        {/* عنوان القسم + مبدّل Premium */}
        {!loading && !error && (
          <>
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-[24px] font-black tracking-tight sm:text-[28px]">
                  {activeFilter === "الكل" ? t("home.allOffers") : t(`filters.${getTypeKey(activeFilter)}`)}
                </h2>
                <p className="mt-1 text-[13.5px] text-[var(--color-mute)]">
                  {t("home.toggleHint")}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <SortToggle value={sortMode} onChange={setSortMode} t={t} />
                <PremiumToggle value={premiumView} onChange={setPremiumView} />
                <span className="hidden rounded-xl border border-[var(--color-ink-line)] bg-[var(--fill)] px-3 py-1.5 text-[13px] font-bold text-[var(--accent-text)] sm:block">
                  {t("home.offersCount", { count: filtered.length })}
                </span>
              </div>
            </div>

            {/* بوكس معلومات الوضع — موجود دائماً بنفس الأبعاد (عادي/Premium) فلا يحدث أي قفزة عند التبديل */}
            <OfferModeNote
              mode={premiumView}
              unlocked={unlocked}
              onSwitchPremium={() => setPremiumView("premium")}
              onOpenPremium={() => setPremiumModal(true)}
            />
          </>
        )}

        {/* الحالات */}
        {loading && <SkeletonGrid />}
        {error && <ErrorState message={error} onRetry={load} />}
        {!loading && !error && filtered.length === 0 && (
          <EmptyState onReset={resetFilters} />
        )}

        {/* الشبكة */}
        {!loading && !error && filtered.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence>
              {ordered.map((c, i) => (
                <CompanyCard
                  key={c.id}
                  company={c}
                  index={i}
                  isFavorite={favorites.includes(c.id)}
                  onToggleFav={toggleFav}
                  onCopy={handleCopy}
                  premium={premiumView === "premium" && c.supports_premium !== false}
                  unlocked={unlocked}
                  onUnlock={() => setPremiumModal(true)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* قسم تصفّح حسب الفئة — تنقّل فقط (بعد شبكة العروض، قبل "كيف يعمل") */}
      <CategoryBrowse companies={companies} />

      <HowItWorks />
      <Footer onPremium={() => setPremiumModal(true)} />

      {/* ===== توست النسخ ===== */}
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
              {t("home.copiedToast")}{" "}
              <span className="font-mono font-extrabold text-[var(--accent-text)]">{toast}</span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* نافذة فتح Premium */}
      <PremiumModal open={premiumModal} onClose={() => setPremiumModal(false)} />

      {/* نافذة جمع الإيميل (للزوّار غير المسجّلين، مرة واحدة) */}
      <EmailPopup />
    </div>
  );
}

/**
 * مبدّل الترتيب: الأحدث (الافتراضي) / الأعلى نسبة نجاح.
 * نفس هوية مبدّل Premium (segmented) — أيقونة على الهاتف، أيقونة+نص على الشاشات الأكبر.
 */
function SortToggle({ value, onChange, t }) {
  const items = [
    { key: "newest", icon: Clock, label: t("vote.sortNewest") },
    { key: "success", icon: TrendingUp, label: t("vote.sortSuccess") },
  ];
  // نفس شكل/حجم PremiumToggle بالضبط (الحاوية + الأزرار + الـpill المنزلق).
  return (
    <div className="relative inline-flex items-center gap-1 rounded-2xl border border-[var(--color-ink-line)] bg-[var(--fill)] p-1">
      {items.map((it) => {
        const active = value === it.key;
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onChange(it.key)}
            aria-pressed={active}
            className="relative z-10 flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13.5px] font-extrabold transition-colors"
            style={{ color: active ? "#0a0a0a" : "var(--text-softer)" }}
          >
            {active && (
              <motion.span
                layoutId="sort-pill"
                className="absolute inset-0 -z-10 rounded-xl"
                style={{ background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" }}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <it.icon size={14} />
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * بوكس معلومات الوضع (عادي / Premium).
 * كل الحالات الثلاث مكدّسة في نفس خلية الشبكة، فتأخذ الخلية ارتفاع أطول نص دائماً
 * → الأبعاد ثابتة تماماً في كل الأوضاع، والتبديل مجرّد تلاشٍ للون/النص/الأيقونة بلا أي layout shift.
 */
function OfferModeNote({ mode, unlocked, onSwitchPremium, onOpenPremium }) {
  const { t } = useTranslation();

  const GOLD_BOX = {
    borderColor: "rgba(207,154,30,0.45)",
    background: "linear-gradient(90deg, rgba(240,198,60,0.12), rgba(240,198,60,0.04))",
  };
  const GOLD_ICON = { background: "linear-gradient(135deg,#ffe486,#cf9a1e)" };
  const GREEN_BOX = {
    borderColor: "rgba(166,240,0,0.4)",
    background: "linear-gradient(90deg, rgba(166,240,0,0.12), rgba(166,240,0,0.04))",
  };
  const GREEN_ICON = { background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" };

  const variants = [
    {
      key: "normal",
      active: mode === "normal",
      box: GREEN_BOX,
      icon: GREEN_ICON,
      Icon: Tag,
      text: t("home.normalInfo"),
      cta: null,
      onClick: onSwitchPremium,
    },
    {
      key: "premium-locked",
      active: mode === "premium" && !unlocked,
      box: GOLD_BOX,
      icon: GOLD_ICON,
      Icon: Crown,
      text: t("home.premiumBanner"),
      cta: t("home.openPremium"),
      onClick: onOpenPremium,
    },
    {
      key: "premium-unlocked",
      active: mode === "premium" && unlocked,
      box: GOLD_BOX,
      icon: GOLD_ICON,
      Icon: Crown,
      text: t("home.premiumUnlocked"),
      cta: null,
      onClick: onOpenPremium,
    },
  ];

  return (
    <div className="mb-6 grid">
      {variants.map((v) => (
        <button
          key={v.key}
          type="button"
          onClick={v.onClick}
          aria-hidden={!v.active}
          tabIndex={v.active ? 0 : -1}
          className={`col-start-1 row-start-1 flex w-full items-center justify-between gap-3 rounded-2xl border px-5 py-3.5 text-start transition-opacity duration-300 ${
            v.active ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          style={v.box}
        >
          <span className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[#0a0a0a]" style={v.icon}>
              <v.Icon size={18} />
            </span>
            <span className="text-[13.5px] font-bold text-[var(--text)]">{v.text}</span>
          </span>
          {v.cta && (
            <span className="hidden shrink-0 rounded-xl px-4 py-2 text-[13px] font-extrabold text-[#0a0a0a] sm:block" style={GOLD_ICON}>
              {v.cta}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
