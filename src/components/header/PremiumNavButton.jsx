import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Crown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePremium } from "../../lib/premium.jsx";
import { offersLink } from "../../lib/seo.js";

const GOLD_BG = "linear-gradient(135deg, #ffe486, #f0c63c 55%, #cf9a1e)";

/**
 * زر Premium الذهبي في الهيدر (دائماً ظاهر): يفتح نفس نافذة Premium الموجودة.
 * للمشترك (ومول الهدية) يتحوّل إلى شارة ذهبية "عضو Premium" تفتح عروض Premium.
 * compact: نسخة الهاتف الصغيرة. أزرار (لا روابط) حتى لا تمسّها قواعد وضع التطبيق على روابط الهيدر.
 */
export default function PremiumNavButton({ onOpen, compact = false }) {
  const { t, i18n } = useTranslation();
  const { hasPremium, isLifetime } = usePremium();
  // حساب الأدمن: Premium مدى الحياة
  const memberLabel = isLifetime ? t("premium.lifetime") : t("header.member");
  const navigate = useNavigate();
  const size = compact ? "h-9 gap-1 rounded-xl px-2 text-[12.5px] max-[369px]:px-2.5" : "gap-1.5 rounded-xl px-3 py-2 text-[13.5px] xl:px-3.5";
  // الهواتف (< 420px) لا تتّسع للشعار والنص وجرس الإشعارات معاً: التاج وحده ظاهر، والنص يبقى لقارئ الشاشة
  // (زر Premium الكبير في شريط التنقّل السفلي يبقى كيما راه)
  const label = compact ? "relative max-[419px]:sr-only" : "relative";

  if (hasPremium) {
    return (
      <button
        type="button"
        onClick={() => navigate(offersLink(i18n.language, { mode: "premium" }))}
        title={t("hero.ctaMember")}
        aria-label={memberLabel}
        className={`flex shrink-0 items-center whitespace-nowrap border font-extrabold transition-colors hover:bg-[#f0c63c]/15 ${size}`}
        style={{ borderColor: "rgba(240,198,60,0.55)", background: "linear-gradient(120deg, rgba(240,198,60,0.16), rgba(240,198,60,0.05))", color: "#ffe486" }}
      >
        <Crown size={compact ? 14 : 15} />
        {/* الهاتف: مساحة ضيقة → "Premium" بإطار ذهبي يكفي لتمييز العضو */}
        <span className={label}>{compact ? t("premiumToggle.premium") : memberLabel}</span>
      </button>
    );
  }

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.96 }}
      className={`group relative flex shrink-0 items-center overflow-hidden whitespace-nowrap font-extrabold text-[#0a0a0a] ${size}`}
      style={{ background: GOLD_BG, boxShadow: "0 8px 22px -10px rgba(240,198,60,0.75)" }}
    >
      <span aria-hidden className="absolute inset-0 -translate-x-full bg-white/35 transition-transform duration-500 group-hover:translate-x-full" />
      <Crown size={compact ? 14 : 15} className="relative transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110" />
      <span className={label}>{t("premiumToggle.premium")}</span>
    </motion.button>
  );
}
