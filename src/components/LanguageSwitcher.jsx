import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocale } from "../lib/locale.jsx";

// اللغات الثلاث: الاسم بلغته + رمز دولة العلم (flag-icons) — أعلام SVG حقيقية لا emoji.
const LANGS = [
  { code: "ar", label: "العربية", flag: "dz" },
  { code: "en", label: "English", flag: "gb" },
  { code: "fr", label: "Français", flag: "fr" },
];

/** علم دائري حقيقي (SVG عبر flag-icons) — يظهر على كل الأنظمة بما فيها Windows. */
function Flag({ code, size = 18 }) {
  return (
    <span
      className={`fi fi-${code}`}
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        backgroundSize: "cover",
        backgroundPosition: "center",
        boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.12)",
        flexShrink: 0,
      }}
    />
  );
}

/** زر اللغة الأنيق — علم اللغة الحالية + قائمة منسدلة بالخيارات الثلاثة. */
export default function LanguageSwitcher({ className = "" }) {
  const { t } = useTranslation();
  const { lang, setLang } = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // إغلاق القائمة عند الضغط خارجها أو زر Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = LANGS.find((l) => l.code === lang) || LANGS[0];

  const pick = (code) => {
    setLang(code);
    setOpen(false);
  };

  return (
    <div ref={ref} className={`relative ${className}`}>
      <motion.button
        onClick={() => setOpen((v) => !v)}
        whileTap={{ scale: 0.9 }}
        aria-label={t("lang.switch")}
        aria-haspopup="menu"
        aria-expanded={open}
        title={t("lang.switch")}
        className="relative flex h-9 items-center gap-1.5 rounded-xl border border-[var(--color-ink-line)] bg-[var(--fill)] px-2 text-[var(--text)] transition-colors hover:bg-[var(--fill-strong)]"
      >
        <Flag code={current.flag} size={18} />
        <ChevronDown size={13} className="text-[var(--color-mute)]" />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.16 }}
            className="absolute end-0 top-full z-[120] mt-2 min-w-[170px] overflow-hidden rounded-2xl border border-[var(--color-ink-line)] bg-[var(--elev)]/95 p-1.5 shadow-[0_16px_50px_-12px_rgba(0,0,0,0.45)] backdrop-blur-xl"
          >
            {LANGS.map((l) => {
              const active = l.code === current.code;
              return (
                <button
                  key={l.code}
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => pick(l.code)}
                  dir={l.code === "ar" ? "rtl" : "ltr"}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[14px] font-bold transition-colors hover:bg-[var(--fill)]"
                  style={{ color: active ? "var(--accent-text)" : "var(--text-softer)" }}
                >
                  <Flag code={l.flag} size={20} />
                  <span className="flex-1 text-start">{l.label}</span>
                  {active && <Check size={15} className="shrink-0 text-[var(--color-lime)]" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
