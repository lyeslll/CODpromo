import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Crown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePremium } from "../../lib/premium.jsx";
import { offersLink, offersPath } from "../../lib/seo.js";
import { fmtUSD } from "../../lib/plans.js";
import { monthlyUsdPrice, premiumMultiplier } from "../../lib/siteStats.js";
import { formatNumber } from "../../lib/values.js";
import { useSharedStats } from "../header/headerData.js";

const GOLD_BG = "linear-gradient(135deg, #fff1b8, #ffe486 28%, #f0c63c 62%, #cf9a1e)";
const INK = "#1d1403";

/**
 * الـ CTA فوق الفوتر: كوبون واحد بجهتين يفرقهما خط مثقّب —
 * جهة عادية (افتح العروض) وجهة ذهبية (Premium: السعر + المضاعف ×N من site_stats).
 * المشترك (ومول الهدية) يرى "عضو Premium" ورابط عروض Premium بدل زر الاشتراك.
 */
export default function FooterCta({ onPremium, innerRef }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const navigate = useNavigate();
  const { hasPremium } = usePremium();
  const stats = useSharedStats();
  const usd = monthlyUsdPrice();
  const multiplier = premiumMultiplier(stats?.premiumUnlockValueUsd ?? null, usd);

  return (
    <section ref={innerRef} className="mx-auto max-w-6xl px-4 pb-4 pt-12">
      <div className="duo" style={{ "--edge-a": "rgba(166,240,0,0.35)", "--edge-b": "rgba(255,228,134,0.85)", "--perf": "rgba(29,20,3,0.42)" }}>
        {/* ===== الجهة العادية ===== */}
        <div className="duo-a bg-[var(--color-ink-card)] px-6 pb-10 pt-11 text-center sm:px-10 lg:flex-[1.3] lg:py-14 lg:text-start">
          <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(70% 90% at 50% 0%, rgba(166,240,0,0.14), transparent 70%)" }} />
          <span aria-hidden className="duo-ring duo-ring-1" />
          <span aria-hidden className="duo-ring duo-ring-2" />
          <h2 className="relative text-balance text-[30px] font-black leading-[1.12] tracking-tight text-[var(--text)] sm:text-[42px]">{t("finalCta.title")}</h2>
          <p className="relative mx-auto mt-4 max-w-md text-[15.5px] leading-[1.7] text-[var(--text-soft)] sm:text-[17px] lg:mx-0">{t("finalCta.sub")}</p>
          <Link to={offersPath(lang)} className="relative mt-7 inline-flex">
            <motion.span
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="group relative flex items-center gap-2 overflow-hidden rounded-2xl px-7 py-4 text-[16px] font-extrabold text-[#0a0a0a] shadow-[0_14px_40px_-12px_rgba(166,240,0,0.6)]"
              style={{ background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" }}
            >
              <span aria-hidden className="absolute inset-0 -translate-x-full bg-white/30 transition-transform duration-500 group-hover:translate-x-full" />
              <span className="relative">{t("finalCta.cta")}</span>
              <ArrowLeft size={18} className="relative transition-transform group-hover:-translate-x-1 ltr:rotate-180 ltr:group-hover:translate-x-1" />
            </motion.span>
          </Link>
        </div>

        {/* ===== الجهة الذهبية (Premium) ===== */}
        <div className="duo-b flex flex-col justify-center px-6 pb-9 pt-10 sm:px-10 lg:flex-1 lg:py-14" style={{ background: GOLD_BG, color: INK }}>
          <span aria-hidden className="duo-ring duo-ring-1" />
          <span aria-hidden className="duo-ring duo-ring-2" />
          <span aria-hidden className="duo-perf" />
          <span aria-hidden className="pointer-events-none absolute -end-10 -top-10 h-44 w-44 rounded-full bg-white/30 blur-2xl" />

          <div className="relative flex items-center gap-2 text-[17px] font-black">
            <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: INK, color: "#ffe486" }}>
              <Crown size={18} />
            </span>
            {hasPremium ? t("header.member") : t("premiumToggle.premium")}
          </div>
          <p className="relative mt-2 text-[14.5px] font-semibold" style={{ color: "rgba(29,20,3,0.72)" }}>
            {hasPremium ? t("hero.ctaMember") : t("nav.premiumSub")}
          </p>

          {!hasPremium && (
            <div className="relative mt-6 flex flex-wrap items-end gap-x-8 gap-y-4">
              {usd != null && (
                <p className="text-[14px] font-bold" style={{ color: "rgba(29,20,3,0.75)" }}>
                  {t("compare.priceFrom")}{" "}
                  <bdi className="text-[34px] font-black leading-none [font-family:Inter,sans-serif]" style={{ color: INK }}>
                    {fmtUSD(usd)}
                  </bdi>{" "}
                  {t("compare.perMonth")}
                </p>
              )}
              {multiplier && (
                <div className="flex items-end gap-2">
                  <bdi className="text-[46px] font-black leading-[0.85] tracking-tight [font-family:Inter,sans-serif]" style={{ color: INK }}>
                    ×{formatNumber(multiplier, lang)}
                  </bdi>
                  <span className="max-w-[120px] text-[12px] font-bold leading-snug" style={{ color: "rgba(29,20,3,0.7)" }}>
                    {t("stats.multiplier")}
                  </span>
                </div>
              )}
            </div>
          )}

          <motion.button
            type="button"
            onClick={hasPremium ? () => navigate(offersLink(lang, { mode: "premium" })) : onPremium}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="relative mt-7 flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-[15.5px] font-extrabold sm:w-auto sm:self-start"
            style={{ background: INK, color: "#ffe486", boxShadow: "0 14px 30px -14px rgba(29,20,3,0.8)" }}
          >
            <Crown size={17} />
            {hasPremium ? t("compare.seePremium") : t("nav.premium")}
          </motion.button>
        </div>
      </div>
    </section>
  );
}
