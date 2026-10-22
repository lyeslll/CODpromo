import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import SectionHead from "../landing/SectionHead.jsx";
import PremiumToggle from "../PremiumToggle.jsx";
import GoldBurst from "../GoldBurst.jsx";
import NocodeCard from "./NocodeCard.jsx";
import NocodeGrid from "./NocodeGrid.jsx";
import { useNocodeDeals } from "../../lib/nocode.js";
import { dealHasPremium, premiumFirst } from "../../lib/premiumOffer.js";
import { offersLink } from "../../lib/seo.js";
import { ModeWaveContext, useWaveSwitch, useFloatingSwitch } from "../../lib/modeWave.jsx";
import DesktopModeSwitch from "../DesktopModeSwitch.jsx";

const MAX_HOME = 6;

/**
 * قسم "عروض بلا كود" في الرئيسية (بعد عيّنة العروض وقبل قسم التطبيق).
 * يختفي إذا لا يوجد عرض نشط. مبدّل عادي/Premium، وزر نحو /offers?kind=nocode.
 */
export default function NocodeSection({ unlocked, onUnlock }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const deals = useNocodeDeals();
  const [mode, setMode] = useState("normal");
  const [burst, setBurst] = useState(0);
  // موجة التبديل + تثبيت البطاقة اللي قدامك + مبدّل عائم في الكمبيوتر (lib/modeWave.jsx)
  const toggleRef = useRef(null);
  const areaRef = useRef(null);
  const floating = useFloatingSwitch(toggleRef, areaRef, !!deals?.length);
  const { wave, beforeChange } = useWaveSwitch(mode === "premium", areaRef, areaRef, (id) => !dealHasPremium(deals?.find((d) => `d${d.id}` === id)));

  if (!deals?.length) return null;

  const premium = mode === "premium";
  const changeMode = (m) => {
    if (m === mode) return;
    beforeChange();
    if (m === "premium") setBurst((b) => b + 1);
    setMode(m);
  };
  const shown = (premium ? premiumFirst(deals, dealHasPremium) : deals).slice(0, MAX_HOME);

  return (
    <section aria-labelledby="nocode-title" className="mx-auto max-w-6xl px-4 py-24 sm:py-28">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <SectionHead id="nocode-title" title={t("nocode.title")} sub={t("nocode.sub")} />
        <div ref={toggleRef} className="relative">
          <PremiumToggle value={mode} onChange={changeMode} layoutId="nocode-prem-pill" />
          <GoldBurst fire={burst} />
        </div>
      </div>

      <ModeWaveContext.Provider value={wave}>
      <div ref={areaRef}>
      <NocodeGrid rail className="mt-10">
        {shown.map((d) => (
          <NocodeCard key={d.id} deal={d} premium={premium} unlocked={unlocked} onUnlock={onUnlock} onShowNormal={() => changeMode("normal")} />
        ))}
      </NocodeGrid>
      </div>
      </ModeWaveContext.Provider>
      <DesktopModeSwitch visible={floating} value={mode} onChange={changeMode} layoutId="nocode-prem-pill-desk" />

      <div className="mt-10 flex justify-center">
        <Link
          to={offersLink(lang, { kind: "nocode" })}
          className="group inline-flex items-center gap-2 rounded-2xl border border-[var(--color-ink-line)] bg-[var(--fill)] px-6 py-3.5 text-[15px] font-extrabold text-[var(--text)] transition-colors hover:bg-[var(--fill-strong)]"
        >
          {t("nocode.seeAll")}
          <ArrowLeft size={17} className="transition-transform group-hover:-translate-x-0.5 ltr:rotate-180 ltr:group-hover:translate-x-0.5" />
        </Link>
      </div>
    </section>
  );
}
