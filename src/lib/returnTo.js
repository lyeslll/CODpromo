// ============================================================
//  CODpromo — الرجوع لنفس الصفحة بعد الدخول / التسجيل (مثلاً: "سجّل الدخول لتقييم الشركة")
//  نفس طريقة الهدية والمفتاح الذهبي و Premium: sessionStorage (ساعة) + Login / Signup يقراوها.
// ============================================================

const KEY = "codpromo:return-to";
const TTL_MS = 60 * 60 * 1000;

/** يحفظ مسار داخلي (يبدا بـ / وماشي //) — أي حاجة أخرى تتجاهل. */
export function setReturnTo(path) {
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//")) return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() }));
  } catch {
    /* sessionStorage غير متاح */
  }
}

/** المسار المحفوظ (ولا null) — يتمسح بعد ما يتقرا. */
export function takeReturnTo() {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) || "null");
    sessionStorage.removeItem(KEY);
    if (!v || Date.now() - v.at > TTL_MS || typeof v.path !== "string" || !v.path.startsWith("/") || v.path.startsWith("//")) return null;
    return v.path;
  } catch {
    return null;
  }
}

/** نفس الشي بلا مسح (لرابط Google / تأكيد الإيميل). */
export function peekReturnTo() {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) || "null");
    if (!v || Date.now() - v.at > TTL_MS || typeof v.path !== "string" || !v.path.startsWith("/") || v.path.startsWith("//")) return null;
    return v.path;
  } catch {
    return null;
  }
}
