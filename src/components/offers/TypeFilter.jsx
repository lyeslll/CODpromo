import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { getTypeMeta } from "../../lib/types.js";
import { TYPE_PARAMS } from "../../lib/offerFilters.js";

// ترتيب الأزرار: الكل ثم الأنواع الثلاثة بألوانها
const ITEMS = [null, "discount", "coupon", "cashback"];

/**
 * فلتر النوع بالألوان الثلاثة (تخفيض أخضر / كوبون أزرق / كاش باك برتقالي).
 * value: قيمة type في الرابط (discount | coupon | cashback) أو null = الكل.
 */
export default function TypeFilter({ value, onChange }) {
  const { t } = useTranslation();
  return (
    <div role="group" aria-label={t("offers.typeLabel")} className="grid grid-cols-4 gap-1.5 sm:flex sm:items-center sm:gap-2">
      {ITEMS.map((key) => {
        const active = value === key;
        const meta = key ? getTypeMeta(TYPE_PARAMS[key]) : null;
        const Icon = meta?.icon;
        return (
          <button
            key={key || "all"}
            type="button"
            onClick={() => onChange(key)}
            aria-pressed={active}
            className="relative rounded-xl border px-1.5 py-2 text-[12px] font-bold transition-colors sm:px-4 sm:text-[13.5px]"
            style={{
              color: active ? "#0a0a0a" : meta ? meta.color : "var(--text-softer)",
              borderColor: active ? "transparent" : meta ? `${meta.color}33` : "var(--color-ink-line)",
              background: active ? "transparent" : meta ? `${meta.color}0a` : "var(--fill)",
            }}
          >
            {active && (
              <motion.span
                layoutId="type-filter-pill"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                className="absolute inset-0 rounded-xl"
                style={{
                  background: meta
                    ? `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)`
                    : "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))",
                  boxShadow: `0 8px 24px -10px ${meta ? meta.glow : "rgba(166,240,0,0.6)"}`,
                }}
              />
            )}
            <span className="relative flex items-center justify-center gap-1 whitespace-nowrap sm:gap-1.5">
              {Icon && <Icon size={13} className="shrink-0" />}
              {t(`filters.${key || "all"}`)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
