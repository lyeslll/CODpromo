import { Link } from "react-router-dom";
import { XCircle } from "lucide-react";
import { Shell } from "./PaymentSuccess.jsx";

/** صفحة إلغاء الدفع — لم تتم أي عملية خصم. */
export default function PaymentCancel() {
  return (
    <Shell>
      <span
        className="grid h-16 w-16 place-items-center rounded-2xl"
        style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)" }}
      >
        <XCircle size={30} className="text-red-400" />
      </span>

      <h1 className="mt-5 text-[24px] font-black tracking-tight text-[var(--text)]">
        أُلغيت عملية الدفع
      </h1>
      <p className="mt-2 text-[14px] leading-relaxed text-[var(--text-soft)]">
        لم تتم أي عملية خصم. يمكنك المحاولة مجدداً في أي وقت.
      </p>

      <Link
        to="/"
        className="mt-6 inline-flex items-center justify-center rounded-xl border border-[var(--color-ink-line)] bg-[var(--fill)] px-6 py-3 text-[15px] font-extrabold text-[var(--text)] transition-colors hover:bg-[var(--fill-strong)]"
      >
        العودة للموقع
      </Link>
    </Shell>
  );
}
