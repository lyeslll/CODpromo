import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * الكلمة نفسها: C ثابتة، و "OD" ⇄ "ode" تنزلق، و "promo" تتحرك بسلاسة مع تغيّر العرض.
 * قبل: الجزء الوسطاني كان overflow-hidden ويصغر تحت عرض نصّو → الحرف الرابع ("e" تاع Code) يتقصّ في
 * الهاتف وفي بعض المتصفحات. دروك: عرضو يتقاس (بعد ما يتحمّل الخط) ويتحرّك بـ CSS، والقصّ عمودي برك،
 * والخط محسوب على "Code promo" (الأطول) باش الكلمة كاملة تدخل في الشاشة.
 */
function Word({ code, className = "", style }) {
  const { t } = useTranslation();
  const from = t("footer.word.cod");
  const to = t("footer.word.code");
  const aRef = useRef(null);
  const bRef = useRef(null);
  const [w, setW] = useState(null);
  useLayoutEffect(() => {
    const measure = () => {
      const fw = aRef.current?.offsetWidth || 0;
      const tw = bRef.current?.offsetWidth || 0;
      if (fw && tw) setW({ from: fw, to: tw });
    };
    measure();
    document.fonts?.ready?.then(measure);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (ro && aRef.current) ro.observe(aRef.current);
    return () => ro?.disconnect();
  }, [from, to]);
  const ease = "cubic-bezier(0.16, 1, 0.3, 1)";
  const part = (on) => ({
    display: "inline-block",
    position: on ? "relative" : "absolute",
    insetInlineStart: 0,
    top: on ? 0 : "0.08em", // الجزء المخبّي فوق نفس السطر (نفس الحشو تاع الحاوية)
    transform: on ? "translateY(0)" : code ? "translateY(-75%)" : "translateY(75%)",
    opacity: on ? 1 : 0,
    transition: `transform 0.5s ${ease}, opacity 0.5s ${ease}`,
  });
  return (
    <div
      className={`flex items-baseline justify-center whitespace-nowrap font-black leading-[0.86] tracking-[-0.05em] [font-family:Inter,sans-serif] ${className}`}
      style={{ fontSize: "clamp(44px, 15.5vw, 260px)", ...style }}
    >
      <span>{from.charAt(0)}</span>
      {/* مع "Code" تنفتح مسافة صغيرة قبل promo: "Code promo" */}
      <span
        className="relative inline-block py-[0.08em]"
        style={{
          width: w ? (code ? w.to : w.from) : undefined,
          marginInlineEnd: code ? "0.2em" : 0,
          clipPath: "inset(0 -0.6em)",
          transition: `width 0.5s ${ease}, margin 0.5s ${ease}`,
        }}
      >
        <span ref={aRef} aria-hidden={code} style={part(!code)}>
          {from.slice(1)}
        </span>
        <span ref={bRef} aria-hidden={!code} style={part(code)}>
          {to.slice(1)}
        </span>
      </span>
      <span>{t("footer.word.promo")}</span>
    </div>
  );
}

/**
 * "CODpromo" ضخمة بعرض الصفحة (نص فقط، ليس ملف الشعار): حدود باهتة، وتحت الفأرة
 * تتعمّر بالليموني في موضعها (قناع دائري يتبع المؤشر عبر متغيّرات CSS، بلا re-render)،
 * ومع المرور تتحوّل "COD" إلى "Code" (قصة الاسم). اللمس: نقرة تُبدّل وتضيء موضعها.
 */
export default function Wordmark() {
  const ref = useRef(null);
  const timer = useRef(null);
  const [code, setCode] = useState(false);
  const [lit, setLit] = useState(false);
  useEffect(() => () => clearTimeout(timer.current), []);

  const place = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  return (
    <div
      ref={ref}
      aria-hidden
      dir="ltr"
      onPointerEnter={(e) => {
        if (e.pointerType !== "mouse") return;
        place(e);
        setCode(true);
        setLit(true);
      }}
      onPointerMove={(e) => e.pointerType === "mouse" && place(e)}
      onPointerLeave={(e) => {
        if (e.pointerType !== "mouse") return;
        setCode(false);
        setLit(false);
      }}
      onPointerDown={(e) => {
        if (e.pointerType === "mouse") return;
        place(e);
        setCode((v) => !v);
        setLit(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setLit(false), 1600);
      }}
      className="relative mx-auto mt-14 max-w-[1600px] cursor-default select-none overflow-hidden px-2 pb-5 sm:pb-8"
    >
      {/* الحدّ خلف التعبئة (paint-order) بلون الخلفية: يختفي تداخل خطوط الحروف من الداخل */}
      <Word code={code} className="text-[var(--color-ink)] [-webkit-text-stroke:3px_rgba(255,255,255,0.14)] [paint-order:stroke_fill]" />
      <Word
        code={code}
        className="pointer-events-none absolute inset-0 px-2 text-[var(--color-lime)] transition-opacity duration-500"
        style={{
          opacity: lit ? 1 : 0,
          textShadow: "0 0 40px rgba(166,240,0,0.35)",
          WebkitMaskImage: "radial-gradient(260px circle at var(--mx, 50%) var(--my, 50%), #000 22%, transparent 72%)",
          maskImage: "radial-gradient(260px circle at var(--mx, 50%) var(--my, 50%), #000 22%, transparent 72%)",
        }}
      />
    </div>
  );
}
