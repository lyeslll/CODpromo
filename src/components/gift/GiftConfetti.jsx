import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

// ألوان Premium الذهبية + ورقي فاتح
const COLORS = ["#ffe486", "#f0c63c", "#cf9a1e", "#fff4c2", "#ffffff"];
const COUNT = 150;
const LIFE_MS = 3400;

/**
 * قصاصات ذهبية تنفجر مرة وحدة (Canvas بكامل الشاشة، بلا تفاعل).
 * fire: رقم يزيد عند كل احتفال (0 = لا شيء). origin: نقطة الانفجار بالنسبة للشاشة (0..1).
 * prefers-reduced-motion → لا شيء. الحلقة تتوقّف وحدها وتنظّف الكانفاس.
 */
export default function GiftConfetti({ fire, origin = { x: 0.5, y: 0.34 } }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!fire || reduce) return;
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const ox = origin.x * w;
    const oy = origin.y * h;
    const power = Math.min(w, 900) / 900;
    const parts = Array.from({ length: COUNT }, () => {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.15;
      const sp = (7 + Math.random() * 9) * (0.65 + power * 0.55);
      return {
        x: ox + (Math.random() - 0.5) * 30,
        y: oy + (Math.random() - 0.5) * 16,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        w: 5 + Math.random() * 6,
        h: 3 + Math.random() * 5,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.32,
        flip: Math.random() * Math.PI * 2,
        vf: 0.08 + Math.random() * 0.12,
        round: Math.random() < 0.28,
        color: COLORS[(Math.random() * COLORS.length) | 0],
      };
    });

    let raf = 0;
    const start = performance.now();
    let last = start;
    const step = (now) => {
      const dt = Math.min(2.4, (now - last) / 16.67);
      last = now;
      const t = now - start;
      ctx.clearRect(0, 0, w, h);
      const fade = t > LIFE_MS - 700 ? Math.max(0, (LIFE_MS - t) / 700) : 1;
      for (const p of parts) {
        p.vy += 0.26 * dt;
        p.vx *= Math.pow(0.985, dt);
        p.vy *= Math.pow(0.985, dt);
        p.x += p.vx * dt + Math.sin(p.flip) * 0.6;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        p.flip += p.vf * dt;
        if (p.y > h + 20) continue;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, Math.cos(p.flip));
        ctx.fillStyle = p.color;
        if (p.round) {
          ctx.beginPath();
          ctx.arc(0, 0, p.h * 0.6, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
        ctx.restore();
      }
      if (t < LIFE_MS) raf = requestAnimationFrame(step);
      else ctx.clearRect(0, 0, w, h);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      ctx.clearRect(0, 0, w, h);
    };
  }, [fire, reduce]); // eslint-disable-line react-hooks/exhaustive-deps

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-[120] h-full w-full" />;
}
