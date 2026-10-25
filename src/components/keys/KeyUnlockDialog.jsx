import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Key, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import KeysSheet from "./KeysSheet.jsx";
import { DiamondGlyph, DiamondKey } from "./DiamondKey.jsx";
import { DIA_BG, DIA_DEEP, DIA_INK, DIA_SOFT } from "./diamond.js";
import { isImageUrl } from "../CompanyLogo.jsx";
import BidiText from "../BidiText.jsx";
import "./keys.css";

// حالة الخادم (use_diamond_key) → رسالة (keys.err.*)
const ERR = { no_keys: "noKeys", has_premium: "hasPremium", unavailable: "unavailable", auth: "auth" };

/** "10% ← 20%" — العادي ← Premium (السهم يتقلب مع اتجاه الكتابة). */
export function ValueGain({ normal, premium, className = "" }) {
  const { i18n } = useTranslation();
  const rtl = i18n.dir() === "rtl";
  if (!premium) return null;
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 ${className}`}>
      {normal && normal !== premium && (
        <>
          <span className="truncate text-[var(--color-mute)] line-through decoration-[var(--color-mute)]">
            <BidiText text={normal} rtl={rtl} />
          </span>
          <ArrowLeft size={13} className="shrink-0 text-[var(--color-mute)] ltr:rotate-180" aria-hidden />
        </>
      )}
      <span className="truncate font-black" style={{ color: DIA_SOFT }}>
        <BidiText text={premium} rtl={rtl} />
      </span>
    </span>
  );
}

/**
 * تأكيد استعمال مفتاح ماسي ("يفتح كود {company} لحسابك للأبد"). onConfirm() → null عند النجاح (البطاقة
 * تسكّر وتبدا حركة الفتح)، وإلا حالة الخادم لرسالة الخطأ. onGolden: "استعمل مفتاحك الذهبي المجاني بلاصتو".
 */
export default function KeyUnlockDialog({ open, company, normal, premium, balance, onConfirm, onGolden, onClose }) {
  const { t, i18n } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const confirmRef = useRef(null);
  const name = company?.name || "";

  useEffect(() => {
    if (!open) return;
    setBusy(false);
    setError("");
    const id = requestAnimationFrame(() => confirmRef.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(id);
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
      setError(t(`keys.err.${ERR[status] || "network"}`));
    }
  };

  return (
    <KeysSheet
      open={open}
      onClose={onClose}
      busy={busy}
      labelledBy="dk-confirm-title"
      title={t("keys.confirm.title")}
      icon={
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: DIA_BG }}>
          <DiamondGlyph size={20} />
        </span>
      }
    >
      <div className="text-center">
        <DiamondKey sparkle flip={i18n.dir() === "ltr"} className="mx-auto h-auto w-[150px] -rotate-6 drop-shadow-[0_12px_20px_rgba(150,195,255,0.35)]" />
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--text-soft)]">{t("keys.confirm.body", { company: name })}</p>
      </div>

      <div className="mx-auto mt-4 flex max-w-[340px] items-center gap-3 rounded-2xl border px-3.5 py-3" style={{ borderColor: `${DIA_DEEP}55`, background: "rgba(169,205,255,0.06)" }}>
        <MiniLogo logo={company?.logo} name={name} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14.5px] font-extrabold text-[var(--text)]">{name}</div>
          <ValueGain normal={normal} premium={premium} className="max-w-full text-[13.5px]" />
        </div>
      </div>

      <p className="mt-3 text-center text-[12.5px] font-bold" style={{ color: DIA_SOFT }}>
        {t("keys.confirm.after", { count: Math.max((balance || 0) - 1, 0) })}
      </p>
      <p className="mt-2 text-center text-[12.5px] leading-relaxed text-[var(--color-mute)]">{t("keys.confirm.note")}</p>

      {error && (
        <p role="alert" className="mt-3 rounded-xl border border-red-500/30 bg-red-500/[0.08] px-3.5 py-2.5 text-[13px] font-semibold leading-relaxed text-red-300">
          {error}
        </p>
      )}

      <div className="mt-5 flex flex-col gap-2.5">
        <button
          ref={confirmRef}
          type="button"
          onClick={confirm}
          disabled={busy}
          className="dk-glint flex items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-[15px] font-extrabold outline-none focus-visible:ring-2 focus-visible:ring-[#dbeeff] disabled:opacity-70"
          style={{ background: DIA_BG, color: DIA_INK, boxShadow: "0 14px 34px -14px rgba(150,195,255,0.7)" }}
        >
          {busy ? <Loader2 size={17} className="animate-spin" /> : <DiamondGlyph size={17} />}
          {busy ? t("keys.confirm.busy") : t("keys.confirm.yes")}
        </button>
        <button type="button" onClick={onClose} disabled={busy} className="rounded-2xl px-5 py-3 text-[14px] font-bold text-[var(--text-soft)] transition-colors hover:text-[var(--text)] disabled:opacity-50">
          {t("keys.confirm.no")}
        </button>
        {onGolden && (
          <button type="button" onClick={onGolden} disabled={busy} className="mx-auto flex items-center gap-1.5 text-[13px] font-bold text-[#ffe486] underline decoration-dotted underline-offset-4 disabled:opacity-50">
            <Key size={14} /> {t("keys.confirm.golden")}
          </button>
        )}
      </div>
    </KeysSheet>
  );
}

export function MiniLogo({ logo, name }) {
  const [errored, setErrored] = useState(false);
  const letter = (name || "؟").trim().charAt(0);
  return (
    <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-[linear-gradient(150deg,#1c1c20,#141417)]">
      {isImageUrl(logo) && !errored ? (
        <img src={logo} alt="" className="h-full w-full object-cover" onError={() => setErrored(true)} />
      ) : logo && !isImageUrl(logo) ? (
        <span className="text-[22px] leading-none">{logo}</span>
      ) : (
        <span className="text-[19px] font-black leading-none" style={{ color: DIA_SOFT }}>
          {letter}
        </span>
      )}
    </span>
  );
}
