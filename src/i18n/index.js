import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ar from "./locales/ar.json";

export const LANG_KEY = "codpromo:lang";
export const SUPPORTED = ["ar", "en", "fr"];
export const DEFAULT_LANG = "ar";

/** اللغات التي تُعرض من اليمين لليسار. */
export const RTL_LANGS = ["ar"];
export const dirOf = (lng) => (RTL_LANGS.includes(lng) ? "rtl" : "ltr");

// العربية في الحزمة الأساسية (اللغة الافتراضية + الاحتياط)، والإنجليزية والفرنسية تتحمّل غير كي تلزم
// (~100KB لكل وحدة كانت تتحمّل لكل زائر).
const LOADERS = {
  en: () => import("./locales/en.json"),
  fr: () => import("./locales/fr.json"),
};

/** يحمّل ملف اللغة إذا ما كانش محمّل (العربية دايماً موجودة). */
export function ensureLang(lng) {
  if (!LOADERS[lng] || i18n.hasResourceBundle(lng, "translation")) return Promise.resolve();
  return LOADERS[lng]().then((m) => {
    i18n.addResourceBundle(lng, "translation", m.default || m, true, true);
  });
}

/** نفس قاعدة RouteLangSync (App.jsx): /en و /fr ← لغتهم، الصفحات العامة بلا بادئة ← العربية، وإلا المحفوظة. */
export function langForPath(pathname, current) {
  if (pathname === "/en" || pathname.startsWith("/en/")) return "en";
  if (pathname === "/fr" || pathname.startsWith("/fr/")) return "fr";
  if (/^\/(store\/|category\/|categories|favorites|offers|partners|premium|new$)/.test(pathname)) return "ar";
  return current;
}

/** يقرأ اللغة المحفوظة بأمان — الافتراضي العربية. */
export function getInitialLang() {
  let saved = DEFAULT_LANG;
  try {
    const s = localStorage.getItem(LANG_KEY);
    if (SUPPORTED.includes(s)) saved = s;
  } catch {
    /* localStorage غير متاح (تصفّح خاص…) — نتجاهل */
  }
  return typeof window !== "undefined" ? langForPath(window.location.pathname, saved) : saved;
}

i18n.use(initReactI18next).init({
  resources: { ar: { translation: ar } },
  partialBundledLanguages: true,
  lng: getInitialLang(),
  fallbackLng: DEFAULT_LANG,
  supportedLngs: SUPPORTED,
  interpolation: { escapeValue: false },
  react: { useSuspense: false, bindI18nStore: "added" },
});

export default i18n;
