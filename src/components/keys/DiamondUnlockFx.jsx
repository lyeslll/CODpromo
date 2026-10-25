import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { DiamondKey } from "./DiamondKey.jsx";
import "./keys.css";

// نفس الغطاء المعدني تاع الخدش (CompanyCard → METAL_BG) باش الحركة تتربط معاه
const METAL_BG = {
  background:
    "repeating-linear-gradient(115deg, #c6cbd4 0px, #aab0ba 6px, #d4d9e1 12px, #9aa0aa 18px), linear-gradient(135deg, #c2c7d0, #9aa0aa 40%, #d6dbe3 60%, #8f95a0)",
  backgroundBlendMode: "overlay",
};
const DURATION_MS = 1250;

/**
 * المفتاح الماسي يفتح الكود (فوق خانة الكود في البطاقة، قبل الخدش): المفتاح يدخل للثقب، يدور (ضغط عمودي
 * يبان كيما دوران)، حلقة ضوء جليدية، والغطاء المعدني يتنحّى على بطاقة الخدش الكاينة.
 * CSS keyframes برك (transform / opacity، بلا filter) — خفيف في الهاتف؛ prefers-reduced-motion → مباشرة للخدش.
 */
export default function DiamondUnlockFx({ onDone }) {
  const { i18n } = useTranslation();
  const reduce = useReducedMotion();
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const ltr = i18n.dir() === "ltr";

  useEffect(() => {
    if (reduce) {
      doneRef.current?.();
      return;
    }
    const id = setTimeout(() => doneRef.current?.(), DURATION_MS + 50);
    return () => clearTimeout(id);
  }, [reduce]);

  if (reduce) return null;
  // في العربية رأس المفتاح يشير لليسار → يدخل من اليمين (والعكس في en / fr)؛ الرأس يوقف على الثقب
  return (
    <div aria-hidden className="dk-fx pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-xl" style={{ ...METAL_BG, "--dk-ms": `${DURATION_MS}ms` }}>
      <span className="absolute left-1/2 top-1/2 h-[13px] w-[13px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#2f333a]" />
      <span className="dk-flash" />
      <div
        className="dk-key absolute top-1/2 w-[96px]"
        style={{ left: ltr ? "calc(50% - 89px)" : "calc(50% - 7px)", marginTop: -18, "--dk-from": ltr ? "-120%" : "120%", "--dk-rot": ltr ? "10deg" : "-10deg", "--dk-origin": ltr ? "92% 50%" : "8% 50%" }}
      >
        <DiamondKey sparkle flip={ltr} className="h-auto w-full drop-shadow-[0_4px_10px_rgba(80,110,200,0.45)]" />
      </div>
    </div>
  );
}
