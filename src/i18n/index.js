import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ar from "./locales/ar.json";
import en from "./locales/en.json";
import fr from "./locales/fr.json";

export const LANG_KEY = "codpromo:lang";
export const SUPPORTED = ["ar", "en", "fr"];
export const DEFAULT_LANG = "ar";

/** اللغات التي تُعرض من اليمين لليسار. */
export const RTL_LANGS = ["ar"];
export const dirOf = (lng) => (RTL_LANGS.includes(lng) ? "rtl" : "ltr");

/** يقرأ اللغة المحفوظة بأمان — الافتراضي العربية. */
export function getInitialLang() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (SUPPORTED.includes(saved)) return saved;
  } catch {
    /* localStorage غير متاح (تصفّح خاص…) — نتجاهل */
  }
  return DEFAULT_LANG;
}

i18n.use(initReactI18next).init({
  resources: {
    ar: { translation: ar },
    en: { translation: en },
    fr: { translation: fr },
  },
  lng: getInitialLang(),
  fallbackLng: DEFAULT_LANG,
  supportedLngs: SUPPORTED,
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export default i18n;
