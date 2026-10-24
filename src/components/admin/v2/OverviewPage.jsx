import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Users, Crown, Store, Inbox, Copy, ThumbsUp, AtSign, AlertCircle, RefreshCw, TrendingUp, Trophy } from "lucide-react";
import CompanyLogo from "../../CompanyLogo.jsx";
import { getTypeMeta } from "../../../lib/types.js";
import { fetchAdminOverview } from "../../../lib/adminStats.js";
import { Glass, PageHeader, RangeFilter, Skeleton, EmptyState, fmt, useAdminT } from "./ui.jsx";

const RANGE_KEY = "codpromo:admin-range";
const readRange = () => {
  try {
    return localStorage.getItem(RANGE_KEY) || "7d";
  } catch {
    return "7d";
  }
};

/** نظرة عامة: كل الأرقام من admin_overview (محسوبة في قاعدة البيانات). */
export default function OverviewPage() {
  const t = useAdminT();
  const [range, setRange] = useState(readRange);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    try {
      localStorage.setItem(RANGE_KEY, range);
    } catch {
      /* تجاهل */
    }
    let active = true;
    setError("");
    setData(null);
    fetchAdminOverview(range)
      .then((d) => active && setData(d))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [range, tick]);

  const success = data && data.votes_range > 0 ? Math.round((100 * data.votes_up_range) / data.votes_range) : null;

  const cards = data
    ? [
        { id: "users", wide: true, icon: Users, color: "#a6f000", value: data.users_total, extra: [[t("ov.today"), data.users_today], [t("ov.last7"), data.users_7d]] },
        { id: "premium", icon: Crown, color: "#f0c63c", value: data.premium_active, note: t("ov.premiumNote") },
        { id: "companies", icon: Store, color: "#38bdf8", value: data.companies, extra: [[t("ov.offers"), data.offers]] },
        { id: "requests", icon: Inbox, color: "#fbbf24", value: data.requests_pending, to: "/admin/requests", note: data.requests_pending ? t("ov.review") : t("ov.noPending") },
        { id: "copies", icon: Copy, color: "#a6f000", value: data.copies_range, note: t(`range.in_${range}`) },
        { id: "success", icon: ThumbsUp, color: "#a6f000", value: success == null ? null : `${success}%`, note: t("ov.votesCount", { count: data.votes_range }) },
        { id: "subscribers", icon: AtSign, color: "#38bdf8", value: data.subscribers_total, extra: [[t(`range.in_${range}`), data.subscribers_range]] },
      ]
    : null;

  return (
    <>
      <PageHeader title={t("nav.overview")} sub={t("ov.sub")} actions={<RangeFilter value={range} onChange={setRange} />} />

      {error ? (
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
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {cards
              ? cards.map((c) => <Kpi key={c.id} {...c} label={t(`ov.kpi.${c.id}`)} />)
              : Array.from({ length: 7 }, (_, i) => (
                  <Glass key={i} className={`p-4 ${i === 0 ? "col-span-2" : ""}`}>
                    <Skeleton className="h-9 w-9 rounded-xl" />
                    <Skeleton className="mt-4 h-7 w-20" />
                    <Skeleton className="mt-2 h-3 w-28" />
                  </Glass>
                ))}
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <ChartCard title={t("ov.chartSignups")} color="#a6f000" data={data} field="signups" />
            <ChartCard title={t("ov.chartCopies")} color="#38bdf8" data={data} field="copies" />
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <TopList title={t("ov.topCopied")} rows={data?.top_copied} loading={!data} valueOf={(r) => r.n} unit={t("ov.copiesUnit")} />
            <TopList
              title={t("ov.topVoted")}
              rows={data?.top_voted}
              loading={!data}
              valueOf={(r) => r.n}
              unit={t("ov.votesUnit")}
              extraOf={(r) => t("ov.successShort", { pct: Math.round((100 * r.up) / Math.max(1, r.n)) })}
            />
          </div>
        </>
      )}
    </>
  );
}

function Kpi({ icon: Icon, color, value, label, extra, note, to, wide }) {
  const body = (
    <Glass glow={`${color}2e`} className={`h-full p-4 sm:p-5 ${to ? "transition-colors hover:border-white/15" : ""}`}>
      <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: `${color}1a`, color }}>
        <Icon size={18} />
      </span>
      <div className="mt-4 text-[28px] font-black leading-none tabular-nums text-white sm:text-[32px]">{typeof value === "string" ? value : fmt(value)}</div>
      <div className="mt-1.5 text-[13px] font-bold text-[#c9c9cf]">{label}</div>
      {extra && (
        <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-[var(--color-mute)]">
          {extra.map(([l, v]) => (
            <span key={l}>
              {l} <b className="font-extrabold tabular-nums text-[#c9c9cf]">{fmt(v)}</b>
            </span>
          ))}
        </div>
      )}
      {note && <div className="mt-2.5 text-[12px] text-[var(--color-mute)]">{note}</div>}
    </Glass>
  );
  const span = wide ? "col-span-2" : "";
  return to ? (
    <Link to={to} className={`block h-full rounded-[20px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-lime)] ${span}`}>
      {body}
    </Link>
  ) : (
    <div className={span}>{body}</div>
  );
}

/** منحنى بسيط (SVG): مساحة + خط، مع قيمة النقطة عند المرور/اللمس. */
export function ChartCard({ title, color, data, field }) {
  const t = useAdminT();
  const [hover, setHover] = useState(null);
  const series = data?.series || [];
  const unit = data?.series_unit;
  const W = 600;
  const H = 180;
  const P = { t: 12, r: 8, b: 26, l: 8 };
  const vals = series.map((s) => Number(s[field]) || 0);
  const max = Math.max(1, ...vals);
  const total = vals.reduce((a, b) => a + b, 0);
  const x = (i) => P.l + (series.length <= 1 ? (W - P.l - P.r) / 2 : (i * (W - P.l - P.r)) / (series.length - 1));
  const y = (v) => P.t + (H - P.t - P.b) * (1 - v / max);

  const label = (s) => {
    const d = new Date(s.t);
    if (unit === "hour") return d.toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" });
    if (unit === "month") return d.toLocaleDateString("ar", { month: "short", year: "2-digit" });
    return d.toLocaleDateString("ar", { day: "numeric", month: "short" });
  };

  const path = useMemo(() => {
    if (!series.length) return { line: "", area: "" };
    const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    return { line: `M${pts.join(" L")}`, area: `M${x(0)},${H - P.b} L${pts.join(" L")} L${x(vals.length - 1)},${H - P.b} Z` };
  }, [data, field]); // eslint-disable-line react-hooks/exhaustive-deps

  const ticks = series.length ? [0, Math.floor((series.length - 1) / 2), series.length - 1].filter((v, i, a) => a.indexOf(v) === i) : [];
  const gid = `g-${field}`;

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    for (let i = 1; i < series.length; i++) if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    setHover(best);
  };

  return (
    <Glass className="p-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[15px] font-extrabold text-white">
          <TrendingUp size={16} style={{ color }} /> {title}
        </h2>
        {data && (
          <span className="text-[12.5px] text-[var(--color-mute)]">
            {t("ov.total")} <b className="font-black tabular-nums text-white">{fmt(total)}</b>
          </span>
        )}
      </div>
      {!data ? (
        <Skeleton className="h-[180px] w-full" />
      ) : (
        <div className="relative" dir="ltr">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-[180px] w-full touch-pan-y"
            preserveAspectRatio="none"
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={() => setHover(null)}
            role="img"
            aria-label={`${title}: ${fmt(total)}`}
          >
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={color} stopOpacity="0.32" />
                <stop offset="1" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75].map((f) => (
              <line key={f} x1={P.l} x2={W - P.r} y1={P.t + (H - P.t - P.b) * f} y2={P.t + (H - P.t - P.b) * f} stroke="rgba(255,255,255,0.05)" strokeDasharray="3 5" />
            ))}
            <path d={path.area} fill={`url(#${gid})`} />
            <path d={path.line} fill="none" stroke={color} strokeWidth="2.2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            {hover != null && (
              <>
                <line x1={x(hover)} x2={x(hover)} y1={P.t} y2={H - P.b} stroke="rgba(255,255,255,0.18)" vectorEffect="non-scaling-stroke" />
                <circle cx={x(hover)} cy={y(vals[hover])} r="4" fill="#0a0a0a" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
              </>
            )}
          </svg>
          <div className="pointer-events-none relative h-4 text-[11px] text-[var(--color-mute)]" dir="rtl">
            {ticks.map((i) => (
              <span key={i} className="absolute top-0 -translate-x-1/2 whitespace-nowrap" style={{ left: `${(x(i) / W) * 100}%` }}>
                {label(series[i])}
              </span>
            ))}
          </div>
          {hover != null && (
            <div
              className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-lg border border-white/10 bg-[#0b0b0d]/95 px-2.5 py-1.5 text-center text-[12px] shadow-xl"
              style={{ left: `${Math.min(88, Math.max(12, (x(hover) / W) * 100))}%` }}
              dir="rtl"
            >
              <div className="font-black tabular-nums text-white">{fmt(vals[hover])}</div>
              <div className="text-[11px] text-[var(--color-mute)]">{label(series[hover])}</div>
            </div>
          )}
          {total === 0 && <p className="absolute inset-x-0 top-[70px] text-center text-[13px] text-[var(--color-mute)]" dir="rtl">{t("ov.noData")}</p>}
        </div>
      )}
    </Glass>
  );
}

export function TopList({ title, rows, loading, valueOf, unit, extraOf }) {
  const t = useAdminT();
  const max = Math.max(1, ...(rows || []).map(valueOf));
  return (
    <Glass className="p-5">
      <h2 className="mb-3 flex items-center gap-2 text-[15px] font-extrabold text-white">
        <Trophy size={16} className="text-[#f0c63c]" /> {title}
      </h2>
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : !rows?.length ? (
        <EmptyState title={t("ov.topEmpty")} desc={t("ov.topEmptyDesc")} />
      ) : (
        <ol className="space-y-2.5">
          {rows.map((r, i) => {
            const meta = getTypeMeta(r.type);
            return (
              <li key={r.id} className="flex items-center gap-3">
                <span className="w-4 shrink-0 text-center text-[12px] font-black tabular-nums text-[var(--color-mute)]">{i + 1}</span>
                <CompanyLogo logo={r.logo} name={r.name} size={34} accent={meta.color} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[13.5px] font-bold text-white">{r.name}</span>
                    <span className="shrink-0 text-[12px] text-[var(--color-mute)]">
                      <b className="font-black tabular-nums text-white">{fmt(valueOf(r))}</b> {unit}
                      {extraOf && <span className="ms-2">{extraOf(r)}</span>}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                    <div className="h-full rounded-full" style={{ width: `${(100 * valueOf(r)) / max}%`, background: meta.color }} />
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Glass>
  );
}
