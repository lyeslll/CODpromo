import { motion } from "framer-motion";
import Logo from "../Logo.jsx";

const GOLD_DEEP = "#cf9a1e";

/**
 * إطار صفحات الدفع (النجاح، العودة من SlickPay / PayPal، الإلغاء): خلفية داكنة بضوء ذهبي،
 * اللوغو فوق، والمحتوى في عمود وسط. wide = صفحة النجاح (ملخص + الخطوة الجاية).
 */
export default function PaymentShell({ children, wide = false }) {
  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[var(--color-ink)] text-[var(--text)]">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[760px] max-w-[100vw] -translate-x-1/2 rounded-full blur-[120px]"
        style={{ background: `radial-gradient(circle, ${GOLD_DEEP}2e, transparent 65%)` }}
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid" />

      <div className={`relative mx-auto flex w-full flex-col items-center px-4 pb-16 pt-8 sm:pt-12 ${wide ? "max-w-xl" : "max-w-md"}`}>
        <Logo compact />
        <motion.main
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="mt-10 flex w-full flex-col items-center text-center"
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}

/** أيقونة حالة دائرية (انتظار / خطأ) لصفحات الدفع. */
export function StatusBadge({ tone = "gold", children }) {
  const style =
    tone === "error"
      ? { background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)" }
      : { background: "rgba(240,198,60,0.12)", border: "1px solid rgba(240,198,60,0.35)", color: "#ffe486" };
  return (
    <span className="grid h-16 w-16 place-items-center rounded-2xl" style={style}>
      {children}
    </span>
  );
}
