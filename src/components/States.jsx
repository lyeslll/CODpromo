import { motion } from "framer-motion";
import { SearchX, WifiOff, RefreshCw } from "lucide-react";

export function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-[260px] overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)]"
        >
          <div
            className="h-full w-full"
            style={{
              background:
                "linear-gradient(100deg, transparent 20%, rgba(128,128,128,0.12) 50%, transparent 80%)",
              backgroundSize: "200% 100%",
              animation: "shimmer 1.6s linear infinite",
            }}
          />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ onReset }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="mx-auto flex max-w-sm flex-col items-center rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] px-6 py-14 text-center"
    >
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[var(--fill)] text-[var(--color-mute)]">
        <SearchX size={30} />
      </div>
      <h3 className="mt-5 text-[18px] font-extrabold text-[var(--text)]">لا توجد عروض مطابقة</h3>
      <p className="mt-2 text-[14px] text-[var(--color-mute)]">
        جرّب كلمة بحث أخرى أو غيّر الفلتر للعثور على ما يناسبك.
      </p>
      <button
        onClick={onReset}
        className="mt-6 rounded-xl px-5 py-2.5 text-[14px] font-extrabold text-[#0a0a0a]"
        style={{ background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" }}
      >
        إعادة ضبط الفلاتر
      </button>
    </motion.div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center rounded-[var(--radius-card)] border border-red-500/20 bg-red-500/[0.04] px-6 py-14 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-red-500/10 text-red-400">
        <WifiOff size={30} />
      </div>
      <h3 className="mt-5 text-[18px] font-extrabold text-[var(--text)]">تعذّر تحميل العروض</h3>
      <p className="mt-2 text-[14px] text-[var(--color-mute)]">{message}</p>
      <button
        onClick={onRetry}
        className="mt-6 flex items-center gap-2 rounded-xl border border-[var(--color-ink-line)] bg-[var(--fill)] px-5 py-2.5 text-[14px] font-bold text-[var(--text)] transition-colors hover:bg-[var(--fill-strong)]"
      >
        <RefreshCw size={15} /> إعادة المحاولة
      </button>
    </div>
  );
}
