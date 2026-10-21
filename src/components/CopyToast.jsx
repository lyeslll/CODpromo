import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";

/** توست "تم نسخ الكود" المشترك بين صفحات العروض. */
export default function CopyToast({ code }) {
  const { t } = useTranslation();
  return (
    <AnimatePresence>
      {code && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: 30, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2.5 rounded-2xl border border-[var(--color-ink-line)] bg-[var(--elev)]/95 px-4 py-3 shadow-[0_16px_50px_-12px_rgba(0,0,0,0.45)] backdrop-blur-xl"
        >
          <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--color-lime)] text-[#0a0a0a]">
            <Check size={16} strokeWidth={3} />
          </span>
          <span className="text-[14px] font-semibold text-[var(--text)]">
            {t("home.copiedToast")}{" "}
            <span className="font-mono font-extrabold text-[var(--accent-text)]">{code}</span>
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
