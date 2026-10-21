import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PLAY_URL, isInsideApp, platformOf } from "../../lib/appInstall.js";

const CLOSED_KEY = "codpromo:app-banner-closed";
const H = 56;

const wasClosed = () => {
  try {
    return localStorage.getItem(CLOSED_KEY) === "1";
  } catch {
    return false;
  }
};

/**
 * شريط صغير أعلى الصفحة في متصفح Android فقط: "حمّل تطبيق CODpromo" + زر يفتح Google Play.
 * يُغلق بـ X ويتذكّر ذلك (localStorage). لا يظهر داخل التطبيق ولا في لوحة الأدمن.
 * يأخذ مكانه في أعلى الصفحة (body يُزاح بـ --app-banner-h)، والهيدر الثابت ينزل تحته
 * ثم يصعد مع التمرير حتى يختفي الشريط (--app-banner-top) — القواعد في index.css.
 */
export default function AppBanner() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(() => platformOf() === "android" && !isInsideApp() && !wasClosed());
  const show = open && !pathname.startsWith("/admin");

  useEffect(() => {
    if (!show) return;
    const root = document.documentElement;
    root.style.setProperty("--app-banner-h", `${H}px`);
    const onScroll = () => root.style.setProperty("--app-banner-top", `${Math.max(0, H - window.scrollY)}px`);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      root.style.removeProperty("--app-banner-h");
      root.style.removeProperty("--app-banner-top");
    };
  }, [show]);

  const close = () => {
    try {
      localStorage.setItem(CLOSED_KEY, "1");
    } catch {}
    setOpen(false);
  };

  if (!show) return null;
  return (
    <div
      role="region"
      aria-label={t("app.bannerTitle")}
      className="absolute inset-x-0 top-0 z-[60] flex items-center gap-3 border-b border-[var(--color-ink-line)] bg-[var(--elev)] pe-2 ps-3"
      style={{ height: H }}
    >
      <span aria-hidden className="pointer-events-none absolute inset-x-8 bottom-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(166,240,0,0.45), transparent)" }} />
      <img src="/pwa-192.png" alt="" width={36} height={36} className="h-9 w-9 shrink-0 rounded-[10px]" />
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-[14px] font-extrabold text-[var(--text)]">{t("app.bannerTitle")}</span>
        <span className="block truncate text-[12px] font-medium text-[var(--color-mute)]">{t("app.bannerSub")}</span>
      </span>
      <a
        href={PLAY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 rounded-xl px-4 py-2 text-[13.5px] font-extrabold text-[#0a0a0a]"
        style={{ background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" }}
      >
        {t("app.bannerCta")}
      </a>
      <button
        type="button"
        onClick={close}
        aria-label={t("header.close")}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[var(--color-mute)] transition-colors hover:bg-[var(--fill)] hover:text-[var(--text)]"
      >
        <X size={17} />
      </button>
    </div>
  );
}
