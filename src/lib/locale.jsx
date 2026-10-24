import { createContext, useContext, useState, useEffect, useCallback } from "react";
import i18n, { LANG_KEY, SUPPORTED, DEFAULT_LANG, dirOf, ensureLang } from "../i18n/index.js";

const LocaleContext = createContext({
  lang: DEFAULT_LANG,
  dir: "rtl",
  setLang: () => {},
});

/** يطبّق اللغة على عنصر <html> (lang + dir) ويحفظها بأمان — الخط يتبدّل عبر CSS حسب [lang]. */
function applyLang(lang) {
  const root = document.documentElement;
  root.setAttribute("lang", lang);
  root.setAttribute("dir", dirOf(lang));
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* تجاهل آمن */
  }
}

export function LocaleProvider({ children }) {
  const [lang, setLangState] = useState(() => i18n.language || DEFAULT_LANG);

  // مزامنة <html> والمكتبة عند أي تغيير
  useEffect(() => {
    if (i18n.language !== lang) i18n.changeLanguage(lang);
    applyLang(lang);
  }, [lang]);

  // ملف اللغة يتحمّل أولاً (en/fr)، ثم التبديل — بلا ما يبان النص العربي للحظة
  const setLang = useCallback((next) => {
    if (!SUPPORTED.includes(next)) return;
    ensureLang(next).then(
      () => setLangState(next),
      () => setLangState(next)
    );
  }, []);

  return (
    <LocaleContext.Provider value={{ lang, dir: dirOf(lang), setLang }}>
      {children}
    </LocaleContext.Provider>
  );
}

export const useLocale = () => useContext(LocaleContext);
