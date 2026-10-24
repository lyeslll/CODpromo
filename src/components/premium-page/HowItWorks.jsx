import { Check, Copy, Crown } from "lucide-react";
import { useTranslation } from "react-i18next";
import SectionHead from "../landing/SectionHead.jsx";
import { formatNumber } from "../../lib/values.js";
import "./premium-page.css";

const GOLD_SOFT = "#ffe486";
const GOLD = "#f0c63c";

/** كيف يعمل: ثلاث خطوات متتالية (ادفع ← اكشف ← وفّر)، كل وحدة برسم صغير ثابت (بلا كود حقيقي). */
export default function HowItWorks({ pricing }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const steps = [
    { k: "s1", art: <PaidStub t={t} amount={pricing?.dzd != null ? t("pricing.dzd", { dzd: formatNumber(pricing.dzd, lang) }) : null} /> },
    { k: "s2", art: <ScratchStrip t={t} /> },
    { k: "s3", art: <CopiedRow t={t} /> },
  ];

  return (
    <section id="how" className="scroll-mt-28 py-20 sm:py-24" aria-labelledby="pp-how-title">
      <div className="mx-auto max-w-5xl px-4">
        <SectionHead id="pp-how-title" title={t("premiumPage.how.title")} sub={t("premiumPage.how.sub")} />
        <ol className="mt-10 grid gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.k} className="flex flex-col rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] p-5 sm:p-6">
              <div className="grid h-[92px] place-items-center rounded-2xl bg-[var(--color-ink)]" aria-hidden>
                {s.art}
              </div>
              <div className="mt-5 flex items-center gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border text-[14px] font-black" style={{ borderColor: `${GOLD}80`, color: GOLD_SOFT }}>
                  {formatNumber(i + 1, lang)}
                </span>
                <h3 className="text-[18px] font-extrabold text-[var(--text)]">{t(`premiumPage.how.${s.k}.t`)}</h3>
              </div>
              <p className="mt-2.5 text-[14.5px] leading-[1.75] text-[var(--text-soft)]">{t(`premiumPage.how.${s.k}.d`)}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function PaidStub({ t, amount }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-dashed px-4 py-2.5" style={{ borderColor: `${GOLD}66` }}>
      <Crown size={18} style={{ color: GOLD }} />
      {amount && <bdi className="text-[16px] font-black text-[var(--text)]">{amount}</bdi>}
      <span className="rounded-full border-2 px-2 py-0.5 text-[11px] font-black" style={{ borderColor: GOLD, color: GOLD_SOFT, transform: "rotate(-6deg)" }}>
        {t("premiumPage.how.paid")}
      </span>
    </div>
  );
}

function ScratchStrip({ t }) {
  return (
    <div className="relative h-11 w-[200px] overflow-hidden rounded-xl border" style={{ borderColor: `${GOLD}55`, background: "rgba(240,198,60,0.08)" }}>
      <span dir="ltr" className="absolute inset-0 grid place-items-center font-mono text-[18px] font-black tracking-[0.3em]" style={{ color: GOLD_SOFT }}>
        ••••••••
      </span>
      {/* القشرة الذهبية مخدوشة نصّها */}
      <span className="pp-foil absolute inset-y-0 end-0 grid w-[58%] place-items-center text-[12px] font-black text-[#1d1403]" style={{ clipPath: "polygon(14% 0, 100% 0, 100% 100%, 0 100%, 9% 62%, 4% 30%)" }}>
        {t("premiumPage.how.scratch")}
      </span>
    </div>
  );
}

function CopiedRow({ t }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border px-2 py-2" style={{ borderColor: `${GOLD}55` }}>
      <span dir="ltr" className="rounded-lg bg-[var(--fill)] px-3 py-1.5 font-mono text-[13px] font-black tracking-widest" style={{ color: GOLD_SOFT }}>
        ••••••
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-extrabold text-[#1d1403]" style={{ background: `linear-gradient(135deg, ${GOLD_SOFT}, ${GOLD})` }}>
        <Check size={14} strokeWidth={3} /> {t("premiumPage.how.copied")}
      </span>
      <Copy size={14} className="text-[var(--color-mute)]" />
    </div>
  );
}
