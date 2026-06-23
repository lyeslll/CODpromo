import React from "react";
import ReactDOM from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.jsx";
import { ThemeProvider } from "./lib/theme.jsx";
import { LocaleProvider } from "./lib/locale.jsx";
import "./i18n/index.js";
import "flag-icons/css/flag-icons.min.css";
import "./index.css";
import { Capacitor } from "@capacitor/core";

// iOS Capacitor: نضيف صنف للـ body باش تُطبَّق تعديلات safe area الخاصة بـ iOS فقط.
if (Capacitor.getPlatform() === "ios") {
  document.body.classList.add("is-ios-app");
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HelmetProvider>
      <LocaleProvider>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </LocaleProvider>
    </HelmetProvider>
  </React.StrictMode>
);

// TWA/تطبيق: امنع قائمة الكليك اليمين / الضغط المطوّل (Copier / Traduire / Partager)
// مع استثناء حقول الإدخال باش الكتابة و التحديد فيهم يبقاو يخدمو عادي (البحث).
document.addEventListener(
  "contextmenu",
  (e) => {
    const el = e.target;
    if (
      el &&
      el.closest &&
      el.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]')
    ) {
      return; // اترك السلوك الافتراضي داخل حقول الإدخال
    }
    e.preventDefault();
  },
  { capture: true }
);

// Fade out the first-paint boot loader once React has mounted.
requestAnimationFrame(() => {
  const boot = document.getElementById("boot");
  if (boot) {
    boot.classList.add("hide");
    setTimeout(() => boot.remove(), 450);
  }
});
