// ============================================================
//  هل نحمّل نسخة الـ 3D؟ لا مع prefers-reduced-motion، ولا مع توفير البيانات
//  أو اتصال 2G، ولا على الهواتف الضعيفة (ذاكرة/أنوية قليلة)، ولا بلا WebGL.
//  أجهزة iOS لا تكشف الذاكرة وتُقيّد عدد الأنوية، فنكتفي بفحص WebGL لها.
// ============================================================

export function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function isIOS() {
  const ua = navigator.userAgent || "";
  return /iP(hone|ad|od)/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function canUse3D() {
  if (typeof window === "undefined") return false;
  try {
    if (prefersReducedMotion()) return false;
    const n = navigator;
    if (n.connection?.saveData) return false;
    if (/(^|-)2g$/.test(n.connection?.effectiveType || "")) return false;
    if (!isIOS()) {
      if (typeof n.deviceMemory === "number" && n.deviceMemory < 4) return false;
      if (typeof n.hardwareConcurrency === "number" && n.hardwareConcurrency < 4) return false;
    }
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}
