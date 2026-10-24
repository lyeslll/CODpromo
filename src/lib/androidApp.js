import { useEffect, useState } from "react";

// ============================================================
//  CODpromo — هل الصفحة داخل تطبيق Android (TWA، الحزمة com.codpromo.twa)؟
//  المصدر الوحيد في كل الموقع: الدفع (Google Play برك داخل التطبيق، والبوابات الثلاث برك في المتصفح)،
//  وإخفاء "حمّل التطبيق"، والنصوص اللي تذكر طرق الدفع.
//
//  السبب اللي خلّى الكشف يضيع: document.referrer = "android-app://com.codpromo.twa" غير في أول
//  صفحة يفتحها التطبيق. كل تنقّل يمرّ على موقع آخر ويرجع (الدخول بـ Google عبر supabase.co و
//  accounts.google.com، رابط تأكيد الإيميل، …) ولا إعادة تحميل كاملة يبدّل الـ referrer → الكشف يطيح
//  والنافذة تولّي تبيّن طرق المتصفح.
//
//  الحلّ (ثلاث علامات، أي وحدة تكفي):
//   1) الـ referrer بالحزمة بالضبط (ماشي أي android-app:// — Chrome يحطّ android-app://com.google.android.gm
//      كي تفتح رابط من Gmail في المتصفح).
//   2) علامة في sessionStorage تتحطّ من أول صفحة. sessionStorage خاص بالتبويب: تبويب التطبيق برك،
//      ما يوصلش لتبويب Chrome العادي (عكس localStorage اللي التطبيق يتقاسمو مع Chrome — لذا ممنوع هنا).
//      يبقى كي نخرجو لـ accounts.google.com / supabase.co ونرجعو في نفس التبويب، وكي تتعاد الصفحة.
//   3) احتياط: getDigitalGoodsService("https://play.google.com/billing") ينجح غير داخل التطبيق
//      (Play Billing مفعّل في نسخة Android)؛ في المتصفح يرفض. نتيجتو تتحفظ في نفس العلامة.
// ============================================================

// الحزمة بالضبط (ماشي com.codpromo.twa.xxx)
const PACKAGE_REFERRER = /^android-app:\/\/com\.codpromo\.twa(\/|$)/;
const KEY = "codpromo:twa";
const PLAY_METHOD = "https://play.google.com/billing";
const PROBE_TIMEOUT_MS = 2500;

let probe = null;

function flagged() {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function mark() {
  try {
    sessionStorage.setItem(KEY, "1");
  } catch {
    /* sessionStorage غير متاح: الـ referrer والفحص يكفيو */
  }
}

/** متزامن: الـ referrer ولا العلامة. صحيح = داخل التطبيق أكيد. */
export function isAndroidAppKnown() {
  if (typeof window === "undefined") return false;
  if (PACKAGE_REFERRER.test(document.referrer || "")) {
    mark();
    return true;
  }
  return flagged();
}

/** يرجع true إذا الصفحة داخل التطبيق: العلامات المتزامنة، وإلا فحص Digital Goods (مرة وحدة في الصفحة). */
export function detectAndroidApp() {
  if (isAndroidAppKnown()) return Promise.resolve(true);
  if (typeof window === "undefined" || typeof window.getDigitalGoodsService !== "function") return Promise.resolve(false);
  if (!probe) {
    probe = Promise.race([
      Promise.resolve()
        .then(() => window.getDigitalGoodsService(PLAY_METHOD))
        .then((service) => !!service, () => false),
      new Promise((resolve) => setTimeout(() => resolve(false), PROBE_TIMEOUT_MS)),
    ]).then((inApp) => {
      if (inApp) mark();
      return inApp;
    });
  }
  return probe;
}

/** يتنادى في main.jsx قبل أي حاجة: يحفظ العلامة من أول صفحة (وقت الـ referrer مازال صحيح). */
export function rememberAndroidApp() {
  if (!isAndroidAppKnown()) detectAndroidApp();
}

/** React: "app" (داخل التطبيق) | "web" (متصفح) | "checking" (الفحص مازال، أقل من ثانيتين). */
export function useAndroidApp() {
  const [mode, setMode] = useState(() =>
    isAndroidAppKnown() ? "app" : typeof window !== "undefined" && typeof window.getDigitalGoodsService === "function" ? "checking" : "web"
  );
  useEffect(() => {
    if (mode !== "checking") return;
    let active = true;
    detectAndroidApp().then((inApp) => active && setMode(inApp ? "app" : "web"));
    return () => {
      active = false;
    };
  }, [mode]);
  return mode;
}
