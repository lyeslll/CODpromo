import { Crown, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getTypeMeta, getTypeKey } from "../../lib/types.js";
import CompanyLogo from "../CompanyLogo.jsx";

const GOLD = "#f0c63c";
const GOLD_SOFT = "#ffe486";
const GOLD_DEEP = "#cf9a1e";

/**
 * كوبون مصغّر للعرض فقط (بلا أزرار): نفس شكل التذكرة (قصّ + خط مثقّب).
 * premium=true → ذهبي بالكامل، والكود مخفي دائماً (لا يُكشف كود Premium هنا).
 */
export default function MiniCoupon({ company, premium = false, className = "" }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const meta = getTypeMeta(company.type);
  const accent = premium ? GOLD : meta.color;
  const loc = (field) => (lang !== "ar" && company[`${field}_${lang}`]) || company[field] || "";
  const value = premium ? loc("premium_discount") || loc("discount") : loc("discount");
  const Icon = meta.icon;

  return (
    <div
      className={`ticket relative flex flex-col ${premium ? "ticket-premium" : ""} ${className}`}
      style={{ "--edge-base": `${accent}59`, "--edge-strong": `${accent}b3`, "--perf": `${accent}80`, "--stub": `${accent}0f` }}
    >
      <div className="ticket-top relative bg-[var(--color-ink-card)] p-5 pb-4">
        {premium && (
          <span className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(120% 80% at 50% 0%, ${GOLD}2e, transparent 62%)` }} />
        )}
        <span aria-hidden className="ticket-ring ticket-ring-l" />
        <span aria-hidden className="ticket-ring ticket-ring-r" />
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <CompanyLogo logo={company.logo} name={company.name} size={44} />
            <span className="truncate text-[15px] font-extrabold text-[var(--text)]">{company.name}</span>
          </div>
          {premium ? (
            <span
              className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black text-[#0a0a0a]"
              style={{ background: `linear-gradient(135deg, ${GOLD_SOFT}, ${GOLD_DEEP})` }}
            >
              <Crown size={11} /> {t("card.premiumBadge")}
            </span>
          ) : (
            <span className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: `${accent}1a`, color: accent }}>
              <Icon size={12} /> {t(`types.${getTypeKey(company.type)}`)}
            </span>
          )}
        </div>
        <div className="relative mt-5 text-[11.5px] font-semibold text-[var(--color-mute)]">
          {premium ? t("card.premiumDiscount") : t("card.offerValue")}
        </div>
        <div className="relative text-[40px] font-black leading-none" style={{ color: accent, textShadow: `0 0 26px ${accent}66` }}>
          {value}
        </div>
      </div>
      <div className="ticket-stub relative bg-[var(--color-ink-card)] px-5 pb-5 pt-4">
        <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "var(--stub)" }} />
        <span aria-hidden className="ticket-ring ticket-ring-l" />
        <span aria-hidden className="ticket-ring ticket-ring-r" />
        <span aria-hidden className="ticket-perf" />
        <div
          className="relative flex items-center justify-between rounded-xl border border-dashed px-3.5 py-2.5"
          style={{ borderColor: `${accent}55`, background: `${accent}0d` }}
        >
          <span className="text-[10.5px] font-semibold text-[var(--color-mute)]">{premium ? t("card.premiumCode") : t("card.code")}</span>
          {premium ? (
            <span className="flex items-center gap-1.5 text-[var(--text)]">
              <span dir="ltr" className="font-mono text-[15px] font-extrabold tracking-widest">••••••</span>
              <Lock size={14} style={{ color: accent }} />
            </span>
          ) : (
            <span dir="ltr" className="font-mono text-[15px] font-extrabold tracking-widest text-[var(--text)]">
              {company.code}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
