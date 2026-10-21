// ============================================================
//  هل نشغّل المؤثرات الكاملة (3D بـ CSS، ميلان، جزيئات، لمعة متحركة)؟
//  لا مع prefers-reduced-motion، ولا مع توفير البيانات أو 2G، ولا على الأجهزة
//  الضعيفة (ذاكرة/أنوية قليلة). iOS لا يكشف الذاكرة فنعتبره قادراً.
//  غير ذلك → نسخة 2D خفيفة بنفس البطاقات ونفس الوظائف.
// ============================================================

export function canUseFx() {
  if (typeof window === "undefined") return false;
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    const n = navigator;
    if (n.connection?.saveData) return false;
    if (/(^|-)2g$/.test(n.connection?.effectiveType || "")) return false;
    const ios = /iP(hone|ad|od)/.test(n.userAgent || "") || (n.platform === "MacIntel" && n.maxTouchPoints > 1);
    if (!ios) {
      if (typeof n.deviceMemory === "number" && n.deviceMemory < 4) return false;
      if (typeof n.hardwareConcurrency === "number" && n.hardwareConcurrency < 4) return false;
    }
    return true;
  } catch {
    return false;
  }
}
