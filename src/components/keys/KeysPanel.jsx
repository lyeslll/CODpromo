import { Link, useNavigate } from "react-router-dom";
import { ArrowDownLeft, ArrowUpRight, Crown, Gift, Key, LockOpen, RotateCcw, ShoppingBag } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useKeys } from "../../lib/keysContext.jsx";
import { useFreeKey } from "../../lib/freeKeyContext.jsx";
import { formatPrice } from "../../lib/pricing.jsx";
import { offersLink, premiumPath, storePath } from "../../lib/seo.js";
import { formatNumber } from "../../lib/values.js";
import KeysSheet from "./KeysSheet.jsx";
import { DiamondGlyph, DiamondKey } from "./DiamondKey.jsx";
import { DIA_BG, DIA_DEEP, DIA_INK, DIA_SOFT } from "./diamond.js";
import { formatMoney } from "./money.js";
import "./keys.css";

const GOLD = "#f0c63c";
const GOLD_SOFT = "#ffe486";
const GOLD_BG = "linear-gradient(135deg, #ffe486, #f0c63c 55%, #cf9a1e)";

const KIND_ICON = { purchase: ShoppingBag, gift: Gift, use: LockOpen, refund: RotateCcw };

/**
 * لوحة المفاتيح (من العدّاد في الهيدر ولا الداشبورد): الرصيد الماسي، حالة المفتاح الذهبي، الرصيد اللي ينقص
 * من Premium (الموقع برك)، الشراء، وتاريخ المفاتيح (آخر 50 حركة من دفتر القاعدة).
 */
export default function KeysPanel() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const navigate = useNavigate();
  const keys = useKeys();
  const fk = useFreeKey();
  const open = keys.panelOpen && keys.status === "ok";
  const go = (to) => {
    keys.closePanel();
    navigate(to);
  };
  const credit = keys.showCredit ? keys.credit : null;
  const paid = credit ? credit.creditDzd : 0;
  const fmtDay = (d) => new Date(d).toLocaleDateString(lang, { day: "numeric", month: "short", year: "numeric" });

  return (
    <KeysSheet
      open={open}
      onClose={keys.closePanel}
      labelledBy="keys-panel-title"
      title={t("keys.panel.title")}
      icon={
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: DIA_BG }}>
          <DiamondGlyph size={20} />
        </span>
      }
    >
      {/* الرصيد */}
      <div className="relative overflow-hidden rounded-2xl border p-4" style={{ borderColor: `${DIA_DEEP}55`, background: "linear-gradient(160deg, rgba(169,205,255,0.14), rgba(169,205,255,0.02) 70%)" }}>
        <div className="flex items-center gap-4">
          <DiamondKey sparkle flip={i18n.dir() === "ltr"} className="h-auto w-[118px] shrink-0 -rotate-6 drop-shadow-[0_10px_18px_rgba(150,195,255,0.35)]" />
          <div className="min-w-0">
            <p className="text-[12.5px] font-bold text-[var(--text-soft)]">{t("keys.panel.balance")}</p>
            <p className="mt-0.5 text-[34px] font-black leading-none tabular-nums" style={{ color: DIA_SOFT }}>
              {formatNumber(keys.balance, lang)}
            </p>
            <p className="mt-1 text-[12.5px] font-bold text-[var(--text-softer)]">{t("keys.count", { count: keys.balance })}</p>
            {keys.demo && <span className="mt-1.5 inline-block rounded-full border border-white/20 px-2 py-0.5 text-[10.5px] font-black text-[var(--text-soft)]">{t("keys.demo")}</span>}
          </div>
        </div>
      </div>

      {/* المفتاح الذهبي */}
      {(fk.status === "available" || fk.status === "used") && (
        <div className="mt-2.5 flex items-center gap-3 rounded-2xl border border-[#f0c63c]/25 bg-[#f0c63c]/[0.05] px-3.5 py-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: fk.status === "available" ? GOLD_BG : "rgba(240,198,60,0.12)" }}>
            <Key size={16} className={fk.status === "available" ? "text-[#1d1403]" : "text-[#f0c63c]"} />
          </span>
          <div className="min-w-0 text-[13px] leading-snug">
            <p className="font-extrabold text-[var(--text)]">{t("keys.panel.golden")}</p>
            <p className="truncate text-[var(--text-soft)]">
              {fk.status === "available"
                ? t("keys.panel.goldenOn")
                : fk.usedCompany?.name
                  ? t("keys.panel.goldenUsed", { company: fk.usedCompany.name })
                  : t("keys.panel.goldenUsedGeneric")}
            </p>
          </div>
        </div>
      )}

      {/* النظام العادل (الموقع برك) */}
      {credit && paid > 0 && (
        <div className="mt-2.5 rounded-2xl border px-3.5 py-3" style={{ borderColor: `${GOLD}40`, background: "linear-gradient(160deg, rgba(240,198,60,0.1), rgba(240,198,60,0.02))" }}>
          <p className="flex items-start gap-2 text-[13px] font-bold leading-relaxed text-[var(--text-softer)]">
            <Crown size={15} className="mt-[3px] shrink-0" style={{ color: GOLD }} />
            <span>
              {credit.covered
                ? t("keys.credit.covered", { paid: formatMoney(t, lang, paid, "DZD") })
                : t("keys.credit.line", { paid: formatMoney(t, lang, paid, "DZD"), due: formatPrice(t, lang, credit.dueDzd, credit.dueUsd) })}
            </span>
          </p>
          <button
            type="button"
            onClick={() => go(`${premiumPath(lang)}?checkout=1`)}
            className="mt-2.5 inline-flex items-center gap-1.5 text-[13px] font-extrabold underline decoration-dotted underline-offset-4"
            style={{ color: GOLD_SOFT }}
          >
            {credit.covered ? t("keys.credit.activate") : t("keys.credit.cta")} <ArrowUpRight size={14} className="rtl:-scale-x-100" />
          </button>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <button type="button" onClick={() => go(`${premiumPath(lang)}#keys`)} className="dk-glint flex items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-[14.5px] font-extrabold" style={{ background: DIA_BG, color: DIA_INK }}>
          <DiamondGlyph size={17} /> {t("keys.panel.buy")}
        </button>
        <button type="button" onClick={() => go(offersLink(lang, { mode: "premium" }))} className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-ink-line)] px-4 py-3.5 text-[14px] font-bold text-[var(--text)] transition-colors hover:bg-[var(--fill)]">
          <LockOpen size={16} /> {t("keys.panel.open")}
        </button>
      </div>

      {/* التاريخ */}
      <h3 className="mb-2 mt-5 text-[13px] font-extrabold text-[var(--text-softer)]">{t("keys.panel.history")}</h3>
      {keys.history.length ? (
        <ul className="divide-y divide-dashed divide-[var(--color-ink-line)] rounded-2xl border border-[var(--color-ink-line)] bg-[var(--color-ink)]/60">
          {keys.history.map((h) => {
            const Icon = KIND_ICON[h.kind] || Key;
            const plus = h.delta > 0;
            const label =
              h.kind === "purchase"
                ? t("keys.history.purchase", { count: h.order_keys || h.delta })
                : h.kind === "gift"
                  ? t("keys.history.gift")
                  : h.kind === "refund"
                    ? t("keys.history.refund")
                    : h.company?.name
                      ? t("keys.history.useCompany", { company: h.company.name })
                      : t("keys.history.use");
            return (
              <li key={h.id} className="flex items-center gap-3 px-3.5 py-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.05] text-[var(--text-soft)]">
                  <Icon size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  {h.kind === "use" && h.company?.slug ? (
                    <Link to={storePath(h.company.slug, lang)} onClick={keys.closePanel} className="block truncate text-[13.5px] font-bold text-[var(--text)] hover:underline">
                      {label}
                    </Link>
                  ) : (
                    <p className="truncate text-[13.5px] font-bold text-[var(--text)]">{label}</p>
                  )}
                  <p className="text-[11.5px] text-[var(--color-mute)]">{fmtDay(h.created_at)}</p>
                </div>
                <span className="flex items-center gap-0.5 text-[14px] font-black tabular-nums" style={{ color: plus ? DIA_SOFT : "var(--text-soft)" }} dir="ltr">
                  {plus ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />}
                  {plus ? `+${h.delta}` : `${h.delta}`}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-[var(--color-ink-line)] px-4 py-5 text-center text-[13px] text-[var(--color-mute)]">{t("keys.panel.empty")}</p>
      )}
      <p className="mt-3 text-[12px] leading-relaxed text-[var(--color-mute)]">{t("keys.panel.rules")}</p>
    </KeysSheet>
  );
}
