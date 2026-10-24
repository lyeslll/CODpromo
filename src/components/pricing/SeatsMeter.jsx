import { useTranslation } from "react-i18next";
import { formatNumber } from "../../lib/values.js";

// ============================================================
//  عدّاد مقاعد الإطلاق (حقيقي، من pricing_public): "تبقّى X مقعداً بسعر الإطلاق"
//  + شريط ثقوب كيما خط التثقيب في تذاكر الكوبون: الثقوب المليانة = المقاعد الباقية.
//  يختفي بعد الإطلاق (السعر العادي برك). ثابت بلا حركة.
// ============================================================
const HOLES = 20;

export default function SeatsMeter({ pricing, tone = "gold", className = "" }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  if (!pricing?.isLaunch || !pricing.seatsTotal) return null;
  const left = Math.max(0, pricing.seatsLeft);
  const total = pricing.seatsTotal;
  const lit = Math.min(HOLES, Math.max(left > 0 ? 1 : 0, Math.ceil((left / total) * HOLES)));
  const ink = tone === "ink";
  const on = ink ? "#1d1403" : "#f0c63c";
  const off = ink ? "rgba(29,20,3,0.35)" : "rgba(240,198,60,0.32)";

  return (
    <div
      className={className}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={left}
      aria-label={t("pricing.seatsAria", { left: formatNumber(left, lang), total: formatNumber(total, lang) })}
    >
      <p className="text-[13px] font-extrabold" style={{ color: ink ? "#1d1403" : "var(--text)" }}>
        {t("pricing.seatsLeft", { count: left, n: formatNumber(left, lang) })}
      </p>
      <div aria-hidden className="mt-2 flex items-center justify-between gap-[3px]">
        {Array.from({ length: HOLES }, (_, i) => (
          <span
            key={i}
            className="aspect-square min-w-0 flex-1 rounded-full"
            style={
              i < lit
                ? { background: on, maxWidth: 9 }
                : { boxShadow: `inset 0 0 0 1.5px ${off}`, maxWidth: 9 }
            }
          />
        ))}
      </div>
    </div>
  );
}
