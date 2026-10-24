import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Ban,
  BadgeDollarSign,
  CreditCard,
  Gift,
  Key,
  Landmark,
  Loader2,
  RefreshCw,
  RotateCcw,
  Smartphone,
  Armchair,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { fetchSalesStats, listPurchases, revokePurchase } from "../../../lib/sales.js";
import { ChartCard } from "./OverviewPage.jsx";
import { useAdminT, Glass, PageHeader, Segmented, Skeleton, EmptyState, fmt, fmtDate, GOLD_BG } from "./ui.jsx";

const GOLD = "#f0c63c";
const PAGE = 50;
const DAY = 86400000;

const PROVIDER = {
  stripe: { icon: CreditCard, color: "#8f8bff" },
  paypal: { icon: Wallet, color: "#4ea8ff" },
  slickpay: { icon: Landmark, color: "#38bdf8" },
  google_play: { icon: Smartphone, color: "#34d27b" },
};
// الاسترداد من Stripe و PayPal يسحب Premium وحدو (webhook)؛ SlickPay و Google Play يدوي من هنا
const MANUAL_REVOKE = new Set(["slickpay", "google_play"]);

/** "9,900 دج" / "39$" */
const money = (t, amount, currency) =>
  currency === "DZD" ? t("sales.dzd", { n: fmt(amount) }) : currency === "USD" ? t("sales.usd", { n: fmt(amount) }) : `${fmt(amount)} ${currency}`;

/**
 * /admin/sales — مبيعات Premium مدى الحياة (purchases برك؛ بلا الهدايا والمفتاح الذهبي والأدمن):
 * المشترين، الدخل حسب العملة، المقاعد الباقية، "اشترى بعد الهدية / بعد المفتاح الذهبي" (بتاريخ الشراء)،
 * منحنى 30 يوم، وقائمة المشتريات مع أهلية الاسترداد (7 أيام + بلا كشف كود Premium جديد بعد الشراء)
 * وزر "سحب Premium بعد الاسترداد".
 */
export default function SalesPage({ notify }) {
  const t = useAdminT();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(null);
  const [tick, setTick] = useState(0);
  // notify يتبدّل في كل رسم تاع Admin.jsx → ref باش التحميل ما يتعاودش بلا حدّ
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  const loadStats = useCallback(async () => {
    setError("");
    setStats(null);
    try {
      setStats(await fetchSalesStats());
    } catch (e) {
      setError(e.message || t("common.loadFailed"));
    }
  }, [t]);

  const loadRows = useCallback(async () => {
    setRows(null);
    try {
      const list = await listPurchases(filter, PAGE, 0);
      setRows(list);
      setTotal(Number(list[0]?.total_count) || 0);
    } catch (e) {
      setRows([]);
      notifyRef.current("error", e.message);
    }
  }, [filter]);

  useEffect(() => {
    loadStats();
  }, [loadStats, tick]);

  useEffect(() => {
    loadRows();
  }, [loadRows, tick]);

  const loadMore = async () => {
    setMore(true);
    try {
      const list = await listPurchases(filter, PAGE, rows.length);
      setRows((prev) => [...prev, ...list]);
    } catch (e) {
      notify("error", e.message);
    } finally {
      setMore(false);
    }
  };

  const revoke = async (r) => {
    if (busy) return;
    const who = r.full_name || r.email || t("sales.deletedUser");
    if (!window.confirm(t("sales.revokeConfirm", { name: who, provider: t(`sales.provider.${r.provider}`) }))) return;
    setBusy(r.id);
    try {
      const res = await revokePurchase(r.id);
      notify("success", res === "already" ? t("sales.revokeAlready") : t("sales.revoked"));
      setTick((x) => x + 1);
    } catch (e) {
      notify("error", e.message);
    } finally {
      setBusy(null);
    }
  };

  if (error) {
    return (
      <>
        <PageHeader title={t("nav.sales")} sub={t("pages.salesSub")} />
        <Glass>
          <EmptyState
            icon={AlertCircle}
            title={t("common.loadFailed")}
            desc={error}
            action={
              <button type="button" onClick={() => setTick((x) => x + 1)} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-[13px] font-bold text-white">
                <RefreshCw size={14} /> {t("common.retry")}
              </button>
            }
          />
        </Glass>
      </>
    );
  }

  const revenue = (cur) => stats?.revenue?.find((r) => r.currency === cur)?.amount ?? 0;
  const pricing = stats?.pricing;
  const kpis = [
    { id: "buyers", icon: Users, value: stats ? fmt(stats.buyers) : null },
    { id: "revenueDzd", icon: Landmark, value: stats ? money(t, revenue("DZD"), "DZD") : null },
    { id: "revenueUsd", icon: BadgeDollarSign, value: stats ? money(t, revenue("USD"), "USD") : null },
    {
      id: "seats",
      icon: Armchair,
      value: pricing ? (pricing.tier === "launch" ? `${fmt(pricing.seats_left)} / ${fmt(pricing.seats_total)}` : t("sales.launchOver")) : null,
    },
    { id: "refunded", icon: RotateCcw, value: stats ? fmt(stats.refunded) : null },
    { id: "afterGift", icon: Gift, value: stats ? fmt(stats.after_gift) : null, note: t("sales.afterGiftNote") },
    { id: "afterKey", icon: Key, value: stats ? fmt(stats.after_free_key) : null, note: t("sales.afterKeyNote") },
  ];

  return (
    <>
      <PageHeader
        title={t("nav.sales")}
        sub={t("pages.salesSub")}
        actions={
          <button type="button" onClick={() => setTick((x) => x + 1)} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3.5 py-2 text-[13px] font-bold text-white">
            <RefreshCw size={14} /> {t("common.refresh")}
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map((k) => (
          <Glass key={k.id} glow={`${GOLD}2e`} className="h-full p-4 sm:p-5">
            <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: `${GOLD}1a`, color: GOLD }}>
              <k.icon size={18} />
            </span>
            {k.value != null ? (
              <div className="mt-4 break-words text-[22px] font-black leading-tight tabular-nums text-white sm:text-[26px]">{k.value}</div>
            ) : (
              <Skeleton className="mt-4 h-7 w-16" />
            )}
            <div className="mt-1.5 text-[13px] font-bold text-[#c9c9cf]">{t(`sales.kpi.${k.id}`)}</div>
            {k.note && <div className="mt-2 text-[11.5px] leading-relaxed text-[var(--color-mute)]">{k.note}</div>}
          </Glass>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <ChartCard title={t("sales.chart")} color={GOLD} data={stats ? { ...stats, series_unit: "day" } : null} field="n" />
        <Glass className="p-5">
          <h2 className="text-[15px] font-extrabold text-white">{t("sales.byProvider")}</h2>
          <ul className="mt-4 space-y-2.5">
            {Object.keys(PROVIDER).map((p) => {
              const P = PROVIDER[p];
              return (
                <li key={p} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-black/25 px-3.5 py-2.5">
                  <span className="flex items-center gap-2.5 text-[13.5px] font-bold text-[#e4e4e7]">
                    <P.icon size={16} style={{ color: P.color }} /> {t(`sales.provider.${p}`)}
                  </span>
                  {stats ? <span className="text-[15px] font-black tabular-nums text-white">{fmt(stats.by_provider?.[p] ?? 0)}</span> : <Skeleton className="h-5 w-8" />}
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-[11.5px] leading-relaxed text-[var(--color-mute)]">{t("sales.excludedNote")}</p>
        </Glass>
      </div>

      <Glass className="mt-5 p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-extrabold text-white">{t("sales.listTitle")}</h2>
            <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--color-mute)]">{t("sales.refundRule")}</p>
          </div>
          <Segmented
            value={filter}
            onChange={setFilter}
            size="sm"
            label={t("sales.filterLabel")}
            options={["all", "active", "eligible", "refunded"].map((v) => ({ value: v, label: t(`sales.filter.${v}`) }))}
          />
        </div>

        {rows === null ? (
          <div className="space-y-2.5">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[64px] rounded-xl" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon={BadgeDollarSign} title={t("sales.emptyTitle")} desc={t("sales.emptyDesc")} />
        ) : (
          <>
            <ul className="divide-y divide-white/[0.05]">
              {rows.map((r) => {
                const P = PROVIDER[r.provider] || PROVIDER.stripe;
                const daysLeft = Math.max(0, Math.ceil((new Date(r.refund_until) - Date.now()) / DAY));
                const reveals = Number(r.reveals_after) || 0;
                const status = r.refunded_at
                  ? { text: t("sales.status.refunded", { date: fmtDate(r.refunded_at) }), color: "#f87171" }
                  : r.eligible
                    ? { text: t("sales.status.eligible", { days: fmt(daysLeft) }), color: "#a6f000" }
                    : reveals > 0
                      ? { text: t("sales.status.revealed", { n: fmt(reveals), date: fmtDate(r.first_reveal_at, true) }), color: "#fbbf24" }
                      : { text: t("sales.status.expired"), color: "#9ca3af" };
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
                      <span className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-[#e4e4e7]">
                        <P.icon size={14} style={{ color: P.color }} /> {t(`sales.provider.${r.provider}`)}
                      </span>
                      <span className="text-[14px] font-black tabular-nums text-white">{money(t, r.amount, r.currency)}</span>
                      <span
                        className="rounded-md px-1.5 py-0.5 text-[11px] font-bold"
                        style={r.tier === "launch" ? { background: `${GOLD}22`, color: GOLD } : { background: "rgba(255,255,255,0.08)", color: "#c9c9cf" }}
                      >
                        {t(`pricing.tier.${r.tier}`)}
                      </span>
                    </div>
                    <div className="min-w-0 text-[12.5px] leading-relaxed">
                      <div className="tabular-nums text-[#c9c9cf]">{fmtDate(r.purchased_at, true)}</div>
                      <div className="font-bold" style={{ color: status.color }}>
                        {status.text}
                      </div>
                    </div>
                    <div className="flex md:justify-end">
                      {!r.refunded_at && (
                        <button
                          type="button"
                          onClick={() => revoke(r)}
                          disabled={busy === r.id}
                          title={MANUAL_REVOKE.has(r.provider) ? undefined : t("sales.autoHint")}
                          className={
                            MANUAL_REVOKE.has(r.provider)
                              ? "inline-flex items-center gap-1.5 rounded-xl border border-[#f87171]/40 bg-[#f87171]/10 px-3 py-2 text-[12.5px] font-extrabold text-[#fca5a5] disabled:opacity-60"
                              : "inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-[12px] font-bold text-[#9ca3af] disabled:opacity-60"
                          }
                        >
                          {busy === r.id ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />} {t("sales.revoke")}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            {rows.length < total && (
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={more}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-extrabold text-[#1d1403] disabled:opacity-60"
                  style={GOLD_BG}
                >
                  {more && <Loader2 size={15} className="animate-spin" />} {t("sales.more")}
                </button>
              </div>
            )}
          </>
        )}
      </Glass>
    </>
  );
}
