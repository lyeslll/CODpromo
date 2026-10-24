import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Store, Check, ShieldCheck, Hourglass, Crown } from "lucide-react";
import { useTranslation } from "react-i18next";
import DashboardShell from "../../components/dashboard/DashboardShell.jsx";
import WelcomePanel from "../../components/dashboard/customer/WelcomePanel.jsx";
import PlanPass from "../../components/dashboard/customer/PlanPass.jsx";
import GiftCodeField from "../../components/dashboard/customer/GiftCodeField.jsx";
import FreeKeyCard from "../../components/dashboard/customer/FreeKeyCard.jsx";
import RecentCopies from "../../components/dashboard/customer/RecentCopies.jsx";
import GrowCards from "../../components/dashboard/customer/GrowCards.jsx";
import SettingsPanel from "../../components/dashboard/customer/SettingsPanel.jsx";
import CompanyCard from "../../components/CompanyCard.jsx";
import PremiumModal from "../../components/PremiumModal.jsx";
import { useGoPremium } from "../../lib/goPremium.js";
import GiftConfetti from "../../components/gift/GiftConfetti.jsx";
import { useAuth } from "../../lib/auth.jsx";
import { usePremium } from "../../lib/premium.jsx";
import { giftDaysLeft } from "../../lib/gifts.js";
import { fetchMyPurchase } from "../../lib/billing.js";
import { usePricing } from "../../lib/pricing.jsx";
import { useFreeKey } from "../../lib/freeKeyContext.jsx";
import LifetimePrice from "../../components/pricing/LifetimePrice.jsx";
import SeatsMeter from "../../components/pricing/SeatsMeter.jsx";
import { fetchFavoritesWithCompany, addFavorite, removeFavorite } from "../../lib/favorites.js";
import { fetchRecentCopies, countCopiedCodes, logCodeCopy, COPY_EVENT } from "../../lib/copies.js";
import { countMyVotes } from "../../lib/account.js";
import { trackClick } from "../../lib/supabase.js";
import { loadHeaderOffers, useSharedStats } from "../../components/header/headerData.js";
import { offersPath } from "../../lib/seo.js";

const NEW_OFFERS = 6;
// بانر الدفعة الوحدة يبان كي تبقى 7 أيام (أو أقل) في الهدية
const GIFT_ENDING_DAYS = 7;

/**
 * داشبورد الزبون. الحاسوب: شبكة 12 عموداً. الهاتف: عمود واحد والأهم فوق
 * (الخطة ← الأكواد المنسوخة ← الترحيب ← المفضّلة ← عروض جديدة ← طوّر تجارتك ← الإعدادات).
 * كل الأرقام من قاعدة البيانات.
 */
export default function CustomerDashboard() {
  const { user, profile } = useAuth();
  const { unlocked, hasPremium, isPremiumActive, isLifetime, isGift, gift, premiumReady, refreshGift } = usePremium();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const stats = useSharedStats();

  const [favorites, setFavorites] = useState([]);
  const [favLoading, setFavLoading] = useState(true);
  const [copies, setCopies] = useState([]);
  const [copiesLoading, setCopiesLoading] = useState(true);
  const [copiedCount, setCopiedCount] = useState(null);
  const [votes, setVotes] = useState(null);
  const [allOffers, setAllOffers] = useState([]);
  // نافذة Premium هنا غير لـ "أنا عضو Stork"؛ الترقية = صفحة /premium
  const [modal, setModal] = useState(null); // null | "stork"
  const goPremium = useGoPremium();
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const [celebrate, setCelebrate] = useState(0);
  const [giftToast, setGiftToast] = useState(null);
  const giftToastTimer = useRef(null);

  const kind = isLifetime ? "lifetime" : isPremiumActive ? "premium" : isGift ? "gift" : "free";
  const pricing = usePricing();
  const fk = useFreeKey();
  // تاريخ الشراء (Premium مدى الحياة) — من purchases، المستخدم يقرا مشترياتو برك
  const [purchase, setPurchase] = useState(null);
  useEffect(() => {
    if (kind !== "lifetime" || profile?.is_admin) return;
    let active = true;
    fetchMyPurchase(user.id).then((p) => active && setPurchase(p));
    return () => {
      active = false;
    };
  }, [kind, user.id, profile?.is_admin]);
  const giftLeft = isGift ? giftDaysLeft(gift) : null;
  const giftEnding = isGift && giftLeft <= GIFT_ENDING_DAYS;
  const fmtDay = (d) => new Date(d).toLocaleDateString(lang, { day: "numeric", month: "long", year: "numeric" });

  // تفعيل من خانة "هل لديك كود هدية؟": الخطة تتبدّل + قصاصات ذهبية + رسالة
  const onGiftRedeemed = async (r) => {
    await refreshGift();
    setCelebrate((n) => n + 1);
    setGiftToast(r.premium_until || null);
    clearTimeout(giftToastTimer.current);
    giftToastTimer.current = setTimeout(() => setGiftToast(null), 4200);
  };
  useEffect(() => () => clearTimeout(giftToastTimer.current), []);
  const name = profile?.full_name || user?.user_metadata?.full_name || t("dashboard.customer.friend");
  const joined = new Date(profile?.created_at || user?.created_at || Date.now()).toLocaleDateString(lang, { month: "long", year: "numeric" });

  const loadCopies = useCallback(() => {
    fetchRecentCopies(user.id, 10)
      .then(setCopies)
      .catch(() => setCopies([]))
      .finally(() => setCopiesLoading(false));
    countCopiedCodes(user.id)
      .then(setCopiedCount)
      .catch(() => setCopiedCount(0));
  }, [user.id]);

  useEffect(() => {
    let active = true;
    fetchFavoritesWithCompany(user.id)
      .then((rows) => active && setFavorites(rows))
      .catch(() => active && setFavorites([]))
      .finally(() => active && setFavLoading(false));
    countMyVotes(user.id)
      .then((n) => active && setVotes(n))
      .catch(() => active && setVotes(0));
    loadHeaderOffers().then((rows) => active && setAllOffers(rows));
    loadCopies();
    window.addEventListener(COPY_EVENT, loadCopies);
    return () => {
      active = false;
      window.removeEventListener(COPY_EVENT, loadCopies);
      clearTimeout(toastTimer.current);
    };
  }, [user.id, loadCopies]);

  const favIds = useMemo(() => favorites.map((f) => f.company_id), [favorites]);

  // عروض جديدة تهمك: الأحدث في فئات المفضّلة (بلا المفضّلة نفسها)، وإلا الأحدث عموماً.
  const { newOffers, fromFavorites } = useMemo(() => {
    const byDate = [...allOffers].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const favCats = new Set(favorites.map((f) => f.companies?.category_id).filter(Boolean));
    const favCatText = new Set(favorites.map((f) => f.companies?.category).filter(Boolean));
    if (favorites.length) {
      const inCats = byDate.filter(
        (c) => !favIds.includes(c.id) && ((c.category_id && favCats.has(c.category_id)) || (!c.category_id && c.category && favCatText.has(c.category)))
      );
      if (inCats.length) return { newOffers: inCats.slice(0, NEW_OFFERS), fromFavorites: true };
    }
    return { newOffers: byDate.filter((c) => !favIds.includes(c.id)).slice(0, NEW_OFFERS), fromFavorites: false };
  }, [allOffers, favorites, favIds]);

  const showToast = (code) => {
    setToast(code);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  // نسخ من بطاقة كوبون (CompanyCard يسجّل النسخة، وحدث COPY_EVENT يحدّث القائمة والعدّاد)
  const handleCardCopy = useCallback((c, code = c.code) => {
    navigator.clipboard?.writeText(code).catch(() => {});
    trackClick(c.id, c.clicks);
    showToast(code);
  }, []);

  // "انسخ مرة أخرى" من قائمة الأكواد المنسوخة
  const copyAgain = async (c, code, premium) => {
    navigator.clipboard?.writeText(code).catch(() => {});
    trackClick(c.id, c.clicks);
    showToast(code);
    logCodeCopy(c.id, premium);
  };

  const toggleFav = (company) => {
    const id = company.id;
    const isFav = favIds.includes(id);
    const before = favorites;
    setFavorites((prev) => (isFav ? prev.filter((f) => f.company_id !== id) : [{ company_id: id, companies: company }, ...prev]));
    const op = isFav ? removeFavorite(user.id, id) : addFavorite(user.id, id);
    op.catch(() => setFavorites(before));
  };

  const cardProps = (c, i) => ({
    company: c,
    index: i,
    isFavorite: favIds.includes(c.id),
    onToggleFav: () => toggleFav(c),
    onCopy: handleCardCopy,
    premium: hasPremium && c.supports_premium !== false,
    unlocked,
    onUnlock: goPremium,
  });

  // البطاقات تتبدّل كي توصل حالة Premium والسعر والمفتاح الذهبي (بطاقة الخطة تكبر ~260px) → هيكل واحد
  // حتى يكونو معروفين، ثم الصفحة كاملة مرة وحدة (بلا قفزات متتالية).
  const ready = premiumReady && (hasPremium || pricing != null) && (hasPremium || fk.status !== "loading");
  if (!ready) {
    return (
      <DashboardShell badge={t("dashboard.customer.badge")} wide>
        <div aria-busy="true" className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="h-[260px] animate-pulse rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] lg:col-span-7" />
          <div className="h-[420px] animate-pulse rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] lg:col-span-5" />
          <div className="h-[220px] animate-pulse rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] lg:col-span-12" />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell badge={t("dashboard.customer.badge")} wide>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* حساب الأدمن فقط: دخول مباشر للوحة التحكم (بلا رمز) */}
        {profile?.is_admin === true && (
          <div className="order-0 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-[var(--color-lime)]/30 bg-[var(--color-lime)]/[0.06] px-5 py-3.5 lg:col-span-12">
            <p className="flex items-center gap-2 text-[14px] font-bold text-[var(--text)]">
              <ShieldCheck size={18} className="text-[var(--color-lime)]" /> {t("dashboard.admin.note")}
            </p>
            <Link
              to="/admin"
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13.5px] font-extrabold text-[#0a0a0a] transition-transform hover:scale-[1.02]"
              style={{ background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" }}
            >
              <ShieldCheck size={16} /> {t("dashboard.admin.open")}
            </Link>
          </div>
        )}
        {/* هدية Premium: 7 أيام قبل النهاية → الدفعة الوحدة (Premium مدى الحياة) + عدّاد مقاعد الإطلاق */}
        {giftEnding && (
          <div className="order-0 grid gap-4 rounded-[var(--radius-card)] border border-[#f0c63c]/40 bg-[linear-gradient(90deg,rgba(240,198,60,0.13),rgba(240,198,60,0.04))] px-5 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center lg:col-span-12">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[#1d1403]" style={{ background: "linear-gradient(135deg, #ffe486, #cf9a1e)" }}>
                <Hourglass size={19} />
              </span>
              <div className="min-w-0">
                <p className="text-[15px] font-extrabold text-[var(--text)]">{t("dashboard.gift.endingTitle", { duration: t("gift.dur.daysNom", { count: giftLeft }) })}</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--text-soft)]">{t("dashboard.gift.endingDesc")}</p>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-6">
              {pricing && (
                <div>
                  <p className="text-[12px] font-extrabold text-[#ffe486]">{t("pricing.oneTime")}</p>
                  <LifetimePrice pricing={pricing} size="md" className="mt-1" />
                </div>
              )}
              <SeatsMeter pricing={pricing} className="sm:w-[190px]" />
              <button
                type="button"
                onClick={goPremium}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13.5px] font-extrabold text-[#1d1403] transition-transform hover:scale-[1.02]"
                style={{ background: "linear-gradient(135deg, #ffe486, #f0c63c 55%, #cf9a1e)" }}
              >
                <Crown size={16} /> {t("dashboard.gift.endingCta")}
              </button>
            </div>
          </div>
        )}
        {/* الهاتف: الترحيب والأرقام أولاً (كانت 4 بطاقات بيع قبلها والاسم في y≈1190) */}
        <div className="-order-1 lg:order-none lg:col-span-7">
          <WelcomePanel name={name} email={user?.email} joined={joined} kind={kind} stats={{ copied: copiedCount, favorites: favLoading ? null : favorites.length, votes }} />
        </div>
        <div className="order-1 lg:order-none lg:col-span-5">
          <PlanPass
            kind={kind}
            profile={profile}
            gift={gift}
            purchase={purchase}
            stats={stats}
            onOpenPremium={goPremium}
            onOpenStork={() => setModal("stork")}
            // هدية وحدة لكل حساب في حياتو: الخانة تبان غير لحساب ما خذاش هدية من قبل
            giftField={premiumReady && !gift ? <GiftCodeField onRedeemed={onGiftRedeemed} /> : null}
          />
        </div>
        {/* المفتاح الذهبي: متاح → اختر البطاقة، مستعمل → الكود + النسخ (الهاتف: مباشرة تحت الخطة) */}
        <div className="order-1 empty:hidden lg:order-none lg:col-span-12">
          <FreeKeyCard onCopied={showToast} />
        </div>
        <div className="order-2 lg:order-none lg:col-span-7">
          <RecentCopies rows={copies} loading={copiesLoading} premiumActive={hasPremium} onCopy={copyAgain} onUnlock={goPremium} />
        </div>
        <div className="order-6 lg:order-none lg:col-span-5 lg:self-start">
          <GrowCards />
        </div>

        {/* المفضّلة — نفس بطاقات الكوبون */}
        <section className="order-4 mt-4 lg:order-none lg:col-span-12">
          <SectionHead title={t("dashboard.customer.favorites")} note={!favLoading && favorites.length > 0 ? t("dashboard.customer.items", { count: favorites.length }) : null} />
          {favLoading ? (
            <CardsSkeleton />
          ) : favorites.length === 0 ? (
            <EmptyFavorites />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence>
                {favorites.map((f, i) => (
                  <CompanyCard key={f.company_id} {...cardProps(f.companies, i)} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>

        {/* عروض جديدة تهمك */}
        {newOffers.length > 0 && (
          <section className="order-5 mt-4 lg:order-none lg:col-span-12">
            <SectionHead
              title={t("dashboard.newOffers.title")}
              note={fromFavorites ? t("dashboard.newOffers.fromFavs") : t("dashboard.newOffers.latest")}
              action={
                <Link to={offersPath(lang)} className="text-[13px] font-bold text-[var(--accent-text)] hover:underline">
                  {t("dashboard.newOffers.all")}
                </Link>
              }
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* الهاتف: 3 عروض فقط حتى لا تطول الصفحة */}
              {newOffers.map((c, i) => (
                <div key={c.id} className={i >= 3 ? "hidden sm:block" : undefined}>
                  <CompanyCard {...cardProps(c, i)} />
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="order-7 mt-4 lg:order-none lg:col-span-12">
          <SettingsPanel />
        </div>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            role="status"
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

      <AnimatePresence>
        {giftToast !== null && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            role="status"
            className="fixed bottom-5 left-1/2 z-50 flex w-max max-w-[92vw] -translate-x-1/2 items-center gap-2.5 rounded-2xl border border-[#f0c63c]/45 bg-[var(--elev)]/95 px-4 py-3 shadow-[0_16px_50px_-12px_rgba(0,0,0,0.45)] backdrop-blur-xl"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[#1d1403]" style={{ background: "linear-gradient(135deg, #ffe486, #cf9a1e)" }}>
              <Check size={16} strokeWidth={3} />
            </span>
            <span className="text-[14px] font-semibold text-[var(--text)]">{t("gift.toast", { date: giftToast ? fmtDay(giftToast) : "" })}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <GiftConfetti fire={celebrate} />
      <PremiumModal open={modal !== null} initialStep="stork" onClose={() => setModal(null)} />
    </DashboardShell>
  );
}

function SectionHead({ title, note, action }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-[20px] font-extrabold text-[var(--text)]">{title}</h2>
        {note && <p className="mt-0.5 text-[13px] text-[var(--color-mute)]">{note}</p>}
      </div>
      {action}
    </div>
  );
}

function CardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-[260px] animate-pulse rounded-[var(--radius-card)] bg-[var(--color-ink-card)]" />
      ))}
    </div>
  );
}

function EmptyFavorites() {
  const { t, i18n } = useTranslation();
  return (
    <div className="flex flex-col items-center rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] px-6 py-14 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[var(--fill)] text-[var(--color-mute)]">
        <Store size={28} />
      </div>
      <h3 className="mt-5 text-[17px] font-extrabold text-[var(--text)]">{t("dashboard.customer.emptyTitle")}</h3>
      <p className="mt-1.5 text-[14px] text-[var(--text-soft)]">{t("dashboard.customer.emptyDesc")}</p>
      <Link
        to={offersPath(i18n.language)}
        className="mt-6 rounded-xl px-5 py-2.5 text-[14px] font-extrabold text-[#0a0a0a]"
        style={{ background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" }}
      >
        {t("dashboard.customer.browse")}
      </Link>
    </div>
  );
}
