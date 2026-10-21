import { useLayoutEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useTranslation } from "react-i18next";

// القطع التي تنفتح/تنغلق (تُقاس بعرضها الطبيعي بنفس الخط)
const PIECES = { ash: "ash", n: "n", elivery: "elivery", sp: " ", e: "e", promo: "promo" };

/** قطعة نص عرضها يتحرك (0 ↔ عرضها الطبيعي) فتدفع ما بعدها. */
function Piece({ text, width, opacity, className = "", style }) {
  return (
    <motion.span className={`inline-block overflow-hidden whitespace-pre align-bottom ${className}`} style={{ width, opacity, ...style }}>
      {text}
    </motion.span>
  );
}

/**
 * 5.4 — قصة الاسم مع التمرير (طباعة فقط، بلا تعديل ملف اللوغو):
 * CODpromo ← "COD" تنفتح إلى Cash On Delivery ثم ترجع ← يدخل حرف "e" فتُقرأ "Code promo"
 * ← الخلاصة: أكواد برومو لتجّار الدفع عند الاستلام.
 */
export default function NameStory() {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  if (reduced) return <StaticStory t={t} />;
  return <ScrollStory t={t} />;
}

function StaticStory({ t }) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-24 text-center" aria-label={t("story.label")}>
      <p className="text-[15px] font-semibold text-[var(--color-mute)]">{t("story.intro")}</p>
      <p dir="ltr" className="mt-6 text-[56px] font-black leading-none tracking-tight [font-family:Inter,sans-serif] sm:text-[96px]">
        COD<span className="text-[var(--color-lime)]">promo</span>
      </p>
      <p dir="ltr" className="mt-6 text-[22px] font-extrabold [font-family:Inter,sans-serif] sm:text-[30px]">
        Cash On Delivery
      </p>
      {t("story.codMeaning") && <p className="mt-1 text-[17px] font-bold text-[var(--text-soft)]">{t("story.codMeaning")}</p>}
      <p className="mt-3 text-[18px] font-bold text-[var(--text-soft)]">{t("story.readAs")}</p>
      <p className="mx-auto mt-10 max-w-2xl text-balance text-[26px] font-black leading-snug sm:text-[36px]">{t("story.conclusion")}</p>
    </section>
  );
}

function ScrollStory({ t }) {
  const ref = useRef(null);
  const boxRef = useRef(null);
  const measureRefs = useRef({});
  const [w, setW] = useState({ ash: 0, n: 0, elivery: 0, sp: 0, e: 0, promo: 0, base: 0, box: 0 });

  // قياس العروض الطبيعية للقطع + المساحة المتاحة (يتحدّث مع تغيّر المقاس/الخط)
  useLayoutEffect(() => {
    const measure = () => {
      const m = {};
      for (const k of Object.keys(PIECES)) m[k] = measureRefs.current[k]?.offsetWidth || 0;
      m.base = measureRefs.current.base?.offsetWidth || 0;
      m.box = boxRef.current?.offsetWidth || 0;
      setW(m);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (boxRef.current) ro.observe(boxRef.current);
    document.fonts?.ready?.then(measure).catch(() => {});
    return () => ro.disconnect();
  }, []);

  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start start", "end end"] });

  // المراحل: ظهور → انفتاح COD → رجوع → دخول e → الخلاصة.
  // كل المدى من 0 إلى 1 صراحةً: framer يشغّل الشفافية على scroll timeline أصلي، وأي
  // مدى لا يبدأ بـ0 أو لا ينتهي بـ1 يرجع للقيمة الأصلية بعده (يختفي النص من جديد).
  const open = [0, 0.12, 0.24, 0.4, 0.5, 1];
  const ash = useTransform(p, open, [0, 0, w.ash, w.ash, 0, 0]);
  const n = useTransform(p, open, [0, 0, w.n, w.n, 0, 0]);
  const elivery = useTransform(p, open, [0, 0, w.elivery, w.elivery, 0, 0]);
  const sp = useTransform(p, open, [0, 0, w.sp, w.sp, 0, 0]);
  const promoW = useTransform(p, [0, 0.12, 0.22, 0.42, 0.52, 1], [w.promo, w.promo, 0, 0, w.promo, w.promo]);
  const promoOp = useTransform(p, [0, 0.12, 0.2, 0.44, 0.52, 1], [1, 1, 0, 0, 1, 1]);
  const eW = useTransform(p, [0, 0.56, 0.66, 1], [0, 0, w.e, w.e]);
  const eSp = useTransform(p, [0, 0.56, 0.66, 1], [0, 0, w.sp, w.sp]);
  const eOp = useTransform(p, [0, 0.56, 0.64, 1], [0, 0, 1, 1]);

  // تصغير الكلمة إن لم تتّسع الشاشة (الهاتف) — مجموع العروض الحالية مقابل المتاح
  const scale = useTransform(() => {
    const total = w.base + ash.get() + n.get() + elivery.get() + sp.get() * 2 + promoW.get() + eW.get() + eSp.get();
    if (!total || !w.box) return 1;
    return Math.min(1, (w.box * 0.94) / total);
  });

  // الكلمة ظاهرة منذ دخول القسم (لا فراغ أسود قبل بدء الحركة)
  const appear = useTransform(p, [0, 1], [1, 1]);
  const appearY = useTransform(p, [0, 1], [0, 0]);
  const codMeaningOp = useTransform(p, [0, 0.2, 0.26, 0.38, 0.44, 1], [0, 0, 1, 1, 0, 0]);
  const readOp = useTransform(p, [0, 0.62, 0.7, 0.84, 0.9, 1], [0, 0, 1, 1, 0.35, 0.35]);
  const finalOp = useTransform(p, [0, 0.78, 0.88, 1], [0, 0, 1, 1]);
  const finalY = useTransform(p, [0, 0.78, 0.88, 1], [24, 24, 0, 0]);
  const codMeaning = t("story.codMeaning");

  const wordCls = "[font-family:Inter,sans-serif] font-black tracking-tight";

  return (
    <section ref={ref} className="relative h-[250vh]" aria-label={t("story.label")}>
      <div className="sticky top-0 flex h-[100svh] flex-col items-center justify-center overflow-hidden px-4 text-center">
        <motion.p style={{ opacity: appear }} className="text-[15px] font-semibold text-[var(--color-mute)]">
          {t("story.intro")}
        </motion.p>

        <div ref={boxRef} className="mt-6 flex w-full max-w-6xl justify-center">
          <motion.div
            dir="ltr"
            style={{ scale, opacity: appear, y: appearY }}
            className={`${wordCls} flex items-end whitespace-nowrap text-[clamp(52px,13vw,150px)] leading-[1.05]`}
            aria-hidden
          >
            <span>C</span>
            <Piece text="ash" width={ash} />
            <Piece text={PIECES.sp} width={sp} />
            <span>O</span>
            <Piece text="n" width={n} />
            <Piece text={PIECES.sp} width={sp} />
            <span>D</span>
            <Piece text="elivery" width={elivery} />
            <Piece text="e" width={eW} opacity={eOp} className="text-[var(--color-lime)]" />
            <Piece text={PIECES.sp} width={eSp} />
            <Piece text="promo" width={promoW} opacity={promoOp} className="text-[var(--color-lime)]" />
          </motion.div>
        </div>
        {/* نسخة مقروءة لقارئات الشاشة */}
        <span className="sr-only">{`CODpromo — Cash On Delivery — Code promo. ${t("story.conclusion")}`}</span>

        <div className="relative mt-6 h-[64px] w-full max-w-3xl sm:h-[72px]">
          {codMeaning && (
            <motion.p style={{ opacity: codMeaningOp }} className="absolute inset-x-0 top-0 text-[20px] font-extrabold text-[var(--text-softer)] sm:text-[26px]">
              {codMeaning}
            </motion.p>
          )}
          <motion.p style={{ opacity: readOp }} className="absolute inset-x-0 top-0 text-[20px] font-extrabold text-[var(--text-softer)] sm:text-[26px]">
            {t("story.readAs")}
          </motion.p>
        </div>

        <motion.p
          style={{ opacity: finalOp, y: finalY }}
          className="mx-auto mt-4 max-w-3xl text-balance text-[28px] font-black leading-[1.25] tracking-tight sm:text-[42px]"
        >
          {t("story.conclusion")}
        </motion.p>

        {/* قياس خفي بنفس الخط والمقاس */}
        <div aria-hidden className={`${wordCls} pointer-events-none invisible absolute flex whitespace-pre text-[clamp(52px,13vw,150px)]`}>
          <span ref={(el) => (measureRefs.current.base = el)}>COD</span>
          {Object.entries(PIECES).map(([k, v]) => (
            <span key={k} ref={(el) => (measureRefs.current[k] = el)}>
              {v}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
