import { motion } from "framer-motion";
import { Crown } from "lucide-react";

/** مبدّل العرض: عادي ↔ Premium مع حركة pill سلسة. */
export default function PremiumToggle({ value, onChange }) {
  const items = [
    { key: "normal", label: "عادي" },
    { key: "premium", label: "Premium", icon: Crown },
  ];
  return (
    <div className="relative inline-flex items-center gap-1 rounded-2xl border border-[var(--color-ink-line)] bg-[var(--fill)] p-1">
      {items.map((it) => {
        const active = value === it.key;
        const gold = it.key === "premium";
        return (
          <button
            key={it.key}
            onClick={() => onChange(it.key)}
            className="relative z-10 flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13.5px] font-extrabold transition-colors"
            style={{ color: active ? "#0a0a0a" : "var(--text-softer)" }}
          >
            {active && (
              <motion.span
                layoutId="prem-pill"
                className="absolute inset-0 -z-10 rounded-xl"
                style={{
                  background: gold
                    ? "linear-gradient(135deg, #ffe486, #cf9a1e)"
                    : "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))",
                  boxShadow: gold ? "0 6px 20px -8px rgba(240,198,60,0.5)" : "none",
                }}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            {it.icon && <it.icon size={14} />}
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
