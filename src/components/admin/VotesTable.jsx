import { useEffect, useMemo, useState } from "react";
import { ThumbsUp, ThumbsDown, Loader2, AlertTriangle, Vote, ArrowUpDown } from "lucide-react";
import { fetchVoteStats, relativeTime } from "../../lib/votes.js";
import CompanyLogo from "../CompanyLogo.jsx";

// ============================================================
//  لوحة الأدمن — إحصائيات التصويت لكل شركة (👍 / 👎 / النسبة / آخر نجاح)
//  مفيدة لاكتشاف الأكواد الميتة (نسبة نجاح منخفضة) وتحديثها.
//  عربية RTL ثابتة (داخل غلاف الأدمن الداكن).
// ============================================================

const DEAD_RATE = 50; // أقل من هذه النسبة (مع أصوات كافية) = كود ميت محتمل
const MIN_VOTES = 3;

export default function VotesTable({ companies = [] }) {
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState("dead"); // dead | votes | rate

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchVoteStats()
      .then((m) => active && setStats(m || {}))
      .catch(() => active && setStats({}))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  // دمج الشركات مع إحصائياتها
  const rows = useMemo(() => {
    const list = companies.map((c) => {
      const s = stats[c.id] || { up_count: 0, down_count: 0, total_count: 0, success_rate: 0, last_up_at: null };
      return { company: c, ...s };
    });
    const voted = list.filter((r) => r.total_count > 0);
    const unvoted = list.filter((r) => r.total_count === 0);

    if (sortBy === "votes") {
      voted.sort((a, b) => b.total_count - a.total_count);
    } else if (sortBy === "rate") {
      voted.sort((a, b) => b.success_rate - a.success_rate || b.total_count - a.total_count);
    } else {
      // dead: الأكواد الميتة (أقل نسبة، أصوات كافية) أولاً
      voted.sort((a, b) => a.success_rate - b.success_rate || b.total_count - a.total_count);
    }
    return [...voted, ...unvoted];
  }, [companies, stats, sortBy]);

  // ملخّص عام
  const totals = useMemo(() => {
    let up = 0, down = 0, dead = 0;
    for (const id in stats) {
      up += stats[id].up_count;
      down += stats[id].down_count;
      if (stats[id].total_count >= MIN_VOTES && stats[id].success_rate < DEAD_RATE) dead += 1;
    }
    return { up, down, total: up + down, dead };
  }, [stats]);

  if (loading) {
    return (
      <div className="grid min-h-[30vh] place-items-center">
        <Loader2 size={28} className="animate-spin text-[var(--color-lime)]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ملخّص */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Summary icon={Vote} label="إجمالي الأصوات" value={totals.total} color="#a6f000" />
        <Summary icon={ThumbsUp} label="👍 نجح" value={totals.up} color="#34d399" />
        <Summary icon={ThumbsDown} label="👎 لم ينجح" value={totals.down} color="#f87171" />
        <Summary icon={AlertTriangle} label="أكواد ميتة محتملة" value={totals.dead} color="#fbbf24" />
      </div>

      {/* ترتيب */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-[12.5px] font-bold text-[#9a9aa2]">
          <ArrowUpDown size={14} /> ترتيب:
        </span>
        {[
          { key: "dead", label: "الأكواد الميتة أولاً" },
          { key: "rate", label: "الأعلى نجاحاً" },
          { key: "votes", label: "الأكثر تصويتاً" },
        ].map((o) => (
          <button
            key={o.key}
            onClick={() => setSortBy(o.key)}
            className={`rounded-lg px-3 py-1.5 text-[12.5px] font-bold transition-colors ${
              sortBy === o.key
                ? "bg-[var(--color-lime)] text-[#0a0a0a]"
                : "border border-[var(--color-ink-line)] text-[#c9c9cf] hover:bg-white/5"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* الجدول */}
      <div className="overflow-hidden rounded-2xl border border-[var(--color-ink-line)] bg-[var(--color-ink-card)]">
        <div className="hidden grid-cols-[1fr_70px_70px_120px_120px] gap-3 border-b border-[var(--color-ink-line)] px-4 py-3 text-[12px] font-bold text-[#9a9aa2] sm:grid">
          <span>الشركة</span>
          <span className="text-center">👍</span>
          <span className="text-center">👎</span>
          <span className="text-center">نسبة النجاح</span>
          <span className="text-center">آخر نجاح</span>
        </div>

        {rows.length === 0 && (
          <div className="px-4 py-10 text-center text-[13.5px] text-[#9a9aa2]">لا توجد شركات بعد.</div>
        )}

        {rows.map(({ company, up_count, down_count, total_count, success_rate, last_up_at }) => {
          const dead = total_count >= MIN_VOTES && success_rate < DEAD_RATE;
          const rateColor =
            total_count < MIN_VOTES ? "#6b7280" : success_rate >= 70 ? "#34d399" : success_rate >= 50 ? "#fbbf24" : "#f87171";
          return (
            <div
              key={company.id}
              className="grid grid-cols-2 items-center gap-3 border-b border-[var(--color-ink-line)] px-4 py-3 last:border-0 sm:grid-cols-[1fr_70px_70px_120px_120px]"
            >
              {/* الشركة */}
              <div className="col-span-2 flex min-w-0 items-center gap-2.5 sm:col-span-1">
                <CompanyLogo logo={company.logo} name={company.name} size={36} accent="#a6f000" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13.5px] font-extrabold text-white">{company.name}</span>
                    {dead && (
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-black text-amber-400">
                        <AlertTriangle size={10} /> كود ميت؟
                      </span>
                    )}
                  </div>
                  <span className="truncate text-[11.5px] font-mono text-[#9a9aa2]">{company.code}</span>
                </div>
              </div>

              {/* 👍 */}
              <div className="text-center text-[14px] font-extrabold text-emerald-400 sm:text-[13.5px]">
                <span className="sm:hidden text-[#9a9aa2]">👍 </span>
                {up_count}
              </div>
              {/* 👎 */}
              <div className="text-center text-[14px] font-extrabold text-red-400 sm:text-[13.5px]">
                <span className="sm:hidden text-[#9a9aa2]">👎 </span>
                {down_count}
              </div>

              {/* النسبة */}
              <div className="col-span-2 sm:col-span-1">
                {total_count > 0 ? (
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full" style={{ width: `${success_rate}%`, background: rateColor }} />
                    </div>
                    <span className="w-[58px] shrink-0 text-end text-[12.5px] font-extrabold" style={{ color: rateColor }}>
                      {success_rate}% ({total_count})
                    </span>
                  </div>
                ) : (
                  <span className="text-[12px] text-[#6b7280]">لا أصوات</span>
                )}
              </div>

              {/* آخر نجاح */}
              <div className="col-span-2 text-[11.5px] text-[#9a9aa2] sm:col-span-1 sm:text-center">
                {last_up_at ? relativeTime(last_up_at, "ar") : "—"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Summary({ icon: Icon, label, value, color }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] p-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: `${color}1f`, color }}>
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <div className="text-[18px] font-black leading-none text-white">{value}</div>
        <div className="mt-1 truncate text-[11.5px] text-[#9a9aa2]">{label}</div>
      </div>
    </div>
  );
}
