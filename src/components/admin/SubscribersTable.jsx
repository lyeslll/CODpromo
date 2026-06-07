import { useState } from "react";
import { Loader2, Download, Search, Mail, CheckCircle2, XCircle } from "lucide-react";

function downloadCsv(rows) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = ["البريد", "الموافقة", "المصدر", "التاريخ"];
  const lines = rows.map((r) =>
    [
      r.email,
      r.consent ? "نعم" : "لا",
      r.source || "",
      r.created_at ? new Date(r.created_at).toLocaleString("ar") : "",
    ]
      .map(esc)
      .join(",")
  );
  const csv = "﻿" + [header.map(esc).join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `codpromo-subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SubscribersTable({ subscribers, loading }) {
  const [q, setQ] = useState("");
  const rows = subscribers.filter((s) => !q.trim() || s.email?.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-ink-line)] p-4">
        <div>
          <h2 className="text-[17px] font-extrabold text-white">المشتركون في النشرة</h2>
          <p className="text-[12.5px] text-[var(--color-mute)]">{subscribers.length} مشترك</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex items-center">
            <Search size={15} className="pointer-events-none absolute right-3 text-[var(--color-mute)]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="بحث…"
              className="w-40 rounded-xl border border-[var(--color-ink-line)] bg-[#0c0c0e] py-2 pr-9 pl-3 text-[13px] text-white outline-none focus:border-[var(--color-lime)]"
            />
          </div>
          <button
            onClick={() => downloadCsv(rows)}
            disabled={!rows.length}
            className="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[13px] font-extrabold text-[#0a0a0a] disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" }}
          >
            <Download size={15} /> تحميل CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-[var(--color-mute)]">
          <Loader2 size={18} className="animate-spin" /> جارٍ التحميل…
        </div>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center text-[14px] text-[var(--color-mute)]">
          {subscribers.length === 0 ? "لا مشتركين بعد (أو لم تُضبط صلاحيات القراءة)." : "لا نتائج."}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="border-b border-[var(--color-ink-line)] text-[12px] text-[var(--color-mute)]">
                <th className="p-3 font-semibold">البريد</th>
                <th className="p-3 font-semibold">الموافقة</th>
                <th className="hidden p-3 font-semibold sm:table-cell">المصدر</th>
                <th className="hidden p-3 font-semibold sm:table-cell">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-b border-[var(--color-ink-line)] last:border-0 hover:bg-white/[0.02]">
                  <td className="p-3">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.04] text-[var(--color-mute)]">
                        <Mail size={15} />
                      </span>
                      <span className="text-[13.5px] font-bold text-white" dir="ltr">{s.email}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    {s.consent ? (
                      <span className="flex w-fit items-center gap-1 rounded-md bg-[var(--color-lime)]/15 px-2 py-0.5 text-[11.5px] font-bold text-[var(--color-lime)]">
                        <CheckCircle2 size={12} /> نعم
                      </span>
                    ) : (
                      <span className="flex w-fit items-center gap-1 rounded-md bg-red-500/15 px-2 py-0.5 text-[11.5px] font-bold text-red-400">
                        <XCircle size={12} /> لا
                      </span>
                    )}
                  </td>
                  <td className="hidden p-3 text-[12.5px] text-[#c9c9cf] sm:table-cell">{s.source || "—"}</td>
                  <td className="hidden p-3 text-[12.5px] text-[var(--color-mute)] sm:table-cell">
                    {s.created_at ? new Date(s.created_at).toLocaleDateString("ar") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
