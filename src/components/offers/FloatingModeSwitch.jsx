import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import PremiumToggle from "../PremiumToggle.jsx";
import GoldBurst from "../GoldBurst.jsx";
import { useScrollVisibility } from "../../lib/scrollVisibility.jsx";

/**
 * مبدّل عادي/Premium عائم للهاتف فقط: يظهر ما دامت قائمة العروض في الشاشة،
 * ويجلس فوق شريط التنقّل السفلي دون أن يغطّيه (ينزل مكانه حين يختفي الشريط).
 */
export default function FloatingModeSwitch({ visible, value, onChange, burst, showHint }) {
  const { t } = useTranslation();
  const { hidden } = useScrollVisibility();

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-30 flex justify-center transition-transform duration-300 md:hidden"
      style={{
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)",
        transform: hidden ? "translateY(0)" : "translateY(-66px)",
      }}
    >
      <AnimatePresence>
        {visible && (
          <motion.div
            key="float-switch"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="pointer-events-auto flex flex-col items-center gap-1.5"
          >
            {showHint && (
              <span className="rounded-full bg-[var(--elev)]/90 px-3 py-1 text-[11px] font-bold text-[var(--text-softer)] backdrop-blur">
                {t("offers.swipeHint")}
              </span>
            )}
            <div className="relative rounded-2xl bg-[var(--elev)]/95 shadow-[0_14px_40px_-12px_rgba(0,0,0,0.85)] backdrop-blur-xl">
              <PremiumToggle value={value} onChange={onChange} layoutId="prem-pill-float" />
              <GoldBurst fire={burst} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
