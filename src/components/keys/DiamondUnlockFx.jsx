import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { DiamondKey } from "./DiamondKey.jsx";
import "./keys.css";

// نفس الغطاء المعدني تاع الخدش (CompanyCard → METAL_BG) باش الحركة تتربط معاه
const METAL_BG = {
  background:
    "repeating-linear-gradient(115deg, #c6cbd4 0px, #aab0ba 6px, #d4d9e1 12px, #9aa0aa 18px), linear-gradient(135deg, #c2c7d0, #9aa0aa 40%, #d6dbe3 60%, #8f95a0)",
  backgroundBlendMode: "overlay",
};
const DURATION = 1.15;

/**
 * المفتاح الماسي يفتح الكود (فوق خانة الكود في البطاقة، قبل الخدش): المفتاح يدخل للثقب، يدور (ضغط عمودي
 * يبان كيما دوران)، حلقة ضوء جليدية، والغطاء المعدني يتنحّى على بطاقة الخدش الكاينة. transform / opacity برك
 * (خفيف في الهاتف، بلا filter)؛ prefers-reduced-motion → مباشرة للخدش.
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
    const id = setTimeout(() => doneRef.current?.(), DURATION * 1000 + 60);
    return () => clearTimeout(id);
  }, [reduce]);

  if (reduce) return null;
  // في العربية رأس المفتاح يشير لليسار → يدخل من اليمين (والعكس في en / fr)
  const from = ltr ? "-115%" : "115%";
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-xl"
      style={METAL_BG}
      initial={{ opacity: 1 }}
      animate={{ opacity: [1, 1, 0] }}
      transition={{ duration: DURATION, times: [0, 0.78, 1], ease: "easeOut" }}
    >
      {/* ثقب القفل */}
      <span className="absolute left-1/2 top-1/2 h-[13px] w-[13px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#2f333a]" />
      <motion.span
        className="dk-flash"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 0, 3.4], opacity: [0, 1, 0] }}
        transition={{ duration: DURATION, times: [0, 0.55, 0.85], ease: "easeOut" }}
      />
      <motion.div
        className="absolute left-1/2 top-1/2 w-[96px]"
        style={{ marginLeft: ltr ? -84 : -12, marginTop: -18 }}
        initial={{ x: from, opacity: 0, scaleY: 1 }}
        animate={{ x: [from, "0%", "0%", "0%"], opacity: [0, 1, 1, 0], scaleY: [1, 1, 0.22, 1], rotate: [0, 0, ltr ? 10 : -10, 0] }}
        transition={{ duration: DURATION, times: [0, 0.38, 0.58, 0.82], ease: [0.16, 1, 0.3, 1] }}
      >
        <DiamondKey sparkle flip={ltr} className="h-auto w-full drop-shadow-[0_4px_10px_rgba(80,110,200,0.45)]" />
      </motion.div>
    </motion.div>
  );
}
