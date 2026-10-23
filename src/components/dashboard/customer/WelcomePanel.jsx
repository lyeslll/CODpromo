import { Crown, Gift, Infinity as InfinityIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatNumber } from "../../../lib/values.js";

/** شارة الخطة: عادي / Premium / Premium مدى الحياة / Premium هدية. */
export function PlanBadge({ kind }) {
  const { t } = useTranslation();
  if (kind === "free") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-ink-line)] bg-[var(--fill)] px-2.5 py-1 text-[12px] font-bold text-[var(--text-softer)]">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-lime)]" /> {t("dashboard.plan.free")}
      </span>
    );
  }
  const Icon = kind === "lifetime" ? InfinityIcon : kind === "gift" ? Gift : Crown;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-extrabold text-[#0a0a0a]"
      style={{ background: "linear-gradient(135deg, #ffe486, #f0c63c 55%, #cf9a1e)" }}
    >
      <Icon size={13} /> {kind === "lifetime" ? t("premium.lifetime") : kind === "gift" ? t("dashboard.gift.title") : t("premiumToggle.premium")}
    </span>
  );
}

/**
 * بطاقة الترحيب: الحرف الأول في دائرة، الاسم، الإيميل، نوع الحساب، عضو منذ، شارة الخطة،
 * وتحتها ثلاثة أرقام حقيقية من قاعدة البيانات (null = قيد التحميل).
 */
export default function WelcomePanel({ name, email, joined, kind, stats }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const initial = (name || "؟").trim().charAt(0).toUpperCase();
  const items = [
    { key: "copied", value: stats.copied },
    { key: "favorites", value: stats.favorites },
    { key: "votes", value: stats.votes },
  ];

  return (
    <section className="relative flex h-full flex-col justify-between overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)]">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 h-48 w-48 rounded-full blur-[80px] ltr:-left-12 rtl:-right-12"
        style={{ background: "radial-gradient(circle, rgba(166,240,0,0.16), transparent 65%)" }}
      />
      <div className="relative flex flex-1 items-center gap-4 p-5 sm:p-6">
        <span
          className="grid h-16 w-16 shrink-0 place-items-center rounded-full text-[26px] font-black text-[#0a0a0a] sm:h-[72px] sm:w-[72px]"
          style={{ background: "linear-gradient(150deg, var(--color-lime-soft), var(--color-lime-deep))" }}
          aria-hidden
        >
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-[22px] font-black tracking-tight sm:text-[26px]" dir="auto">
              {name}
            </h1>
            <PlanBadge kind={kind} />
          </div>
          <p className="mt-1 truncate text-[13.5px] text-[var(--text-soft)]">
            <bdi dir="ltr">{email}</bdi>
          </p>
          <p className="mt-1.5 text-[12.5px] text-[var(--color-mute)]">
            {t("dashboard.customer.accountTypeVal")}
            <span className="mx-2 inline-block h-3 w-px translate-y-0.5 bg-[var(--color-ink-line)]" aria-hidden />
            {t("dashboard.customer.memberSince")} {joined}
          </p>
        </div>
      </div>

      <dl className="relative grid grid-cols-3 border-t border-dashed border-[var(--color-ink-line)]">
        {items.map((it, i) => (
          <div key={it.key} className={`px-3 py-4 text-center sm:px-5 sm:py-5 ${i > 0 ? "border-s border-dashed border-[var(--color-ink-line)]" : ""}`}>
            <dd className="text-[26px] font-black leading-none tabular-nums text-[var(--text)] sm:text-[30px]">
              {it.value == null ? <span className="inline-block h-7 w-10 animate-pulse rounded-md bg-[var(--fill)]" /> : formatNumber(it.value, lang)}
            </dd>
            <dt className="mt-1.5 text-[12px] font-semibold text-[var(--text-soft)] sm:text-[13px]">{t(`dashboard.stats.${it.key}`)}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}
