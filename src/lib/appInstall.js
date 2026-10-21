import { useState } from "react";
import { isPlayBillingSupported } from "./playBilling.js";

// ============================================================
//  CODpromo — توزيع تطبيق Android (Google Play)
//  - رابط صفحة التطبيق في Google Play.
//  - هل نحن داخل التطبيق؟ (نفس كشف خيار Google Play في الدفع: isPlayBillingSupported)
//  - منصّة الهاتف (Android / iPhone) لاختيار الزر المناسب.
// ============================================================

export const PLAY_URL = "https://play.google.com/store/apps/details?id=com.codpromo.twa";

const IN_APP_KEY = "codpromo:in-app";

/**
 * داخل تطبيق؟ → كل عناصر "حمّل التطبيق" تختفي.
 * - تطبيق Android (TWA): نفس كشف خيار Google Play في الدفع، ونحفظه للجلسة
 *   (document.referrer يضيع بعد إعادة تحميل الصفحة داخل التطبيق).
 * - نافذة تطبيق مثبّت (standalone)، أو تطبيق iOS، أو معاينة الهاتف داخل الصفحة (iframe).
 */
export function isInsideApp() {
  if (typeof window === "undefined") return false;
  if (isPlayBillingSupported()) {
    try {
      sessionStorage.setItem(IN_APP_KEY, "1");
    } catch {}
    return true;
  }
  try {
    if (sessionStorage.getItem(IN_APP_KEY) === "1") return true;
  } catch {}
  if (window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true) return true;
  if (document.body.classList.contains("is-ios-app")) return true;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/** "android" | "ios" | "other" — من وكيل المتصفّح (iPadOS يتظاهر بأنه Mac: نكشفه باللمس). */
export function platformOf() {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";
  if (/android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
  return "other";
}

/** { inApp, platform } — يُحسب مرّة واحدة عند التركيب. */
export function useAppTarget() {
  const [target] = useState(() => ({ inApp: isInsideApp(), platform: platformOf() }));
  return target;
}

/** شارة Google Play الرسمية بلغة الواجهة (الملفات كما نشرتها Google، بلا أي تعديل). */
export const badgeSrc = (lang) => `/badges/google-play-${["ar", "en", "fr"].includes(lang) ? lang : "en"}.png`;
