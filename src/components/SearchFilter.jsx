import { motion } from "framer-motion";
import { Search, X } from "lucide-react";
import { FILTERS, getTypeMeta } from "../lib/types.js";

export default function SearchFilter({
  search,
  setSearch,
  activeFilter,
  setActiveFilter,
  resultCount,
}) {
  return (
    <div className="mb-8 pt-2">
      {/* حقل البحث */}
      <div className="group relative">
        <div
          className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 blur transition-opacity duration-300 group-focus-within:opacity-100"
          style={{ background: "linear-gradient(120deg, rgba(166,240,0,0.4), rgba(56,189,248,0.25))" }}
        />
        <div className="relative flex items-center gap-3 rounded-2xl border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] px-4 py-3.5 transition-colors group-focus-within:border-transparent">
          <Search size={20} className="shrink-0 text-[var(--color-mute)] transition-colors group-focus-within:text-[var(--color-lime)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث عن متجر، فئة، أو كود خصم…"
            className="w-full bg-transparent text-[15px] font-medium text-[var(--text)] outline-none placeholder:text-[var(--color-mute)]"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              aria-label="مسح"
              className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--fill)] text-[var(--color-mute)] transition-colors hover:bg-[var(--fill-strong)] hover:text-[var(--text)]"
            >
              <X size={14} />
            </button>
          )}
          <span className="hidden shrink-0 rounded-lg bg-[var(--fill)] px-2 py-1 text-[11px] font-bold text-[var(--color-mute)] sm:block">
            {resultCount} نتيجة
          </span>
        </div>
      </div>

      {/* فلاتر النوع */}
      <div className="no-scrollbar mt-3 flex items-center gap-2 overflow-x-auto pb-0.5">
        {FILTERS.map((f) => {
          const active = activeFilter === f;
          const meta = f === "الكل" ? null : getTypeMeta(f);
          const Icon = meta?.icon;
          return (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className="relative shrink-0 rounded-xl px-4 py-2 text-[13.5px] font-bold transition-colors"
              style={{
                color: active ? "#0a0a0a" : "var(--text-softer)",
              }}
            >
              {active && (
                <motion.span
                  layoutId="filter-pill"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  className="absolute inset-0 rounded-xl"
                  style={{
                    background: meta
                      ? `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)`
                      : "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))",
                    boxShadow: `0 8px 24px -10px ${meta ? meta.glow : "rgba(166,240,0,0.6)"}`,
                  }}
                />
              )}
              <span className="relative flex items-center gap-1.5">
                {Icon && <Icon size={14} />}
                {f}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
