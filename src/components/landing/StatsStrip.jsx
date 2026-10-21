import { useEffect, useRef, useState } from "react";
import { animate, useInView, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { formatNumber } from "../../lib/values.js";
import { premiumMultiplier } from "../../lib/siteStats.js";

/** رقم يعدّ تصاعدياً مرّة واحدة حين يظهر في الشاشة. */
function CountUp({ value, lang, prefix = "", run }) {
  const reduced = useReducedMotion();
  const [n, setN] = useState(reduced ? value : 0);
  useEffect(() => {
    if (!run) return;
    if (reduced) {
      setN(value);
      return;
    }
    const c = animate(0, value, { duration: 1.6, ease: [0.16, 1, 0.3, 1], onUpdate: setN });
    return () => c.stop();
  }, [value, run, reduced]);
  return (
    <>
      {prefix}
      {formatNumber(n, lang)}
    </>
  );
}

/**
 * 5.3 — شريط الأرقام: كعوب تذكرة تُقطع (خطوط مثقّبة بينها).
 * كل رقم من site_stats (يدوي من الأدمن، أو عدّ تلقائي من القاعدة)، وأي خانة فارغة تختفي.
 * لا تقييم مزيّف ولا أرقام مكتوبة في الكود.
 */
export default function StatsStrip({ stats }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  const multiplier = premiumMultiplier(stats?.premiumUnlockValueUsd);
  const cells = [
    stats?.totalSavingsDzd != null && {
      key: "savings",
      value: stats.totalSavingsDzd,
      unit: t("stats.dzd"),
      label: t("stats.savings"),
    },
    stats?.totalCodes != null && { key: "codes", value: stats.totalCodes, label: t("stats.codes") },
    stats?.partnersCount != null && { key: "partners", value: stats.partnersCount, label: t("stats.partners") },
    multiplier && { key: "multiplier", value: multiplier, prefix: "×", label: t("stats.multiplier"), gold: true },
  ].filter(Boolean);

  return (
    <section ref={ref} aria-label={t("stats.label")} className="relative mx-auto max-w-6xl px-4">
      {/* خانات مرنة: الخانة الفارغة لا تُرسم أصلاً، والباقية تتمدّد لتملأ العرض كاملاً
          (هاتف: خانتان في الصف والأخيرة الفردية تأخذ الصف كاملاً — حاسوب: صف واحد).
          الخطوط المثقّبة = حافة علوية/بدائية لكل خانة، والحواف الخارجية مخفية بإزاحة 1px. */}
      <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)]">
        <div className="-ms-px -mt-px flex flex-wrap">
        {/* مجاني: الوعد الأول قبل أي رقم */}
        <div
          className={`flex basis-full flex-col justify-center gap-1 border-s border-t border-dashed border-[var(--color-ink-line)] px-6 py-5 ${
            cells.length ? "md:shrink-0 md:basis-[23%]" : ""
          }`}
        >
          <span className="text-[30px] font-black leading-none text-[var(--accent-text)] sm:text-[34px]">{t("stats.free")}</span>
          <span className="text-[13px] font-medium leading-snug text-[var(--text-soft)]">{t("stats.freeSub")}</span>
        </div>
        {cells.map((c) => (
          <div
            key={c.key}
            className="relative flex min-w-0 flex-[1_1_50%] flex-col justify-center gap-1 border-s border-t border-dashed border-[var(--color-ink-line)] px-6 py-5 md:flex-[1_1_0%]"
          >
            <span className="flex items-baseline gap-1.5 leading-none">
              <bdi
                dir="ltr"
                className="text-[28px] font-black tracking-tight tabular-nums [font-family:Inter,sans-serif] sm:text-[34px]"
                style={{ color: c.gold ? "#ffe486" : "var(--text)" }}
              >
                <CountUp value={c.value} lang={lang} prefix={c.prefix} run={inView} />
              </bdi>
              {c.unit && <span className="text-[15px] font-extrabold text-[var(--color-mute)]">{c.unit}</span>}
            </span>
            <span className="text-[13px] font-medium text-[var(--text-soft)]">{c.label}</span>
          </div>
        ))}
        </div>
      </div>
    </section>
  );
}
