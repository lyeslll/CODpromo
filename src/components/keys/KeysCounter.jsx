import { Key } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useKeys } from "../../lib/keysContext.jsx";
import { useFreeKey } from "../../lib/freeKeyContext.jsx";
import { formatNumber } from "../../lib/values.js";
import { DiamondGlyph } from "./DiamondKey.jsx";
import { DIA_DEEP, DIA_SOFT } from "./diamond.js";
import "./keys.css";

const GOLD = "#f0c63c";

/**
 * عدّاد المفاتيح في الهيدر (الذهبي + الماسي): نفس ارتفاع زر Premium (h-9) — الهيدر ما يكبرش.
 * الضغط يحلّ لوحة الرصيد والتاريخ والشراء (KeysPanel). يبان للحساب العادي ومول الهدية برك؛ Premium
 * (مدفوع / Stork / أدمن) والزائر: والو. compact (الهاتف): مربّع 36px.
 */
export default function KeysCounter({ compact = false }) {
  const { t, i18n } = useTranslation();
  const keys = useKeys();
  const fk = useFreeKey();
  if (keys.status !== "ok") return null;
  const lang = i18n.language;
  const golden = fk.status === "available" ? 1 : fk.status === "used" ? 0 : null;
  const label = t("keys.counter.aria", {
    count: keys.balance,
    golden: golden == null ? t("keys.counter.goldenOff") : golden ? t("keys.counter.goldenOn") : t("keys.counter.goldenUsed"),
  });

  // الهاتف: مربّع 36px (نفس زر القائمة) — الجوهرة + العدد في شارة صغيرة + نقطة ذهبية كي المفتاح الذهبي متاح.
  // بلا هاد الشكل، سطر الشعار (خاصة بالفرنسية) يتقسم والهيدر يكبر. تحت 350px: يتخبّى (اللوحة من قائمة الهاتف).
  if (compact) {
    return (
      <button
        type="button"
        onClick={keys.openPanel}
        aria-label={label}
        title={label}
        aria-haspopup="dialog"
        className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl border transition-colors hover:bg-white/[0.06] max-[349px]:hidden"
        style={{ borderColor: `${DIA_DEEP}66`, background: "linear-gradient(120deg, rgba(169,205,255,0.12), rgba(169,205,255,0.03))" }}
      >
        <DiamondGlyph size={19} />
        <span
          aria-hidden
          className="absolute -end-1.5 -top-1.5 z-[2] min-w-[18px] rounded-full px-1 text-center text-[10.5px] font-black leading-[18px] tabular-nums"
          style={{ background: "linear-gradient(135deg, #f4fbff, #a9cdff)", color: "#0b1430", boxShadow: "0 0 0 2px var(--color-ink)" }}
        >
          {formatNumber(keys.balance, lang)}
        </span>
        {golden === 1 && <span aria-hidden className="absolute -bottom-1 -end-1 z-[2] h-2.5 w-2.5 rounded-full" style={{ background: GOLD, boxShadow: "0 0 0 2px var(--color-ink)" }} />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={keys.openPanel}
      aria-label={label}
      title={label}
      aria-haspopup="dialog"
      className={`dk-glint flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border font-extrabold tabular-nums transition-colors hover:bg-white/[0.06] ${
        compact ? "h-9 px-2 text-[12.5px]" : "h-9 px-2.5 text-[13px]"
      }`}
      style={{ borderColor: `${DIA_DEEP}66`, background: "linear-gradient(120deg, rgba(169,205,255,0.12), rgba(169,205,255,0.03))", color: DIA_SOFT }}
    >
      {golden != null && (
        <span className={`flex items-center gap-0.5 ${compact ? "max-[369px]:hidden" : ""}`} style={{ color: golden ? GOLD : "var(--color-mute)" }}>
          <Key size={14} aria-hidden />
          <span aria-hidden>{formatNumber(golden, lang)}</span>
        </span>
      )}
      {golden != null && <span aria-hidden className={`h-4 w-px bg-white/15 ${compact ? "max-[369px]:hidden" : ""}`} />}
      <span className="flex items-center gap-1">
        <DiamondGlyph size={16} />
        <span aria-hidden>{formatNumber(keys.balance, lang)}</span>
      </span>
    </button>
  );
}
