import { Suspense, lazy, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Bell } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNotifications } from "../../lib/useNotifications.js";
import { useBackToClose } from "../../lib/useBackToClose.js";
import { formatNumber } from "../../lib/values.js";
import "./notifications.css";

// محتوى القائمة يتحمّل غير كي يقرب الزائر للجرس (مرور / لمس / تركيز) — الهيدر يبقى خفيف
const loadPanel = () => import("./NotificationsPanel.jsx");
const NotificationsPanel = lazy(loadPanel);

function PanelFallback() {
  return <div className="h-48 animate-pulse rounded-2xl bg-[var(--fill)]" aria-busy="true" />;
}

/**
 * جرس الإشعارات في الهيدر: نفس مقاس الأزرار جنبو (h-9) — الهيدر ما يكبرش. العدّاد = غير المقروءة.
 * sheet = false: نافذة تحت الجرس (الكمبيوتر)؛ true: لوحة من تحت بكامل العرض (الهاتف، portal على body).
 * onOpenChange: الهيدر يبقى ظاهر وقت النافذة مفتوحة (Navbar).
 * القائمة كي تتسكّر → كلش يتعلّم مقروء (النقاط تبقى باينة وهي مفتوحة).
 */
export default function NotificationBell({ sheet = false, onOpenChange }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const notif = useNotifications();
  const notifRef = useRef(notif);
  notifRef.current = notif;
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  const [atOpen, setAtOpen] = useState([]);
  const wrapRef = useRef(null);
  const btnRef = useRef(null);
  const panelRef = useRef(null);
  const titleId = useId();
  const { pathname, search } = useLocation();

  const setBoth = (v) => {
    openRef.current = v;
    setOpen(v);
    onOpenChange?.(v);
  };
  const close = (returnFocus = false) => {
    if (!openRef.current) return;
    setBoth(false);
    if (notifRef.current.unreadCount) notifRef.current.markAllRead();
    if (returnFocus) btnRef.current?.focus();
  };
  const toggle = () => {
    if (openRef.current) return close();
    loadPanel();
    setAtOpen(notif.unreadIds);
    notif.ensureFresh();
    setBoth(true);
  };

  // أي تنقّل يسكّرها
  useEffect(() => close(), [pathname, search]); // eslint-disable-line react-hooks/exhaustive-deps

  // نافذة الكمبيوتر: ضغطة برّا ولا Esc
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current?.contains(e.target) || panelRef.current?.contains(e.target)) return;
      close();
    };
    const onKey = (e) => e.key === "Escape" && close(true);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    const id = requestAnimationFrame(() => panelRef.current?.focus({ preventScroll: true }));
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // الهاتف: زر الرجوع يسكّر اللوحة + الصفحة ما تتحرّكش تحتها
  useBackToClose(open && sheet, () => close());
  useEffect(() => {
    if (!open || !sheet) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, [open, sheet]);

  const count = notif.unreadCount;
  const label = count ? t("notify.bell.unread", { count }) : t("notify.bell.label");
  const panel = (
    <Suspense fallback={<PanelFallback />}>
      <NotificationsPanel notif={notif} unreadAtOpen={atOpen} onClose={() => close()} titleId={titleId} showClose={sheet} />
    </Suspense>
  );

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        onPointerEnter={loadPanel}
        onFocus={loadPanel}
        aria-label={label}
        title={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-xl border transition-colors ${
          open
            ? "border-[var(--color-lime)]/45 bg-[var(--fill-strong)] text-[var(--text)]"
            : "border-[var(--color-ink-line)] bg-[var(--fill)] text-[var(--text-softer)] hover:border-[var(--color-lime)]/35 hover:text-[var(--text)]"
        }`}
      >
        <Bell
          size={sheet ? 16 : 17}
          className={`transition-[translate] duration-200 ${count ? "nb-ring" : ""} ${sheet && count ? "translate-y-[1.5px] ltr:-translate-x-[1.5px] rtl:translate-x-[1.5px]" : ""}`}
        />
        <AnimatePresence>
          {count > 0 && (
            <motion.span
              key="badge"
              aria-hidden
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: "spring", stiffness: 520, damping: 26 }}
              // الهاتف: صغيرة وداخل حدود الزر (ما تركبش على اللي جنبو)، والأيقونة تتزاح شوية للجهة الأخرى.
              // الكمبيوتر: كيما كانت.
              className={`pointer-events-none absolute grid place-items-center rounded-full bg-[var(--color-lime)] font-black leading-none text-[#0a0a0a] tabular-nums [font-family:Inter,sans-serif] ${
                sheet
                  ? "end-[2px] top-[2px] h-[14px] min-w-[14px] px-[3px] text-[9px] shadow-[0_0_0_1.5px_var(--color-ink)]"
                  : "-end-1.5 -top-1.5 h-[18px] min-w-[18px] px-1 text-[10.5px] shadow-[0_0_0_2px_var(--color-ink),0_0_10px_rgba(166,240,0,0.55)]"
              }`}
            >
              {count > 9 ? `${formatNumber(9, lang)}+` : formatNumber(count, lang)}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {!sheet && (
        <AnimatePresence>
          {open && (
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-labelledby={titleId}
              tabIndex={-1}
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.16 }}
              className="absolute end-0 top-[calc(100%+12px)] z-50 flex max-h-[min(72vh,600px)] w-[min(400px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border border-[var(--color-ink-line)] bg-[var(--elev)] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)] outline-none"
            >
              {panel}
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {sheet &&
        typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <>
                <motion.div
                  key="nb-backdrop"
                  className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-[2px]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => close()}
                />
                <motion.div
                  key="nb-sheet"
                  ref={panelRef}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby={titleId}
                  tabIndex={-1}
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", stiffness: 380, damping: 38 }}
                  className="fixed inset-x-0 bottom-0 z-[71] flex max-h-[85dvh] flex-col rounded-t-3xl border-t border-[var(--color-ink-line)] bg-[var(--elev)] pb-[env(safe-area-inset-bottom)] shadow-[0_-24px_60px_-20px_rgba(0,0,0,0.9)] outline-none"
                >
                  <span aria-hidden className="mx-auto mt-2.5 h-1.5 w-11 shrink-0 rounded-full bg-white/15" />
                  {panel}
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
