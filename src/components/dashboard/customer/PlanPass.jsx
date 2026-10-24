import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Crown, Infinity as InfinityIcon, KeyRound, CalendarClock, CreditCard, Gift, ShoppingBag } from "lucide-react";
import { useTranslation } from "react-i18next";
import { offersLink } from "../../../lib/seo.js";
import { premiumMultiplier } from "../../../lib/siteStats.js";
import { formatNumber } from "../../../lib/values.js";
import { usePricing } from "../../../lib/pricing.jsx";
import LifetimePrice from "../../pricing/LifetimePrice.jsx";
import SeatsMeter from "../../pricing/SeatsMeter.jsx";

const GOLD_SOFT = "#ffe486";
const GOLD = "#f0c63c";
const GOLD_DEEP = "#cf9a1e";
const GOLD_BG = `linear-gradient(135deg, ${GOLD_SOFT}, ${GOLD} 55%, ${GOLD_DEEP})`;
const PROVIDER_KEY = { stripe: "stripe", slickpay: "slickpay", paypal: "paypal", google_play: "play" };
const DAY = 86400000;

const ticketVars = {
  "--edge-base": "rgba(240,198,60,0.42)",
  "--edge-strong": "rgba(240,198,60,0.7)",
  "--perf": "rgba(240,198,60,0.55)",
};

/**
 * بطاقة الخطة = تذكرة ذهبية.
 *  - مدى الحياة (شراء ولا أدمن): "Premium مدى الحياة" بلا تاريخ نهاية + تاريخ الشراء وطريقة الدفع (purchases).
 *  - Premium بمدّة (Stork): تاريخ الانتهاء ودائرة الأيام الباقية.
 *  - هدية (kind="gift"): "Premium هدية" + نهاية الهدية والأيام الباقية (من gift_redemptions عبر my_gift).
 *  - عادي: كوبون ترقية بالدفعة الوحدة (pricing_settings + العدّاد) والمضاعف (site_stats) + زر يفتح نافذة Premium، وتحته تفعيل كود Stork
 *    وخانة "هل لديك كود هدية؟" (giftField).
 */
export default function PlanPass({ kind, profile, gift, purchase, stats, onOpenPremium, onOpenStork, giftField }) {
  if (kind === "free") return <UpgradeCoupon stats={stats} onOpenPremium={onOpenPremium} onOpenStork={onOpenStork} giftField={giftField} />;
  if (kind === "gift" && gift) return <MemberPass gift={gift} />;
  return <MemberPass lifetime={kind === "lifetime"} profile={profile} purchase={purchase} />;
}

function MemberPass({ lifetime, profile, gift, purchase }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const rawUntil = gift ? gift.premium_until : profile?.premium_until;
  const until = rawUntil ? new Date(rawUntil) : null;
  const endless = !gift && (lifetime || !until);
  const daysLeft = endless ? null : Math.max(0, Math.ceil((until - Date.now()) / DAY));
  const total = gift ? Math.max(gift.duration_days || 0, daysLeft || 0, 1) : Math.max(daysLeft || 0, 30);
  const ratio = endless ? 1 : Math.min(1, (daysLeft || 0) / total);
  const providerKey = gift ? null : PROVIDER_KEY[purchase?.provider || profile?.payment_provider];
  const Icon = gift ? Gift : Crown;
  const fmtDate = (d) => new Date(d).toLocaleDateString(lang, { day: "numeric", month: "long", year: "numeric" });

  const title = gift ? t("dashboard.gift.title") : lifetime ? t("premium.lifetime") : t("premiumToggle.premium");

  return (
    <div className="ticket ticket-premium flex h-full flex-col" style={ticketVars}>
      <div className="ticket-top relative flex-1 p-5 sm:p-6" style={{ background: "linear-gradient(160deg, rgba(240,198,60,0.16), rgba(240,198,60,0.04) 60%), var(--color-ink-card)" }}>
        <div className="flex items-start gap-3.5">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-[#0a0a0a]" style={{ background: GOLD_BG }}>
            <Icon size={23} />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-[var(--text-soft)]">{t("dashboard.plan.yourPlan")}</p>
            <h2 className="mt-0.5 text-[22px] font-black leading-tight" style={{ color: GOLD_SOFT }}>
              {title}
            </h2>
            {gift && <p className="mt-0.5 text-[12.5px] font-semibold text-[var(--text-soft)]">{t("dashboard.gift.from")}</p>}
          </div>
        </div>
        <dl className="mt-5 grid gap-2.5 text-[13.5px]">
          <Row icon={CalendarClock} label={t("dashboard.plan.endsOn")}>
            {endless ? t("dashboard.plan.noEnd") : fmtDate(until)}
          </Row>
          {purchase?.purchased_at && (
            <Row icon={ShoppingBag} label={t("dashboard.plan.purchasedOn")}>
              {fmtDate(purchase.purchased_at)}
            </Row>
          )}
          {providerKey && (purchase || !lifetime) && (
            <Row icon={CreditCard} label={t("dashboard.plan.paidWith")}>
              {t(`premium.methods.${providerKey}Name`)}
            </Row>
          )}
        </dl>
      </div>
      <div className="ticket-stub relative flex items-center gap-4 p-5 sm:p-6" style={{ background: "rgba(240,198,60,0.06)" }}>
        <span className="ticket-ring ticket-ring-l" />
        <span className="ticket-ring ticket-ring-r" />
        <span className="ticket-perf" />
        <DaysRing ratio={ratio} label={endless ? null : daysLeft} lang={lang} />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-extrabold text-[var(--text)]">
            {endless ? t("dashboard.plan.forever") : gift ? t("dashboard.gift.daysLeft") : t("dashboard.plan.daysLeft", { count: daysLeft })}
          </p>
          <Link
            to={offersLink(lang, { mode: "premium" })}
            className="mt-2 inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[13px] font-extrabold text-[#0a0a0a] transition-transform hover:scale-[1.02]"
            style={{ background: GOLD_BG }}
          >
            <Crown size={14} /> {t("compare.seePremium")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, children }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex items-center gap-2 text-[var(--text-soft)]">
        <Icon size={15} style={{ color: GOLD }} /> {label}
      </dt>
      <dd className="truncate font-bold text-[var(--text)]" dir="auto">
        {children}
      </dd>
    </div>
  );
}

/** دائرة الأيام الباقية (أو ∞ لمدى الحياة). الحركة مرّة واحدة عند الظهور. */
function DaysRing({ ratio, label, lang }) {
  const R = 30;
  const C = 2 * Math.PI * R;
  return (
    <div className="relative grid h-[76px] w-[76px] shrink-0 place-items-center">
      <svg viewBox="0 0 72 72" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="36" cy="36" r={R} fill="none" stroke="rgba(240,198,60,0.16)" strokeWidth="6" />
        <motion.circle
          cx="36"
          cy="36"
          r={R}
          fill="none"
          stroke="url(#plan-gold)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - ratio) }}
          transition={{ duration: 1.1, ease: [0.2, 0.8, 0.2, 1], delay: 0.2 }}
        />
        <defs>
          <linearGradient id="plan-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={GOLD_SOFT} />
            <stop offset="1" stopColor={GOLD_DEEP} />
          </linearGradient>
        </defs>
      </svg>
      {label == null ? (
        <InfinityIcon size={26} style={{ color: GOLD_SOFT }} />
      ) : (
        <span className="text-[20px] font-black tabular-nums" style={{ color: GOLD_SOFT }}>
          {formatNumber(label, lang)}
        </span>
      )}
    </div>
  );
}

function UpgradeCoupon({ stats, onOpenPremium, onOpenStork, giftField }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const pricing = usePricing();
  const multiplier = premiumMultiplier(stats?.premiumUnlockValueUsd ?? null, pricing?.usd);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="ticket ticket-premium flex flex-1 flex-col" style={ticketVars}>
        <div className="ticket-top relative flex-1 p-5 sm:p-6" style={{ background: "linear-gradient(160deg, rgba(240,198,60,0.18), rgba(240,198,60,0.04) 65%), var(--color-ink-card)" }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[13px] font-bold text-[var(--text-soft)]">{t("dashboard.plan.yourPlanFree")}</p>
              <h2 className="mt-0.5 flex items-center gap-2 text-[22px] font-black" style={{ color: GOLD_SOFT }}>
                <Crown size={21} /> {t("premiumToggle.premium")}
              </h2>
              <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-soft)]">{t("dashboard.customer.upgradeDesc")}</p>
            </div>
          </div>
          {pricing && (
            <div className="mt-4">
              <p className="text-[12.5px] font-extrabold" style={{ color: GOLD_SOFT }}>{t("pricing.oneTime")}</p>
              <LifetimePrice pricing={pricing} size="md" className="mt-1.5" />
              <SeatsMeter pricing={pricing} className="mt-3" />
            </div>
          )}
          {multiplier && (
            <div className="mt-4 flex items-end gap-2.5">
              <bdi dir="ltr" className="text-[40px] font-black leading-none tabular-nums" style={{ color: GOLD_SOFT }}>
                ×{formatNumber(multiplier, "en")}
              </bdi>
              <span className="pb-1 text-[12.5px] font-semibold leading-snug text-[var(--text-soft)]">{t("compare.multiplierLabel")}</span>
            </div>
          )}
        </div>
        <div className="ticket-stub relative p-5 sm:p-6" style={{ background: "rgba(240,198,60,0.06)" }}>
          <span className="ticket-ring ticket-ring-l" />
          <span className="ticket-ring ticket-ring-r" />
          <span className="ticket-perf" />
          <button
            type="button"
            onClick={onOpenPremium}
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-[15px] font-extrabold text-[#0a0a0a] transition-transform hover:scale-[1.01] active:scale-[0.99]"
            style={{ background: GOLD_BG, boxShadow: "0 12px 26px -14px rgba(240,198,60,0.8)" }}
          >
            <Crown size={17} /> {t("dashboard.plan.openPremium")}
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={onOpenStork}
        className="flex items-center gap-2.5 rounded-2xl border border-[var(--color-ink-line)] bg-[var(--fill)] px-4 py-3 text-start text-[13px] text-[var(--text-soft)] transition-colors hover:border-[#f0c63c]/40 hover:text-[var(--text)]"
      >
        <KeyRound size={16} className="shrink-0" style={{ color: GOLD }} />
        <span>
          {t("dashboard.plan.storkQ")} <span className="font-extrabold" style={{ color: GOLD_SOFT }}>{t("dashboard.plan.storkCta")}</span>
        </span>
      </button>
      {giftField}
    </div>
  );
}
