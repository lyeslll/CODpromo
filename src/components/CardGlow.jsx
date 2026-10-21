import { useEffect, useRef } from "react";

// ============================================================
//  ضوء البطاقة: بقعة دائرية بلون نوع العرض تتبع المؤشر (نفس تأثير main:
//  radial-gradient 280px بلون glow النوع — 0.35، والذهبي 0.4 — ويظهر عند المرور).
//  في الهاتف: يظهر في موضع اللمس ثم ينطفئ بالتدريج.
//  الموضع عبر متغيّرات CSS (--mx/--my) على كل بقعة — بلا re-render.
// ============================================================

/** بقعة الضوء — توضع داخل كل جزء من التذكرة (فتُقصّ مع شكل الكوبون). الأب يحمل الصنف group. */
export function GlowSpot({ color }) {
  return (
    <span
      data-glow
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      style={{ background: `radial-gradient(280px circle at var(--mx,50%) var(--my,0%), ${color}, transparent 65%)` }}
    />
  );
}

/** يربط بقع البطاقة بالمؤشر: ref للعنصر الأب + معالجات pointer تُمرَّر له. */
export function useCardGlow() {
  const ref = useRef(null);
  const timer = useRef(null);
  const touching = useRef(false);
  useEffect(() => () => clearTimeout(timer.current), []);

  const spots = () => ref.current?.querySelectorAll("[data-glow]") || [];
  const place = (e) => {
    for (const s of spots()) {
      const r = s.getBoundingClientRect();
      s.style.setProperty("--mx", `${e.clientX - r.left}px`);
      s.style.setProperty("--my", `${e.clientY - r.top}px`);
    }
  };
  const light = (on) => {
    for (const s of spots()) {
      s.style.transition = on ? "opacity 120ms ease-out" : "opacity 900ms ease-out";
      s.style.opacity = on ? "1" : "";
    }
  };

  const onPointerMove = (e) => {
    if (e.pointerType === "mouse" || touching.current) place(e);
  };
  const onPointerDown = (e) => {
    if (e.pointerType === "mouse") return;
    clearTimeout(timer.current);
    touching.current = true;
    place(e);
    light(true);
  };
  const release = (e) => {
    if (e.pointerType === "mouse" || !touching.current) return;
    touching.current = false;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => light(false), 250);
  };

  return { ref, handlers: { onPointerMove, onPointerDown, onPointerUp: release, onPointerCancel: release } };
}
