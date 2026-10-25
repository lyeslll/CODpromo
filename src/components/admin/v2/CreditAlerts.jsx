import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Crown, Loader2, RotateCcw } from "lucide-react";
import { fetchCreditAlerts, resolveCreditAlert } from "../../../lib/keysAdmin.js";
import { useAdminT, Glass, fmt, fmtDate } from "./ui.jsx";

const money = (t, amount, currency) =>
  currency === "DZD" ? t("sales.dzd", { n: fmt(amount) }) : currency === "USD" ? t("sales.usd", { n: Number(amount).toFixed(Number.isInteger(Number(amount)) ? 0 : 2) }) : `${fmt(amount)} ${currency}`;

// "امنح Premium" ما يخدمش كي الحساب Premium من قبل، تمسح، ولا المبلغ ما يطابقش
const NO_GRANT = new Set(["already_premium", "no_account", "amount"]);  // credit_revoked: قرار الأدمن (يقدر يمنح)

/**
 * /admin/sales — تنبيهات Premium بالرصيد (phase38) فوق المبيعات:
 *  - refund_needed: دفعة وصلت بعد ما تلغى دفع الباقي وما تفعّلش بيها Premium → "رجّعت الدراهم" ولا "امنح Premium".
 *  - uncovered: Premium بالباقي تفعّل والمفاتيح اللي تحسبت فيه استرجعت دراهمها → "خلّي Premium" (ولا الاسترداد تحت).
 *  - granted (آخر 30 يوم): دفعات متأخّرة تفعّل بيها Premium وحدو (الرصيد كان مازال مغطّي) — للمعلومة.
 * ما يبان والو كي ما كاين حتى تنبيه.
 */
export default function CreditAlerts({ notify, tick = 0, onChanged }) {
  const t = useAdminT();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(null);
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  const load = useCallback(async () => {
    try {
      setData(await fetchCreditAlerts());
    } catch (e) {
      setData(null);
      notifyRef.current("error", e.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, tick]);

  const act = async (row, action) => {
    const vars = { email: row.email || t("sales.deletedUser"), amount: money(t, row.amount, row.currency), provider: t(`sales.provider.${row.provider}`) };
    if (!window.confirm(t(`keys.alerts.confirm.${action}`, vars))) return;
    setBusy(`${row.id}:${action}`);
    try {
      const r = await resolveCreditAlert(row.id, action);
      notifyRef.current(["refunded", "granted", "kept"].includes(r) ? "success" : "error", t(`keys.alerts.res.${r}`));
      await load();
      onChanged?.();
    } catch (e) {
      notifyRef.current("error", e.message);
    } finally {
      setBusy(null);
    }
  };

  const open = data?.open || [];
  const granted = data?.granted || [];
  if (!open.length && !granted.length) return null;

  return (
    <Glass className="mb-5 border border-[#f87171]/30 p-5">
      {open.length > 0 && (
        <>
          <h2 className="flex items-center gap-2 text-[16px] font-extrabold text-white">
            <AlertTriangle size={17} className="text-[#fca5a5]" /> {t("keys.alerts.title", { n: fmt(open.length) })}
          </h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-mute)]">{t("keys.alerts.hint")}</p>
          <ul className="mt-3 divide-y divide-white/[0.05]">
            {open.map((row) => {
              const vars = {
                email: row.email || t("sales.deletedUser"),
                amount: money(t, row.amount, row.currency),
                credit: money(t, row.credit, row.currency),
                provider: t(`sales.provider.${row.provider}`),
              };
              return (
                <li key={`${row.kind}:${row.id}`} className="flex flex-col gap-2 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-[13px] font-bold text-white" dir="ltr">{vars.email}</span>
                      <span className="rounded-md bg-[#f87171]/15 px-1.5 py-0.5 text-[11px] font-bold text-[#fca5a5]">{t(`keys.alerts.kind.${row.kind}`)}</span>
                      <span className="text-[11.5px] text-[var(--color-mute)]">{fmtDate(row.at, true)}</span>
                    </div>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-[#c9c9cf]">
                      {t(`keys.alerts.desc.${row.kind}`, vars)}
                      {row.note && <> {t(`keys.alerts.note.${row.note.startsWith("grant") ? "grant" : row.note}`)}</>}
                    </p>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--color-mute)]">
                      {row.kind === "uncovered" ? t("keys.alerts.howUncovered") : t(`keys.alerts.howRefund.${row.provider}`)}
                      {(row.payment_ref || row.provider_ref) && (
                        <span className="ms-1 font-mono" dir="ltr">
                          {row.payment_ref || row.provider_ref}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {row.kind === "refund_needed" ? (
                      <>
                        <ActionButton busy={busy === `${row.id}:refunded`} onClick={() => act(row, "refunded")} icon={RotateCcw} label={t("keys.alerts.action.refunded")} />
                        {!NO_GRANT.has(row.note) && <ActionButton busy={busy === `${row.id}:grant`} onClick={() => act(row, "grant")} icon={Crown} label={t("keys.alerts.action.grant")} />}
                      </>
                    ) : (
                      <ActionButton busy={busy === `${row.id}:keep`} onClick={() => act(row, "keep")} icon={CheckCircle2} label={t("keys.alerts.action.keep")} />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {granted.length > 0 && (
        <div className={open.length ? "mt-4 border-t border-white/[0.06] pt-4" : ""}>
          <h3 className="flex items-center gap-2 text-[13.5px] font-extrabold text-white">
            <CheckCircle2 size={15} className="text-[#a6f000]" /> {t("keys.alerts.grantedTitle")}
          </h3>
          <ul className="mt-2 space-y-1">
            {granted.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center gap-x-2 text-[12px] text-[#c9c9cf]">
                <span dir="ltr" className="font-bold text-white">{g.email || t("sales.deletedUser")}</span>
                <span>{money(t, g.amount, g.currency)}</span>
                <span>· {t(`sales.provider.${g.provider}`)}</span>
                <span className="text-[var(--color-mute)]">· {fmtDate(g.at, true)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Glass>
  );
}

function ActionButton({ busy, onClick, icon: Icon, label }) {
  return (
    <button type="button" onClick={onClick} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[12px] font-bold text-white hover:bg-white/[0.05] disabled:opacity-50">
      {busy ? <Loader2 size={13} className="animate-spin" /> : <Icon size={13} />} {label}
    </button>
  );
}
