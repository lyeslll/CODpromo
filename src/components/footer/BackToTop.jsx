import { useEffect, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll } from "framer-motion";
import { ArrowUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useScrollVisibility } from "../../lib/scrollVisibility.jsx";

function useWide() {
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const on = () => setWide(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return wide;
}

/** الدائرة: حلقة خافتة + حلقة ليمونية بطول تقدّم القراءة (scrollYProgress — بلا re-render). */
function Ring({ progress }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className="absolute inset-0 h-full w-full -rotate-90">
      <circle cx="24" cy="24" r="22" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
      <motion.circle cx="24" cy="24" r="22" fill="none" stroke="var(--color-lime)" strokeWidth="2.5" strokeLinecap="round" style={{ pathLength: progress }} />
    </svg>
  );
}

const btnCls =
  "group grid place-items-center rounded-full border border-[var(--color-ink-line)] bg-[var(--elev)]/90 text-[var(--text-softer)] shadow-[0_12px_30px_-12px_rgba(0,0,0,0.9)] backdrop-blur-md transition-colors hover:text-[var(--accent-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-lime)]/60";

/**
 * زر "الرجوع للأعلى" بدائرة تُظهر تقدّم القراءة.
 * عائم: يظهر بعد النزول أكثر من شاشة. على الهاتف يختفي حين يظهر الفوتر (حتى لا يغطّي روابطه)،
 * وتحلّ محلّه نسخة inline في السطر الأخير من الفوتر.
 * على الهاتف: أصغر (40px) ويتبع شريط التنقّل السفلي كيما المبدّل العائم (فوقه كي يبان، ينزل كي يختفي)
 * — هكذا ما يطلعش فوق المبدّل، وأي بطاقة جالسة فوق المبدّل تبان كاملة (حتى سطر "آخر نجاح").
 */
export default function BackToTop({ inline = false, footerVisible = false }) {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const wide = useWide();
  const { hidden } = useScrollVisibility();
  const { scrollY, scrollYProgress } = useScroll();
  const [past, setPast] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setPast(y > window.innerHeight * 1.2));
  const toTop = () => window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });

  if (inline) {
    return (
      <button type="button" onClick={toTop} aria-label={t("footer.backToTop")} className={`relative h-12 w-12 md:hidden ${btnCls}`}>
        <Ring progress={scrollYProgress} />
        <ArrowUp size={18} className="relative transition-transform duration-300 group-hover:-translate-y-0.5" />
      </button>
    );
  }

  const show = past && (wide || !footerVisible);
  return (
    <div
      className={`pointer-events-none fixed bottom-[calc(14px+env(safe-area-inset-bottom))] end-4 z-30 transition-transform duration-300 md:bottom-7 md:end-7 ${
        hidden ? "" : "max-md:-translate-y-[66px]"
      }`}
    >
      <AnimatePresence>
        {show && (
          <motion.button
            type="button"
            onClick={toTop}
            aria-label={t("footer.backToTop")}
            title={t("footer.backToTop")}
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.25 }}
            className={`pointer-events-auto relative h-10 w-10 md:h-12 md:w-12 ${btnCls}`}
          >
            <Ring progress={scrollYProgress} />
            <ArrowUp size={18} className="relative transition-transform duration-300 group-hover:-translate-y-0.5" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
