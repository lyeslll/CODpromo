import { motion } from "framer-motion";
import { Ticket, Gift } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * تبويبا /offers: "بكود" (تذاكر الكوبون، الافتراضي) و"بلا كود" (بطاقات الهدية).
 * value: "code" | "nocode" (يُكتب في الرابط kind=nocode). counts اختيارية (أعداد حقيقية).
 */
export default function KindTabs({ value, onChange, counts = {} }) {
  const { t } = useTranslation();
  const items = [
    {
      key: "code",
      icon: Ticket,
      label: t("offers.kindCode"),
      bg: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))",
      text: "#0a0a0a",
      count: "rgba(10,10,10,0.6)",
    },
    // نفس بنفسجي زر "احصل على العرض" في بطاقة الهدية، بكتابة بيضاء (≥ 5.47:1)
    { key: "nocode", icon: Gift, label: t("offers.kindNocode"), bg: "linear-gradient(135deg, #7346ee, #5f36d4)", text: "#ffffff", count: "#ffffff" },
  ];
  return (
    <div role="tablist" aria-label={t("offers.kindLabel")} className="grid grid-cols-2 gap-1 rounded-2xl border border-[var(--color-ink-line)] bg-[var(--fill)] p-1 sm:inline-grid">
      {items.map((it) => {
        const active = value === it.key;
        return (
          <button
            key={it.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.key)}
            className="relative z-10 flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-[14px] font-extrabold transition-colors"
            style={{ color: active ? it.text : "var(--text-softer)" }}
          >
            {active && (
              <motion.span
                layoutId="kind-pill"
                className="absolute inset-0 -z-10 rounded-xl"
                style={{ background: it.bg }}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <it.icon size={16} />
            {it.label}
            {counts[it.key] != null && (
              <span className="text-[12px] font-bold tabular-nums" style={{ color: active ? it.count : "var(--color-mute)" }}>
                {counts[it.key]}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
