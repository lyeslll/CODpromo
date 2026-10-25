import { useCallback, useEffect, useRef, useState } from "react";
import { CreditCard, Gem, Landmark, Loader2, RotateCcw, Smartphone, UserRound, Wallet } from "lucide-react";
import { listKeyOrders, refundKeyOrder } from "../../../lib/keysAdmin.js";
import { useAdminT, Glass, Segmented, Skeleton, EmptyState, fmt, fmtDate } from "./ui.jsx";

const ICE = "#a9cdff";
const PAGE = 50;
const PROVIDER = {
  stripe: { icon: CreditCard, color: "#8f8bff" },
  paypal: { icon: Wallet, color: "#4ea8ff" },
  slickpay: { icon: Landmark, color: "#38bdf8" },
  google_play: { icon: Smartphone, color: "#34d27b" },
};
// Stripe و PayPal: الـ webhook ينحّي المفاتيح وحدو كي ترجّع الدراهم من لوحتهم؛ SlickPay و Google Play يدوي من هنا
const MANUAL = new Set(["slickpay", "google_play"]);

const money = (t, amount, currency) =>
  currency === "DZD" ? t("sales.dzd", { n: fmt(amount) }) : currency === "USD" ? t("sales.usd", { n: Number(amount).toFixed(Number.isInteger(Number(amount)) ? 0 : 2) }) : `${fmt(amount)} ${currency}`;

/**
 * /admin/sales — تبويب "المفاتيح الماسية": كل طلبات الباقات (البوابة، المبلغ، شارة "تجربة")، المفاتيح اللي
 * ما تستعملوش، أهلية الاسترداد (7 أيام، ما تحسبش في Premium) وحصّتها، و"سجّل الاسترداد".
 */
export default function KeyOrdersList({ notify, onChanged }) {
  const t = useAdminT();
  const [filter, setFilter] = useState("all");
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(null);
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  const load = useCallback(async () => {
    setRows(null);
    try {
      const list = await listKeyOrders(filter, PAGE, 0);
      setRows(list);
      setTotal(Number(list[0]?.total_count) || 0);
    } catch (e) {
      setRows([]);
      notifyRef.current("error", e.message);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = async () => {
    setMore(true);
    try {
      const list = await listKeyOrders(filter, PAGE, rows.length);
      setRows((prev) => [...prev, ...list]);
    } catch (e) {
      notify("error", e.message);
    } finally {
      setMore(false);
    }
  };

  const refund = async (r) => {
    if (busy) return;
    const info = r.refund || {};
    const who = r.full_name || r.email || t("sales.deletedUser");
    const msg = t("keys.refundConfirm", { name: who, amount: money(t, info.amount, r.currency), n: fmt(info.unused), provider: t(`sales.provider.${r.provider}`) });
    if (!window.confirm(info.eligible ? msg : `${t("keys.refundNotEligible")}\n\n${msg}`)) return;
    setBusy(r.id);
    try {
      const res = await refundKeyOrder(r.id);
      notify(res?.status === "refunded" ? "success" : "error", t(`keys.refundRes.${res?.status || "not_found"}`, { n: fmt(res?.removed ?? 0) }));
      load();
      onChanged?.();
    } catch (e) {
      notify("error", e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Glass className="mt-5 p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-extrabold text-white">{t("keys.ordersTitle")}</h2>
          <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--color-mute)]">{t("keys.refundRule")}</p>
        </div>
        <Segmented
          value={filter}
          onChange={setFilter}
          size="sm"
          label={t("sales.filterLabel")}
          options={["all", "eligible", "refunded", "pending"].map((v) => ({ value: v, label: t(`keys.filter.${v}`) }))}
        />
      </div>

      {rows === null ? (
        <div className="space-y-2.5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[64px] rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Gem} title={t("keys.emptyOrders")} desc={t("keys.emptyOrdersDesc")} />
      ) : (
        <>
          <ul className="divide-y divide-white/[0.05]">
            {rows.map((r) => {
              const P = PROVIDER[r.provider] || PROVIDER.stripe;
              const info = r.refund || {};
              const status = r.refunded_at
                ? { text: t("keys.status.refunded", { date: fmtDate(r.refunded_at), amount: money(t, r.refunded_amount, r.currency) }), color: "#f87171" }
                : r.status !== "paid"
                  ? { text: t(`keys.status.${r.status}`), color: "#9ca3af" }
                  : info.eligible
                    ? { text: t("keys.status.eligible", { n: fmt(info.unused), amount: money(t, info.amount, r.currency), date: fmtDate(info.refund_until) }), color: "#a6f000" }
                    : { text: t(`keys.status.${info.reason || "expired"}`, { n: fmt(info.unused ?? 0) }), color: info.reason === "in_premium" || info.reason === "premium_pending" ? "#f0c63c" : "#9ca3af" };
              return (
                <li key={r.id} className="grid gap-3 py-3.5 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.3fr)_auto] md:items-center">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.04] text-[#a1a1aa]">
                      <UserRound size={17} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 truncate text-[13.5px] font-bold text-white">
                        <span className="truncate">{r.full_name || r.email || t("sales.deletedUser")}</span>
                        {r.is_admin && <span className="shrink-0 rounded-md bg-white/10 px-1.5 py-0.5 text-[10.5px] font-bold text-[#c9c9cf]">{t("sales.adminTag")}</span>}
                      </div>
                      {r.email && r.full_name && (
                        <div className="truncate text-[12px] text-[var(--color-mute)]" dir="ltr">
                          {r.email}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-black" style={{ background: `${ICE}22`, color: ICE }}>
                      <Gem size={12} /> {t("keys.typeBadge", { n: fmt(r.keys) })}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-[#e4e4e7]">
                      <P.icon size={14} style={{ color: P.color }} /> {t(`sales.provider.${r.provider}`)}
                    </span>
                    <span className="text-[14px] font-black tabular-nums text-white">{money(t, r.amount, r.currency)}</span>
                    {r.tier === "test" && <span className="rounded-md bg-[#38bdf8]/15 px-1.5 py-0.5 text-[11px] font-bold text-[#7dd3fc]">{t("pricing.tier.test")}</span>}
                  </div>
                  <div className="min-w-0 text-[12.5px] leading-relaxed">
                    <div className="tabular-nums text-[#c9c9cf]">{fmtDate(r.paid_at || r.created_at, true)}</div>
                    <div className="font-bold" style={{ color: status.color }}>
                      {status.text}
                    </div>
                  </div>
                  <div className="flex md:justify-end">
                    {r.status === "paid" && !r.refunded_at && Number(info.unused) > 0 && (
                      <button
                        type="button"
                        onClick={() => refund(r)}
                        disabled={busy === r.id}
                        title={MANUAL.has(r.provider) ? undefined : t("keys.autoHint")}
                        className={
                          MANUAL.has(r.provider)
                            ? "inline-flex items-center gap-1.5 rounded-xl border border-[#f87171]/40 bg-[#f87171]/10 px-3 py-2 text-[12.5px] font-extrabold text-[#fca5a5] disabled:opacity-60"
                            : "inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-[12px] font-bold text-[#9ca3af] disabled:opacity-60"
                        }
                      >
                        {busy === r.id ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />} {t("keys.refund")}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {rows.length < total && (
            <div className="mt-4 flex justify-center">
              <button type="button" onClick={loadMore} disabled={more} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-[13px] font-extrabold text-white disabled:opacity-60">
                {more && <Loader2 size={15} className="animate-spin" />} {t("sales.more")}
              </button>
            </div>
          )}
        </>
      )}
    </Glass>
  );
}
