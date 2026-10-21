import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Copy, Check, Crown, Lock, ClipboardList } from "lucide-react";
import { useTranslation } from "react-i18next";
import CompanyLogo from "../../CompanyLogo.jsx";
import { getTypeMeta } from "../../../lib/types.js";
import { getPremiumCode } from "../../../lib/supabase.js";
import { offersPath } from "../../../lib/seo.js";

const GOLD_SOFT = "#ffe486";

/** "منذ 3 ساعات" بلغة الواجهة. */
function relTime(iso, lang) {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const steps = [
    [60, "second"],
    [3600, "minute", 60],
    [86400, "hour", 3600],
    [604800, "day", 86400],
    [2629800, "week", 604800],
    [31557600, "month", 2629800],
    [Infinity, "year", 31557600],
  ];
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
  for (const [limit, unit, div = 1] of steps) {
    if (abs < limit) return rtf.format(Math.round(diff / div), unit);
  }
  return "";
}

/**
 * آخر الأكواد اللي نسختها: الشركة + الكود + زر "انسخ مرة أخرى".
 * كود Premium يُجلب خادمياً (get_premium_code) — إن انتهى الاشتراك يبقى مقفولاً ويفتح نافذة Premium.
 */
export default function RecentCopies({ rows, loading, premiumActive, onCopy, onUnlock }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  return (
    <section className="h-full rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)]">
      <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-5 sm:px-6">
        <h2 className="text-[18px] font-extrabold text-[var(--text)]">{t("dashboard.copies.title")}</h2>
        {rows.length > 0 && <span className="text-[12.5px] font-bold text-[var(--color-mute)]">{t("dashboard.copies.last", { count: rows.length })}</span>}
      </div>

      {loading ? (
        <ul className="space-y-2 px-3 pb-4 sm:px-4">
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-[62px] animate-pulse rounded-2xl bg-[var(--fill)]" />
          ))}
        </ul>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center px-6 pb-8 pt-4 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--fill)] text-[var(--color-mute)]">
            <ClipboardList size={24} />
          </span>
          <p className="mt-4 text-[15px] font-extrabold text-[var(--text)]">{t("dashboard.copies.emptyTitle")}</p>
          <p className="mt-1 max-w-xs text-[13px] text-[var(--text-soft)]">{t("dashboard.copies.emptyDesc")}</p>
          <Link
            to={offersPath(lang)}
            className="mt-5 rounded-xl px-4 py-2.5 text-[13.5px] font-extrabold text-[#0a0a0a]"
            style={{ background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" }}
          >
            {t("dashboard.customer.browse")}
          </Link>
        </div>
      ) : (
        <ul className="px-2 pb-3 sm:px-3">
          {rows.map((r) => (
            <CopyRow key={r.id} row={r} lang={lang} premiumActive={premiumActive} onCopy={onCopy} onUnlock={onUnlock} />
          ))}
        </ul>
      )}
    </section>
  );
}

function CopyRow({ row, lang, premiumActive, onCopy, onUnlock }) {
  const { t } = useTranslation();
  const c = row.companies;
  const meta = getTypeMeta(c.type);
  const isPremium = row.premium;
  const accent = isPremium ? GOLD_SOFT : meta.color;
  const [pcode, setPcode] = useState(null);
  const [copied, setCopied] = useState(false);
  const locked = isPremium && !premiumActive;

  useEffect(() => {
    if (!isPremium || !premiumActive) return;
    let active = true;
    getPremiumCode(c.id)
      .then((d) => active && setPcode(d?.premium_code || null))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isPremium, premiumActive, c.id]);

  const code = isPremium ? pcode : c.code;

  const again = () => {
    if (locked) return onUnlock();
    if (!code) return;
    onCopy(c, code, isPremium);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <li className="flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-[var(--fill)]">
      <CompanyLogo logo={c.logo} name={c.name} size={40} accent={accent} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[14px] font-bold text-[var(--text)]">{c.name}</span>
          {isPremium && <Crown size={13} className="shrink-0" style={{ color: GOLD_SOFT }} aria-label={t("premiumToggle.premium")} />}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[12.5px]">
          <span className="shrink-0 font-mono font-extrabold tracking-wide" style={{ color: accent }} dir="ltr">
            {locked ? "••••••" : code || "······"}
          </span>
          <span className="truncate text-[var(--color-mute)]">{relTime(row.created_at, lang)}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={again}
        className="flex h-10 w-10 shrink-0 items-center justify-center gap-1.5 rounded-xl border sm:w-auto border-[var(--color-ink-line)] px-3 text-[12.5px] font-bold text-[var(--text-softer)] transition-colors hover:border-[var(--color-lime)]/40 hover:text-[var(--accent-text)]"
        aria-label={`${locked ? t("dashboard.copies.unlock") : t("dashboard.copies.again")}: ${c.name}`}
      >
        {locked ? <Lock size={14} /> : copied ? <Check size={14} className="text-[var(--color-lime)]" /> : <Copy size={14} />}
        <span className="hidden sm:inline">{locked ? t("dashboard.copies.unlock") : copied ? t("dashboard.copies.done") : t("dashboard.copies.again")}</span>
      </button>
    </li>
  );
}
