import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { GoldenKey } from "./GoldenKey.jsx";
import { isImageUrl } from "../CompanyLogo.jsx";
import { useBackToClose } from "../../lib/useBackToClose.js";

const GOLD_SOFT = "#ffe486";
const GOLD_DEEP = "#cf9a1e";

// حالة الخادم (claim_free_reveal) → رسالة (freeKey.err.*)
const ERR = {
  used: "used",
  inbox_used: "inboxUsed",
  disabled: "disabled",
  has_premium: "hasPremium",
  unavailable: "unavailable",
  disposable: "disposable",
  unconfirmed: "unconfirmed",
  auth: "auth",
};

/**
 * تأكيد استعمال المفتاح الذهبي ("عندك مفتاح واحد برك…"). في portal على body: البطاقة تقدر تكون
 * داخل مسرح CSS 3D (القسم المميّز) و position: fixed يتكسّر تحت transform.
 * onConfirm() → null عند النجاح (النافذة تتسكّر من البطاقة)، وإلا حالة الخادم لرسالة الخطأ.
 */
export default function FreeKeyDialog({ open, company, value, onConfirm, onClose }) {
  useBackToClose(open, onClose);
  const { t, i18n } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const confirmRef = useRef(null);
  const backTo = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const busyRef = useRef(false);
  busyRef.current = busy;
  const name = company?.name || "";

  // فتح: التركيز على "نعم" و Esc يسكّر؛ السكير: التركيز يرجع للزر اللي فتحها
  useEffect(() => {
    if (!open) return;
    setError("");
    setBusy(false);
    backTo.current = document.activeElement;
    const id = requestAnimationFrame(() => confirmRef.current?.focus({ preventScroll: true }));
    const onKey = (e) => e.key === "Escape" && !busyRef.current && closeRef.current();
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("keydown", onKey);
      backTo.current?.focus?.({ preventScroll: true });
    };
  }, [open]);

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    let status = "error";
    try {
      status = await onConfirm();
    } catch {
      status = "error";
    }
    if (status) {
      setBusy(false);
      setError(t(`freeKey.err.${ERR[status] || "network"}`));
    }
  };

  if (typeof document === "undefined") return null;
  // الـ portal يبقى ابن البطاقة في شجرة React: أحداث المؤشّر ما تطلعش للبطاقة (whileTap) ولا لسحب
  // القائمة في /offers (عادي ⇄ Premium)، و data-no-swipe احتياط لنفس السحب
  const stop = (e) => e.stopPropagation();
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[115] grid place-items-center p-4"
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
          <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={busy ? undefined : onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="fk-dialog-title"
            aria-describedby="fk-dialog-desc"
            initial={{ opacity: 0, y: 26, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 330, damping: 27 }}
            className="relative w-full max-w-[400px] overflow-hidden rounded-[var(--radius-card)] border bg-[var(--color-ink-card)] px-6 pb-6 pt-7 text-center"
            style={{ borderColor: `${GOLD_DEEP}66`, boxShadow: `0 30px 80px -30px rgba(0,0,0,0.75), 0 0 0 1px ${GOLD_DEEP}22` }}
          >
            <span aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-48 w-80 -translate-x-1/2 rounded-full blur-[70px]" style={{ background: `radial-gradient(circle, ${GOLD_DEEP}55, transparent 65%)` }} />
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              aria-label={t("freeKey.confirm.close")}
              className="absolute end-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-xl border border-[var(--color-ink-line)] bg-[var(--fill)] text-[var(--color-mute)] transition-colors hover:text-[var(--text)] disabled:opacity-50"
            >
              <X size={17} />
            </button>

            <GoldenKey flip={i18n.dir() === "ltr"} className="relative mx-auto h-auto w-[132px] -rotate-6 drop-shadow-[0_10px_18px_rgba(240,198,60,0.35)]" />

            <h2 id="fk-dialog-title" className="relative mt-4 text-[21px] font-black leading-snug text-[var(--text)]">
              {t("freeKey.confirm.title")}
            </h2>
            <p id="fk-dialog-desc" className="relative mt-2 text-[15px] leading-relaxed text-[var(--text-soft)]">
              {t("freeKey.confirm.body", { company: name })}
            </p>

            {/* الشركة اللي راح يكشف كودها */}
            <div className="relative mx-auto mt-5 flex max-w-[300px] items-center gap-3 rounded-2xl border border-[#f0c63c]/25 bg-[#f0c63c]/[0.06] px-3.5 py-3 text-start">
              <MiniLogo logo={company?.logo} name={name} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14.5px] font-extrabold text-[var(--text)]">{name}</div>
                {value && <div className="truncate text-[13px] font-black" style={{ color: GOLD_SOFT }}>{value}</div>}
              </div>
            </div>

            <p className="relative mt-4 text-[12.5px] leading-relaxed text-[var(--color-mute)]">{t("freeKey.confirm.note")}</p>

            {error && (
              <p role="alert" className="relative mt-4 rounded-xl border border-red-500/30 bg-red-500/[0.08] px-3.5 py-2.5 text-[13px] font-semibold leading-relaxed text-red-300">
                {error}
              </p>
            )}

            <div className="relative mt-5 flex flex-col gap-2.5">
              <button
                ref={confirmRef}
                type="button"
                onClick={confirm}
                disabled={busy}
                className="flex items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-[15px] font-extrabold text-[#1d1403] outline-none transition-transform focus-visible:ring-2 focus-visible:ring-[#ffe486] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-ink-card)] disabled:opacity-70"
                style={{ background: `linear-gradient(135deg, ${GOLD_SOFT}, #f0c63c 55%, ${GOLD_DEEP})`, boxShadow: "0 14px 34px -14px rgba(240,198,60,0.7)" }}
              >
                {busy && <Loader2 size={17} className="animate-spin" />}
                {busy ? t("freeKey.confirm.busy") : t("freeKey.confirm.yes")}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="rounded-2xl px-5 py-3 text-[14px] font-bold text-[var(--text-soft)] transition-colors hover:text-[var(--text)] disabled:opacity-50"
              >
                {t("freeKey.confirm.no")}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

function MiniLogo({ logo, name }) {
  const [errored, setErrored] = useState(false);
  const letter = (name || "؟").trim().charAt(0);
  return (
    <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-[linear-gradient(150deg,#1c1c20,#141417)]">
      {isImageUrl(logo) && !errored ? (
        <img src={logo} alt="" className="h-full w-full object-cover" onError={() => setErrored(true)} />
      ) : logo && !isImageUrl(logo) ? (
        <span className="text-[22px] leading-none">{logo}</span>
      ) : (
        <span className="text-[19px] font-black leading-none" style={{ color: GOLD_SOFT }}>
          {letter}
        </span>
      )}
    </span>
  );
}
