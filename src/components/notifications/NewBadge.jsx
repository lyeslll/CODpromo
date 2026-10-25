import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { isRecent } from "../../lib/notifications.js";

/**
 * شارة "جديد": شركة / عرض تزاد في آخر 7 أيام (created_at من القاعدة — بلا أي رقم في الكود).
 * ليموني (هوية الموقع، ماشي لون نوع). size="sm": صغيرة في سطر الفئة تحت اسم الشركة.
 */
export default function NewBadge({ date, size = "md", className = "" }) {
  const { t } = useTranslation();
  if (!isRecent(date)) return null;
  const sm = size === "sm";
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--color-lime)]/12 font-extrabold leading-none text-[var(--accent-text)] ring-1 ring-[var(--color-lime)]/30 ${
        sm ? "px-1.5 py-[3px] text-[10px]" : "px-2 py-1 text-[10.5px]"
      } ${className}`}
    >
      <Sparkles size={sm ? 10 : 11} aria-hidden /> {t("notify.badge.new")}
    </span>
  );
}
