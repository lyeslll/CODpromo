import { useRef, useState, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useTheme } from "../lib/theme.jsx";

/**
 * شعار CODpromo الرسمي — صورة تتبدّل حسب الثيم:
 *   دارك مود → /logo-dark.png  (نص أبيض)
 *   وايت مود → /logo-light.png (نص أسود)
 *
 * إن كان اللوجو داخل منطقة مثبّتة على الدارك (مثل لوحة /admin المغلّفة بـ .dark)
 * يبقى على اللوجو الداكن دائماً بغضّ النظر عن ثيم الموقع.
 */
export default function Logo({ compact = false }) {
  const { theme } = useTheme();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const ref = useRef(null);
  const [forcedDark, setForcedDark] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current?.closest(".dark");
    // منطقة دارك ثابتة فقط إذا كانت عنصراً غير <html> (وسم الثيم العام)
    setForcedDark(!!el && el !== document.documentElement);
  }, []);

  const effective = forcedDark ? "dark" : theme;
  const src = effective === "light" ? "/logo-light.png" : "/logo-dark.png";

  // الرئيسية بلغة المستخدم الحالية (/ للعربية، /en، /fr) — تنقّل React Router ثم scroll للأعلى.
  const homeHref = i18n.language && i18n.language !== "ar" ? `/${i18n.language}` : "/";
  const goHome = (e) => {
    e.preventDefault();
    navigate(homeHref);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <a ref={ref} href={homeHref} onClick={goHome} className="group flex select-none flex-col items-start gap-1">
      <motion.img
        key={src}
        src={src}
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
