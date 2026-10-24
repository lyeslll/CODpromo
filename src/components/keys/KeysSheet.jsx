import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useBackToClose } from "../../lib/useBackToClose.js";
import { DIA_DEEP } from "./diamond.js";

const isPhone = () => typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches;

/**
 * إطار نوافذ المفاتيح: الهاتف = لوحة من تحت، الكمبيوتر = نافذة في الوسط. في portal على body (البطاقة تقدر
 * تكون داخل مسرح CSS 3D)، Esc وزر الرجوع يسكّرو، التركيز يرجع للزر اللي فتحها. busy = ما تتسكّرش.
 * الأحداث ما تطلعش للبطاقة ولا لسحب القائمة في /offers (data-no-swipe).
 */
export default function KeysSheet({ open, onClose, busy = false, labelledBy, title, icon, children, wide = false, z = 116 }) {
  useBackToClose(open, onClose);
  const { t, i18n } = useTranslation();
  const [sheet, setSheet] = useState(isPhone);
  const backTo = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const busyRef = useRef(busy);
  busyRef.current = busy;

  useEffect(() => {
    if (!open) return;
    setSheet(isPhone());
    backTo.current = document.activeElement;
    const onKey = (e) => e.key === "Escape" && !busyRef.current && closeRef.current();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      backTo.current?.focus?.({ preventScroll: true });
    };
  }, [open]);

  if (typeof document === "undefined") return null;
  const stop = (e) => e.stopPropagation();
  const panelMotion = sheet
    ? { initial: { y: "100%" }, animate: { y: 0 }, exit: { y: "100%" }, transition: { type: "spring", stiffness: 380, damping: 38 } }
    : { initial: { opacity: 0, y: 22, scale: 0.97 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: 14, scale: 0.98 }, transition: { type: "spring", stiffness: 340, damping: 28 } };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 flex items-end justify-center sm:items-center sm:p-4"
          style={{ zIndex: z }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          dir={i18n.dir()}
          data-no-swipe=""
          onPointerDown={stop}
          onPointerMove={stop}
          onPointerUp={stop}
          onPointerCancel={stop}
          onClick={stop}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={busy ? undefined : onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            {...panelMotion}
            className={`relative max-h-[92dvh] w-full overflow-y-auto overscroll-contain rounded-t-[26px] border border-b-0 bg-[var(--color-ink-card)] px-5 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] pt-3 sm:rounded-[var(--radius-card)] sm:border-b sm:p-6 ${wide ? "sm:max-w-[480px]" : "sm:max-w-[420px]"}`}
            style={{ borderColor: `${DIA_DEEP}55`, boxShadow: `0 -20px 60px -20px rgba(0,0,0,0.8), 0 0 0 1px ${DIA_DEEP}22` }}
          >
            <span aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-48 w-80 -translate-x-1/2 rounded-full blur-[70px]" style={{ background: `radial-gradient(circle, ${DIA_DEEP}55, transparent 65%)` }} />
            <span aria-hidden className="mx-auto mb-3 block h-1.5 w-11 rounded-full bg-[var(--fill-strong)] sm:hidden" />
            <div className="relative mb-4 flex items-center gap-3">
              {icon}
              <h2 id={labelledBy} className="min-w-0 flex-1 text-[18px] font-black leading-tight text-[var(--text)]">
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                aria-label={t("keys.close")}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--color-ink-line)] bg-[var(--fill)] text-[var(--color-mute)] transition-colors hover:text-[var(--text)] disabled:opacity-50"
              >
                <X size={17} />
              </button>
            </div>
            <div className="relative">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
