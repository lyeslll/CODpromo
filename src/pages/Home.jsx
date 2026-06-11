import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";

import { fetchCompanies, trackClick } from "../lib/supabase.js";
import { getTypeKey } from "../lib/types.js";
import { useAuth } from "../lib/auth.jsx";
import { usePremium } from "../lib/premium.jsx";
import { fetchFavoriteIds, addFavorite, removeFavorite } from "../lib/favorites.js";
import Navbar from "../components/Navbar.jsx";
import PremiumToggle from "../components/PremiumToggle.jsx";
import PremiumModal from "../components/PremiumModal.jsx";
import { Crown } from "lucide-react";
import Hero from "../components/Hero.jsx";
import SearchFilter from "../components/SearchFilter.jsx";
import CompanyCard from "../components/CompanyCard.jsx";
import HowItWorks from "../components/HowItWorks.jsx";
import Footer from "../components/Footer.jsx";
import EmailPopup from "../components/EmailPopup.jsx";
import { SkeletonGrid, EmptyState, ErrorState } from "../components/States.jsx";

export default function Home() {
  const { user } = useAuth();
  const { unlocked } = usePremium();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [premiumView, setPremiumView] = useState("normal"); // عادي / Premium
  const [premiumModal, setPremiumModal] = useState(false);

  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("الكل");
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
      <Navbar />
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
                <PremiumToggle value={premiumView} onChange={setPremiumView} />
                <span className="hidden rounded-xl border border-[var(--color-ink-line)] bg-[var(--fill)] px-3 py-1.5 text-[13px] font-bold text-[var(--accent-text)] sm:block">
                  {t("home.offersCount", { count: filtered.length })}
                </span>
              </div>
            </div>

            {/* شريط ترويجي في وضع Premium قبل الفتح */}
            <AnimatePresence>
              {premiumView === "premium" && !unlocked && (
                <motion.button
                  initial={{ opacity: 0, y: -8, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: -8, height: 0 }}
                  onClick={() => setPremiumModal(true)}
                  className="mb-6 flex w-full items-center justify-between gap-3 overflow-hidden rounded-2xl border px-5 py-3.5 text-start"
                  style={{ borderColor: "rgba(207,154,30,0.45)", background: "linear-gradient(90deg, rgba(240,198,60,0.12), rgba(240,198,60,0.04))" }}
                >
                  <span className="flex items-center gap-2.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[#0a0a0a]" style={{ background: "linear-gradient(135deg,#ffe486,#cf9a1e)" }}>
                      <Crown size={18} />
                    </span>
                    <span className="text-[13.5px] font-bold text-[var(--text)]">
                      {t("home.premiumBanner")}
                    </span>
                  </span>
                  <span className="hidden shrink-0 rounded-xl px-4 py-2 text-[13px] font-extrabold text-[#0a0a0a] sm:block" style={{ background: "linear-gradient(135deg,#ffe486,#cf9a1e)" }}>
                    {t("home.openPremium")}
                  </span>
                </motion.button>
              )}
            </AnimatePresence>
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
              {filtered.map((c, i) => (
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
