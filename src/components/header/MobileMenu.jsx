import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowLeft, Crown, LogIn, LogOut, Smartphone, Tag, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LANGS, Flag, useLangPick } from "../LanguageSwitcher.jsx";
import { useLocale } from "../../lib/locale.jsx";
import { useAuth } from "../../lib/auth.jsx";
import { usePremium } from "../../lib/premium.jsx";
import { useCategories } from "../../lib/categories.jsx";
import { activeCategories, countByCategory } from "../../lib/offerFilters.js";
import { categoryName, categoryRecordSlug } from "../../lib/slug.js";
import { categoriesPath, homePath, offersLink, offersPath } from "../../lib/seo.js";
import { DZ_PLANS, fmtUSD } from "../../lib/plans.js";
import { monthlyUsdPrice } from "../../lib/siteStats.js";
import { formatNumber } from "../../lib/values.js";
import { useHeaderOffers, userDisplay } from "./headerData.js";
import GooglePlayBadge from "../app/GooglePlayBadge.jsx";
import { useAppTarget } from "../../lib/appInstall.js";

const GOLD_BG = "linear-gradient(135deg, #ffe486, #f0c63c 55%, #cf9a1e)";
// ألوان تذكرة Premium (نفس متغيّرات .ticket في البطاقات)
const GOLD_TICKET = { "--edge-base": "#f0c63c59", "--edge-strong": "#f0c63cb3", "--perf": "#f0c63c80" };
const EASE = [0.16, 1, 0.3, 1];
// تلاشٍ خفيف عند طرفي شريط الفئات (يوحي بأن هناك المزيد بالسحب)
const EDGE_FADE = {
  maskImage: "linear-gradient(90deg, transparent, #000 18px, #000 calc(100% - 18px), transparent)",
  WebkitMaskImage: "linear-gradient(90deg, transparent, #000 18px, #000 calc(100% - 18px), transparent)",
};

// ظهور العناصر بالتتابع بعد انفتاح الدائرة (الإزاحة تُلغى تلقائياً مع تقليل الحركة عبر MotionConfig)
const listVariants = { show: { transition: { staggerChildren: 0.05, delayChildren: 0.14 } } };
const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } },
};

/** موضع الانفتاح: مركز زر القائمة + نصف قطر يغطّي الشاشة + أسفل كبسولة الهيدر. */
function measure(originRef) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const b = originRef?.current?.getBoundingClientRect();
  const x = b ? b.left + b.width / 2 : w - 36;
  const y = b ? b.top + b.height / 2 : 40;
  const top = document.querySelector("#top .nav-capsule")?.getBoundingClientRect().bottom ?? 80;
  return { x, y, top, r: Math.ceil(Math.hypot(Math.max(x, w - x), Math.max(y, h - y))) + 8 };
}

/**
 * قائمة الهاتف بكامل الشاشة: تنفتح كدائرة من زر القائمة (وتلاشٍ بسيط مع تقليل الحركة).
 * تبقى تحت الهيدر (z-45) فيبقى الشعار وزر الإغلاق في مكانهما، وفوق شريط التنقّل السفلي (z-40).
 */
export default function MobileMenu({ id, open, onClose, onPremium, onLogout, originRef, offersCount }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const { user } = useAuth();
  const { isPremiumActive, isLifetime } = usePremium();
  const { categories } = useCategories();
  const offers = useHeaderOffers(open);
  const app = useAppTarget();
  const [geo, setGeo] = useState(null);

  // القياس قبل الرسم (حتى تبدأ الدائرة من الزر بالضبط)، ومع تدوير الشاشة،
  // وبعد تبديل اللغة (يتبدّل اتجاه الصفحة في الإطار التالي فينتقل زر القائمة للجهة الأخرى).
  // اتّساع النافذة لمقاس الحاسوب (lg) يغلق القائمة حتى لا يبقى تمرير الصفحة مقفولاً.
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => (window.innerWidth >= 1024 ? onClose() : setGeo(measure(originRef)));
    update();
    const raf = requestAnimationFrame(update);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", update);
    };
  }, [open, originRef, lang]);

  // Esc يغلق القائمة
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // قفل تمرير الصفحة خلف القائمة — بلا تحريك موضع التمرير (فلا يتغيّر شكل الهيدر عند الفتح والإغلاق)
  useEffect(() => {
    if (!open) return;
    const els = [document.documentElement, document.body];
    const prev = els.map((el) => el.style.overflow);
    els.forEach((el) => (el.style.overflow = "hidden"));
    return () => els.forEach((el, i) => (el.style.overflow = prev[i]));
  }, [open]);

  // ترتيب الفئات كما في لوحة الأدمن (sort_order) — ثابت، والأعداد تظهر حين تصل العروض
  const chips = activeCategories(categories);
  const counts = offers.length ? countByCategory(offers, chips) : null;
  const { name, initial } = userDisplay(user, t("nav.account"));
  const usd = monthlyUsdPrice();
  const dzd = DZ_PLANS.find((p) => p.key === "month")?.price ?? null;

  const clip = (r) => (geo ? `circle(${r}px at ${geo.x}px ${geo.y}px)` : undefined);
  const reveal = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.2 } }
    : {
        initial: { clipPath: clip(0) },
        animate: { clipPath: clip(geo?.r ?? 0) },
        exit: { clipPath: clip(0), transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] } },
        transition: { duration: 0.55, ease: EASE },
      };

  const goPremiumOffers = () => {
    onClose();
    navigate(offersLink(lang, { mode: "premium" }));
  };

  return createPortal(
    <AnimatePresence>
      {open && geo && (
        <motion.div
          key="mobile-menu"
          id={id}
          role="dialog"
          aria-label={t("nav.menu")}
          {...reveal}
          className="fixed inset-0 z-[45] overflow-y-auto overscroll-contain bg-[var(--color-ink)] lg:hidden"
          style={{ paddingTop: geo.top + 14, paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)" }}
        >
          {/* توهّج ليموني خفيف من جهة زر القائمة */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-[70vh]"
            style={{ background: `radial-gradient(90% 55% at ${geo.x}px 0, rgba(166,240,0,0.09), transparent 70%)` }}
          />

          <motion.div variants={listVariants} initial="hidden" animate="show" className="relative mx-auto flex max-w-md flex-col px-5">
            {/* روابط كبيرة بشكل سطور إيصال: الاسم ثم نقاط ثم القيمة */}
            <nav className="flex flex-col">
              <BigLink
                to={offersPath(lang)}
                label={t("nav.offers")}
                value={offersCount != null ? formatNumber(offersCount, lang) : null}
                hint={offersCount != null ? t("header.offersBadge", { count: offersCount }) : null}
                onClick={onClose}
              />
              <BigLink to={categoriesPath(lang)} label={t("nav.categories")} value={chips.length ? formatNumber(chips.length, lang) : null} onClick={onClose} />
              <BigLink to={{ pathname: homePath(lang), hash: "#how" }} label={t("nav.how")} onClick={onClose} />
            </nav>

            {/* شرائح الفئات → /offers?category=… — سطران يُسحبان أفقياً حتى يبقى كارت Premium في الشاشة الأولى */}
            {chips.length > 0 && (
              <motion.div variants={itemVariants} className="mt-3 border-t border-dashed border-[var(--color-ink-line)] pt-4">
                <div className="-mx-5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={EDGE_FADE}>
                  <div className="flex w-max flex-col gap-2">
                    {[chips.slice(0, Math.ceil(chips.length / 2)), chips.slice(Math.ceil(chips.length / 2))].map((row, i) => (
                      <div key={i} className="flex gap-2">
                        {row.map((c) => {
                          const n = counts ? counts[c.id] || 0 : null;
                          const icon = (c.icon || "").trim();
                          return (
                            <Link
                              key={c.id}
                              to={offersLink(lang, { category: categoryRecordSlug(c) })}
                              onClick={onClose}
                              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--color-ink-line)] bg-[var(--fill)] px-3.5 py-2 text-[13.5px] font-bold transition-colors hover:border-[var(--color-lime)]/45 active:border-[var(--color-lime)]/60 active:bg-[var(--fill-strong)] ${
                                n === 0 ? "text-[var(--color-mute)]" : "text-[var(--text-softer)]"
                              }`}
                            >
                              {icon ? <span aria-hidden>{icon}</span> : <Tag size={13} className="text-[var(--accent-text)]" />}
                              {categoryName(c, lang)}
                              {n != null && <span className="text-[11.5px] font-extrabold tabular-nums text-[var(--color-mute)] [font-family:Inter,sans-serif]">{n}</span>}
                            </Link>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* كارت Premium ذهبي على شكل تذكرة كوبون: السعر في الأعلى، الزر في الكعب */}
            <motion.div variants={itemVariants} className="ticket ticket-premium relative mt-6" style={GOLD_TICKET}>
              <div className="ticket-top relative bg-[var(--color-ink-card)] p-5 pb-4">
                <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(90% 80% at 85% 0%, rgba(240,198,60,0.16), transparent 65%)" }} />
                <span aria-hidden className="ticket-ring ticket-ring-l" />
                <span aria-hidden className="ticket-ring ticket-ring-r" />
                <div className="relative flex items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[#0a0a0a]" style={{ background: GOLD_BG, boxShadow: "0 10px 24px -10px rgba(240,198,60,0.7)" }}>
                    <Crown size={21} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[18px] font-black text-[#ffe486]">{isPremiumActive ? (isLifetime ? t("premium.lifetime") : t("header.member")) : t("premiumToggle.premium")}</span>
                    <span className="mt-0.5 block text-[13px] font-medium text-[var(--text-soft)]">{isPremiumActive ? t("hero.ctaMember") : t("nav.premiumSub")}</span>
                  </span>
                </div>
                {!isPremiumActive && usd != null && (
                  <div className="relative mt-4">
                    <p className="text-[14px] font-semibold text-[var(--text-soft)]">
                      {t("compare.priceFrom")} <bdi className="text-[28px] font-black leading-none text-[#ffe486] [font-family:Inter,sans-serif]">{fmtUSD(usd)}</bdi>{" "}
                      {t("compare.perMonth")}
                    </p>
                    {dzd != null && <p className="mt-1 text-[12.5px] font-medium text-[var(--color-mute)]">{t("compare.orDzd", { price: formatNumber(dzd, lang) })}</p>}
                  </div>
                )}
              </div>
              <div className="ticket-stub relative bg-[var(--color-ink-card)] px-5 pb-5 pt-4">
                <span aria-hidden className="ticket-ring ticket-ring-l" />
                <span aria-hidden className="ticket-ring ticket-ring-r" />
                <span aria-hidden className="ticket-perf" />
                <motion.button
                  type="button"
                  onClick={isPremiumActive ? goPremiumOffers : onPremium}
                  whileTap={{ scale: 0.97 }}
                  className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl py-3 text-[15px] font-extrabold text-[#0a0a0a]"
                  style={{ background: GOLD_BG, boxShadow: "0 12px 28px -12px rgba(240,198,60,0.8)" }}
                >
                  <span aria-hidden className="absolute inset-0 -translate-x-full bg-white/35 transition-transform duration-700 group-hover:translate-x-full" />
                  <Crown size={17} className="relative" />
                  <span className="relative">{isPremiumActive ? t("compare.seePremium") : t("nav.premium")}</span>
                </motion.button>
              </div>
            </motion.div>

            {/* الحساب: دخول + تسجيل، أو حسابي + خروج */}
            {user ? (
              <motion.div variants={itemVariants} className="mt-4 flex flex-col gap-2">
                <Link
                  to="/dashboard"
                  onClick={onClose}
                  className="flex items-center gap-3 rounded-xl border border-[var(--color-ink-line)] bg-[var(--fill)] px-3 py-2.5 transition-colors hover:bg-[var(--fill-strong)]"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-lg text-[14px] font-black text-[#0a0a0a]" style={{ background: "linear-gradient(150deg, var(--color-lime-soft), var(--color-lime-deep))" }}>
                    {initial}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-bold text-[var(--text)]">{name}</span>
                    <span className="block text-[12px] text-[var(--color-mute)]">{t("nav.account")}</span>
                  </span>
                  <ArrowLeft size={16} className="text-[var(--color-mute)] ltr:rotate-180" />
                </Link>
                <button
                  type="button"
                  onClick={onLogout}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--color-ink-line)] px-3 py-2.5 text-[14px] font-bold text-red-400 transition-colors hover:border-red-500/40"
                >
                  <LogOut size={16} /> {t("nav.logoutLong")}
                </button>
              </motion.div>
            ) : (
              <motion.div variants={itemVariants} className="mt-4 grid grid-cols-[auto_1fr] gap-2">
                <Link
                  to="/login"
                  onClick={onClose}
                  className="flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-[var(--color-ink-line)] px-5 py-3 text-[14px] font-semibold text-[var(--text)] transition-colors hover:bg-[var(--fill)]"
                >
                  <LogIn size={16} /> {t("nav.login")}
                </Link>
                {/* إنشاء حساب: إطار رقيق مثل "دخول" — كارت Premium الذهبي يبقى الوحيد البارز */}
                <Link
                  to="/signup"
                  onClick={onClose}
                  className="flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-[var(--color-ink-line)] px-3 py-3 text-[14px] font-semibold text-[var(--text)] transition-colors hover:bg-[var(--fill)]"
                >
                  <UserPlus size={16} /> {t("nav.signup")}
                </Link>
              </motion.div>
            )}

            {/* اختيار اللغة */}
            <motion.div variants={itemVariants} className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-[var(--color-ink-line)] bg-[var(--fill)] px-3 py-2.5">
              <span className="text-[13.5px] font-bold text-[var(--text-softer)]">{t("nav.language")}</span>
              <LanguageSegment />
            </motion.div>

            {/* تطبيق Android: شارة Google Play صغيرة (أو "قريباً على iPhone") — تختفي داخل التطبيق */}
            {!app.inApp && (
              <motion.div variants={itemVariants} className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-[var(--color-ink-line)] bg-[var(--fill)] px-3 py-2">
                <span className="text-[13.5px] font-bold text-[var(--text-softer)]">{t("app.getApp")}</span>
                {app.platform === "ios" ? (
                  <span className="flex items-center gap-1.5 py-1.5 text-[13px] font-semibold text-[var(--color-mute)]">
                    <Smartphone size={14} aria-hidden /> {t("app.iosSoon")}
                  </span>
                ) : (
                  <GooglePlayBadge height={50} style={{ margin: "-8px -8px" }} />
                )}
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/** سطر كبير: الاسم، خط نقاط، ثم القيمة (عدد) أو سهم. */
function BigLink({ to, label, value, hint, onClick }) {
  return (
    <motion.div variants={itemVariants}>
      <Link to={to} onClick={onClick} className="group flex items-end gap-3 py-2.5 outline-none">
        <span className="text-[clamp(22px,6.6vw,32px)] font-black leading-[1.1] text-[var(--text)] transition-colors group-hover:text-[var(--accent-text)] group-focus-visible:text-[var(--accent-text)] group-active:text-[var(--accent-text)]">
          {label}
        </span>
        <span aria-hidden className="mb-1.5 h-0 min-w-4 flex-1 border-b-2 border-dotted border-[var(--color-ink-line)] transition-colors group-hover:border-[var(--color-lime)]/40" />
        {value != null ? (
          <span aria-hidden className="mb-0.5 text-[16px] font-extrabold tabular-nums text-[var(--accent-text)] [font-family:Inter,sans-serif]">
            {value}
          </span>
        ) : (
          <ArrowLeft size={20} aria-hidden className="mb-1 text-[var(--color-mute)] transition-transform group-hover:-translate-x-1 ltr:rotate-180 ltr:group-hover:translate-x-1" />
        )}
        {hint && <span className="sr-only">{hint}</span>}
      </Link>
    </motion.div>
  );
}

/* مبدّل اللغة المجزّأ (نفس منطق LanguageSwitcher عبر useLangPick — بلا قائمة منسدلة) */
function LanguageSegment() {
  const { lang } = useLocale();
  const pick = useLangPick();
  return (
    <div className="flex items-center gap-1 rounded-xl border border-[var(--color-ink-line)] bg-[var(--fill)] p-1">
      {LANGS.map((l) => {
        const active = l.code === lang;
        return (
          <button
            key={l.code}
            onClick={() => pick(l.code)}
            aria-pressed={active}
            title={l.label}
            className="relative grid h-8 w-9 place-items-center rounded-lg"
          >
            {active && (
              <motion.span
                layoutId="lang-active-seg"
                className="absolute inset-0 rounded-lg bg-[var(--fill-strong)] ring-1 ring-[var(--color-lime)]/30"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative grid place-items-center">
              <Flag code={l.flag} size={18} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
