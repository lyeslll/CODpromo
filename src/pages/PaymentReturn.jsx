import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Crown, Loader2, Check, XCircle } from "lucide-react";
import { Shell } from "./PaymentSuccess.jsx";
import { useAuth } from "../lib/auth.jsx";
import { checkSlickpayInvoice, latestSlickpayInvoiceId } from "../lib/billing.js";

const GOLD_SOFT = "#ffe486";
const GOLD_DEEP = "#cf9a1e";

// صفحة العودة من بوّابة SATIM — تتحقق من حالة فاتورة SlickPay وتعرض النتيجة.
export default function PaymentReturn() {
  const { user, loading: authLoading, refreshProfile } = useAuth();
  const [state, setState] = useState("checking"); // checking | success | failed | error
  const [days, setDays] = useState(null);
  const triesRef = useRef(0);
  const ranRef = useRef(false);
  const mountedRef = useRef(true);
  const timerRef = useRef(null);

  // علم الإلغاء يُرفع فقط عند إزالة المكوّن فعلياً (لا عند إعادة التصيير)
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // يُنفَّذ مرة واحدة بعد استقرار حالة المصادقة — لا يعتمد على دوال/قيم غير ثابتة
  // كي لا تُلغى النتيجة أو حلقة إعادة المحاولة بإعادة تصيير سياق المصادقة
  useEffect(() => {
    if (authLoading || ranRef.current) return;
    ranRef.current = true;

    const run = async () => {
      try {
        // معرّف الفاتورة: من الجلسة، أو من آخر فاتورة للمستخدم
        let id = sessionStorage.getItem("codpromo:slickpay-invoice");
        if (!id && user) id = await latestSlickpayInvoiceId(user.id);
        if (!mountedRef.current) return;
        if (!id) {
          setState("error");
          return;
        }

        const res = await checkSlickpayInvoice(id);
        if (!mountedRef.current) return;

        if (res?.completed) {
          setDays(res.days);
          setState("success");
          refreshProfile?.();
          sessionStorage.removeItem("codpromo:slickpay-invoice");
          return;
        }

        // قد يتأخر تأكيد SATIM لحظات — أعد المحاولة قليلاً
        triesRef.current += 1;
        if (triesRef.current < 4) {
          timerRef.current = setTimeout(run, 2500);
        } else {
          setState("failed");
        }
      } catch {
        if (mountedRef.current) setState("error");
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  if (state === "success") {
    return (
      <Shell>
        <span
          className="grid h-16 w-16 place-items-center rounded-2xl text-[#0a0a0a]"
          style={{ background: `linear-gradient(135deg, ${GOLD_SOFT}, ${GOLD_DEEP})` }}
        >
          <Check size={32} strokeWidth={3} />
        </span>
        <h1 className="mt-5 text-[24px] font-black tracking-tight text-[var(--text)]">
          تم تفعيل Premium! 👑
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--text-soft)]">
          {days ? `اشتراكك نشط الآن لمدة ${days} يوماً.` : "اشتراكك نشط الآن."} استمتع بالخصومات الأقوى.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-xl px-6 py-3 text-[15px] font-extrabold text-[#0a0a0a]"
          style={{ background: `linear-gradient(135deg, ${GOLD_SOFT}, ${GOLD_DEEP})` }}
        >
          العودة للموقع
        </Link>
      </Shell>
    );
  }

  if (state === "checking") {
    return (
      <Shell>
        <span
          className="grid h-16 w-16 place-items-center rounded-2xl text-[#0a0a0a]"
          style={{ background: `linear-gradient(135deg, ${GOLD_SOFT}, ${GOLD_DEEP})` }}
        >
          <Crown size={30} />
        </span>
        <h1 className="mt-5 text-[24px] font-black tracking-tight text-[var(--text)]">
          جارٍ تأكيد الدفع
        </h1>
        <p className="mt-2 inline-flex items-center gap-2 text-[14px] text-[var(--text-soft)]">
          <Loader2 size={16} className="animate-spin" /> نتحقق من حالة عمليتك…
        </p>
      </Shell>
    );
  }

  // failed أو error
  return (
    <Shell>
      <span
        className="grid h-16 w-16 place-items-center rounded-2xl"
        style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)" }}
      >
        <XCircle size={30} className="text-red-400" />
      </span>
      <h1 className="mt-5 text-[24px] font-black tracking-tight text-[var(--text)]">
        لم يكتمل الدفع
      </h1>
      <p className="mt-2 text-[14px] leading-relaxed text-[var(--text-soft)]">
        لم نتمكّن من تأكيد عملية الدفع. إن كنت أتممتها، قد يستغرق التفعيل دقيقة — حدّث لاحقاً، أو حاول مجدداً.
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
