import { useMemo } from "react";
import { Users, User, Building2, Store, Inbox, TrendingUp } from "lucide-react";

export default function AdminOverview({ profiles, companies, requests }) {
  const s = useMemo(() => {
    const customers = profiles.filter((p) => (p.account_type || "customer") === "customer").length;
    const companyUsers = profiles.filter((p) => p.account_type === "company").length;
    const pending = requests.filter((r) => r.status === "pending").length;

    // التسجيلات اليومية لآخر 7 أيام
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      days.push({ key: d.toISOString().slice(0, 10), date: d, count: 0 });
    }
    profiles.forEach((p) => {
      if (!p.created_at) return;
      const k = new Date(p.created_at).toISOString().slice(0, 10);
      const slot = days.find((x) => x.key === k);
      if (slot) slot.count += 1;
    });
    return { total: profiles.length, customers, companyUsers, pending, days };
  }, [profiles, companies, requests]);

  const maxDay = Math.max(1, ...s.days.map((d) => d.count));
  const dayName = (d) => d.toLocaleDateString("ar", { weekday: "short" });

  return (
    <div className="flex flex-col gap-5">
      {/* بطاقات */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Card icon={Users} label="إجمالي المستخدمين" value={s.total} color="#a6f000" />
        <Card icon={User} label="زبائن" value={s.customers} color="#38bdf8" />
        <Card icon={Building2} label="شركات" value={s.companyUsers} color="#a78bfa" />
        <Card icon={Store} label="عروض منشورة" value={companies.length} color="#a6f000" />
        <Card icon={Inbox} label="طلبات معلّقة" value={s.pending} color="#fbbf24" />
      </div>

      {/* مخطط آخر 7 أيام */}
      <div className="rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] p-5">
        <div className="mb-5 flex items-center gap-2">
          <TrendingUp size={18} className="text-[var(--color-lime)]" />
          <h3 className="text-[15px] font-extrabold text-white">التسجيلات — آخر 7 أيام</h3>
        </div>
        <div className="flex items-end justify-between gap-2" style={{ height: 140 }}>
          {s.days.map((d) => (
            <div key={d.key} className="flex flex-1 flex-col items-center justify-end gap-2">
              <span className="text-[12px] font-bold text-[var(--color-lime)]">{d.count}</span>
              <div
                className="w-full rounded-t-lg transition-all"
                style={{
                  height: `${(d.count / maxDay) * 100}px`,
                  minHeight: 4,
                  background:
                    d.count > 0
                      ? "linear-gradient(180deg, var(--color-lime-soft), var(--color-lime-deep))"
                      : "#26271f",
                }}
              />
              <span className="text-[10.5px] font-medium text-[var(--color-mute)]">{dayName(d.date)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Card({ icon: Icon, label, value, color }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] p-4">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: `${color}1a`, color }}>
        <Icon size={20} />
      </span>
      <div className="min-w-0">
        <div className="text-[24px] font-black leading-none text-white">{value}</div>
        <div className="mt-1 truncate text-[12px] font-medium text-[var(--color-mute)]">{label}</div>
      </div>
    </div>
  );
}
