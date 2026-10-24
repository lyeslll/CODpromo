import { AnimatePresence, motion } from "framer-motion";
import { Crown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useScrollVisibility } from "../../lib/scrollVisibility.jsx";
import { formatPrice } from "../../lib/pricing.jsx";
import "./premium-page.css";

/**
 * شريط الشراء العائم: يبان كي يخرج زر الـ Hero من الشاشة وما يكونش زر الشراء الآخر قدّامك.
 * الهاتف: فوق شريط التنقّل السفلي (ينزل مكانه كي يختفي الشريط). الكمبيوتر: كبسولة في الوسط تحت.
 */
export default function StickyBuy({ visible, pricing, onBuy }) {
  const { t, i18n } = useTranslation();
  const { hidden } = useScrollVisibility();
  const price = pricing ? formatPrice(t, i18n.language, pricing.dzd, pricing.usd) : "";

  return (
    <div
      className="pp-sticky pointer-events-none fixed inset-x-0 z-30 flex justify-center px-3 transition-transform duration-300"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)", "--pp-sticky-y": hidden ? "0px" : "-66px" }}
    >
      <AnimatePresence>
        {visible && (
          <motion.div
            key="sticky-buy"
            initial={{ y: 28, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 28, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="pointer-events-auto flex w-full max-w-[460px] items-center gap-3 rounded-2xl border bg-[var(--elev)]/95 p-2 ps-4 shadow-[0_18px_44px_-14px_rgba(0,0,0,0.9)] backdrop-blur-xl"
            style={{ borderColor: "rgba(240,198,60,0.35)" }}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-bold text-[var(--text-soft)]">{t("premiumPage.sticky.label")}</span>
              {price && <bdi className="block truncate text-[15px] font-black text-[#ffe486]">{price}</bdi>}
            </span>
            <button
              type="button"
              onClick={onBuy}
              className="flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-3 text-[14.5px] font-extrabold text-[#1d1403]"
              style={{ background: "linear-gradient(135deg, #ffe486, #f0c63c 55%, #cf9a1e)" }}
            >
              <Crown size={16} /> {t("premiumPage.hero.cta")}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
