import { useCallback, useEffect, useState } from "react";
import { Key, CalendarDays, CalendarRange, Infinity as InfinityIcon, BadgeDollarSign, AlertTriangle, AlertCircle, RefreshCw, Loader2, UserRound } from "lucide-react";
import CompanyLogo from "../../CompanyLogo.jsx";
import { getTypeMeta } from "../../../lib/types.js";
import { fetchFreeKeyStats, listFreeReveals, setFreeKeyEnabled } from "../../../lib/freeKey.js";
import { ChartCard, TopList } from "./OverviewPage.jsx";
import { useAdminT, Glass, PageHeader, Skeleton, EmptyState, fmt, fmtDate, GOLD_BG } from "./ui.jsx";

const GOLD = "#f0c63c";
const PAGE = 50;

/**
 * /admin/free-key — المفتاح الذهبي (phase31): كود Premium واحد مجاناً لكل حساب في حياتو.
 * السويتش العام (site_stats.free_key_enabled)، الأرقام (اليوم / 7 أيام / الكل + منحنى 30 يوم + أكثر
 * الشركات + شحال اشترك مدفوع من بعد مفتاحو)، تنبيه أكثر من 5 كشوفات من نفس IP في يوم (تنبيه برك)،
 * وآخر الكشوفات. كلش عبر RPCs تتحقق من is_admin (count دقيق). منفصل على المشتركين والدخل.
 */
export default function FreeKeyPage({ notify }) {
  const t = useAdminT();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [more, setMore] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    setError("");
    setStats(null);
    setRows(null);
    try {
      const [s, list] = await Promise.all([fetchFreeKeyStats(), listFreeReveals(PAGE, 0)]);
      setStats(s);
      setRows(list);
      setTotal(Number(list[0]?.total_count) || 0);
    } catch (e) {
      setError(e.message || t("common.loadFailed"));
      setRows([]);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load, tick]);

  const loadMore = async () => {
    setMore(true);
    try {
      const list = await listFreeReveals(PAGE, rows.length);
      setRows((prev) => [...prev, ...list]);
    } catch (e) {
      notify("error", e.message);
    } finally {
      setMore(false);
    }
  };

  const toggle = async () => {
    if (!stats || switching) return;
    const next = !stats.enabled;
    setSwitching(true);
    try {
      const v = await setFreeKeyEnabled(next);
      setStats((s) => ({ ...s, enabled: v }));
      notify("success", v ? t("freeKey.turnedOn") : t("freeKey.turnedOff"));
    } catch (e) {
      notify("error", e.message);
    } finally {
      setSwitching(false);
    }
  };

  const enabled = !!stats?.enabled;
  const switchEl = (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={!stats || switching}
      onClick={toggle}
      className="inline-flex items-center gap-3 rounded-xl border border-white/[0.08] bg-black/30 px-3.5 py-2.5 text-[13.5px] font-bold text-white disabled:opacity-60"
    >
      {switching ? <Loader2 size={16} className="animate-spin" style={{ color: GOLD }} /> : <Key size={16} style={{ color: enabled ? GOLD : "#6b7280" }} />}
      {enabled ? t("freeKey.on") : t("freeKey.off")}
      <span className="relative h-6 w-11 shrink-0 rounded-full transition-colors" style={{ background: enabled ? GOLD : "rgba(255,255,255,0.12)" }}>
        <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all" style={{ insetInlineStart: enabled ? 22 : 2 }} />
      </span>
    </button>
  );

  if (error) {
    return (
      <>
        <PageHeader title={t("nav.freeKey")} sub={t("pages.freeKeySub")} />
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

  const kpis = [
    { id: "today", icon: CalendarDays, value: stats?.today },
    { id: "week", icon: CalendarRange, value: stats?.week },
    { id: "total", icon: InfinityIcon, value: stats?.total },
    { id: "converted", icon: BadgeDollarSign, value: stats?.converted, note: t("freeKey.convertedNote") },
  ];

  return (
    <>
      <PageHeader title={t("nav.freeKey")} sub={t("pages.freeKeySub")} actions={switchEl} />

      {stats && !enabled && (
        <p role="status" className="mb-5 flex items-start gap-2.5 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[13.5px] font-semibold leading-relaxed text-[#c9c9cf]">
          <Key size={17} className="mt-0.5 shrink-0 text-[#6b7280]" /> {t("freeKey.offNote")}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map((k) => (
          <Glass key={k.id} glow={`${GOLD}2e`} className="h-full p-4 sm:p-5">
            <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: `${GOLD}1a`, color: GOLD }}>
              <k.icon size={18} />
            </span>
            {stats ? (
              <div className="mt-4 text-[28px] font-black leading-none tabular-nums text-white sm:text-[32px]">{fmt(k.value)}</div>
            ) : (
              <Skeleton className="mt-4 h-7 w-16" />
            )}
            <div className="mt-1.5 text-[13px] font-bold text-[#c9c9cf]">{t(`freeKey.kpi.${k.id}`)}</div>
            {k.note && <div className="mt-2 text-[11.5px] leading-relaxed text-[var(--color-mute)]">{k.note}</div>}
          </Glass>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <ChartCard title={t("freeKey.chart")} color={GOLD} data={stats} field="reveals" />
        <TopList title={t("freeKey.top")} rows={stats?.top_companies} loading={!stats} valueOf={(r) => Number(r.n) || 0} unit={t("freeKey.unit")} />
      </div>

      {/* تنبيه برك (بلا حبس): بزاف ناس يتقاسمو نفس IP في شبكات الموبايل */}
      {stats?.ip_alerts?.length > 0 && (
        <Glass className="mt-5 border-[#fbbf24]/25 p-5">
          <h2 className="flex items-center gap-2 text-[15px] font-extrabold text-white">
            <AlertTriangle size={16} className="text-[#fbbf24]" /> {t("freeKey.alertsTitle")}
          </h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-mute)]">{t("freeKey.alertsHint")}</p>
          <ul className="mt-4 space-y-2.5">
            {stats.ip_alerts.map((a) => (
              <li key={`${a.ip}-${a.day}`} className="rounded-xl border border-white/[0.06] bg-black/25 px-3.5 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-[13.5px] font-bold text-white">
                    {t("freeKey.alertLine", { n: fmt(a.n), day: fmtDate(a.day) })}
                  </span>
                  <span className="font-mono text-[11.5px] text-[#6b7280]" dir="ltr" title={t("freeKey.ipHint")}>
                    IP #{a.ip}
                  </span>
                </div>
                {a.emails?.length > 0 && (
                  <p className="mt-1.5 break-all text-[12px] leading-relaxed text-[#a1a1aa]" dir="ltr">
                    {a.emails.filter(Boolean).join(" · ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Glass>
      )}

      <Glass className="mt-5 p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[16px] font-extrabold text-white">{t("freeKey.listTitle")}</h2>
          {rows && rows.length > 0 && <span className="text-[12.5px] text-[var(--color-mute)]">{t("freeKey.listCount", { shown: fmt(rows.length), total: fmt(total) })}</span>}
        </div>
        {rows === null ? (
          <div className="space-y-2.5">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[58px] rounded-xl" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon={Key} title={t("freeKey.emptyTitle")} desc={t("freeKey.emptyDesc")} />
        ) : (
          <>
            <ul className="divide-y divide-white/[0.05]">
              {rows.map((r) => {
                const meta = getTypeMeta(r.company_type);
                return (
                  <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.04] text-[#a1a1aa]">
                      <UserRound size={17} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-bold text-white">{r.full_name || r.email || t("freeKey.deletedUser")}</div>
                      {r.email && r.full_name && (
                        <div className="truncate text-[12px] text-[var(--color-mute)]" dir="ltr">
                          {r.email}
                        </div>
                      )}
                    </div>
                    <div className="flex min-w-0 items-center gap-2.5 sm:w-[240px]">
                      {r.company_id ? <CompanyLogo logo={r.company_logo} name={r.company_name} size={30} accent={meta.color} /> : null}
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-bold text-[#e4e4e7]">{r.company_name || t("freeKey.deletedCompany")}</div>
                        <div className="text-[11.5px] text-[var(--color-mute)]">{t(`freeKey.source.${r.source}`, { defaultValue: r.source })}</div>
                      </div>
                    </div>
                    <span className="w-full text-[12px] tabular-nums text-[var(--color-mute)] sm:w-auto sm:text-end">{fmtDate(r.created_at, true)}</span>
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
                  {more && <Loader2 size={15} className="animate-spin" />} {t("freeKey.more")}
                </button>
              </div>
            )}
          </>
        )}
      </Glass>
    </>
  );
}
