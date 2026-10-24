import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Copy, Crown, ExternalLink, ShieldCheck, Star, ChevronLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import CompanyLogo from "../CompanyLogo.jsx";
import BidiText from "../BidiText.jsx";
import ShareButtons from "../seo/ShareButtons.jsx";
import { formatDay, locText, RATING_MIN_AVG } from "../../lib/storeContent.js";
import { relativeTime } from "../../lib/votes.js";

/** ألوان التذكرة من لون النوع (بلا color-mix: نفس الطريقة hex + شفافية في كل الموقع). */
export function accentVars(hex) {
  const n = parseInt(String(hex).replace("#", ""), 16);
  const mix = (c) => Math.round(c + (255 - c) * 0.3);
  const hi = `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => mix(c).toString(16).padStart(2, "0")).join("")}`;
  return {
    "--sa": hex,
    "--sa-hi": hi,
    "--sa-soft": `${hex}22`,
    "--sa-faint": `${hex}0f`,
    "--sa-line": `${hex}8c`,
    "--sa-glow": `${hex}59`,
    "--edge-base": `${hex}40`,
    "--edge-strong": `${hex}99`,
    "--perf": `${hex}73`,
  };
}

/**
 * رأس صفحة الشركة: اللوغو والاسم والفئة والتقييم، ثم أحسن عرض كتذكرة كوبون كبيرة
 * (القيمة + الكود + "انسخ الكود" مباشرة)، آخر تحقق، وشريط Premium الذهبي.
 */
export default function StoreHero({
  company, lang, accent, typeLabel, TypeIcon, catLabel, catTo, rating, voteRow,
  hasPremiumOffer, unlocked, onCopy, onPremium, onRevealPremium, canonical, shareTitle, copyRef,
}) {
  const { t } = useTranslation();
  const rtl = lang === "ar";
  const value = locText(company, "discount", lang);
  const premiumValue = locText(company, "premium_discount", lang);
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = () => {
    onCopy(company.code);
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  };

  const checked = formatDay(company.code_checked_at, lang);
  const lastWin = !checked && Number(voteRow?.up_count) + Number(voteRow?.down_count) >= 3 ? relativeTime(voteRow?.last_up_at, lang) : null;
  const showAvg = rating && rating.count >= RATING_MIN_AVG && rating.avg != null;

  return (
    // grid-cols-[minmax(0,1fr)] في الهاتف: بلاه العمود يكبر قدّ أعرض محتوى (التذكرة) ويخرج من الحاشية،
    // ويتبدّل عرضو كي يوصل الخط → الـ Hero كامل يقفز (CLS 0.16 في هاتف بطيء)
    <header className="store-hero grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:items-center lg:gap-10" style={accentVars(accent)}>
      {/* الهوية */}
      <div className="min-w-0">
        <div className="flex items-center gap-4">
          <CompanyLogo logo={company.logo} bg={company.logo_bg} name={company.name} size={72} accent={accent} eager className="!rounded-[20px] lg:hidden" />
          <CompanyLogo logo={company.logo} bg={company.logo_bg} name={company.name} size={92} accent={accent} eager className="!rounded-[24px] hidden lg:grid" />
          <div className="min-w-0">
            <h1 className="text-[27px] font-black leading-[1.15] tracking-tight sm:text-[34px] lg:text-[42px]">
              <bdi>{company.name}</bdi>
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13.5px] font-semibold text-[var(--color-mute)]">
              <span className="inline-flex items-center gap-1 font-bold" style={{ color: accent }}>
                <TypeIcon size={14} /> {typeLabel}
              </span>
              {catLabel && (
                <>
                  <span aria-hidden className="h-1 w-1 rounded-full bg-[var(--color-ink-line)]" />
                  {catTo ? (
                    <Link to={catTo} className="rounded-md py-1 underline-offset-4 hover:text-[var(--text)] hover:underline">
                      {catLabel}
                    </Link>
                  ) : (
                    <span>{catLabel}</span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {showAvg && (
          <a href="#ratings" className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--color-ink-line)] bg-[var(--fill)] px-3 text-[13.5px] font-bold text-[var(--text-softer)] hover:border-[#fbbf24]/40">
            <Star size={16} className="fill-[#fbbf24] text-[#fbbf24]" />
            <span className="[font-family:Inter,sans-serif] text-[15px] font-black text-[var(--text)]">{rating.avg}</span>
            <span className="text-[var(--color-mute)]">{t("storePage.rating.count", { count: rating.count })}</span>
          </a>
        )}

        {/* الوصف القصير (العرض) — النبذة الكاملة في قسم "عن الشركة" */}
        {locText(company, "description", lang) && (
          <p className="mt-4 max-w-[62ch] text-[15px] leading-[1.75] text-[var(--text-soft)]">
            <BidiText text={locText(company, "description", lang)} rtl={rtl} />
          </p>
        )}

        <div className="mt-5 hidden flex-wrap items-center gap-3 lg:flex">
          {company.link && <VisitButton href={company.link} label={t("storePage.visit")} />}
          <ShareButtons url={canonical} title={shareTitle} />
        </div>
      </div>

      {/* التذكرة: أحسن عرض + الكود */}
      <div className={`ticket relative ${hasPremiumOffer && unlocked ? "ticket-premium" : ""}`}>
        <div className="ticket-top relative px-5 pb-5 pt-5 sm:px-6">
          <span aria-hidden className="ticket-ring ticket-ring-l" />
          <span aria-hidden className="ticket-ring ticket-ring-r" />
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="store-value text-[52px] sm:text-[60px]">
                <bdi>{value}</bdi>
              </div>
              <p className="mt-2 text-[14px] font-bold text-[var(--text-softer)]">
                <BidiText text={`${typeLabel} ${t("storePage.offerFor", { name: company.name })}`} rtl={rtl} />
              </p>
            </div>
            <TypeIcon size={34} strokeWidth={1.6} className="mb-1 shrink-0 opacity-70" style={{ color: accent }} aria-hidden />
          </div>
        </div>
        <div className="ticket-stub relative px-5 pb-5 pt-5 sm:px-6">
          <span aria-hidden className="ticket-ring ticket-ring-l" />
          <span aria-hidden className="ticket-ring ticket-ring-r" />
          <span aria-hidden className="ticket-perf" />

          {company.code ? (
            <div ref={copyRef} className="flex items-stretch gap-2.5">
              <div className="store-code flex min-w-0 flex-1 flex-col justify-center rounded-xl px-3.5 py-2">
                <span className="text-[11px] font-bold text-[var(--color-mute)]">{t("storePage.codeLabel")}</span>
                <span dir="ltr" className="truncate text-start font-mono text-[18px] font-extrabold tracking-[0.08em] text-[var(--text)] rtl:text-end">
                  {company.code}
                </span>
              </div>
              <button
                type="button"
                onClick={copy}
                className="store-copy flex min-h-[54px] shrink-0 items-center gap-2 rounded-xl px-5 text-[15px] font-black transition-transform active:scale-[0.97]"
              >
                {copied ? <Check size={18} strokeWidth={3} /> : <Copy size={18} />}
                <span aria-live="polite">{copied ? t("storePage.copied") : t("storePage.copy")}</span>
              </button>
            </div>
          ) : null}

          {(checked || lastWin) && (
            <p className="mt-3 flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--color-mute)]">
              <ShieldCheck size={14} style={{ color: accent }} />
              {checked ? t("storePage.checkedAt", { date: checked }) : t("vote.lastWin", { time: lastWin })}
            </p>
          )}

          {hasPremiumOffer && premiumValue && (
            <button
              type="button"
              onClick={unlocked ? onRevealPremium : onPremium}
              className="store-gold mt-3.5 flex min-h-[48px] w-full items-center justify-between gap-3 rounded-xl px-3.5 text-start"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#0a0a0a]" style={{ background: "linear-gradient(135deg, #ffe486, #f0c63c 55%, #cf9a1e)" }}>
                  <Crown size={16} />
                </span>
                <span className="flex min-w-0 items-baseline gap-2 text-[13.5px] font-extrabold text-[#ffe486]">
                  <span className="truncate">
                    <BidiText text={unlocked ? t("storePage.premiumOpen") : t("storePage.premiumWith")} rtl={rtl} />
                  </span>
                  <bdi className="shrink-0 [font-family:Inter,sans-serif] text-[16px] font-black">{premiumValue}</bdi>
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-0.5 text-[12.5px] font-bold text-[#f0c63c]">
                {unlocked ? t("storePage.premiumReveal") : t("storePage.premiumCta")}
                <ChevronLeft size={15} className="ltr:rotate-180" />
              </span>
            </button>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2.5 lg:hidden">
            {company.link && <VisitButton href={company.link} label={t("storePage.visit")} />}
            <ShareButtons url={canonical} title={shareTitle} />
          </div>
        </div>
      </div>
    </header>
  );
}

function VisitButton({ href, label }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--color-ink-line)] bg-[var(--fill)] px-4 text-[14px] font-extrabold text-[var(--text)] transition-colors hover:border-[var(--sa-line)]"
    >
      <ExternalLink size={16} style={{ color: "var(--sa)" }} /> {label}
    </a>
  );
}
