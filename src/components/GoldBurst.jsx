import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

// ألوان هوية Premium الذهبية
const COLORS = ["#ffe486", "#f0c63c", "#cf9a1e", "#fff4c2"];

/**
 * جزيئات ذهبية خفيفة تنفجر من مركز العنصر الأب عند التحوّل إلى Premium.
 * fire: رقم يزيد عند كل تحوّل (التغيّر فقط يطلق الانفجار، لا التحميل الأول).
 * لا شيء مع prefers-reduced-motion. العنصر الأب يحتاج position غير static.
 */
export default function GoldBurst({ fire, count = 16, spread = 1 }) {
  const reduce = useReducedMotion();
  const [bursts, setBursts] = useState([]);
  const timers = useRef([]);
  const lastFire = useRef(fire);

  useEffect(() => {
    if (fire === lastFire.current) return;
    lastFire.current = fire;
    if (reduce) return;
    const id = `${fire}-${Date.now()}`;
    const parts = Array.from({ length: count }, (_, i) => {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.45;
      const d = (30 + Math.random() * 48) * spread;
      return {
        x: Math.cos(a) * d,
        y: Math.sin(a) * d,
        s: 3 + Math.random() * 4,
        c: COLORS[i % COLORS.length],
        delay: Math.random() * 0.08,
      };
    });
    setBursts((b) => [...b, { id, parts }]);
    timers.current.push(setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 1100));
  }, [fire, count, spread, reduce]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  if (!bursts.length) return null;
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 z-30 overflow-visible">
      {bursts.map((b) =>
        b.parts.map((p, i) => (
          <motion.span
            key={`${b.id}-${i}`}
            className="absolute left-1/2 top-1/2 rounded-full"
            style={{
              width: p.s,
              height: p.s,
              marginLeft: -p.s / 2,
              marginTop: -p.s / 2,
              background: p.c,
              boxShadow: `0 0 8px ${p.c}`,
            }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: p.x, y: p.y, opacity: 0, scale: 0.2 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: p.delay }}
          />
        ))
      )}
    </span>
  );
}
