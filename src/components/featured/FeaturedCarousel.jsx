import { useCallback, useEffect, useRef, useState } from "react";
import { useInView, useMotionValue, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import FeaturedFrame from "./FeaturedFrame.jsx";
import { askOrientationOnce, clamp } from "./hooks.js";

const GAP = 12;

/**
 * شرائح بالسحب (scroll-snap أصلي — بلا JS في الحركة): البطاقة في الوسط تكبر وتضيء،
 * والجيران أصغر وأخفت. الميلان بالهاتف (gyro) على البطاقة النشطة فقط.
 * width = عرض الحاوية (يقيسه الأب)؛ bleed = الشرائح تصل لحافتي الشاشة (-mx-4).
 */
export default function FeaturedCarousel({ items, tones, fx, renderCard, width, gyro = false, bleed = true }) {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const trackRef = useRef(null);
  const raf = useRef(0);
  const [active, setActive] = useState(0);
  const nx = useMotionValue(0);
  const ny = useMotionValue(0);
  const inView = useInView(trackRef, { amount: 0.3 });

  const full = bleed ? width + 32 : width;
  // 84% من العرض (يطلّ الجاران)، لكن لا أقل من 300px (عرض بطاقة /offers في هاتف 320px) ولا أكثر من 360px
  const slideW = Math.round(Math.min(Math.max(full * 0.84, Math.min(300, full)), 360));
  const spacer = Math.max(0, Math.round((full - slideW) / 2) - GAP);

  // النشطة = الأقرب للوسط، من موضع التمرير مباشرة (الشريحة i في الوسط عند |scrollLeft| = i × الخطوة؛
  // |…| لأن scrollLeft سالب في RTL). مرة واحدة لكل إطار أثناء التمرير.
  const n = items.length;
  const measure = useCallback(() => {
    raf.current = 0;
    const el = trackRef.current;
    if (!el) return;
    const best = Math.max(0, Math.min(n - 1, Math.round(Math.abs(el.scrollLeft) / (slideW + GAP))));
    setActive((a) => (a === best ? a : best));
  }, [n, slideW]);
  const onScroll = () => {
    if (!raf.current) raf.current = requestAnimationFrame(measure);
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const scrollToSlide = (i) => {
    const el = trackRef.current;
    const s = el?.querySelectorAll("[data-slide]")[i];
    if (!s) return;
    const r = el.getBoundingClientRect();
    const b = s.getBoundingClientRect();
    el.scrollBy({ left: b.left + b.width / 2 - (r.left + r.width / 2), behavior: reduced ? "auto" : "smooth" });
  };

  // ميلان الهاتف: فقط والقسم في الشاشة (المرجع = وضعية الهاتف عند أول قراءة)
  useEffect(() => {
    if (!gyro || !fx || !inView) return;
    let base = null;
    const onOri = (e) => {
      if (e.gamma == null || e.beta == null) return;
      if (base == null) base = e.beta;
      nx.set(clamp(e.gamma / 24));
      ny.set(clamp((e.beta - base) / 24));
    };
    window.addEventListener("deviceorientation", onOri);
    return () => {
      window.removeEventListener("deviceorientation", onOri);
      nx.set(0);
      ny.set(0);
    };
  }, [gyro, fx, inView, nx, ny]);

  return (
    <div className={bleed ? "-mx-4" : ""}>
      <div
        ref={trackRef}
        onScroll={onScroll}
        onTouchEnd={gyro && fx ? askOrientationOnce : undefined}
        className="fx-track is-emph no-scrollbar flex overflow-x-auto py-8"
        style={{ gap: GAP }}
      >
        <span aria-hidden className="shrink-0" style={{ width: spacer }} />
        {items.map((it, i) => (
          <div key={it.company.id} data-slide className="fx-slide shrink-0" style={{ width: slideW }}>
            <div className={`fx-slide-in ${i === active ? "is-active" : i < active ? "is-before" : "is-after"}`}>
              <FeaturedFrame tone={tones[i]} label={it.label} lit={i === active} fx={fx} tilt={gyro && i === active} nx={nx} ny={ny}>
                {renderCard(it, i)}
              </FeaturedFrame>
            </div>
          </div>
        ))}
        <span aria-hidden className="shrink-0" style={{ width: spacer }} />
      </div>

      {items.length > 1 && (
        <div className="flex items-center justify-center gap-1">
          {items.map((it, i) => (
            <button
              key={it.company.id}
              type="button"
              onClick={() => scrollToSlide(i)}
              aria-label={t("featured.goTo", { name: it.company.name })}
              aria-current={i === active || undefined}
              className="grid h-7 place-items-center px-1"
            >
              <span
                className="block h-2 rounded-full transition-[width,background-color] duration-300"
                style={{ width: i === active ? 22 : 8, background: i === active ? tones[i].color : "rgba(255,255,255,0.22)" }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
