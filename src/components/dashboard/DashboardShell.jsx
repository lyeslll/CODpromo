import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Sun, Moon, LogOut, Home } from "lucide-react";
import { useTranslation } from "react-i18next";
import Logo from "../Logo.jsx";
import LanguageSwitcher from "../LanguageSwitcher.jsx";
import { useTheme } from "../../lib/theme.jsx";
import { useAuth } from "../../lib/auth.jsx";

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const { t } = useTranslation();
  const isDark = theme === "dark";
  return (
    <button
      onClick={toggle}
      aria-label={t("dashboard.toggleTheme")}
      className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--color-ink-line)] bg-[var(--fill)] text-[var(--text)] transition-colors hover:bg-[var(--fill-strong)]"
    >
      {isDark ? <Sun size={17} className="text-[var(--color-lime)]" /> : <Moon size={17} className="text-[var(--accent-text)]" />}
    </button>
  );
}

/** إطار موحّد لصفحات الداشبورد (شريط علوي + حاوية محتوى) بنفس الهوية. */
export default function DashboardShell({ badge, children }) {
  const { user, signOut } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const name = user?.user_metadata?.full_name || user?.email || t("nav.account");
  const initial = (name || "؟").trim().charAt(0).toUpperCase();

  const logout = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-[var(--color-ink)] text-[var(--text)]">
      <header className="sticky top-0 z-40 border-b border-[var(--color-ink-line)] bg-[var(--elev)]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Logo compact />
            </Link>
            {badge && (
              <span className="hidden rounded-lg border border-[var(--color-ink-line)] bg-[var(--fill)] px-2.5 py-1 text-[12px] font-bold text-[var(--accent-text)] sm:inline">
                {badge}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
            <Link
              to="/"
              className="hidden items-center gap-1.5 rounded-xl border border-[var(--color-ink-line)] px-3 py-2 text-[13.5px] font-bold text-[var(--text)] transition-colors hover:bg-[var(--fill)] sm:flex"
            >
              <Home size={15} /> {t("dashboard.site")}
            </Link>
            <span
              className="grid h-9 w-9 place-items-center rounded-xl text-[14px] font-black text-[#0a0a0a]"
              style={{ background: "linear-gradient(150deg, var(--color-lime-soft), var(--color-lime-deep))" }}
              title={name}
            >
              {initial}
            </span>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 rounded-xl border border-[var(--color-ink-line)] px-3 py-2 text-[13.5px] font-bold text-[var(--text-softer)] transition-colors hover:border-red-500/40 hover:text-red-400"
            >
              <LogOut size={15} /> <span className="hidden sm:inline">{t("dashboard.logout")}</span>
            </button>
          </div>
        </div>
      </header>

      <motion.main
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mx-auto max-w-5xl px-4 py-7"
      >
        {children}
      </motion.main>
    </div>
  );
}

/** بطاقة ترحيب مشتركة. */
export function WelcomeCard({ title, subtitle, children }) {
  return (
    <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] p-6">
      <div
        className="pointer-events-none absolute -left-10 -top-16 h-40 w-40 rounded-full blur-[70px]"
        style={{ background: "radial-gradient(circle, rgba(166,240,0,0.18), transparent 65%)" }}
      />
      <div className="relative">
        <h1 className="text-[24px] font-black tracking-tight sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1.5 text-[14px] text-[var(--text-soft)]">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}

/** عنوان قسم داخل الداشبورد. */
export function SectionTitle({ icon: Icon, children, action }) {
  return (
    <div className="mb-4 mt-9 flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-[19px] font-extrabold text-[var(--text)]">
        {Icon && <Icon size={20} className="text-[var(--color-lime)]" />}
        {children}
      </h2>
      {action}
    </div>
  );
}
