import { useMemo } from "react";
import { Crown, ExternalLink, Hourglass, Stamp } from "lucide-react";
import { useTranslation } from "react-i18next";
import BidiText from "../BidiText.jsx";
import ShareButtons from "../seo/ShareButtons.jsx";
import { canUseFx } from "../../lib/fxCapability.js";
import ComingSoonNotify from "./ComingSoonNotify.jsx";
import { SOON, SOON_SOFT } from "./tone.js";
import "./coming-soon.css";

/**
 * التذكرة الكبيرة في صفحة الشركة كي يكون العرض "قريباً" (phase coming-soon): "قريباً" + "ترقّبوا" بلاصة القيمة،
 * ختم الشمع فوق الخط المثقّب، "أعلمني عند التفعيل" + العدّاد بلاصة الكود والنسخ، سطر "سجّل من رابطنا دروك"
 * (رابط الإحالة يخدم من دروك)، و"Premium قريباً" إذا كاين. نفس أبعاد التذكرة العادية تقريباً.
 */
export default function ComingSoonHero({ company, lang, canonical, shareTitle }) {
  const { t } = useTranslation();
  const fx = useMemo(() => canUseFx(), []);
  const rtl = lang === "ar";

  return (
    <div data-soon-anchor="" className={`ticket ticket-soon relative ${fx ? "soon-fx" : ""}`}>
      <div className="ticket-top relative px-5 pb-6 pt-5 sm:px-6">
        <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(120% 80% at 50% 0%, ${SOON}1f, transparent 64%)` }} />
        <span aria-hidden className="ticket-ring ticket-ring-l" />
        <span aria-hidden className="ticket-ring ticket-ring-r" />
        <div className="relative flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="store-value text-[52px] sm:text-[60px]">
              <span className="soon-shine">{t("comingSoon.value")}</span>
            </div>
            <p className="mt-2 text-[14px] font-bold text-[var(--text-softer)]">
              <BidiText text={t("comingSoon.heroLine", { name: company.name })} rtl={rtl} />
            </p>
          </div>
          <Hourglass size={34} strokeWidth={1.6} className="mb-1 shrink-0 opacity-70" style={{ color: SOON }} aria-hidden />
        </div>
      </div>

      <div aria-hidden className="relative h-0">
        <span className="soon-seal soon-seal-lg" title={t("comingSoon.sealed")}>
          <Stamp size={21} strokeWidth={2.2} />
        </span>
      </div>

      <div className="ticket-stub relative px-5 pb-5 pt-8 sm:px-6">
        <span aria-hidden className="ticket-ring ticket-ring-l" />
        <span aria-hidden className="ticket-ring ticket-ring-r" />
        <span aria-hidden className="ticket-perf" />

        <div className="soon-code mb-3.5 flex min-h-[48px] items-center justify-between gap-3 rounded-xl px-3.5 py-2">
          <span className="shrink-0 text-[11px] font-bold text-[var(--color-mute)]">{t("storePage.codeLabel")}</span>
          <span className="truncate text-[15px] font-extrabold" style={{ color: SOON }}>
            {t("comingSoon.codeSoon")}
          </span>
        </div>

        <ComingSoonNotify companyId={company.id} size="hero" />

        {company.link && (
          <p className="mt-3 text-[12.5px] font-semibold leading-relaxed text-[var(--text-soft)]">
            <BidiText text={t("comingSoon.joinNow", { name: company.name })} rtl={rtl} />
          </p>
        )}

        {company.premium_coming_soon && (
          <p className="mt-3 flex items-center gap-2 rounded-xl border border-[#f0c63c]/25 bg-[#f0c63c]/[0.06] px-3 py-2.5 text-[13px] font-extrabold" style={{ color: SOON_SOFT }}>
            <Crown size={15} className="shrink-0 text-[#f0c63c]" />
            <BidiText text={t("comingSoon.premiumSoon")} rtl={rtl} />
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2.5 lg:hidden">
          {company.link && <SoonVisit href={company.link} label={t("storePage.visit")} />}
          <ShareButtons url={canonical} title={shareTitle} />
        </div>
      </div>
    </div>
  );
}

export function SoonVisit({ href, label }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--color-ink-line)] bg-[var(--fill)] px-4 text-[14px] font-extrabold text-[var(--text)] transition-colors hover:border-[#ff7eb3]/60"
    >
      <ExternalLink size={16} style={{ color: SOON }} /> {label}
    </a>
  );
}
