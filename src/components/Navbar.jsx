import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { LogIn, LogOut, Sparkles, Menu, X, Sun, Moon } from "lucide-react";
import { useTranslation } from "react-i18next";
import Logo from "./Logo.jsx";
import LanguageSwitcher from "./LanguageSwitcher.jsx";
import { useTheme } from "../lib/theme.jsx";
import { useAuth } from "../lib/auth.jsx";

const LINKS = [
  { key: "stores", href: "#stores" },
  { key: "how", href: "#how" },
  { key: "popular", href: "#stores" },
];

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
          <motion.span
            key="sun"
            initial={{ y: 14, opacity: 0, rotate: -90 }}
            animate={{ y: 0, opacity: 1, rotate: 0 }}
            exit={{ y: -14, opacity: 0, rotate: 90 }}
            transition={{ duration: 0.22 }}
          >
            <Sun size={17} className="text-[var(--color-lime)]" />
          </motion.span>
        ) : (
          <motion.span
            key="moon"
            initial={{ y: 14, opacity: 0, rotate: 90 }}
            animate={{ y: 0, opacity: 1, rotate: 0 }}
            exit={{ y: -14, opacity: 0, rotate: -90 }}
            transition={{ duration: 0.22 }}
          >
            <Moon size={17} className="text-[var(--accent-text)]" />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

/** اسم العرض وأول حرف للمستخدم. */
function userDisplay(user, fallback) {
  const name = user?.user_metadata?.full_name || user?.email || fallback;
  const initial = (name || "؟").trim().charAt(0).toUpperCase();
  return { name, initial };
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const logout = async () => {
    await signOut();
    setOpen(false);
    navigate("/");
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
      <div className="mx-auto max-w-6xl px-4 pt-3 sm:pt-4">
        <div
          className={`flex items-center justify-between rounded-2xl border px-3.5 py-2.5 transition-all duration-300 sm:px-5 ${
            scrolled
              ? "border-[var(--color-ink-line)] bg-[var(--elev)]/80 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.35)] backdrop-blur-xl"
              : "border-transparent bg-transparent"
          }`}
        >
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

          {/* أزرار */}
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />

            {user ? (
              <>
                {/* بطاقة الحساب — تفتح الداشبورد */}
                <Link
                  to="/dashboard"
                  title={t("nav.account")}
                  className="hidden items-center gap-2 rounded-xl border border-[var(--color-ink-line)] bg-[var(--fill)] py-1.5 pe-3 ps-1.5 transition-colors hover:bg-[var(--fill-strong)] sm:flex"
                >
                  <span
                    className="grid h-7 w-7 place-items-center rounded-lg text-[13px] font-black text-[#0a0a0a]"
                    style={{ background: "linear-gradient(150deg, var(--color-lime-soft), var(--color-lime-deep))" }}
                  >
                    {initial}
                  </span>
                  <span className="max-w-[110px] truncate text-[13px] font-bold text-[var(--text)]">
                    {name}
                  </span>
                </Link>
                <button
                  onClick={logout}
                  className="hidden items-center gap-1.5 rounded-xl border border-[var(--color-ink-line)] px-3 py-2 text-[13.5px] font-bold text-[var(--text-softer)] transition-colors hover:border-red-500/40 hover:text-red-400 sm:flex"
                >
                  <LogOut size={15} /> {t("nav.logout")}
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="hidden items-center gap-1.5 rounded-xl px-3.5 py-2 text-[14px] font-semibold text-[var(--text-softer)] transition-colors hover:text-[var(--text)] sm:flex"
                >
                  <LogIn size={16} />
                  {t("nav.login")}
                </Link>

                <Link to="/signup">
                  <motion.span
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    className="group relative hidden items-center gap-1.5 overflow-hidden rounded-xl px-4 py-2 text-[14px] font-extrabold text-[#0a0a0a] sm:flex"
                    style={{
                      background:
                        "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))",
                    }}
                  >
                    <span className="absolute inset-0 -translate-x-full bg-white/30 transition-transform duration-500 group-hover:translate-x-full" />
                    <Sparkles size={15} className="relative" />
                    <span className="relative">{t("nav.signup")}</span>
                  </motion.span>
                </Link>
              </>
            )}

            {/* زر القائمة للموبايل */}
            <button
              onClick={() => setOpen((v) => !v)}
              aria-label={t("nav.menu")}
              className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--color-ink-line)] bg-[var(--fill)] text-[var(--text)] md:hidden"
            >
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* قائمة الموبايل */}
        <AnimatePresence>
          {open && (
            <motion.nav
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -8, height: 0 }}
              transition={{ duration: 0.25 }}
              className="mt-2 overflow-hidden rounded-2xl border border-[var(--color-ink-line)] bg-[var(--elev)]/95 p-2 backdrop-blur-xl md:hidden"
            >
              {LINKS.map((l) => (
                <a
                  key={l.key}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-4 py-3 text-[15px] font-medium text-[var(--text-softer)] transition-colors hover:bg-[var(--fill)] hover:text-[var(--text)]"
                >
                  {t(`nav.${l.key}`)}
                </a>
              ))}

              {user ? (
                <div className="mt-1 p-1">
                  <Link
                    to="/dashboard"
                    onClick={() => setOpen(false)}
                    className="mb-2 flex items-center gap-2 rounded-xl border border-[var(--color-ink-line)] bg-[var(--fill)] px-3 py-2.5"
                  >
                    <span
                      className="grid h-8 w-8 place-items-center rounded-lg text-[14px] font-black text-[#0a0a0a]"
                      style={{ background: "linear-gradient(150deg, var(--color-lime-soft), var(--color-lime-deep))" }}
                    >
                      {initial}
                    </span>
                    <span className="truncate text-[14px] font-bold text-[var(--text)]">{name}</span>
                  </Link>
                  <button
                    onClick={logout}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--color-ink-line)] px-3 py-2.5 text-[14px] font-bold text-red-400"
                  >
                    <LogOut size={16} /> {t("nav.logoutLong")}
                  </button>
                </div>
              ) : (
                <div className="mt-1 grid grid-cols-2 gap-2 p-1">
                  <Link
                    to="/login"
                    onClick={() => setOpen(false)}
                    className="rounded-xl border border-[var(--color-ink-line)] px-3 py-2.5 text-center text-[14px] font-semibold text-[var(--text)]"
                  >
                    {t("nav.login")}
                  </Link>
                  <Link
                    to="/signup"
                    onClick={() => setOpen(false)}
                    className="rounded-xl px-3 py-2.5 text-center text-[14px] font-extrabold text-[#0a0a0a]"
                    style={{
                      background:
                        "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))",
                    }}
                  >
                    {t("nav.signup")}
                  </Link>
                </div>
              )}
            </motion.nav>
          )}
        </AnimatePresence>
      </div>
    </motion.header>
  );
}
