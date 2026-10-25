import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowUpCircle,
  BadgeDollarSign,
  Crown,
  Gem,
  Gift,
  Landmark,
  Loader2,
  LockOpen,
  RefreshCw,
  RotateCcw,
  Search,
  ShoppingBag,
  Undo2,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { fetchKeysHistory, fetchKeysStats, giftKeys, listCreditUses, listKeysAccounts, revokeCreditUpgrade } from "../../../lib/keysAdmin.js";
import { ChartCard } from "./OverviewPage.jsx";
import { useAdminT, Glass, PageHeader, Skeleton, EmptyState, fmt, fmtDate, inputCls } from "./ui.jsx";

const ICE = "#a9cdff";
const ICE_BG = { background: "linear-gradient(135deg, #f4fbff, #bcdcff 50%, #8fb2ff)", color: "#0b1430" };
const PAGE = 50;
const KIND_ICON = { purchase: ShoppingBag, gift: Gift, use: LockOpen, refund: RotateCcw };

const money = (t, amount, currency) =>
  currency === "DZD" ? t("sales.dzd", { n: fmt(amount) }) : currency === "USD" ? t("sales.usd", { n: Number(amount).toFixed(Number.isInteger(Number(amount)) ? 0 : 2) }) : `${fmt(amount)} ${currency}`;

/**
 * /admin/keys — المفاتيح الماسية (phase37): الأرقام (المباعة، المستعملة، المهداة، الباقية، المداخيل، الزبائن،
 * "شراو مفاتيح ومن بعد طلعو لـ Premium")، منحنى 30 يوم، رصيد وتاريخ كل حساب، إهداء مفاتيح لأي حساب مع السبب،
 * والتفعيل بالرصيد. كلش عبر RPCs تتحقق من is_admin. المبيعات بلا التجربة ولا الأدمن.
 */
export default function KeysPage({ notify }) {
  const t = useAdminT();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [more, setMore] = useState(false);
  const [history, setHistory] = useState(null); // { user, data }
  const [credits, setCredits] = useState(null);
  const [tick, setTick] = useState(0);
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  const load = useCallback(async () => {
    setError("");
    setStats(null);
    try {
      const [s, cu] = await Promise.all([fetchKeysStats(), listCreditUses()]);
      setStats(s);
      setCredits(cu);
    } catch (e) {
      setError(e.message || t("common.loadFailed"));
    }
  }, [t]);

  const loadRows = useCallback(async () => {
    setRows(null);
    try {
      const list = await listKeysAccounts(q, PAGE, 0);
      setRows(list);
      setTotal(Number(list[0]?.total_count) || 0);
    } catch (e) {
      setRows([]);
      notifyRef.current("error", e.message);
    }
  }, [q]);

  useEffect(() => {
    load();
  }, [load, tick]);
  useEffect(() => {
    loadRows();
  }, [loadRows, tick]);
  useEffect(() => {
    const id = setTimeout(() => setQ(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);

  const loadMore = async () => {
    setMore(true);
    try {
      const list = await listKeysAccounts(q, PAGE, rows.length);
      setRows((prev) => [...prev, ...list]);
    } catch (e) {
      notify("error", e.message);
    } finally {
      setMore(false);
    }
  };

  const openHistory = async (r) => {
    setHistory({ user: r, data: null });
    try {
      setHistory({ user: r, data: await fetchKeysHistory(r.user_id) });
    } catch (e) {
      notify("error", e.message);
      setHistory(null);
    }
  };

  const revokeUpgrade = async (c) => {
    if (!window.confirm(t("keys.revokeUpgradeConfirm", { email: c.email || t("sales.deletedUser") }))) return;
    try {
      const r = await revokeCreditUpgrade(c.id);
      notify(r === "revoked" ? "success" : "error", t(`keys.revokeUpgradeRes.${r}`));
      setTick((x) => x + 1);
    } catch (e) {
      notify("error", e.message);
    }
  };

  if (error) {
    return (
      <>
        <PageHeader title={t("nav.keys")} sub={t("pages.keysSub")} />
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
  const kpis = [
    { id: "sold", icon: ShoppingBag, value: stats ? fmt(stats.keys_sold) : null, note: stats ? t("keys.kpiNote.orders", { n: fmt(stats.orders) }) : null },
    { id: "used", icon: LockOpen, value: stats ? fmt(stats.keys_used) : null },
    { id: "gifted", icon: Gift, value: stats ? fmt(stats.keys_gifted) : null },
    { id: "outstanding", icon: Gem, value: stats ? fmt(stats.keys_outstanding) : null, note: stats ? t("keys.kpiNote.removed", { n: fmt(stats.keys_removed) }) : null },
    { id: "revenueDzd", icon: Landmark, value: stats ? money(t, revenue("DZD"), "DZD") : null },
    { id: "revenueUsd", icon: BadgeDollarSign, value: stats ? money(t, revenue("USD"), "USD") : null },
    { id: "buyers", icon: Users, value: stats ? fmt(stats.buyers) : null, note: stats ? t("keys.kpiNote.tests", { n: fmt(stats.tests) }) : null },
    { id: "upgraded", icon: ArrowUpCircle, value: stats ? fmt(stats.upgraded) : null, note: t("keys.kpiNote.upgraded") },
  ];

  return (
    <>
      <PageHeader
        title={t("nav.keys")}
        sub={t("pages.keysSub")}
        actions={
          <button type="button" onClick={() => setTick((x) => x + 1)} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3.5 py-2 text-[13px] font-bold text-white">
            <RefreshCw size={14} /> {t("common.refresh")}
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map((k) => (
          <Glass key={k.id} glow={`${ICE}2e`} className="h-full p-4 sm:p-5">
            <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: `${ICE}1a`, color: ICE }}>
              <k.icon size={18} />
            </span>
            {k.value != null ? (
              <div className="mt-4 break-words text-[22px] font-black leading-tight tabular-nums text-white sm:text-[26px]">{k.value}</div>
            ) : (
              <Skeleton className="mt-4 h-7 w-16" />
            )}
            <div className="mt-1.5 text-[13px] font-bold text-[#c9c9cf]">{t(`keys.kpi.${k.id}`)}</div>
            {k.note && <div className="mt-2 text-[11.5px] leading-relaxed text-[var(--color-mute)]">{k.note}</div>}
          </Glass>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <ChartCard title={t("keys.chartSold")} color={ICE} data={stats ? { ...stats, series_unit: "day" } : null} field="sold" />
        <ChartCard title={t("keys.chartUsed")} color="#a6f000" data={stats ? { ...stats, series_unit: "day" } : null} field="used" />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <GiftForm notify={notify} onDone={() => setTick((x) => x + 1)} />
        <CreditUses rows={credits} onRevoke={revokeUpgrade} />
      </div>

      {/* الحسابات */}
      <Glass className="mt-5 p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-extrabold text-white">{t("keys.accountsTitle")}</h2>
            <p className="mt-0.5 text-[12px] text-[var(--color-mute)]">{t("keys.accountsHint")}</p>
          </div>
          <label className="relative w-full max-w-xs">
            <Search size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[#6b7280]" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("keys.search")} dir="auto" className={`${inputCls} ps-9`} />
          </label>
        </div>
        {rows === null ? (
          <div className="space-y-2.5">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[56px] rounded-xl" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon={Gem} title={t("keys.emptyAccounts")} desc={t("keys.emptyAccountsDesc")} />
        ) : (
          <>
            <ul className="divide-y divide-white/[0.05]">
              {rows.map((r) => (
                <li key={r.user_id}>
                  <button type="button" onClick={() => openHistory(r)} className="grid w-full gap-2 py-3 text-start transition-colors hover:bg-white/[0.02] md:grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)_auto] md:items-center">
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.04] text-[#a1a1aa]">
                        <UserRound size={17} />
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 truncate text-[13.5px] font-bold text-white">
                          <span className="truncate">{r.full_name || r.email || t("sales.deletedUser")}</span>
                          {r.premium && <Crown size={13} className="shrink-0 text-[#f0c63c]" />}
                        </span>
                        {r.email && (
                          <span className="block truncate text-[12px] text-[var(--color-mute)]" dir="ltr">
                            {r.email}
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] font-bold text-[#c9c9cf]">
                      <span>{t("keys.col.bought", { n: fmt(r.bought) })}</span>
                      <span>{t("keys.col.used", { n: fmt(r.used) })}</span>
                      <span>{t("keys.col.gifted", { n: fmt(r.gifted) })}</span>
                      {Number(r.removed) > 0 && <span className="text-[#fca5a5]">{t("keys.col.removed", { n: fmt(r.removed) })}</span>}
                    </span>
                    <span className="flex items-center gap-2 md:justify-end">
                      <span className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[14px] font-black tabular-nums" style={{ background: `${ICE}1f`, color: ICE }}>
                        <Gem size={14} /> {fmt(r.balance)}
                      </span>
                      <span className="text-[11.5px] tabular-nums text-[var(--color-mute)]">{fmtDate(r.last_at)}</span>
                    </span>
                  </button>
                </li>
              ))}
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

      {history && <HistoryDrawer t={t} history={history} onClose={() => setHistory(null)} />}
    </>
  );
}

/** إهداء مفاتيح لأي حساب بالإيميل مع السبب (1–20). */
function GiftForm({ notify, onDone }) {
  const t = useAdminT();
  const [email, setEmail] = useState("");
  const [count, setCount] = useState(3);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const valid = /\S+@\S+\.\S+/.test(email.trim()) && Number(count) >= 1 && Number(count) <= 20 && reason.trim().length >= 3;

  const submit = async (e) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    try {
      const r = await giftKeys(email, count, reason);
      notify("success", t("keys.giftDone", { email: r.email, n: fmt(r.keys), balance: fmt(r.balance) }) + (r.premium ? ` ${t("keys.giftPremiumNote")}` : ""));
      setEmail("");
      setReason("");
      onDone?.();
    } catch (err) {
      notify("error", err.code === "P0002" ? t("keys.giftNoUser") : err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Glass as="form" onSubmit={submit} className="p-5">
      <h2 className="flex items-center gap-2 text-[16px] font-extrabold text-white">
        <Gift size={17} style={{ color: ICE }} /> {t("keys.giftTitle")}
      </h2>
      <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-mute)]">{t("keys.giftHint")}</p>
      <label className="mt-4 block">
        <span className="mb-1.5 block text-[13px] font-bold text-[#c9c9cf]">{t("keys.giftEmail")}</span>
        <input type="email" required dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
      </label>
      <label className="mt-3 block">
        <span className="mb-1.5 block text-[13px] font-bold text-[#c9c9cf]">{t("keys.giftCount")}</span>
        <input type="number" min={1} max={20} step={1} dir="ltr" value={count} onChange={(e) => setCount(e.target.value)} className={`${inputCls} tabular-nums`} />
      </label>
      <label className="mt-3 block">
        <span className="mb-1.5 block text-[13px] font-bold text-[#c9c9cf]">{t("keys.giftReason")}</span>
        <textarea required minLength={3} maxLength={300} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className={`${inputCls} resize-y`} />
      </label>
      <button type="submit" disabled={!valid || busy} className="mt-4 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13.5px] font-extrabold disabled:opacity-50" style={ICE_BG}>
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Gem size={16} />} {t("keys.giftSubmit")}
      </button>
    </Glass>
  );
}

/** شراءات Premium بالرصيد (الباقي بالبوابة) والتفعيل الكامل بالرصيد. */
function CreditUses({ rows, onRevoke }) {
  const t = useAdminT();
  return (
    <Glass className="p-5">
      <h2 className="flex items-center gap-2 text-[16px] font-extrabold text-white">
        <Crown size={17} className="text-[#f0c63c]" /> {t("keys.creditTitle")}
      </h2>
      <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-mute)]">{t("keys.creditHint")}</p>
      {rows === null ? (
        <Skeleton className="mt-4 h-24 rounded-xl" />
      ) : rows.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-[13px] text-[var(--color-mute)]">{t("keys.creditEmpty")}</p>
      ) : (
        <ul className="mt-3 divide-y divide-white/[0.05]">
          {rows.slice(0, 30).map((c) => (
            <li key={c.provider_ref} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-bold text-white" dir="ltr">
                  {c.email || t("sales.deletedUser")}
                </div>
                <div className="text-[12px] text-[#c9c9cf]">
                  {c.kind === "full" ? t("keys.creditFull") : t("keys.creditCheckout", { provider: t(`sales.provider.${c.provider}`), due: money(t, c.amount_due, c.currency) })}
                  {" · "}
                  {t("keys.creditUsed", { amount: money(t, c.credit, c.currency) })}
                  {c.tier === "test" && <span className="ms-1.5 rounded-md bg-[#38bdf8]/15 px-1.5 py-0.5 text-[10.5px] font-bold text-[#7dd3fc]">{t("pricing.tier.test")}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${c.applied ? "bg-[#a6f000]/15 text-[#a6f000]" : "bg-white/[0.06] text-[#9ca3af]"}`}>
                  {c.revoked_at ? t("keys.creditRevoked") : c.applied ? t("keys.creditApplied") : t("keys.creditOpen")}
                </span>
                {/* الرصيد اللي تحسب ما بقاش مغطّى (مفاتيح استرجعت دراهمها): قرار الأدمن (سحب Premium من المبيعات) */}
                {c.applied && c.backed === false && (
                  <span className="rounded-md bg-[#f87171]/15 px-1.5 py-0.5 text-[11px] font-bold text-[#fca5a5]" title={t("keys.creditUnbackedHint")}>
                    {t("keys.creditUnbacked")}
                  </span>
                )}
                {c.kind === "full" && c.applied && (
                  <button type="button" onClick={() => onRevoke(c)} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[11.5px] font-bold text-[#9ca3af] hover:text-white">
                    <Undo2 size={12} /> {t("keys.revokeUpgrade")}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Glass>
  );
}

/** تاريخ حساب (الدفتر): كل حركة بتاريخها، السبب، والطلب. */
function HistoryDrawer({ t, history, onClose }) {
  const { user, data } = history;
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[90] flex justify-end bg-black/60" onClick={onClose}>
      <aside role="dialog" aria-modal="true" aria-label={t("keys.historyTitle")} onClick={(e) => e.stopPropagation()} className="h-full w-full max-w-md overflow-y-auto border-s border-white/10 bg-[#0d0d10] p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[17px] font-extrabold text-white">{t("keys.historyTitle")}</h2>
            <p className="truncate text-[12.5px] text-[var(--color-mute)]" dir="ltr">
              {user.email}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label={t("common.close")} className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 text-[#9ca3af] hover:text-white">
            <X size={16} />
          </button>
        </div>
        {!data ? (
          <Skeleton className="mt-5 h-40 rounded-xl" />
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="text-[12px] font-bold text-[#c9c9cf]">{t("keys.kpi.outstanding")}</div>
                <div className="mt-1 text-[22px] font-black tabular-nums" style={{ color: ICE }}>
                  {fmt(data.balance)}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="text-[12px] font-bold text-[#c9c9cf]">{t("keys.locked")}</div>
                <div className="mt-1 text-[22px] font-black tabular-nums text-white">{fmt(data.locked)}</div>
              </div>
            </div>
            {data.credit?.status === "ok" && Number(data.credit.credit_dzd) > 0 && (
              <p className="mt-3 rounded-xl border border-[#f0c63c]/30 bg-[#f0c63c]/[0.06] px-3 py-2.5 text-[12.5px] font-bold text-[#ffe486]">
                {t("keys.historyCredit", { paid: money(t, data.credit.credit_dzd, "DZD"), due: money(t, data.credit.due_dzd, "DZD") })}
              </p>
            )}
            <ul className="mt-4 space-y-2">
              {(data.rows || []).map((h) => {
                const Icon = KIND_ICON[h.kind] || Gem;
                return (
                  <li key={h.id} className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-[13px] font-bold text-white">
                        <Icon size={15} style={{ color: ICE }} /> {t(`keys.kindLabels.${h.kind}`)}
                        {h.company?.name && <span className="text-[#c9c9cf]">· {h.company.name}</span>}
                      </span>
                      <span className="text-[14px] font-black tabular-nums" dir="ltr" style={{ color: h.delta > 0 ? ICE : "#c9c9cf" }}>
                        {h.delta > 0 ? `+${h.delta}` : h.delta}
                      </span>
                    </div>
                    <div className="mt-1 text-[11.5px] text-[var(--color-mute)]">
                      {fmtDate(h.created_at, true)}
                      {h.order && ` · ${t(`sales.provider.${h.order.provider}`)} · ${money(t, h.order.amount, h.order.currency)}${h.order.tier === "test" ? ` · ${t("pricing.tier.test")}` : ""}`}
                      {h.by && ` · ${h.by}`}
                    </div>
                    {h.note && <div className="mt-1 text-[12px] font-semibold text-[#e4e4e7]">{t("keys.reason", { note: h.note })}</div>}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </aside>
    </div>
  );
}
