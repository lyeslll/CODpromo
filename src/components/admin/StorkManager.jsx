import { useState } from "react";
import { Loader2, Plus, KeyRound, Crown, CheckCircle2, Circle, Wand2, Trash2, X } from "lucide-react";
import { generateStorkCode } from "../../lib/stork.js";
import { useAdminT } from "./v2/ui.jsx";

/** أكواد Stork: إضافة يدوية، توليد كود عشوائي صعب، وحذف الأكواد غير المستعملة (مع تأكيد). */
export default function StorkManager({ codes, loading, onAdd, onDelete, premiumCount }) {
  const t = useAdminT();
  const [newCode, setNewCode] = useState("");
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState("");
  const [confirmId, setConfirmId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const used = codes.filter((c) => c.is_used).length;
  const available = codes.length - used;

  const add = async (code) => {
    if (!code.trim()) return;
    setErr("");
    setAdding(true);
    try {
      await onAdd(code);
      setNewCode("");
    } catch (e) {
      setErr(e.message);
    } finally {
      setAdding(false);
    }
  };

  const remove = async (id) => {
    setErr("");
    setDeletingId(id);
    try {
      await onDelete(id);
      setConfirmId(null);
    } catch {
      setErr(t("stork.deleteFailed"));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
      <div className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
        <div className="grid grid-cols-2 gap-3">
          <Stat icon={Crown} label={t("stork.activePremium")} value={premiumCount} color="#f0c63c" />
          <Stat icon={KeyRound} label={t("stork.total")} value={codes.length} color="#a6f000" />
          <Stat icon={Circle} label={t("stork.available")} value={available} color="#38bdf8" />
          <Stat icon={CheckCircle2} label={t("stork.used")} value={used} color="#fbbf24" />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            add(newCode);
          }}
          className="rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] p-5"
        >
          <h3 className="mb-1 flex items-center gap-1.5 text-[15px] font-extrabold text-white">
            <Plus size={17} className="text-[var(--color-lime)]" /> {t("stork.addTitle")}
          </h3>
          <p className="mb-3 text-[12px] text-[var(--color-mute)]">{t("stork.addHint")}</p>
          {err && <div className="mb-2 rounded-lg border border-red-500/30 bg-red-500/[0.08] px-3 py-2 text-[12.5px] font-semibold text-red-400">{err}</div>}
          <button
            type="button"
            onClick={() => add(generateStorkCode())}
            disabled={adding}
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[14px] font-extrabold text-[#0a0a0a] disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" }}
          >
            {adding ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />} {t("stork.generate")}
          </button>
          <div className="flex items-stretch gap-2">
            <input
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              placeholder="STORK-XXXX-XXXX"
              aria-label={t("stork.manual")}
              dir="ltr"
              className="w-full rounded-xl border border-[var(--color-ink-line)] bg-[#0c0c0e] px-3.5 py-2.5 text-left font-mono text-[14px] font-bold tracking-wider text-white outline-none focus:border-[var(--color-lime)]"
            />
            <button type="submit" disabled={adding || !newCode.trim()} className="shrink-0 rounded-xl border border-[var(--color-ink-line)] px-4 text-[13.5px] font-bold text-white hover:bg-white/5 disabled:opacity-50">
              {t("stork.add")}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)]">
        <div className="border-b border-[var(--color-ink-line)] p-4">
          <h2 className="text-[17px] font-extrabold text-white">{t("stork.listTitle")}</h2>
          <p className="text-[12.5px] text-[var(--color-mute)]">{t("stork.count", { count: codes.length })}</p>
        </div>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-[var(--color-mute)]">
            <Loader2 size={18} className="animate-spin" /> {t("common.loading")}
          </div>
        ) : codes.length === 0 ? (
          <div className="py-16 text-center text-[14px] text-[var(--color-mute)]">{t("stork.empty")}</div>
        ) : (
          <ul className="divide-y divide-[var(--color-ink-line)]">
            {codes.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-3.5">
                <span className="font-mono text-[14px] font-extrabold tracking-wider text-white" dir="ltr">
                  {c.code}
                </span>
                {c.is_used ? (
                  <span className="flex items-center gap-1 rounded-md bg-[#fbbf24]/15 px-2 py-0.5 text-[11.5px] font-bold text-[#fbbf24]">
                    <CheckCircle2 size={12} /> {t("stork.usedOne")}
                  </span>
                ) : confirmId === c.id ? (
                  <span className="flex items-center gap-2" role="group" aria-label={t("stork.confirm")}>
                    <span className="text-[12.5px] font-bold text-red-300">{t("stork.confirm")}</span>
                    <button
                      type="button"
                      onClick={() => remove(c.id)}
                      disabled={deletingId === c.id}
                      className="flex items-center gap-1 rounded-lg bg-red-500/90 px-2.5 py-1 text-[12px] font-extrabold text-white disabled:opacity-60"
                    >
                      {deletingId === c.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} {t("stork.yesDelete")}
                    </button>
                    <button type="button" onClick={() => setConfirmId(null)} aria-label={t("stork.cancel")} className="grid h-7 w-7 place-items-center rounded-lg border border-[var(--color-ink-line)] text-[#a1a1aa] hover:text-white">
                      <X size={13} />
                    </button>
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <span className="flex items-center gap-1 rounded-md bg-[var(--color-lime)]/15 px-2 py-0.5 text-[11.5px] font-bold text-[var(--color-lime)]">
                      <Circle size={12} /> {t("stork.availableOne")}
                    </span>
                    <button
                      type="button"
                      onClick={() => setConfirmId(c.id)}
                      aria-label={`${t("stork.delete")}: ${c.code}`}
                      title={t("stork.delete")}
                      className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--color-ink-line)] text-[#a1a1aa] transition-colors hover:border-red-500/40 hover:text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
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
