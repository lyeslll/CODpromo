import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { ThemeProvider } from "./lib/theme.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);

// Fade out the first-paint boot loader once React has mounted.
requestAnimationFrame(() => {
  const boot = document.getElementById("boot");
  if (boot) {
    boot.classList.add("hide");
    setTimeout(() => boot.remove(), 450);
  }
});
