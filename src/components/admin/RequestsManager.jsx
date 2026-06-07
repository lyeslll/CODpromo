import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Check,
  X,
  ExternalLink,
  Mail,
  Clock,
  CheckCircle2,
  XCircle,
  Inbox,
} from "lucide-react";
import CompanyLogo from "../CompanyLogo.jsx";
import { getTypeMeta } from "../../lib/types.js";

const STATUS = {
  pending: { label: "قيد المراجعة", color: "#fbbf24", icon: Clock },
  accepted: { label: "مقبول", color: "#a6f000", icon: CheckCircle2 },
  rejected: { label: "مرفوض", color: "#ef4444", icon: XCircle },
};

const FILTERS = [
  { key: "pending", label: "المعلّقة" },
  { key: "all", label: "الكل" },
  { key: "accepted", label: "المقبولة" },
  { key: "rejected", label: "المرفوضة" },
];

export default function RequestsManager({ requests, profiles, loading, onAccept, onReject, busyId }) {
  const [filter, setFilter] = useState("pending");

  const emailByUser = useMemo(() => {
    const m = {};
    profiles.forEach((p) => (m[p.id] = p.email));
    return m;
  }, [profiles]);

  const rows = requests.filter((r) => (filter === "all" ? true : r.status === filter));

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-ink-line)] p-4">
        <div>
          <h2 className="text-[17px] font-extrabold text-white">طلبات الشركات</h2>
          <p className="text-[12.5px] text-[var(--color-mute)]">
            {requests.filter((r) => r.status === "pending").length} طلب معلّق
          </p>
        </div>
        <div className="flex gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="rounded-lg px-3 py-1.5 text-[12.5px] font-bold transition-colors"
              style={{
                background: filter === f.key ? "var(--color-lime)" : "transparent",
                color: filter === f.key ? "#0a0a0a" : "#c9c9cf",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-[var(--color-mute)]">
          <Loader2 size={18} className="animate-spin" /> جارٍ التحميل…
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center text-[var(--color-mute)]">
          <Inbox size={28} className="mb-3" />
          <span className="text-[14px]">
            {requests.length === 0 ? "لا توجد طلبات (أو لم تُضبط صلاحيات القراءة)." : "لا طلبات في هذا التصنيف."}
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-3 p-4">
          <AnimatePresence>
            {rows.map((r) => {
              const meta = getTypeMeta(r.type);
              const st = STATUS[r.status] || STATUS.pending;
              const busy = busyId === r.id;
              return (
                <motion.div
                  key={r.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  className="rounded-2xl border border-[var(--color-ink-line)] bg-[#0c0c0e] p-4"
                >
                  <div className="flex items-start gap-3">
                    <CompanyLogo logo={r.logo} name={r.title} size={56} accent={meta.color} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[15px] font-extrabold text-white">{r.title}</span>
                        <span className="rounded-md px-1.5 py-0.5 text-[10.5px] font-bold" style={{ background: `${meta.color}1a`, color: meta.color }}>
                          {r.type}
                        </span>
                        <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: `${st.color}1a`, color: st.color }}>
                          <st.icon size={11} /> {st.label}
                        </span>
                      </div>
                      <div className="mt-1 text-[12.5px] font-bold text-[#c9c9cf]">{r.company_name || "—"}</div>
                      {r.description && (
                        <p className="mt-1.5 line-clamp-2 text-[13px] text-[#a1a1aa]">{r.description}</p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[var(--color-mute)]">
                        {r.code && (
                          <span>
                            الكود: <span className="font-mono font-bold text-[var(--color-lime)]">{r.code}</span>
                          </span>
                        )}
                        {emailByUser[r.user_id] && (
                          <a href={`mailto:${emailByUser[r.user_id]}`} className="flex items-center gap-1 hover:text-white" dir="ltr">
                            <Mail size={12} /> {emailByUser[r.user_id]}
                          </a>
                        )}
                        {r.link && (
                          <a href={r.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-[var(--color-lime)]">
                            <ExternalLink size={12} /> الرابط
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {r.status === "pending" && (
                    <div className="mt-3 flex items-center gap-2 border-t border-[var(--color-ink-line)] pt-3">
                      <button
                        onClick={() => onAccept(r)}
                        disabled={busy}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-[13.5px] font-extrabold text-[#0a0a0a] disabled:opacity-60"
                        style={{ background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" }}
                      >
                        {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} strokeWidth={3} />}
                        قبول ونشر
                      </button>
                      <button
                        onClick={() => onReject(r)}
                        disabled={busy}
                        className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--color-ink-line)] px-4 py-2.5 text-[13.5px] font-bold text-[#c9c9cf] transition-colors hover:border-red-500/40 hover:text-red-400 disabled:opacity-60"
                      >
                        <X size={16} /> رفض
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
