import { useEffect, useRef } from "react";

// شرط التفعيل: فأرة حقيقية (ليس الهاتف/اللمس) وبلا تقليل الحركة
const QUERY = "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)";

/**
 * ضوء ليموني خفيف جداً يتبع الفأرة فوق الخلفية السوداء في كل الصفحات (الحاسوب فقط).
 * - تحت كل المحتوى (z-index سالب)؛ ولأن غلاف الصفحة أسود معتم، يصير شفافاً ما دام الضوء مفعّلاً
 *   (صنف html.cursor-glow في index.css) — لون body نفسه أسود، فلا يتغيّر شيء آخر.
 * - يلحق المؤشر بتأخير صغير (lerp في requestAnimationFrame) عبر متغيّرات CSS، بلا re-render.
 * - أخف بكثير من ضوء البطاقات (0.05 مقابل 0.35) حتى لا يتنافسا.
 */
export default function CursorGlow() {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mq = window.matchMedia(QUERY);
    const root = document.documentElement;
    let raf = 0;
    let shown = false;
    let cx = 0;
    let cy = 0;
    let tx = 0;
    let ty = 0;

    const step = () => {
      cx += (tx - cx) * 0.14;
      cy += (ty - cy) * 0.14;
      el.style.setProperty("--cx", `${cx.toFixed(1)}px`);
      el.style.setProperty("--cy", `${cy.toFixed(1)}px`);
      raf = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.4 ? requestAnimationFrame(step) : 0;
    };
    const onMove = (e) => {
      if (e.pointerType !== "mouse") return;
      tx = e.clientX;
      ty = e.clientY;
      if (!shown) {
        cx = tx;
        cy = ty;
        shown = true;
        el.style.opacity = "1";
      }
      if (!raf) raf = requestAnimationFrame(step);
    };
    const hide = () => {
      shown = false;
      el.style.opacity = "";
    };
    // خروج الفأرة من النافذة
    const onOut = (e) => !e.relatedTarget && hide();

    const start = () => {
      root.classList.add("cursor-glow");
      window.addEventListener("pointermove", onMove, { passive: true });
      document.addEventListener("pointerout", onOut);
    };
    const stop = () => {
      root.classList.remove("cursor-glow");
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerout", onOut);
      cancelAnimationFrame(raf);
      raf = 0;
      hide();
    };
    const sync = () => (mq.matches ? start() : stop());
    sync();
    mq.addEventListener("change", sync);
    return () => {
      mq.removeEventListener("change", sync);
      stop();
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 h-[640px] w-[640px] rounded-full opacity-0 transition-opacity duration-700"
      style={{
        zIndex: -1,
        background: "radial-gradient(circle closest-side, rgba(166,240,0,0.05), rgba(166,240,0,0.02) 50%, transparent)",
        transform: "translate3d(calc(var(--cx, -9999px) - 50%), calc(var(--cy, -9999px) - 50%), 0)",
        willChange: "transform",
      }}
    />
  );
}
