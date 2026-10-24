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
 * (مدفوع / Stork / أدمن) والزائر: والو. compact (الهاتف): تحت 370px الماسي وحدو.
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
