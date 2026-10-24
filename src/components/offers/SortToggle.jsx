import { motion } from "framer-motion";
import { Clock, TrendingUp, Flame } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * مبدّل الترتيب: الأحدث (الافتراضي) / الأعلى نسبة نجاح / الأكثر استخداماً
 * (ترتيب حسب نسخ الأكواد الحقيقية في code_copies — RPC offers_usage_rank).
 * نفس هوية مبدّل Premium (segmented) — نفس الحاوية والأزرار والـ pill المنزلق.
 */
export default function SortToggle({ value, onChange }) {
  const { t } = useTranslation();
  const items = [
    { key: "newest", icon: Clock, label: t("vote.sortNewest") },
    { key: "success", icon: TrendingUp, label: t("vote.sortSuccess") },
    { key: "usage", icon: Flame, label: t("vote.sortUsage") },
  ];
  return (
    <div className="no-scrollbar relative inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-2xl border border-[var(--color-ink-line)] bg-[var(--fill)] p-1">
      {items.map((it) => {
        const active = value === it.key;
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onChange(it.key)}
            aria-pressed={active}
            className="relative z-10 flex min-h-[40px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 py-2 text-[12.5px] font-extrabold transition-colors sm:min-h-0 sm:px-4 sm:text-[13.5px]"
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
            <it.icon size={14} className="hidden sm:block" />
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
