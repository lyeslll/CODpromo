import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

/**
 * شعار CODpromo الرسمي — الموقع داكن فقط، فنستعمل دائماً نسخة الداكن:
 *   /logo-dark.png (نص أبيض)
 */
const LOGO_SRC = "/logo-dark.png";

export default function Logo({ compact = false }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  // الرئيسية بلغة المستخدم الحالية (/ للعربية، /en، /fr) — تنقّل React Router ثم scroll للأعلى.
  const homeHref = i18n.language && i18n.language !== "ar" ? `/${i18n.language}` : "/";
  const goHome = (e) => {
    e.preventDefault();
    navigate(homeHref);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <a href={homeHref} onClick={goHome} className="group flex select-none flex-col items-start gap-1">
      <motion.img
        src={LOGO_SRC}
        alt="CODpromo"
        whileHover={{ scale: 1.04 }}
        transition={{ type: "spring", stiffness: 320, damping: 18 }}
        className="h-11 w-auto object-contain"
        style={{ maxWidth: 168 }}
      />
      {!compact && (
        <span className="text-[10.5px] font-medium text-[var(--color-mute)]">
          {t("logo.tagline")}
        </span>
      )}
    </a>
  );
}
