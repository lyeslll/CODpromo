import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon, Loader2 } from "lucide-react";
import Logo from "../Logo.jsx";
import { useTheme } from "../../lib/theme.jsx";

// نمط حقول الإدخال المشترك في صفحات الحساب
export const authInputCls =
  "w-full rounded-xl border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] px-3.5 py-3 text-[14.5px] font-medium text-[var(--text)] outline-none transition-colors placeholder:text-[var(--color-mute)] focus:border-[var(--color-lime)]";

/** زر "متابعة عبر Google" بشعار Google الرسمي. */
export function GoogleButton({ onClick, loading, label = "المتابعة عبر Google" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-[var(--color-ink-line)] bg-[var(--fill)] px-4 py-3 text-[14.5px] font-bold text-[var(--text)] transition-colors hover:bg-[var(--fill-strong)] disabled:opacity-60"
    >
      {loading ? (
        <Loader2 size={18} className="animate-spin" />
      ) : (
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z" />
          <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
          <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
          <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
        </svg>
      )}
      {label}
    </button>
  );
}

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      onClick={toggle}
      aria-label="تبديل الوضع"
      className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--color-ink-line)] bg-[var(--fill)] text-[var(--text)] transition-colors hover:bg-[var(--fill-strong)]"
    >
      {isDark ? (
        <Sun size={18} className="text-[var(--color-lime)]" />
      ) : (
        <Moon size={18} className="text-[var(--accent-text)]" />
      )}
    </button>
  );
}

/** إطار موحّد لصفحات الحساب (دخول/تسجيل/استعادة) بنفس الهوية البصرية. */
export default function AuthShell({ title, subtitle, children, footer }) {
  // الحاوية الرئيسية: عرض كامل، لا تتجاوز عرض الشاشة، متمركزة، وتقصّ أي تجاوز أفقي — لمنع انحراف الصفحة على الهاتف
  return (
    <div
      className="relative mx-auto grid min-h-screen w-full place-items-center overflow-x-hidden bg-[var(--color-ink)] px-4 py-10 text-[var(--text)]"
      style={{ maxWidth: "100vw" }}
    >
      {/* خلفية متوهّجة — مقيّدة بعرض الشاشة حتى لا تسبب تجاوزاً أفقياً */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/4 h-[420px] w-[640px] max-w-[100vw] -translate-x-1/2 rounded-full blur-[120px]"
        style={{ background: "radial-gradient(circle, rgba(166,240,0,0.14), transparent 65%)" }}
      />
      <div className="pointer-events-none absolute inset-0 bg-grid" />

      {/* زر الثيم + رجوع */}
      <div className="absolute inset-x-0 top-0 z-10 mx-auto flex max-w-md items-center justify-between px-4 pt-5">
        <Link
          to="/"
          className="text-[13px] font-semibold text-[var(--color-mute)] transition-colors hover:text-[var(--text)]"
        >
          ← العودة للموقع
        </Link>
        <ThemeToggle />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 22, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full min-w-0 max-w-md overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] p-5 shadow-[0_24px_70px_-30px_rgba(0,0,0,0.55)] sm:p-7"
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo compact />
          <h1 className="mt-5 text-[24px] font-black tracking-tight">{title}</h1>
          {subtitle && (
            <p className="mt-1.5 text-[14px] text-[var(--color-mute)]">{subtitle}</p>
          )}
        </div>

        {children}

        {footer && (
          <div className="mt-6 border-t border-[var(--color-ink-line)] pt-5 text-center text-[13.5px] text-[var(--color-mute)]">
            {footer}
          </div>
        )}
      </motion.div>
    </div>
  );
}

/** تنبيه ملوّن (خطأ/نجاح) داخل صفحات الحساب. */
export function AuthAlert({ type = "error", children }) {
  const error = type === "error";
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-[13px] font-semibold"
        style={{
          borderColor: error ? "rgba(239,68,68,0.3)" : "rgba(166,240,0,0.35)",
          background: error ? "rgba(239,68,68,0.08)" : "rgba(166,240,0,0.08)",
          color: error ? "#f87171" : "var(--accent-text)",
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
