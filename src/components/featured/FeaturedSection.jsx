import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import SectionHead from "../landing/SectionHead.jsx";
import PremiumToggle from "../PremiumToggle.jsx";
import GoldBurst from "../GoldBurst.jsx";
import { offersLink } from "../../lib/seo.js";

// المسرح والمؤثرات في chunk منفصل: لا يُحمَّل إلا حين يقترب الزائر من القسم
const FeaturedShowcase = lazy(() => import("./FeaturedShowcase.jsx"));

/**
 * قسم "العروض المميّزة" في الرئيسية (مباشرة تحت شريط الأرقام).
 * العروض يختارها الأدمن (featured_offers)؛ إذا لا يوجد عرض منشور، القسم يختفي.
 * items: [{ company, label }] بالترتيب. مبدّل عادي/Premium يجعل كل الوظائف متاحة.
 */
export default function FeaturedSection({ items, favorites, onToggleFav, onCopy, unlocked, onUnlock }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [mode, setMode] = useState("normal");
  const [burst, setBurst] = useState(0);
  const holderRef = useRef(null);
  const [near, setNear] = useState(false);
  const has = items.length > 0;

  useEffect(() => {
    if (!has || near) return;
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
  }, [has, near]);

  if (!has) return null;

  const changeMode = (m) => {
    if (m === mode) return;
    if (m === "premium") setBurst((b) => b + 1);
    setMode(m);
  };
  const placeholder = <div className="min-h-[640px]" />;

  return (
    <section aria-labelledby="featured-title" className="relative mx-auto max-w-6xl px-4 pb-6 pt-24 sm:pt-28">
      <SectionHead center id="featured-title" title={t("featured.title")} sub={t("featured.sub")} />

      <div className="mt-8 flex justify-center">
        <div className="relative">
          <PremiumToggle value={mode} onChange={changeMode} layoutId="featured-prem-pill" />
          <GoldBurst fire={burst} />
        </div>
      </div>

      <div ref={holderRef} className="relative">
        {near ? (
          <Suspense fallback={placeholder}>
            <FeaturedShowcase
              items={items}
              premiumMode={mode === "premium"}
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
