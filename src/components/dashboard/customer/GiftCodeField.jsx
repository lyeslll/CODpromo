import { useState } from "react";
import { Gift, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { normalizeGiftCode, formatGiftCode, redeemGift } from "../../../lib/gifts.js";

// حالة الخادم → رسالة قصيرة (gift.err.*)
const ERR = {
  invalid: "invalid",
  inactive: "inactive",
  expired: "expired",
  already_redeemed: "already",
  has_premium: "hasPremium",
  rate_limited: "rateLimited",
};

/**
 * "هل لديك كود هدية؟" — خانة صغيرة في بطاقة الخطة (حساب عادي ما خذاش هدية من قبل).
 * التفعيل عبر redeem_gift (نفس قواعد صفحة الهدية)، و onRedeemed(r) يحتفل ويحدّث الخطة.
 */
export default function GiftCodeField({ onRedeemed }) {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const c = normalizeGiftCode(code);
    // كود قصير بزاف: غالط أكيد، بلا ما نحسبوه محاولة في الخادم
    if (c.length < 12) return setError(t("gift.err.invalid"));
    setBusy(true);
    try {
      const r = await redeemGift(c);
      if (r?.status === "ok" || (r?.status === "yours" && r.active)) {
        setCode("");
        onRedeemed?.(r);
      } else if (r?.status === "exhausted") {
        setError(t(r.kind === "group" ? "gift.err.full" : "gift.err.used"));
      } else if (r?.status === "yours") {
        setError(t("gift.err.ended"));
      } else {
        setError(t(`gift.err.${ERR[r?.status] || "network"}`));
      }
    } catch {
      setError(t("gift.err.network"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border border-[var(--color-ink-line)] bg-[var(--fill)] px-4 py-3">
      <label htmlFor="gift-code" className="flex items-center gap-2 text-[13px] font-bold text-[var(--text-soft)]">
        <Gift size={16} className="shrink-0 text-[#f0c63c]" /> {t("gift.field.label")}
      </label>
      <div className="mt-2.5 flex items-stretch gap-2">
        <input
          id="gift-code"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setError("");
          }}
          onBlur={() => normalizeGiftCode(code).length >= 12 && setCode(formatGiftCode(code))}
          placeholder={t("gift.field.placeholder")}
          dir="ltr"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={40}
          aria-invalid={!!error}
          aria-describedby={error ? "gift-code-err" : undefined}
          className="min-w-0 flex-1 rounded-xl border border-[var(--color-ink-line)] bg-[var(--color-ink)] px-3 py-2.5 text-left font-mono text-[13.5px] font-bold tracking-wider text-[var(--text)] outline-none transition-colors placeholder:font-sans placeholder:tracking-normal placeholder:text-[var(--color-mute)] focus:border-[#cf9a1e]"
        />
        <button
          type="submit"
          disabled={busy}
          className="grid shrink-0 place-items-center rounded-xl px-4 text-[13.5px] font-extrabold text-[#1d1403] disabled:opacity-60"
          style={{ background: "linear-gradient(135deg, #ffe486, #cf9a1e)" }}
        >
          {busy ? <Loader2 size={17} className="animate-spin" /> : t("gift.field.submit")}
        </button>
      </div>
      {error && (
        <p id="gift-code-err" role="alert" className="mt-2 text-[12.5px] font-semibold text-red-400">
          {error}
        </p>
      )}
    </form>
  );
}
