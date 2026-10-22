import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import PremiumToggle from "./PremiumToggle.jsx";

/**
 * مبدّل عادي/Premium عائم للكمبيوتر (md+): كبسولة زجاجية في وسط أسفل الشاشة، نفس مبدّل الأصل.
 * visible من useFloatingSwitch (lib/modeWave.jsx): يبان كي يخرج المبدّل الأصلي من الشاشة،
 * ويختفي كي يرجع — مبدّل واحد ظاهر. نفس الحالة ونفس onChange تاع الأصل.
 * بعيد على زر الرجوع للأعلى (في الركن). الهاتف عندو مبدّلو العائم الخاص في /offers.
 */
export default function DesktopModeSwitch({ visible, value, onChange, layoutId }) {
  const { t } = useTranslation();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-30 hidden justify-center md:flex">
      <AnimatePresence>
        {visible && (
          <motion.div
            key="desk-switch"
            role="group"
            aria-label={t("premiumToggle.floating")}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="pointer-events-auto rounded-2xl border border-[var(--color-ink-line)] bg-[var(--elev)]/75 p-1 shadow-[0_18px_44px_-14px_rgba(0,0,0,0.9)] backdrop-blur-xl backdrop-saturate-150"
          >
            <PremiumToggle value={value} onChange={onChange} layoutId={layoutId} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
