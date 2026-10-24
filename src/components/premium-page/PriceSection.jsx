import { forwardRef } from "react";
import { Link } from "react-router-dom";
import { Check, Crown, RefreshCw, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import SectionHead from "../landing/SectionHead.jsx";
import LifetimePrice from "../pricing/LifetimePrice.jsx";
import SeatsMeter from "../pricing/SeatsMeter.jsx";
import { formatPrice } from "../../lib/pricing.jsx";
import { premiumMultiplier } from "../../lib/siteStats.js";
import { formatNumber } from "../../lib/values.js";

const GOLD_SOFT = "#ffe486";
const GOLD = "#f0c63c";
const GOLD_BG = "linear-gradient(135deg, #ffe486, #f0c63c 55%, #cf9a1e)";
const TICKET_VARS = { "--r": "16px", "--edge-base": "rgba(240,198,60,0.42)", "--edge-strong": "rgba(240,198,60,0.7)", "--perf": "rgba(240,198,60,0.55)" };
const PERKS = ["all", "nocode", "noRenewal", "refund"];

/**
 * السعر (#price): تذكرة ذهبية كبيرة (السعر الحقيقي من pricing_public + المزايا + العدّاد + زر الشراء)،
 * وبجنبها ضمان 7 أيام وقيمة الخصومات (site_stats). ctaRef = زر الشراء (يخبّي الشريط العائم كي يبان).
 */
const PriceSection = forwardRef(function PriceSection({ pricing, pricingReady, onRetry, stats, member, onBuy, offersTo }, ctaRef) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const unlock = stats?.premiumUnlockValueUsd ?? null;
  const multiplier = premiumMultiplier(unlock, pricing?.usd);
  const facts = [
    ["type", t("premiumPage.price.facts.typeV")],
    ["duration", t("premiumPage.price.facts.durationV")],
    ["activation", t("premiumPage.price.facts.activationV")],
    ...(pricing?.isLaunch && pricing.seatsTotal
      ? [["seats", t("premiumPage.price.facts.seatsV", { left: formatNumber(Math.max(0, pricing.seatsLeft), lang), total: formatNumber(pricing.seatsTotal, lang) })]]
      : []),
  ];

  return (
    <section id="price" className="scroll-mt-28 py-20 sm:py-24" aria-labelledby="pp-price-title">
      <div className="mx-auto max-w-5xl px-4">
        <SectionHead
          id="pp-price-title"
          title={t("premiumPage.price.title")}
          sub={
            pricing?.isLaunch
              ? t("premiumPage.price.subLaunch", { seats: formatNumber(pricing.seatsTotal, lang), regular: formatPrice(t, lang, pricing.regularDzd, pricing.regularUsd) })
              : t("premiumPage.price.subRegular")
          }
        />

        <div className="mt-10 grid gap-5 lg:grid-cols-[1.35fr_1fr]">
          <div className="ticket ticket-premium" style={TICKET_VARS}>
            <div className="ticket-top relative p-6 sm:p-8" style={{ background: "radial-gradient(90% 70% at 100% 0%, rgba(240,198,60,0.16), transparent 60%), var(--color-ink-card)" }}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-[15px] font-extrabold" style={{ color: GOLD_SOFT }}>
                  <Crown size={17} /> {t("pricing.productName")}
                </p>
                {pricing?.isTest ? (
                  <span className="rounded-full border border-[#38bdf8]/50 bg-[#38bdf8]/15 px-3 py-1 text-[12px] font-black text-[#7dd3fc]">{t("pricing.testBadge")}</span>
                ) : (
                  pricing?.isLaunch && (
                    <span className="rounded-full px-3 py-1 text-[12px] font-black text-[#1d1403]" style={{ background: GOLD_BG }}>
                      {t("pricing.launchBadge")}
                    </span>
                  )
                )}
              </div>

              {pricing ? (
                <LifetimePrice pricing={pricing} size="xl" className="mt-5" />
              ) : pricingReady ? (
                <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/[0.08] px-4 py-3">
                  <p className="text-[13px] font-semibold text-red-300">{t("pricing.error")}</p>
                  <button type="button" onClick={onRetry} className="flex shrink-0 items-center gap-1.5 text-[13px] font-extrabold text-[var(--text)]">
                    <RefreshCw size={14} /> {t("pricing.retry")}
                  </button>
                </div>
              ) : (
                <div aria-hidden className="mt-5 h-[72px] w-2/3 animate-pulse rounded-xl bg-[var(--fill-strong)]" />
              )}

              <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
                {PERKS.map((k) => (
                  <li key={k} className="flex items-start gap-2.5 text-[14px] leading-relaxed text-[var(--text-softer)]">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full" style={{ background: "rgba(240,198,60,0.16)" }}>
                      <Check size={12} strokeWidth={3.5} style={{ color: GOLD }} />
                    </span>
                    {t(`premiumPage.price.perks.${k}`)}
                  </li>
                ))}
              </ul>
            </div>

            <div className="ticket-stub relative p-6 sm:px-8" style={{ background: "rgba(240,198,60,0.06)" }}>
              <span className="ticket-ring ticket-ring-l" />
              <span className="ticket-ring ticket-ring-r" />
              <span className="ticket-perf" />
              <SeatsMeter pricing={pricing} className="mb-5" />
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
                {facts.map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[11.5px] font-bold text-[var(--color-mute)]">{t(`premiumPage.price.facts.${k}`)}</dt>
                    <dd className="mt-0.5 text-[14.5px] font-extrabold text-[var(--text)]">
                      <bdi>{v}</bdi>
                    </dd>
                  </div>
                ))}
              </dl>
              {member ? (
                <Link ref={ctaRef} to={offersTo} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 text-[16px] font-extrabold text-[#1d1403]" style={{ background: GOLD_BG }}>
                  <Crown size={18} /> {t("premiumPage.hero.memberCta")}
                </Link>
              ) : (
                <button
                  ref={ctaRef}
                  type="button"
                  onClick={onBuy}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 text-[16.5px] font-extrabold text-[#1d1403] transition-transform hover:scale-[1.01] active:scale-[0.99]"
                  style={{ background: GOLD_BG, boxShadow: "0 18px 44px -18px rgba(240,198,60,0.75)" }}
                >
                  <Crown size={18} /> {t("premiumPage.hero.cta")}
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <div className="rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] p-6">
              <span className="grid h-12 w-12 place-items-center rounded-2xl" style={{ background: "rgba(166,240,0,0.1)", color: "var(--color-lime)" }}>
                <ShieldCheck size={24} />
              </span>
              <h3 className="mt-4 text-[20px] font-black text-[var(--text)]">{t("premiumPage.guarantee.title")}</h3>
              <p className="mt-2 text-[14.5px] leading-[1.75] text-[var(--text-soft)]">{t("premiumPage.guarantee.desc")}</p>
              <Link to="/terms" className="mt-3 inline-block text-[13.5px] font-bold text-[var(--accent-text)] underline decoration-dotted underline-offset-4">
                {t("pricing.terms")}
              </Link>
            </div>

            {unlock != null && (
              <div className="rounded-[var(--radius-card)] border p-6" style={{ borderColor: "rgba(240,198,60,0.3)", background: "linear-gradient(160deg, rgba(240,198,60,0.1), rgba(240,198,60,0.02))" }}>
                <p className="text-[13.5px] font-semibold text-[var(--text-soft)]">{t("compare.unlockLabel")}</p>
                <bdi className="mt-2 block text-[40px] font-black leading-none text-[var(--text)] [font-family:Inter,sans-serif]">${formatNumber(unlock, "en")}</bdi>
                {multiplier && (
                  <div className="mt-4 flex items-baseline gap-2.5 border-t border-dashed pt-4" style={{ borderColor: "rgba(240,198,60,0.25)" }}>
                    <bdi dir="ltr" className="text-[44px] font-black leading-none text-[#ffe486] [font-family:Inter,sans-serif]">
                      ×{formatNumber(multiplier, "en")}
                    </bdi>
                    <span className="text-[13px] font-semibold leading-snug text-[var(--text-soft)]">{t("compare.multiplierLabel")}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
});

export default PriceSection;
