import { useLayoutEffect, useState } from "react";

export const clamp = (v) => Math.max(-1, Math.min(1, v));

/** عرض العنصر بالبكسل (قراءة فورية عند التركيب ثم ResizeObserver). */
export function useElementWidth(ref) {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(Math.round(el.getBoundingClientRect().width));
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

let orientationAsked = false;

/** iOS 13+: إذن ميلان الهاتف يُطلب مرّة واحدة داخل لمسة المستخدم (touchend). */
export function askOrientationOnce() {
  if (orientationAsked) return;
  orientationAsked = true;
  try {
    const D = window.DeviceOrientationEvent;
    if (D && typeof D.requestPermission === "function") D.requestPermission().catch(() => {});
  } catch {
    /* غير مدعوم */
  }
}
