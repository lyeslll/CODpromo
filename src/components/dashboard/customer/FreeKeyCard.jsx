import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Copy, Check, Key, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useFreeKey } from "../../../lib/freeKeyContext.jsx";
import { getPremiumCode } from "../../../lib/supabase.js";
import { logCodeCopy } from "../../../lib/copies.js";
import { offersLink } from "../../../lib/seo.js";
import { GoldenKey } from "../../freekey/GoldenKey.jsx";

const GOLD_SOFT = "#ffe486";
const GOLD_DEEP = "#cf9a1e";

/**
 * بطاقة المفتاح الذهبي في داشبورد الزبون:
 *  متاح → "مفتاحك الذهبي متاح" + زر نحو /offers?mode=premium (يختار البطاقة بنفسو).
 *  مستعمل → "استخدمته على [الشركة]" + كود Premium (get_premium_code يرجّعو لهاد الشركة برك) + النسخ.
 * Premium / أدمن / الميزة موقوفة بلا كشف → ما تبانش.
 */
export default function FreeKeyCard({ onCopied }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const rtl = i18n.dir() === "rtl";
  const fk = useFreeKey();
  const used = fk.status === "used";
  const companyId = fk.usedCompanyId;
  const [code, setCode] = useState({ loading: true, data: null });
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef(null);

  useEffect(() => {
    if (!used || !companyId) return;
    const cached = fk.codeFor(companyId);
    if (cached) {
      setCode({ loading: false, data: cached });
      return;
    }
    let active = true;
    setCode({ loading: true, data: null });
    getPremiumCode(companyId)
      .then((d) => active && setCode({ loading: false, data: d || null }))
      .catch(() => active && setCode({ loading: false, data: null }));
    return () => {
      active = false;
    };
  }, [used, companyId, fk.codeFor]);

  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  if (fk.status !== "available" && !used) return null;

  const shell =
    "flex flex-col gap-4 rounded-[var(--radius-card)] border border-[#f0c63c]/35 bg-[linear-gradient(90deg,rgba(240,198,60,0.11),rgba(240,198,60,0.02))] px-5 py-4 sm:flex-row sm:items-center sm:justify-between";
  const art = <GoldenKey flip={!rtl} className="h-auto w-[86px] shrink-0 -rotate-6 drop-shadow-[0_8px_14px_rgba(0,0,0,0.45)]" />;

  if (!used) {
    return (
      <div className={shell}>
        <div className="flex items-center gap-4">
          {art}
          <div className="min-w-0">
            <p className="text-[16px] font-extrabold text-[var(--text)]">{t("freeKey.dash.availableTitle")}</p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--text-soft)]">{t("freeKey.dash.availableDesc")}</p>
          </div>
        </div>
        <Link
          to={offersLink(lang, { mode: "premium" })}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13.5px] font-extrabold text-[#1d1403] transition-transform hover:scale-[1.02]"
          style={{ background: `linear-gradient(135deg, ${GOLD_SOFT}, #f0c63c 55%, ${GOLD_DEEP})` }}
        >
          <Key size={16} /> {t("freeKey.dash.availableCta")}
        </Link>
      </div>
    );
  }

  const name = fk.usedCompany?.name;
  const value = code.data?.premium_code || null;

  const copy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard?.writeText(value);
    } catch {
      /* الحافظة غير متاحة */
    }
    logCodeCopy(companyId, true, "free_key");
    setCopied(true);
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 1600);
    onCopied?.(value);
  };

  return (
    <div className={shell}>
      <div className="flex min-w-0 items-center gap-4">
        {art}
        <div className="min-w-0">
          <p className="text-[16px] font-extrabold text-[var(--text)]">{name ? t("freeKey.dash.usedTitle", { company: name }) : t("freeKey.dash.usedTitleGeneric")}</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--text-soft)]">{name ? t("freeKey.dash.usedDesc") : t("freeKey.dash.usedGone")}</p>
        </div>
      </div>
      {name && (
        <div className="flex shrink-0 items-stretch gap-2">
          <div className="flex min-w-[150px] items-center justify-between gap-3 rounded-xl border border-dashed border-[#f0c63c]/45 bg-[#f0c63c]/[0.06] px-3.5 py-2.5">
            <span className="text-[10.5px] font-semibold text-[var(--color-mute)]">{t("card.premiumCode")}</span>
            {code.loading ? (
              <Loader2 size={16} className="animate-spin text-[#f0c63c]" aria-label={t("freeKey.dash.loading")} />
            ) : (
              <span className="font-mono text-[15px] font-extrabold tracking-widest text-[var(--text)]" dir="ltr">
                {value || "—"}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={copy}
            disabled={!value}
            className="flex items-center gap-1.5 rounded-xl px-4 text-[13.5px] font-extrabold text-[#1d1403] disabled:opacity-50"
            style={{ background: copied ? "linear-gradient(135deg, #34d399, #10b981)" : `linear-gradient(135deg, ${GOLD_SOFT}, ${GOLD_DEEP})` }}
          >
            {copied ? <Check size={16} /> : <Copy size={15} />} {copied ? t("card.copied") : t("card.copy")}
          </button>
        </div>
      )}
    </div>
  );
}
