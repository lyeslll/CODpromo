import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Heart, Store, LogIn } from "lucide-react";
import { useTranslation } from "react-i18next";

import { trackClick } from "../lib/supabase.js";
import { fetchFavoritesWithCompany, removeFavorite } from "../lib/favorites.js";
import { useAuth } from "../lib/auth.jsx";
import { usePremium } from "../lib/premium.jsx";
import { favoritesUrl } from "../lib/seo.js";

import Navbar from "../components/Navbar.jsx";
import Footer from "../components/Footer.jsx";
import CompanyCard from "../components/CompanyCard.jsx";
import PremiumModal from "../components/PremiumModal.jsx";
import Seo from "../components/Seo.jsx";

// ============================================================
//  صفحة /favorites — مفضّلة المستخدم بنفس بطاقة الشركة (CompanyCard).
//  صفحة خاصة بالمستخدم: noindex وغير مدرجة في الـ sitemap.
// ============================================================
export default function FavoritesPage({ lang = "ar" }) {
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const { unlocked } = usePremium();

  const [items, setItems] = useState([]); // [{ company_id, companies }]
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [premiumModal, setPremiumModal] = useState(false);
  const toastTimer = useRef(null);

  // ملاحظة: لغة/اتجاه الواجهة تُضبط مركزياً في RouteLangSync (App.jsx) من المسار.
  useEffect(() => {
    let active = true;
    window.scrollTo(0, 0);
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchFavoritesWithCompany(user.id)
      .then((rows) => active && setItems(Array.isArray(rows) ? rows : []))
      .catch(() => active && setItems([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [user]);

  // إزالة من المفضّلة (تحديث متفائل)
  const removeFav = (companyId) => {
    setItems((prev) => prev.filter((f) => f.company_id !== companyId));
    if (user) removeFavorite(user.id, companyId).catch(() => {});
  };

  const handleCopy = useCallback((c, code = c.code) => {
    navigator.clipboard?.writeText(code).catch(() => {});
    trackClick(c.id, c.clicks);
    setToast(code);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  const companies = items.map((f) => f.companies).filter(Boolean);
  const canonical = favoritesUrl(lang);

  return (
    <div className="min-h-screen bg-[var(--color-ink)] text-[var(--text)]">
      {/* صفحة خاصة بالمستخدم: noindex، وبلا hreflang (غير مفهرسة) */}
      <Seo lang={lang} title={`${t("favorites.title")} | CODpromo`} canonical={canonical} noindex />
      <Navbar onPremium={() => setPremiumModal(true)} />

      <main className="mx-auto max-w-6xl px-4 pb-10 pt-[112px] sm:pt-[120px]">
        <header className="mb-6">
          <h1 className="text-[26px] font-black tracking-tight sm:text-[32px]">
            {t("favorites.title")}
          </h1>
          {user && !loading && companies.length > 0 && (
            <p className="mt-1.5 text-[14px] text-[var(--color-mute)]">
              {t("favorites.subtitle", { count: companies.length })}
            </p>
          )}
        </header>

        {/* غير مسجّل → دعوة لطيفة لتسجيل الدخول داخل الصفحة (بلا تحويل قسري) */}
        {!authLoading && !user ? (
          <LoginInvite t={t} />
        ) : loading || authLoading ? (
          <div className="grid min-h-[40vh] place-items-center">
            <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[var(--color-ink-line)] border-t-[var(--color-lime)]" />
          </div>
        ) : companies.length === 0 ? (
          <EmptyFavorites t={t} lang={lang} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence>
              {companies.map((c, i) => (
                <CompanyCard
                  key={c.id}
                  company={c}
                  index={i}
                  isFavorite
                  onToggleFav={() => removeFav(c.id)}
                  onCopy={handleCopy}
                  premium={false}
                  unlocked={unlocked}
                  onUnlock={() => setPremiumModal(true)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
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

/* حالة فارغة أنيقة */
function EmptyFavorites({ t, lang }) {
  const homeHref = lang && lang !== "ar" ? `/${lang}` : "/";
  return (
    <div className="flex flex-col items-center rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] px-6 py-16 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[var(--fill)] text-[var(--color-mute)]">
        <Heart size={28} />
      </div>
      <h3 className="mt-5 text-[18px] font-extrabold text-[var(--text)]">{t("favorites.emptyTitle")}</h3>
      <p className="mt-1.5 max-w-sm text-[14px] text-[var(--text-soft)]">{t("favorites.emptyDesc")}</p>
      <Link
        to={homeHref}
        className="mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[14px] font-extrabold text-[#0a0a0a]"
        style={{ background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" }}
      >
        <Store size={16} /> {t("favorites.browse")}
      </Link>
    </div>
  );
}

/* دعوة لطيفة لتسجيل الدخول (للزائر) — داخل الصفحة بلا تحويل قسري */
function LoginInvite({ t }) {
  return (
    <div className="flex flex-col items-center rounded-[var(--radius-card)] border border-[var(--color-lime)]/30 bg-[var(--color-lime)]/[0.06] px-6 py-16 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[var(--color-lime)]/15 text-[var(--color-lime)]">
        <Heart size={28} />
      </div>
      <h3 className="mt-5 text-[18px] font-extrabold text-[var(--text)]">{t("favorites.loginTitle")}</h3>
      <p className="mt-1.5 max-w-sm text-[14px] text-[var(--text-soft)]">{t("favorites.loginDesc")}</p>
      <Link
        to="/login"
        className="mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[14px] font-extrabold text-[#0a0a0a]"
        style={{ background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" }}
      >
        <LogIn size={16} /> {t("favorites.login")}
      </Link>
    </div>
  );
}
