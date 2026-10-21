import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence, useMotionValue, useTransform, animate, useReducedMotion } from "framer-motion";
import { Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { fetchCompanies } from "../lib/supabase.js";
import { usePremium } from "../lib/premium.jsx";
import { useVoteStats } from "../lib/voteStats.jsx";
import { useCategories } from "../lib/categories.jsx";
import { useOfferActions } from "../lib/useOfferActions.js";
import { companySlug } from "../lib/slug.js";
import {
  TYPE_PARAMS,
  activeCategories,
  countByCategory,
  companyCategorySlug,
  matchesSearch,
  successRank,
} from "../lib/offerFilters.js";
import { offersUrl, homeUrl, storeUrl, buildAlternates, breadcrumbLd } from "../lib/seo.js";
import { useFeaturedRows, joinFeatured, loadUsageRank } from "../lib/featured.js";
import { canUseFx } from "../lib/fxCapability.js";

import Navbar from "../components/Navbar.jsx";
import Footer from "../components/Footer.jsx";
import Seo from "../components/Seo.jsx";
import CompanyCard from "../components/CompanyCard.jsx";
import PremiumToggle from "../components/PremiumToggle.jsx";
import PremiumModal from "../components/PremiumModal.jsx";
import EmailPopup from "../components/EmailPopup.jsx";
import CopyToast from "../components/CopyToast.jsx";
import GoldBurst from "../components/GoldBurst.jsx";
import SortToggle from "../components/offers/SortToggle.jsx";
import OfferModeNote from "../components/offers/OfferModeNote.jsx";
import TypeFilter from "../components/offers/TypeFilter.jsx";
import CategoryChips from "../components/offers/CategoryChips.jsx";
import FloatingModeSwitch from "../components/offers/FloatingModeSwitch.jsx";
import FeaturedRow from "../components/featured/FeaturedRow.jsx";
import FeaturedFrame, { frameTone } from "../components/featured/FeaturedFrame.jsx";
import { SkeletonGrid, EmptyState, ErrorState } from "../components/States.jsx";

const SWIPE_HINT_KEY = "codpromo:swipe-hint";

// ============================================================
//  صفحة /offers — كل العروض مع البحث والفلاتر والترتيب ومبدّل عادي/Premium.
//  كل فلتر محفوظ في الرابط (type / category / featured / mode / sort / q) لمشاركة روابط جاهزة:
//    /offers?type=cashback&category=payment-cards&mode=premium
//    /offers?featured=1 (العروض المميّزة فقط) · ?sort=usage (الأكثر استخداماً)
//  الهاتف: مبدّل عائم فوق شريط التنقّل + سحب أفقي على القائمة للتبديل كأنها تبويبات.
// ============================================================
export default function OffersPage({ lang = "ar" }) {
  const { t } = useTranslation();
  const { unlocked } = usePremium();
  const { stats: voteStats } = useVoteStats();
  const { categories, byId } = useCategories();
  const reduceMotion = useReducedMotion();
  const [params, setParams] = useSearchParams();

  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [premiumModal, setPremiumModal] = useState(false);
  const [burst, setBurst] = useState(0);
  const { favorites, toggleFav, handleCopy, toast } = useOfferActions(setCompanies);

  // ===== حالة الفلاتر من الرابط (مصدر الحقيقة) =====
  const typeParam = TYPE_PARAMS[params.get("type")] ? params.get("type") : null;
  const categoryParam = params.get("category") || null;
  const premiumView = params.get("mode") === "premium" ? "premium" : "normal";
  const featuredParam = params.get("featured") === "1";
  const sortMode = ["success", "usage"].includes(params.get("sort")) ? params.get("sort") : "newest";
  const qParam = params.get("q") || "";

  const updateParams = useCallback(
    (patch) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (v) next.set(k, v);
            else next.delete(k);
          }
          return next;
        },
        { replace: true }
      );
    },
    [setParams]
  );

  // البحث: حقل فوري محلياً، ويُكتب في الرابط بعد توقّف الكتابة
  const [search, setSearch] = useState(qParam);
  const lastWrittenQ = useRef(qParam);
  useEffect(() => {
    if (qParam !== lastWrittenQ.current) {
      lastWrittenQ.current = qParam;
      setSearch(qParam); // تغيّر من الخارج (رجوع/تقدّم أو رابط جديد)
    }
  }, [qParam]);
  useEffect(() => {
    const value = search.trim() ? search : "";
    if (value === lastWrittenQ.current) return;
    const id = setTimeout(() => {
      lastWrittenQ.current = value;
      updateParams({ q: value || null });
    }, 300);
    return () => clearTimeout(id);
  }, [search, updateParams]);

  const setMode = useCallback(
    (m) => {
      if (m === premiumView) return;
      if (m === "premium") setBurst((b) => b + 1);
      updateParams({ mode: m === "premium" ? "premium" : null });
    },
    [premiumView, updateParams]
  );

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
    window.scrollTo(0, 0);
    load();
  }, [load]);

  // ===== العروض المميّزة (يختارها الأدمن) + ترتيب "الأكثر استخداماً" =====
  const featuredRows = useFeaturedRows();
  const featured = useMemo(() => joinFeatured(featuredRows, companies), [featuredRows, companies]);
  const featuredLabel = useMemo(() => new Map(featured.map((f) => [f.company.id, f.label])), [featured]);
  const gridFx = useMemo(() => canUseFx(), []);
  const [usageRank, setUsageRank] = useState(null);
  useEffect(() => {
    if (sortMode !== "usage" || usageRank) return;
    let active = true;
    loadUsageRank().then((r) => active && setUsageRank(r));
    return () => {
      active = false;
    };
  }, [sortMode, usageRank]);

  // ===== الفلترة + الترتيب =====
  const cats = useMemo(() => activeCategories(categories), [categories]);
  const counts = useMemo(() => countByCategory(companies, cats), [companies, cats]);

  const filtered = useMemo(
    () =>
      companies.filter((c) => {
        if (featuredParam && !featuredLabel.has(c.id)) return false;
        if (typeParam && c.type !== TYPE_PARAMS[typeParam]) return false;
        if (categoryParam && companyCategorySlug(c, byId, categories) !== categoryParam) return false;
        return matchesSearch(c, search, lang, byId, categories);
      }),
    [companies, featuredParam, featuredLabel, typeParam, categoryParam, search, lang, byId, categories]
  );

  const ordered = useMemo(() => {
    if (sortMode === "success") {
      return [...filtered].sort((a, b) => successRank(voteStats, b.id) - successRank(voteStats, a.id));
    }
    // الأكثر استخداماً: ترتيب النسخ الحقيقي؛ العروض بلا نسخ بعدُ تبقى بعدها بترتيب الأحدث
    if (sortMode === "usage" && usageRank) {
      const rank = (id) => usageRank.get(id) ?? Infinity;
      return [...filtered].sort((a, b) => {
        const ra = rank(a.id);
        const rb = rank(b.id);
        return ra === rb ? 0 : ra - rb;
      });
    }
    return filtered;
  }, [filtered, sortMode, voteStats, usageRank]);

  // ?featured=1 قبل وصول قائمة المميّزة: هيكل تحميل بدل "لا نتائج"
  const featuredPending = featuredParam && featuredRows === null;
  const showFeaturedRow = featured.length > 0 && !featuredParam && !typeParam && !categoryParam && !search.trim();

  const resetFilters = () => {
    setSearch("");
    lastWrittenQ.current = "";
    updateParams({ q: null, type: null, category: null, featured: null });
  };

  // ===== المبدّل العائم (هاتف): يظهر ما دامت القائمة في الشاشة =====
  const listRef = useRef(null);
  const [listInView, setListInView] = useState(false);
  useEffect(() => {
    const el = listRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setListInView(e.isIntersecting), {
      rootMargin: "-120px 0px -140px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const [showSwipeHint, setShowSwipeHint] = useState(() => {
    try {
      return localStorage.getItem(SWIPE_HINT_KEY) !== "1";
    } catch {
      return false;
    }
  });
  const dismissSwipeHint = () => {
    setShowSwipeHint(false);
    try {
      localStorage.setItem(SWIPE_HINT_KEY, "1");
    } catch {
      /* تجاهل آمن */
    }
  };

  // ===== السحب الأفقي على القائمة (لمس فقط) للتبديل عادي ⇄ Premium =====
  // touch-action: pan-y → التمرير العمودي يبقى للمتصفح، والحركة الأفقية لنا.
  const dragX = useMotionValue(0);
  // معاينة ذهبية أثناء السحب نحو Premium (الاتجاه حسب RTL/LTR)
  const goldPreview = useTransform(dragX, lang === "ar" ? [0, 90] : [0, -90], [0, 0.5]);
  const swipe = useRef(null);
  const onPointerDown = (e) => {
    if (e.pointerType !== "touch") return;
    if (e.target.closest?.("canvas, input, textarea, select, [data-no-swipe]")) return;
    swipe.current = { x: e.clientX, y: e.clientY, active: false, dx: 0 };
  };
  const onPointerMove = (e) => {
    const s = swipe.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (!s.active) {
      if (Math.abs(dy) > 12 && Math.abs(dy) >= Math.abs(dx)) {
        swipe.current = null; // تمرير عمودي — نترك المتصفح
        return;
      }
      if (Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 1.4) s.active = true;
    }
    if (s.active) {
      s.dx = dx;
      if (!reduceMotion) dragX.set(dx * 0.22);
    }
  };
  const endSwipe = () => {
    const s = swipe.current;
    swipe.current = null;
    animate(dragX, 0, { type: "spring", stiffness: 420, damping: 36 });
    if (!s?.active || Math.abs(s.dx) < 64) return;
    // RTL: التبويب التالي (Premium) على اليسار → نسحب المحتوى يميناً. LTR: العكس.
    const toPremium = lang === "ar" ? s.dx > 0 : s.dx < 0;
    setMode(toPremium ? "premium" : "normal");
    if (showSwipeHint) dismissSwipeHint();
  };

  // ===== السيو =====
  const canonical = offersUrl(lang);
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: t("seo.offers.title"),
      description: t("seo.offers.description"),
      url: canonical,
      inLanguage: lang,
      ...(companies.length
        ? {
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: companies.length,
              itemListElement: companies.slice(0, 30).map((c, i) => ({
                "@type": "ListItem",
                position: i + 1,
                name: c.name,
                url: storeUrl(companySlug(c), lang),
              })),
            },
          }
        : {}),
    },
    breadcrumbLd([
      { name: t("store.breadcrumbHome"), url: homeUrl(lang) },
      { name: t("offers.title"), url: canonical },
    ]),
  ];

  const isPremium = premiumView === "premium";

  return (
    <div className="relative min-h-screen bg-[var(--color-ink)] text-[var(--text)]">
      <Seo
        lang={lang}
        title={t("seo.offers.title")}
        description={t("seo.offers.description")}
        canonical={canonical}
        alternates={buildAlternates("offers")}
        jsonLd={jsonLd}
      />
      <Navbar onPremium={() => setPremiumModal(true)} />

      {/* أمبيانس ذهبي ناعم يملأ الصفحة في وضع Premium */}
      <motion.div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[70vh]"
        style={{ background: "radial-gradient(70% 60% at 50% 0%, rgba(240,198,60,0.16), transparent 70%)" }}
        initial={false}
        animate={{ opacity: isPremium ? 1 : 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />

      {/* ===== هيرو صغير: العنوان + عدد العروض + البحث ===== */}
      <header className="hero-section relative overflow-hidden pt-[104px] sm:pt-[120px]">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-grid" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4">
          <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
            <h1 className="text-[34px] font-black leading-none tracking-tight sm:text-[48px]">{t("offers.title")}</h1>
            {!loading && !error && (
              <span className="mb-1 rounded-xl border border-[var(--color-ink-line)] bg-[var(--fill)] px-3 py-1 text-[13px] font-bold text-[var(--accent-text)]">
                {t("home.offersCount", { count: companies.length })}
              </span>
            )}
          </div>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--text-soft)] sm:text-[16px]">{t("offers.subtitle")}</p>

          {/* حقل البحث — مرساة سلوك الهيدر عند التمرير (id ثابت مستقل عن اللغة) */}
          <div id="search-anchor" className="group relative mt-6">
            <div
              className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 blur transition-opacity duration-300 group-focus-within:opacity-100"
              style={{ background: "linear-gradient(120deg, rgba(166,240,0,0.4), rgba(56,189,248,0.25))" }}
            />
            <div className="relative flex items-center gap-3 rounded-2xl border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] px-4 py-3.5 transition-colors group-focus-within:border-transparent">
              <Search size={20} className="shrink-0 text-[var(--color-mute)] transition-colors group-focus-within:text-[var(--color-lime)]" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("search.placeholder")}
                aria-label={t("search.placeholder")}
                className="w-full bg-transparent text-[15px] font-medium text-[var(--text)] outline-none placeholder:text-[var(--color-mute)] [&::-webkit-search-cancel-button]:hidden"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label={t("search.clear")}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--fill)] text-[var(--color-mute)] transition-colors hover:bg-[var(--fill-strong)] hover:text-[var(--text)]"
                >
                  <X size={14} />
                </button>
              )}
              <span className="hidden shrink-0 rounded-lg bg-[var(--fill)] px-2 py-1 text-[11px] font-bold text-[var(--color-mute)] sm:block">
                {t("search.results", { count: filtered.length })}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-4 pb-6 pt-5">
        {/* فلتر النوع + شرائح التصنيفات */}
        <div className="flex flex-col gap-3">
          <TypeFilter value={typeParam} onChange={(v) => updateParams({ type: v })} />
          <CategoryChips
            categories={cats}
            counts={counts}
            value={categoryParam}
            onChange={(v) => updateParams({ category: v })}
            featured={
              featured.length || featuredParam
                ? {
                    active: featuredParam,
                    count: featured.length,
                    onToggle: () => updateParams({ featured: featuredParam ? null : "1" }),
                  }
                : null
            }
          />
        </div>

        {/* شريط الأدوات: الترتيب + مبدّل Premium (الحاسوب؛ الهاتف يستعمل المبدّل العائم) */}
        {!loading && !error && (
          <>
            <div className="mb-5 mt-6 flex flex-wrap items-center justify-between gap-3">
              <SortToggle value={sortMode} onChange={(v) => updateParams({ sort: v === "newest" ? null : v })} />
              <div className="relative hidden md:block">
                <PremiumToggle value={premiumView} onChange={setMode} />
                <GoldBurst fire={burst} />
              </div>
            </div>
            <OfferModeNote
              mode={premiumView}
              unlocked={unlocked}
              onSwitchPremium={() => setMode("premium")}
              onOpenPremium={() => setPremiumModal(true)}
            />
          </>
        )}

        {/* صف العروض المميّزة (على القائمة الكاملة بلا فلاتر) */}
        {!loading && !error && showFeaturedRow && (
          <FeaturedRow
            items={featured}
            premiumMode={isPremium}
            favorites={favorites}
            onToggleFav={toggleFav}
            onCopy={handleCopy}
            unlocked={unlocked}
            onUnlock={() => setPremiumModal(true)}
            onShowAll={() => updateParams({ featured: "1" })}
          />
        )}

        {/* الحالات */}
        {(loading || featuredPending) && <SkeletonGrid />}
        {error && <ErrorState message={error} onRetry={load} />}
        {!loading && !featuredPending && !error && filtered.length === 0 && <EmptyState onReset={resetFilters} />}

        {/* الشبكة — السحب الأفقي (لمس) يبدّل بين عادي و Premium */}
        <div
          ref={listRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endSwipe}
          onPointerCancel={endSwipe}
          className="relative"
          style={{ touchAction: "pan-y" }}
        >
          {!isPremium && (
            <motion.div
              aria-hidden
              className="pointer-events-none absolute -inset-x-2 inset-y-0 z-10 rounded-[var(--radius-card)] md:hidden"
              style={{ opacity: goldPreview, background: "linear-gradient(180deg, rgba(240,198,60,0.18), transparent 60%)" }}
            />
          )}
          {/* لمعة ذهبية تمرّ على القائمة عند التحوّل إلى Premium (البطاقات تتلوّن وتعدّ القيم في مكانها) */}
          {!reduceMotion && burst > 0 && isPremium && (
            <motion.div
              key={`sweep-${burst}`}
              aria-hidden
              className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-[var(--radius-card)]"
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.3, delay: 0.75 }}
            >
              <motion.span
                className="absolute inset-y-0 w-1/2 -skew-x-12"
                style={{ background: "linear-gradient(90deg, transparent, rgba(255,228,134,0.22), transparent)" }}
                initial={{ x: lang === "ar" ? "220%" : "-120%" }}
                animate={{ x: lang === "ar" ? "-120%" : "220%" }}
                transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
              />
            </motion.div>
          )}
          {!loading && !error && filtered.length > 0 && (
            <motion.div style={{ x: dragX }} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence>
                {ordered.map((c, i) => {
                  const premium = isPremium && c.supports_premium !== false;
                  const label = featuredLabel.get(c.id);
                  const card = (
                    <CompanyCard
                      key={label ? undefined : c.id}
                      company={c}
                      index={i}
                      isFavorite={favorites.includes(c.id)}
                      onToggleFav={toggleFav}
                      onCopy={handleCopy}
                      premium={premium}
                      unlocked={unlocked}
                      onUnlock={() => setPremiumModal(true)}
                    />
                  );
                  // العرض المميّز داخل الشبكة: نفس الحافة المضيئة بنسخة أخف (ضوء خلفي + الوسم)
                  return label ? (
                    <FeaturedFrame key={c.id} variant="soft" tone={frameTone(c, premium)} label={label} fx={gridFx}>
                      {card}
                    </FeaturedFrame>
                  ) : (
                    card
                  );
                })}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </main>

      <Footer onPremium={() => setPremiumModal(true)} />

      <FloatingModeSwitch
        visible={listInView && !loading && !error && filtered.length > 0}
        value={premiumView}
        onChange={setMode}
        burst={burst}
        showHint={showSwipeHint}
      />

      <CopyToast code={toast} />
      <PremiumModal open={premiumModal} onClose={() => setPremiumModal(false)} />
      <EmailPopup />
    </div>
  );
}
