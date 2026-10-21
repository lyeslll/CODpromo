import { motion } from "framer-motion";
import { Clock, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * مبدّل الترتيب: الأحدث (الافتراضي) / الأعلى نسبة نجاح.
 * نفس هوية مبدّل Premium (segmented) — نفس الحاوية والأزرار والـ pill المنزلق.
 */
export default function SortToggle({ value, onChange }) {
  const { t } = useTranslation();
  const items = [
    { key: "newest", icon: Clock, label: t("vote.sortNewest") },
    { key: "success", icon: TrendingUp, label: t("vote.sortSuccess") },
  ];
  return (
    <div className="relative inline-flex items-center gap-1 rounded-2xl border border-[var(--color-ink-line)] bg-[var(--fill)] p-1">
      {items.map((it) => {
        const active = value === it.key;
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onChange(it.key)}
            aria-pressed={active}
            className="relative z-10 flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13.5px] font-extrabold transition-colors"
            style={{ color: active ? "#0a0a0a" : "var(--text-softer)" }}
          >
            {active && (
              <motion.span
                layoutId="sort-pill"
                className="absolute inset-0 -z-10 rounded-xl"
                style={{ background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" }}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <it.icon size={14} />
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
