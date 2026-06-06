import { createContext, useContext, useState, useEffect, useCallback } from "react";

const THEME_KEY = "codpromo:theme";
const ThemeContext = createContext({ theme: "dark", toggle: () => {}, setTheme: () => {} });

/** يقرأ الثيم المحفوظ بأمان — الافتراضي دارك مود. */
function getInitialTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* localStorage غير متاح (تصفّح خاص…) — نتجاهل */
  }
  return "dark";
}

/** يطبّق الثيم على عنصر <html> ويحفظه بأمان. */
function applyTheme(theme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  root.style.colorScheme = theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* تجاهل آمن */
  }
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((t) => setThemeState(t === "light" ? "light" : "dark"), []);
  const toggle = useCallback(
    () => setThemeState((t) => (t === "dark" ? "light" : "dark")),
    []
  );

  return (
    <ThemeContext.Provider value={{ theme, toggle, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
