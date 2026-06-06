import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LogIn, Sparkles, Menu, X, Sun, Moon } from "lucide-react";
import Logo from "./Logo.jsx";
import { useTheme } from "../lib/theme.jsx";

const LINKS = [
  { label: "المتاجر", href: "#stores" },
  { label: "كيف يعمل", href: "#how" },
  { label: "الأكثر استخداماً", href: "#stores" },
];

function ThemeToggle({ className = "" }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  return (
    <motion.button
      onClick={toggle}
      whileTap={{ scale: 0.9 }}
      aria-label={isDark ? "تفعيل الوضع الفاتح" : "تفعيل الوضع الداكن"}
      title={isDark ? "الوضع الفاتح" : "الوضع الداكن"}
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

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
                key={l.label}
                href={l.href}
                className="rounded-lg px-3.5 py-2 text-[14px] font-medium text-[var(--text-softer)] transition-colors hover:text-[var(--text)]"
              >
                {l.label}
              </a>
            ))}
          </nav>

          {/* أزرار */}
          <div className="flex items-center gap-2">
            <ThemeToggle />

            <button className="hidden items-center gap-1.5 rounded-xl px-3.5 py-2 text-[14px] font-semibold text-[var(--text-softer)] transition-colors hover:text-[var(--text)] sm:flex">
              <LogIn size={16} />
              دخول
            </button>

            <motion.button
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
              <span className="relative">اشترك مجاناً</span>
            </motion.button>

            {/* زر القائمة للموبايل */}
            <button
              onClick={() => setOpen((v) => !v)}
              aria-label="القائمة"
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
                  key={l.label}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-4 py-3 text-[15px] font-medium text-[var(--text-softer)] transition-colors hover:bg-[var(--fill)] hover:text-[var(--text)]"
                >
                  {l.label}
                </a>
              ))}
              <div className="mt-1 grid grid-cols-2 gap-2 p-1">
                <button className="rounded-xl border border-[var(--color-ink-line)] px-3 py-2.5 text-[14px] font-semibold text-[var(--text)]">
                  دخول
                </button>
                <button
                  className="rounded-xl px-3 py-2.5 text-[14px] font-extrabold text-[#0a0a0a]"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))",
                  }}
                >
                  اشترك مجاناً
                </button>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </div>
    </motion.header>
  );
}
