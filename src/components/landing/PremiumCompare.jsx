import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Crown } from "lucide-react";
import { useTranslation } from "react-i18next";
import MiniCoupon from "./MiniCoupon.jsx";
import SectionHead from "./SectionHead.jsx";
import GoldBurst from "../GoldBurst.jsx";
import { offersLink } from "../../lib/seo.js";
import { premiumMultiplier } from "../../lib/siteStats.js";
import { formatNumber, formatUsd } from "../../lib/values.js";
import { usePricing } from "../../lib/pricing.jsx";
import LifetimePrice from "../pricing/LifetimePrice.jsx";
import SeatsMeter from "../pricing/SeatsMeter.jsx";

/**
 * 5.7 — عادي مقابل Premium: نفس العرض جنباً إلى جنب (مجاني / ذهبي).
 * السعر = الدفعة الوحدة (pricing_settings عبر usePricing: الإطلاق مشطوب فوقو العادي + العدّاد)،
 * والقيمة من site_stats، والمضاعف = القيمة ÷ السعر الحالي بالدولار (يُخفى إن نقصت قيمة).
 */
export default function PremiumCompare({ company, stats, onOpenPremium, isPremiumActive }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [burst, setBurst] = useState(0);
  const pricing = usePricing();
  if (!company) return null;

  const unlock = stats?.premiumUnlockValueUsd ?? null;
  const multiplier = premiumMultiplier(unlock, pricing?.usd);

  return (
    <section className="relative overflow-hidden py-24 sm:py-28">
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(60% 50% at 30% 60%, rgba(240,198,60,0.08), transparent 70%)" }} />
      <div className="relative mx-auto max-w-6xl px-4">
        <SectionHead title={t("compare.title")} sub={t("compare.sub")} />

        <div className="mt-12 grid items-stretch gap-6 lg:grid-cols-[1fr_1fr_0.9fr]">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[14px] font-extrabold text-[var(--accent-text)]">
              <span className="h-2 w-2 rounded-full bg-[var(--color-lime)]" /> {t("compare.free")}
            </div>
            <MiniCoupon company={company} />
          </div>
          <div>
            <div className="mb-3 flex items-center gap-2 text-[14px] font-extrabold text-[#ffe486]">
              <Crown size={15} /> {t("premiumToggle.premium")}
            </div>
            <MiniCoupon company={company} premium />
          </div>

          {/* السعر مقابل القيمة */}
          <div className="flex flex-col justify-between rounded-[var(--radius-card)] border border-[#f0c63c]/35 bg-[linear-gradient(160deg,rgba(240,198,60,0.12),rgba(240,198,60,0.02))] p-6">
            <div>
              {/* العضو (مدفوع / هدية / أدمن) ما يشوفش السعر والمقاعد: Premium مفعّل عندو */}
              {isPremiumActive ? (
                <>
                  <p className="flex items-center gap-2 text-[16px] font-black text-[#ffe486]">
                    <Crown size={17} /> {t("premiumPage.hero.memberTitle")}
                  </p>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--text-soft)]">{t("compare.memberNote")}</p>
                </>
              ) : (
                <>
                  <p className="text-[14px] font-extrabold text-[#ffe486]">{t("pricing.oneTime")}</p>
                  <LifetimePrice pricing={pricing} size="md" className="mt-2" />
                  <SeatsMeter pricing={pricing} className="mt-4" />
                </>
              )}

              {unlock != null && (
                <div className="mt-6 border-t border-dashed border-[#f0c63c]/30 pt-5">
                  <p className="text-[13.5px] font-semibold text-[var(--text-soft)]">{t("compare.unlockLabel")}</p>
                  <bdi dir="ltr" className="mt-1 block text-start text-[34px] font-black leading-none text-[var(--text)] [font-family:Inter,sans-serif] rtl:text-end">
                    {formatUsd(unlock, lang)}
                  </bdi>
                </div>
              )}
              {multiplier && (
                <div className="mt-5 flex items-baseline gap-2">
                  <bdi dir="ltr" className="text-[54px] font-black leading-none tracking-tight text-[#ffe486] [font-family:Inter,sans-serif]">
                    ×{formatNumber(multiplier, "en")}
                  </bdi>
                  <span className="text-[13.5px] font-semibold leading-snug text-[var(--text-soft)]">{t("compare.multiplierLabel")}</span>
                </div>
              )}
            </div>

            <div className="mt-7 flex flex-col gap-2.5">
              {!isPremiumActive && (
                <motion.button
                  type="button"
                  onClick={() => {
                    setBurst((b) => b + 1);
                    onOpenPremium?.();
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="relative flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-[15px] font-extrabold text-[#0a0a0a]"
                  style={{ background: "linear-gradient(135deg,#ffe486,#cf9a1e)", boxShadow: "0 12px 34px -12px rgba(240,198,60,0.6)" }}
                >
                  <Crown size={16} /> {t("hero.ctaPremium")}
                  <GoldBurst fire={burst} />
                </motion.button>
              )}
              <Link
                to={offersLink(lang, { mode: "premium" })}
                className="group flex items-center justify-center gap-2 rounded-xl border border-[#f0c63c]/45 px-5 py-3 text-[14.5px] font-extrabold text-[#ffe486] transition-colors hover:bg-[#f0c63c]/10"
              >
                {t("compare.seePremium")}
                <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-0.5 ltr:rotate-180 ltr:group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
