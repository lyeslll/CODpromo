import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { LogIn, LogOut, Sparkles, Menu, X, Sun, Moon, Store, HelpCircle, Flame, Crown, ChevronLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import Logo from "./Logo.jsx";
import LanguageSwitcher, { LANGS, Flag, useLangPick } from "./LanguageSwitcher.jsx";
import { useTheme } from "../lib/theme.jsx";
import { useLocale } from "../lib/locale.jsx";
import { useAuth } from "../lib/auth.jsx";
import { useScrollDirection } from "../lib/useScrollDirection.js";

// روابط التنقّل + أيقونة لكل رابط (الميغا مينيو يعرضها بهرمية واضحة).
const LINKS = [
  { key: "stores", href: "#stores", icon: Store },
  { key: "how", href: "#how", icon: HelpCircle },
  { key: "popular", href: "#stores", icon: Flame },
];

// هوية Premium الذهبية (نفس البطاقات)
const GOLD_SOFT = "#ffe486";
const GOLD_DEEP = "#cf9a1e";

/* ===================== مبدّل الثيم (مدمج في الهيدر — حاسوب) ===================== */
function ThemeToggle({ className = "" }) {
  const { theme, toggle } = useTheme();
  const { t } = useTranslation();
  const isDark = theme === "dark";
  return (
    <motion.button
      onClick={toggle}
      whileTap={{ scale: 0.9 }}
      aria-label={isDark ? t("nav.enableLight") : t("nav.enableDark")}
      title={isDark ? t("nav.themeToLight") : t("nav.themeToDark")}
      className={`relative grid h-9 w-9 place-items-center overflow-hidden rounded-xl border border-[var(--color-ink-line)] bg-[var(--fill)] text-[var(--text)] transition-colors hover:bg-[var(--fill-strong)] ${className}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        {isDark ? (
          <motion.span key="sun" initial={{ y: 14, opacity: 0, rotate: -90 }} animate={{ y: 0, opacity: 1, rotate: 0 }} exit={{ y: -14, opacity: 0, rotate: 90 }} transition={{ duration: 0.22 }}>
            <Sun size={17} className="text-[var(--color-lime)]" />
          </motion.span>
        ) : (
          <motion.span key="moon" initial={{ y: 14, opacity: 0, rotate: 90 }} animate={{ y: 0, opacity: 1, rotate: 0 }} exit={{ y: -14, opacity: 0, rotate: -90 }} transition={{ duration: 0.22 }}>
            <Moon size={17} className="text-[var(--accent-text)]" />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

/* ===================== مبدّل الثيم المجزّأ (داخل الميغا مينيو) ===================== */
function ThemeSegment() {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();
  const opts = [
    { key: "light", icon: Sun, label: t("nav.light") },
    { key: "dark", icon: Moon, label: t("nav.dark") },
  ];
  return (
    <div className="flex items-center gap-1 rounded-xl border border-[var(--color-ink-line)] bg-[var(--fill)] p-1">
      {opts.map((o) => {
        const active = theme === o.key;
        const Icon = o.icon;
        return (
          <button
            key={o.key}
            onClick={() => setTheme(o.key)}
            aria-pressed={active}
            className="relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-bold"
          >
            {active && (
              <motion.span
                layoutId="theme-active-seg"
                className="absolute inset-0 rounded-lg bg-[var(--fill-strong)] ring-1 ring-[var(--color-lime)]/30"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <Icon size={14} className={`relative ${active ? "text-[var(--accent-text)]" : "text-[var(--color-mute)]"}`} />
            <span className={`relative ${active ? "text-[var(--text)]" : "text-[var(--color-mute)]"}`}>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ===================== مبدّل اللغة المجزّأ (داخل الميغا مينيو — بلا قائمة منسدلة) ===================== */
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

/** اسم العرض وأول حرف للمستخدم. */
function userDisplay(user, fallback) {
  const name = user?.user_metadata?.full_name || user?.email || fallback;
  const initial = (name || "؟").trim().charAt(0).toUpperCase();
  return { name, initial };
}

/* ===================== حركات الميغا مينيو ===================== */
const panelVariants = {
  hidden: { opacity: 0, height: 0, y: -10 },
  show: {
    opacity: 1,
    height: "auto",
    y: 0,
    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1], staggerChildren: 0.045, delayChildren: 0.06 },
  },
  exit: { opacity: 0, height: 0, y: -10, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, y: 4, transition: { duration: 0.12 } },
};

export default function Navbar({ onPremium }) {
  const [open, setOpen] = useState(false);
  // إخفاء/إظهار الهيدر حسب اتجاه التمرير (مشترك مع شريط التنقّل السفلي ليتزامنا).
  // موبايل فقط — الحاسوب يبقى ظاهراً عبر md:!translate-y-0.
  const { scrolled, hidden } = useScrollDirection();
  const { user, signOut } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  // قفل تمرير الصفحة عند فتح الميغا مينيو (تجربة شبيهة بالتطبيق)
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const logout = async () => {
    await signOut();
    setOpen(false);
    navigate("/");
  };

  const handlePremium = () => {
    setOpen(false);
    if (onPremium) onPremium();
    else navigate(i18n.language && i18n.language !== "ar" ? `/${i18n.language}` : "/");
  };

  const { name, initial } = userDisplay(user, t("nav.account"));

  return (
    <motion.header
      id="top"
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-x-0 top-0 z-50"
    >
      <div
        className={`mx-auto max-w-6xl px-4 pt-3 transition-transform duration-300 will-change-transform sm:pt-4 md:!translate-y-0 ${
          hidden && !open ? "-translate-y-[150%]" : "translate-y-0"
        }`}
      >
        {/* ===== الكبسولة (الهيدر) — لمسة تعريف خفيفة في الأعلى، زجاجية عند النزول ===== */}
        <div
          className={`relative flex items-center justify-between rounded-2xl border px-3.5 py-2.5 transition-all duration-300 sm:px-5 ${
            scrolled
              ? "border-[var(--color-ink-line)] bg-[var(--elev)]/80 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.5)] backdrop-blur-xl"
              : "border-[var(--color-ink-line)]/40 bg-[var(--elev)]/25 shadow-[0_4px_24px_-18px_rgba(0,0,0,0.5)] backdrop-blur-md"
          }`}
        >
          {/* شعرة ضوء ليموني علوية — تعطي شخصية للهيدر حتى في الأعلى */}
          <span
            aria-hidden
            className={`pointer-events-none absolute inset-x-6 top-0 h-px transition-opacity duration-300 ${scrolled ? "opacity-80" : "opacity-40"}`}
            style={{ background: "linear-gradient(90deg, transparent, rgba(166,240,0,0.55), transparent)" }}
          />

          <Logo />

          {/* روابط سطح المكتب */}
          <nav className="hidden items-center gap-1 md:flex">
            {LINKS.map((l) => (
              <a
                key={l.key}
                href={l.href}
                className="rounded-lg px-3.5 py-2 text-[14px] font-medium text-[var(--text-softer)] transition-colors hover:text-[var(--text)]"
              >
                {t(`nav.${l.key}`)}
              </a>
            ))}
          </nav>

          {/* ===== مجموعة الحاسوب: لغة + ثيم + حساب ===== */}
          <div className="hidden items-center gap-2 md:flex">
            <LanguageSwitcher />
            <ThemeToggle />

            {user ? (
              <>
                <Link
                  to="/dashboard"
                  title={t("nav.account")}
                  className="flex items-center gap-2 rounded-xl border border-[var(--color-ink-line)] bg-[var(--fill)] py-1.5 pe-3 ps-1.5 transition-colors hover:bg-[var(--fill-strong)]"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-lg text-[13px] font-black text-[#0a0a0a]" style={{ background: "linear-gradient(150deg, var(--color-lime-soft), var(--color-lime-deep))" }}>
                    {initial}
                  </span>
                  <span className="max-w-[110px] truncate text-[13px] font-bold text-[var(--text)]">{name}</span>
                </Link>
                <button
                  onClick={logout}
                  className="flex items-center gap-1.5 rounded-xl border border-[var(--color-ink-line)] px-3 py-2 text-[13.5px] font-bold text-[var(--text-softer)] transition-colors hover:border-red-500/40 hover:text-red-400"
                >
                  <LogOut size={15} /> {t("nav.logout")}
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[14px] font-semibold text-[var(--text-softer)] transition-colors hover:text-[var(--text)]"
                >
                  <LogIn size={16} /> {t("nav.login")}
                </Link>
                <Link to="/signup">
                  <motion.span
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    className="group relative flex items-center gap-1.5 overflow-hidden rounded-xl px-4 py-2 text-[14px] font-extrabold text-[#0a0a0a]"
                    style={{ background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" }}
                  >
                    <span className="absolute inset-0 -translate-x-full bg-white/30 transition-transform duration-500 group-hover:translate-x-full" />
                    <Sparkles size={15} className="relative" />
                    <span className="relative">{t("nav.signup")}</span>
                  </motion.span>
                </Link>
              </>
            )}
          </div>

          {/* ===== زر القائمة (موبايل فقط) ===== */}
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label={t("nav.menu")}
            aria-expanded={open}
            className="relative grid h-10 w-10 place-items-center rounded-xl border border-[var(--color-ink-line)] bg-[var(--fill)] text-[var(--text)] transition-colors hover:bg-[var(--fill-strong)] md:hidden"
          >
            <AnimatePresence mode="wait" initial={false}>
              {open ? (
                <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
                  <X size={19} />
                </motion.span>
              ) : (
                <motion.span key="menu" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}>
                  <Menu size={19} />
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>

        {/* ===== الميغا مينيو (موبايل) ===== */}
        <AnimatePresence>
          {open && (
            <>
              {/* خلفية تعتيم تُغلق المينيو */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setOpen(false)}
                className="fixed inset-0 top-0 z-[-1] bg-black/50 backdrop-blur-[2px] md:hidden"
              />

              <motion.nav
                variants={panelVariants}
                initial="hidden"
                animate="show"
                exit="exit"
                className="relative mt-2 overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--elev)]/95 backdrop-blur-xl md:hidden"
                style={{ boxShadow: "0 24px 60px -20px rgba(0,0,0,0.6)" }}
              >
                {/* توهّج علوي خفيف */}
                <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-20" style={{ background: "radial-gradient(80% 100% at 50% 0%, rgba(166,240,0,0.08), transparent 70%)" }} />

                <div className="relative flex flex-col p-3">
                  {/* عنوان قسم: تصفّح */}
                  <motion.span variants={itemVariants} className="px-3 pb-1.5 pt-1 text-[11px] font-bold uppercase tracking-wider text-[var(--color-mute)]">
                    {t("nav.browse")}
                  </motion.span>

                  {/* روابط التنقّل */}
                  {LINKS.map((l) => {
                    const Icon = l.icon;
                    return (
                      <motion.a
                        key={l.key}
                        variants={itemVariants}
                        href={l.href}
                        onClick={() => setOpen(false)}
                        whileTap={{ scale: 0.98 }}
                        className="group flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-semibold text-[var(--text)] transition-colors hover:bg-[var(--fill)]"
                      >
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[var(--color-ink-line)] bg-[var(--fill)] text-[var(--accent-text)] transition-colors group-hover:border-[var(--color-lime)]/40">
                          <Icon size={17} />
                        </span>
                        <span className="flex-1">{t(`nav.${l.key}`)}</span>
                        <ChevronLeft size={16} className="text-[var(--color-mute)] opacity-0 transition-all group-hover:opacity-100 ltr:rotate-180" />
                      </motion.a>
                    );
                  })}

                  {/* فاصل */}
                  <motion.div variants={itemVariants} className="my-2.5 h-px bg-[var(--color-ink-line)]" />

                  {/* زر Premium الذهبي البارز — أهم زر */}
                  <motion.button
                    variants={itemVariants}
                    onClick={handlePremium}
                    whileTap={{ scale: 0.98 }}
                    className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border px-3.5 py-3.5 text-start"
                    style={{ borderColor: "rgba(207,154,30,0.5)", background: "linear-gradient(100deg, rgba(240,198,60,0.16), rgba(240,198,60,0.05))" }}
                  >
                    <span className="absolute inset-0 -translate-x-full bg-white/20 transition-transform duration-700 group-hover:translate-x-full" />
                    <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[#0a0a0a]" style={{ background: `linear-gradient(135deg, ${GOLD_SOFT}, ${GOLD_DEEP})`, boxShadow: "0 8px 22px -8px rgba(240,198,60,0.6)" }}>
                      <Crown size={20} />
                    </span>
                    <span className="relative flex-1">
                      <span className="block text-[15px] font-black" style={{ color: GOLD_SOFT }}>{t("nav.premium")}</span>
                      <span className="mt-0.5 block text-[12px] font-medium text-[var(--text-soft)]">{t("nav.premiumSub")}</span>
                    </span>
                    <ChevronLeft size={18} className="relative ltr:rotate-180" style={{ color: GOLD_DEEP }} />
                  </motion.button>

                  {/* أزرار الحساب */}
                  {user ? (
                    <motion.div variants={itemVariants} className="mt-2.5 flex flex-col gap-2">
                      <Link
                        to="/dashboard"
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 rounded-xl border border-[var(--color-ink-line)] bg-[var(--fill)] px-3 py-2.5 transition-colors hover:bg-[var(--fill-strong)]"
                      >
                        <span className="grid h-9 w-9 place-items-center rounded-lg text-[14px] font-black text-[#0a0a0a]" style={{ background: "linear-gradient(150deg, var(--color-lime-soft), var(--color-lime-deep))" }}>
                          {initial}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-bold text-[var(--text)]">{name}</span>
                          <span className="block text-[12px] text-[var(--color-mute)]">{t("nav.account")}</span>
                        </span>
                        <ChevronLeft size={16} className="text-[var(--color-mute)] ltr:rotate-180" />
                      </Link>
                      <button
                        onClick={logout}
                        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--color-ink-line)] px-3 py-2.5 text-[14px] font-bold text-red-400 transition-colors hover:border-red-500/40"
                      >
                        <LogOut size={16} /> {t("nav.logoutLong")}
                      </button>
                    </motion.div>
                  ) : (
                    <motion.div variants={itemVariants} className="mt-2.5 grid grid-cols-2 gap-2">
                      <Link
                        to="/login"
                        onClick={() => setOpen(false)}
                        className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--color-ink-line)] px-3 py-3 text-center text-[14px] font-semibold text-[var(--text)] transition-colors hover:bg-[var(--fill)]"
                      >
                        <LogIn size={16} /> {t("nav.login")}
                      </Link>
                      <Link
                        to="/signup"
                        onClick={() => setOpen(false)}
                        className="group relative flex items-center justify-center gap-1.5 overflow-hidden rounded-xl px-3 py-3 text-center text-[14px] font-extrabold text-[#0a0a0a]"
                        style={{ background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" }}
                      >
                        <span className="absolute inset-0 -translate-x-full bg-white/30 transition-transform duration-500 group-hover:translate-x-full" />
                        <Sparkles size={15} className="relative" />
                        <span className="relative">{t("nav.signup")}</span>
                      </Link>
                    </motion.div>
                  )}

                  {/* فاصل */}
                  <motion.div variants={itemVariants} className="my-2.5 h-px bg-[var(--color-ink-line)]" />

                  {/* صف الإعدادات: اللغة + الثيم */}
                  <motion.div variants={itemVariants}>
                    <span className="px-3 pb-2 block text-[11px] font-bold uppercase tracking-wider text-[var(--color-mute)]">
                      {t("nav.settings")}
                    </span>
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-ink-line)] bg-[var(--fill)] px-3 py-2.5">
                      <span className="text-[13px] font-bold text-[var(--text-softer)]">{t("nav.language")}</span>
                      <LanguageSegment />
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-[var(--color-ink-line)] bg-[var(--fill)] px-3 py-2.5">
                      <span className="text-[13px] font-bold text-[var(--text-softer)]">{t("nav.theme")}</span>
                      <ThemeSegment />
                    </div>
                  </motion.div>
                </div>
              </motion.nav>
            </>
          )}
        </AnimatePresence>
      </div>
    </motion.header>
  );
}
