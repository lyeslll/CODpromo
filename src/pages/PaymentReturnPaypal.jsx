import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Crown, Loader2, Check, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Shell } from "./PaymentSuccess.jsx";
import { useAuth } from "../lib/auth.jsx";
import { capturePaypalOrder } from "../lib/billing.js";

const GOLD_SOFT = "#ffe486";
const GOLD_DEEP = "#cf9a1e";

// صفحة العودة من PayPal — تلتقط الطلب وتعرض النتيجة.
export default function PaymentReturnPaypal() {
  const { loading: authLoading, refreshProfile } = useAuth();
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const [state, setState] = useState("checking"); // checking | success | failed | error
  const [days, setDays] = useState(null);
  const [reason, setReason] = useState(null);
  const ranRef = useRef(false);
  const mountedRef = useRef(true);

  // علم الإلغاء يُرفع فقط عند إزالة المكوّن فعلياً (لا عند إعادة التصيير)
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // يُنفَّذ مرة واحدة بعد استقرار حالة المصادقة — لا يعتمد على دوال غير ثابتة
  // كي لا تُلغى نتيجة الالتقاط بإعادة تصيير سياق المصادقة أثناء الانتظار
  useEffect(() => {
    if (authLoading || ranRef.current) return;
    ranRef.current = true;

    (async () => {
      try {
        // PayPal يعيد معرّف الطلب في ?token= ، وإلا من الجلسة
        const orderId = params.get("token") || sessionStorage.getItem("codpromo:paypal-order");
        if (!orderId) {
          if (mountedRef.current) setState("error");
          return;
        }

        const res = await capturePaypalOrder(orderId);
        if (!mountedRef.current) return;

        if (res?.completed) {
          setDays(res.days);
          setState("success");
          refreshProfile?.();
          sessionStorage.removeItem("codpromo:paypal-order");
        } else {
          setReason(res?.reason || null);
          setState("failed");
        }
      } catch {
        if (mountedRef.current) setState("error");
      }
    })();
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
          {t("payment.return.successTitle")}
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--text-soft)]">
          {days ? t("payment.return.successDaysDesc", { days }) : t("payment.return.successDesc")} {t("payment.return.enjoy")}
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-xl px-6 py-3 text-[15px] font-extrabold text-[#0a0a0a]"
          style={{ background: `linear-gradient(135deg, ${GOLD_SOFT}, ${GOLD_DEEP})` }}
        >
          {t("payment.back")}
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
          {t("payment.return.checkingTitle")}
        </h1>
        <p className="mt-2 inline-flex items-center gap-2 text-[14px] text-[var(--text-soft)]">
          <Loader2 size={16} className="animate-spin" /> {t("payment.return.checkingPaypal")}
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <span
        className="grid h-16 w-16 place-items-center rounded-2xl"
        style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)" }}
      >
        <XCircle size={30} className="text-red-400" />
      </span>
      <h1 className="mt-5 text-[24px] font-black tracking-tight text-[var(--text)]">
        {t("payment.return.failTitle")}
      </h1>
      <p className="mt-2 text-[14px] leading-relaxed text-[var(--text-soft)]">
        {reason === "COMPLIANCE_VIOLATION"
          ? t("payment.return.failCompliance")
          : t("payment.return.failPaypal")}
      </p>
      {reason && (
        <p className="mt-2 font-mono text-[11px] text-[var(--color-mute)]">{t("payment.return.codeLabel", { code: reason })}</p>
      )}
      <Link
        to="/"
        className="mt-6 inline-flex items-center justify-center rounded-xl border border-[var(--color-ink-line)] bg-[var(--fill)] px-6 py-3 text-[15px] font-extrabold text-[var(--text)] transition-colors hover:bg-[var(--fill-strong)]"
      >
        {t("payment.back")}
      </Link>
    </Shell>
  );
}
