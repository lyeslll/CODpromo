import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pencil, Trash2, ExternalLink, Loader2, AlertTriangle, Search } from "lucide-react";
import CompanyLogo from "../CompanyLogo.jsx";
import { getTypeMeta } from "../../lib/types.js";

export default function CompanyTable({ companies, loading, editingId, onEdit, onDelete }) {
  const [q, setQ] = useState("");
  const [confirmId, setConfirmId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const rows = companies.filter((c) => {
    const t = q.trim().toLowerCase();
    if (!t) return true;
    return (
      c.name?.toLowerCase().includes(t) ||
      c.code?.toLowerCase().includes(t) ||
      c.category?.toLowerCase().includes(t)
    );
  });

  const doDelete = async (id) => {
    setDeletingId(id);
    await onDelete(id);
    setDeletingId(null);
    setConfirmId(null);
  };

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)]">
      {/* رأس */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-ink-line)] p-4">
        <div>
          <h2 className="text-[17px] font-extrabold text-white">الشركات المضافة</h2>
          <p className="text-[12.5px] text-[var(--color-mute)]">{companies.length} شركة</p>
        </div>
        <div className="relative flex items-center">
          <Search size={15} className="pointer-events-none absolute right-3 text-[var(--color-mute)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="بحث…"
            className="w-44 rounded-xl border border-[var(--color-ink-line)] bg-[#0c0c0e] py-2 pr-9 pl-3 text-[13px] text-white outline-none focus:border-[var(--color-lime)]"
          />
        </div>
      </div>

      {/* جسم */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-[var(--color-mute)]">
          <Loader2 size={18} className="animate-spin" /> جارٍ التحميل…
        </div>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center text-[14px] text-[var(--color-mute)]">
          {companies.length === 0 ? "لا توجد شركات بعد — أضف أول شركة." : "لا نتائج للبحث."}
        </div>
      ) : (
        <ul className="divide-y divide-[var(--color-ink-line)]">
          <AnimatePresence initial={false}>
            {rows.map((c) => {
              const meta = getTypeMeta(c.type);
              const isConfirm = confirmId === c.id;
              return (
                <motion.li
                  key={c.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, height: 0 }}
                  className={`flex items-center gap-3 p-3 transition-colors sm:p-4 ${
                    editingId === c.id ? "bg-[var(--color-lime)]/[0.06]" : "hover:bg-white/[0.02]"
                  }`}
                >
                  <CompanyLogo logo={c.logo} name={c.name} size={44} accent={meta.color} />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[14.5px] font-bold text-white">{c.name}</span>
                      <span
                        className="hidden shrink-0 rounded-md px-1.5 py-0.5 text-[10.5px] font-bold sm:inline"
                        style={{ background: `${meta.color}1a`, color: meta.color }}
                      >
                        {c.type}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[12px] text-[var(--color-mute)]">
                      <span className="font-mono font-bold text-[#c9c9cf]">{c.code}</span>
                      <span>·</span>
                      <span className="font-bold" style={{ color: meta.color }}>
                        {c.discount}
                      </span>
                      {c.category && (
                        <>
                          <span className="hidden sm:inline">·</span>
                          <span className="hidden truncate sm:inline">{c.category}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* أفعال */}
                  {isConfirm ? (
                    <motion.div
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-2"
                    >
                      <span className="hidden items-center gap-1 text-[12px] font-bold text-orange-400 sm:flex">
                        <AlertTriangle size={13} /> حذف؟
                      </span>
                      <button
                        onClick={() => doDelete(c.id)}
                        disabled={deletingId === c.id}
                        className="flex items-center gap-1 rounded-lg bg-red-500 px-3 py-1.5 text-[12.5px] font-bold text-white disabled:opacity-60"
                      >
                        {deletingId === c.id ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          "نعم"
                        )}
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        className="rounded-lg border border-[var(--color-ink-line)] px-3 py-1.5 text-[12.5px] font-bold text-white"
                      >
                        لا
                      </button>
                    </motion.div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      {c.link && (
                        <a
                          href={c.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="زيارة الموقع"
                          className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--color-ink-line)] text-[var(--color-mute)] transition-colors hover:text-[var(--color-lime)]"
                        >
                          <ExternalLink size={15} />
                        </a>
                      )}
                      <button
                        onClick={() => onEdit(c)}
                        title="تعديل"
                        className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--color-ink-line)] text-[#c9c9cf] transition-colors hover:border-[var(--color-lime)] hover:text-[var(--color-lime)]"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => setConfirmId(c.id)}
                        title="حذف"
                        className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--color-ink-line)] text-[#c9c9cf] transition-colors hover:border-red-500/50 hover:text-red-400"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
