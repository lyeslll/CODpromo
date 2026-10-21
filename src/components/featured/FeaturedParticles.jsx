import { useEffect, useRef } from "react";

/**
 * غبار ضوء خفيف يصعد داخل مخروط المصباح (Canvas 2D).
 * DPR محدود بـ 1.5، يتوقف خارج الشاشة وعند إخفاء التبويب، ولا يُركَّب أصلاً
 * في النسخة الخفيفة (prefers-reduced-motion / جهاز ضعيف).
 */
export default function FeaturedParticles({ color = "#ffffff", count = 40 }) {
  const ref = useRef(null);
  const colorRef = useRef(color);
  colorRef.current = color;

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const parts = Array.from({ length: count }, () => ({}));
    let w = 0;
    let h = 0;
    let raf = 0;
    let last = 0;
    let visible = false;

    const spawn = (p, anywhere) => {
      p.y = anywhere ? Math.random() * h : h * (0.78 + Math.random() * 0.22);
      p.u = Math.random() * 2 - 1; // الموضع النسبي داخل عرض المخروط
      p.r = 0.6 + Math.random() * 1.5;
      p.vy = 7 + Math.random() * 16; // بكسل/ثانية نحو الأعلى
      p.sway = 4 + Math.random() * 10;
      p.ph = Math.random() * Math.PI * 2;
      p.tw = 0.6 + Math.random() * 1.5;
      p.tint = Math.random() < 0.35;
      p.a = 0.25 + Math.random() * 0.45;
    };
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = r.width;
      h = r.height;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      for (const p of parts) spawn(p, true);
    };
    // نصف عرض المخروط عند الارتفاع y (ضيّق عند المصباح، واسع عند الأرضية)
    const halfAt = (y) => w * (0.06 + 0.34 * (y / h));

    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - (last || now)) / 1000);
      last = now;
      const t = now / 1000;
      const tint = colorRef.current;
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        p.y -= p.vy * dt;
        if (p.y < -4) spawn(p, false);
        const y = Math.max(0, p.y);
        const fade = Math.min(1, y / (h * 0.16)) * Math.min(1, (h - y) / (h * 0.14));
        const alpha = p.a * fade * (0.55 + 0.45 * Math.sin(t * p.tw + p.ph));
        if (alpha <= 0.01) continue;
        const x = w / 2 + p.u * halfAt(y) + Math.sin(t * 0.5 + p.ph) * p.sway;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.tint ? tint : "#fff8e6";
        ctx.beginPath();
        ctx.arc(x, y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };
    const sync = () => {
      const run = visible && !document.hidden;
      if (run && !raf) {
        last = 0;
        raf = requestAnimationFrame(frame);
      } else if (!run && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      sync();
    });
    io.observe(canvas);
    document.addEventListener("visibilitychange", sync);
    return () => {
      cancelAnimationFrame(raf);
      raf = 0;
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [count]);

  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />;
}
