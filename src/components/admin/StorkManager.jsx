import { useState } from "react";
import { Loader2, Plus, KeyRound, Crown, CheckCircle2, Circle } from "lucide-react";

export default function StorkManager({ codes, loading, onAdd, premiumCount }) {
  const [newCode, setNewCode] = useState("");
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState("");

  const used = codes.filter((c) => c.is_used).length;
  const available = codes.length - used;

  const add = async (e) => {
    e.preventDefault();
    if (!newCode.trim()) return;
    setErr("");
    setAdding(true);
    try {
      await onAdd(newCode);
      setNewCode("");
    } catch (e) {
      setErr(e.message);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
      {/* يسار: إحصائيات + إضافة */}
      <div className="flex flex-col gap-4 lg:sticky lg:top-[84px] lg:self-start">
        <div className="grid grid-cols-2 gap-3">
          <Stat icon={Crown} label="أعضاء Premium" value={premiumCount} color="#f0c63c" />
          <Stat icon={KeyRound} label="إجمالي الأكواد" value={codes.length} color="#a6f000" />
          <Stat icon={Circle} label="متاحة" value={available} color="#38bdf8" />
          <Stat icon={CheckCircle2} label="مستخدمة" value={used} color="#fbbf24" />
        </div>

        <form onSubmit={add} className="rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] p-5">
          <h3 className="mb-3 flex items-center gap-1.5 text-[15px] font-extrabold text-white">
            <Plus size={17} className="text-[var(--color-lime)]" /> إضافة كود Stork
          </h3>
          {err && <div className="mb-2 rounded-lg border border-red-500/30 bg-red-500/[0.08] px-3 py-2 text-[12.5px] font-semibold text-red-400">{err}</div>}
          <div className="flex items-stretch gap-2">
            <input
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              placeholder="STORK-XXXX"
              dir="ltr"
              className="w-full rounded-xl border border-[var(--color-ink-line)] bg-[#0c0c0e] px-3.5 py-2.5 text-left font-mono text-[14px] font-bold tracking-wider text-white outline-none focus:border-[var(--color-lime)]"
            />
            <button
              type="submit"
              disabled={adding}
              className="grid w-[96px] shrink-0 place-items-center rounded-xl px-4 text-[14px] font-extrabold text-[#0a0a0a] disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" }}
            >
              {adding ? <Loader2 size={17} className="animate-spin" /> : "إضافة"}
            </button>
          </div>
        </form>
      </div>

      {/* يمين: قائمة الأكواد */}
      <div className="rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)]">
        <div className="border-b border-[var(--color-ink-line)] p-4">
          <h2 className="text-[17px] font-extrabold text-white">أكواد Stork</h2>
          <p className="text-[12.5px] text-[var(--color-mute)]">{codes.length} كود</p>
        </div>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-[var(--color-mute)]">
            <Loader2 size={18} className="animate-spin" /> جارٍ التحميل…
          </div>
        ) : codes.length === 0 ? (
          <div className="py-16 text-center text-[14px] text-[var(--color-mute)]">
            لا أكواد بعد (أو لم تُضبط صلاحيات القراءة).
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-ink-line)]">
            {codes.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 p-3.5">
                <span className="font-mono text-[14px] font-extrabold tracking-wider text-white" dir="ltr">{c.code}</span>
                {c.is_used ? (
                  <span className="flex items-center gap-1 rounded-md bg-[#fbbf24]/15 px-2 py-0.5 text-[11.5px] font-bold text-[#fbbf24]">
                    <CheckCircle2 size={12} /> مستخدم
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded-md bg-[var(--color-lime)]/15 px-2 py-0.5 text-[11.5px] font-bold text-[var(--color-lime)]">
                    <Circle size={12} /> متاح
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, color }) {
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] p-3.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: `${color}1a`, color }}>
        <Icon size={17} />
      </span>
      <div className="min-w-0">
        <div className="text-[20px] font-black leading-none text-white">{value}</div>
        <div className="mt-0.5 truncate text-[11px] font-medium text-[var(--color-mute)]">{label}</div>
      </div>
    </div>
  );
}
