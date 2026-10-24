import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import SectionHead from "../landing/SectionHead.jsx";
import PremiumToggle from "../PremiumToggle.jsx";
import GoldBurst from "../GoldBurst.jsx";
import { offersLink } from "../../lib/seo.js";
import FeaturedMobileCarousel from "./FeaturedMobileCarousel.jsx";
import { useMobileFx } from "./mobile.js";
import { ModeWaveContext, useWaveSwitch, useFloatingSwitch } from "../../lib/modeWave.jsx";
import DesktopModeSwitch from "../DesktopModeSwitch.jsx";

// المسرح والمؤثرات (الكمبيوتر فقط) في chunk منفصل: لا يُحمَّل إلا حين يقترب الزائر من القسم
const FeaturedShowcase = lazy(() => import("./FeaturedShowcase.jsx"));

/**
 * قسم "العروض المميّزة" في الرئيسية (مباشرة تحت شريط الأرقام).
 * العروض يختارها الأدمن (featured_offers)؛ إذا لا يوجد عرض منشور، القسم يختفي.
 * items: [{ company, label }] بالترتيب. مبدّل عادي/Premium يجعل كل الوظائف متاحة.
 * الموبايل (أقل من 1024px أو لمس): شريط سحب خفيف بلا مؤثرات، ولا يُحمَّل الـ 3D أصلاً.
 */
export default function FeaturedSection({ items, favorites, onToggleFav, onCopy, unlocked, onUnlock, pending = false }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [mode, setMode] = useState("normal");
  const [burst, setBurst] = useState(0);
  const holderRef = useRef(null);
  const [near, setNear] = useState(false);
  const mobile = useMobileFx();
  const has = items.length > 0;
  // موجة التبديل + مبدّل عائم في الكمبيوتر (lib/modeWave.jsx)
  const toggleRef = useRef(null);
  const floating = useFloatingSwitch(toggleRef, holderRef, has);
  const { wave } = useWaveSwitch(mode === "premium", holderRef);

  useEffect(() => {
    if (!has || near || mobile) return;
    const el = holderRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        setNear(true);
        io.disconnect();
      },
      { rootMargin: "400px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [has, near, mobile]);

  // البيانات مازالت جاية: نفس القسم بنفس الطول تقريباً (بلاه يدخل ~800px فوق قسم القصة ويدفع الصفحة)
  if (!has && pending) {
    return (
      <section aria-hidden className="relative mx-auto max-w-6xl px-4 pb-6 pt-24 sm:pt-28">
        <SectionHead center title={t("featured.title")} sub={t("featured.sub")} />
        <div className="mt-8 flex justify-center">
          <div className="h-11 w-56 rounded-full border border-[var(--color-ink-line)] bg-[var(--fill)]" />
        </div>
        <div className="mx-auto mt-6 h-[560px] w-full max-w-[400px] animate-pulse rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] lg:h-[640px] lg:max-w-none lg:bg-transparent lg:border-transparent" />
      </section>
    );
  }
  if (!has) return null;

  const changeMode = (m) => {
    if (m === mode) return;
    if (m === "premium") setBurst((b) => b + 1);
    setMode(m);
  };
  const placeholder = <div className="min-h-[640px]" />;
  // نفس الترتيب في العادي و Premium (المجمّدة تتجمّد في بلاصتها)
  const shown = items;
  const showNormal = () => changeMode("normal");

  return (
    <section aria-labelledby="featured-title" className="relative mx-auto max-w-6xl px-4 pb-6 pt-24 sm:pt-28">
      <SectionHead center id="featured-title" title={t("featured.title")} sub={t("featured.sub")} />

      <div className="mt-8 flex justify-center">
        <div ref={toggleRef} className="relative">
          <PremiumToggle value={mode} onChange={changeMode} layoutId="featured-prem-pill" />
          <GoldBurst fire={burst} />
        </div>
      </div>

      <ModeWaveContext.Provider value={wave}>
      <div ref={holderRef} className="relative">
        {mobile ? (
          <FeaturedMobileCarousel
            items={shown}
            premiumMode={mode === "premium"}
            onShowNormal={showNormal}
            favorites={favorites}
            onToggleFav={onToggleFav}
            onCopy={onCopy}
            unlocked={unlocked}
            onUnlock={onUnlock}
          />
        ) : near ? (
          <Suspense fallback={placeholder}>
            <FeaturedShowcase
              items={shown}
              premiumMode={mode === "premium"}
              onShowNormal={showNormal}
              favorites={favorites}
              onToggleFav={onToggleFav}
              onCopy={onCopy}
              unlocked={unlocked}
              onUnlock={onUnlock}
            />
          </Suspense>
        ) : (
          placeholder
        )}
      </div>
      </ModeWaveContext.Provider>
      <DesktopModeSwitch visible={floating} value={mode} onChange={changeMode} layoutId="featured-prem-pill-desk" />

      <div className="mt-8 flex justify-center">
        <Link
          to={offersLink(lang, { featured: "1" })}
          className="group inline-flex items-center gap-2 rounded-2xl border border-[var(--color-ink-line)] bg-[var(--fill)] px-6 py-3.5 text-[15px] font-extrabold text-[var(--text)] transition-colors hover:bg-[var(--fill-strong)]"
        >
          {t("featured.cta")}
          <ArrowLeft size={17} className="transition-transform group-hover:-translate-x-0.5 ltr:rotate-180 ltr:group-hover:translate-x-0.5" />
        </Link>
      </div>
    </section>
  );
}
