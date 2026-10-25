import { Link } from "react-router-dom";
import { Crown, History } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useKeys } from "../../../lib/keysContext.jsx";
import { usePremium } from "../../../lib/premium.jsx";
import { formatPrice } from "../../../lib/pricing.jsx";
import { premiumPath } from "../../../lib/seo.js";
import { formatNumber } from "../../../lib/values.js";
import { DiamondGlyph, DiamondKey } from "../../keys/DiamondKey.jsx";
import { DIA_BG, DIA_DEEP, DIA_INK, DIA_SOFT } from "../../keys/diamond.js";
import { formatMoney } from "../../keys/money.js";
import "../../keys/keys.css";

/**
 * بطاقة المفاتيح الماسية في داشبورد الزبون: الرصيد، شحال من شركة فتحها بيهم، تاريخ مفاتيحو (اللوحة)، الشراء،
 * والنظام العادل (الموقع برك). Premium حقيقي (مدفوع / Stork / أدمن) ما يشوفهاش؛ مول الهدية يشوفها.
 */
export default function KeysCard() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const keys = useKeys();
  const { isPremiumActive } = usePremium();

  // قبل ما توصل الحالة: البلاصة محجوزة (CLS). Premium ما يشوفهاش أصلاً.
  if (keys.status === "loading" && !isPremiumActive) return <div aria-hidden className="h-[118px] animate-pulse rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)]" />;
  if (keys.status !== "ok") return null;
  const credit = keys.showCredit ? keys.credit : null;

  return (
    <div
      className="flex flex-col gap-4 rounded-[var(--radius-card)] border px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
      style={{ borderColor: `${DIA_DEEP}55`, background: "linear-gradient(90deg, rgba(169,205,255,0.11), rgba(169,205,255,0.02))" }}
    >
      <div className="flex min-w-0 items-center gap-4">
        <DiamondKey sparkle flip={i18n.dir() === "ltr"} className="h-auto w-[86px] shrink-0 -rotate-6 drop-shadow-[0_8px_14px_rgba(0,0,0,0.45)]" />
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[16px] font-black text-[var(--text)]">
            {t("keys.dash.title")}
            <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[13px] tabular-nums" style={{ background: "rgba(169,205,255,0.14)", color: DIA_SOFT }}>
              <DiamondGlyph size={13} /> {formatNumber(keys.balance, lang)}
            </span>
            {keys.demo && <span className="rounded-full border border-white/20 px-2 py-0.5 text-[10.5px] font-black text-[var(--text-soft)]">{t("keys.demo")}</span>}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-soft)]">
            {keys.balance > 0 ? t("keys.dash.has", { count: keys.balance }) : t("keys.dash.none")}
            {keys.unlocked.size > 0 && <> · {t("keys.dash.opened", { count: keys.unlocked.size })}</>}
          </p>
          {credit && credit.creditDzd > 0 && (
            <p className="mt-1.5 flex items-start gap-1.5 text-[12.5px] font-bold leading-relaxed text-[#ffe486]">
              <Crown size={13} className="mt-[3px] shrink-0" />
              <span>
                {credit.covered
                  ? t("keys.credit.covered", { paid: formatMoney(t, lang, credit.creditDzd, "DZD") })
                  : t("keys.credit.line", { paid: formatMoney(t, lang, credit.creditDzd, "DZD"), due: formatPrice(t, lang, credit.dueDzd, credit.dueUsd) })}
              </span>
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <button type="button" onClick={keys.openPanel} className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-ink-line)] px-4 py-2.5 text-[13.5px] font-bold text-[var(--text)] transition-colors hover:bg-[var(--fill)]">
          <History size={15} /> {t("keys.dash.history")}
        </button>
        <Link to={`${premiumPath(lang)}#keys`} className="dk-glint inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13.5px] font-extrabold" style={{ background: DIA_BG, color: DIA_INK }}>
          <DiamondGlyph size={15} /> {t("keys.panel.buy")}
        </Link>
      </div>
    </div>
  );
}
