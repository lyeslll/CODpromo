// ============================================================
//  CODpromo — الموقع يحدّث نفسه عند نشر نسخة جديدة (PWA / Service Worker)
//  الـ SW الجديد يتفعّل وحده (skipWaiting + clientsClaim في vite.config.js)، لكن الصفحة
//  المفتوحة تبقى بملفات النسخة القديمة حتى تُعاد. هنا نعيد تحميلها في لحظة آمنة:
//   - إن وصلت النسخة الجديدة خلال أول 15 ثانية من فتح الصفحة → إعادة فورية.
//   - وإلا تُؤجَّل (حتى لا نقطع ما يفعله المستخدم): عند أول تنقّل داخل الموقع،
//     أو حين يغادر المستخدم التبويب — ما عدا صفحات النماذج (الأدمن/الحساب/الدخول).
//  ونفحص وجود نسخة جديدة كل 20 دقيقة وكلما رجع المستخدم للتبويب.
// ============================================================

const FORM_PAGES = /^\/(admin|dashboard|login|signup|forgot-password|reset-password)(\/|$)/;
const QUICK_MS = 15000;
const CHECK_MS = 20 * 60 * 1000;

let pending = false;
let reloading = false;

function reload() {
  if (reloading) return;
  reloading = true;
  window.location.reload();
}

function checkForUpdate() {
  navigator.serviceWorker
    .getRegistration()
    .then((reg) => reg?.update())
    .catch(() => {});
}

export function startSwAutoReload() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  const sw = navigator.serviceWorker;
  // أول زيارة (لا SW يتحكّم بالصفحة بعد) = الصفحة جاءت من الشبكة أصلاً → لا داعي لإعادة التحميل
  const hadController = !!sw.controller;
  const loadedAt = Date.now();

  sw.addEventListener("controllerchange", () => {
    if (!hadController) return;
    if (Date.now() - loadedAt < QUICK_MS) reload();
    else pending = true;
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      if (pending && !FORM_PAGES.test(window.location.pathname)) reload();
    } else {
      checkForUpdate();
    }
  });

  setInterval(checkForUpdate, CHECK_MS);
}

/** يُنادى عند كل تنقّل داخل الموقع: إن كانت نسخة جديدة تنتظر → نحمّلها الآن (الصفحة تتبدّل أصلاً). */
export function reloadIfUpdatePending() {
  if (pending) reload();
}
