import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Crown, Loader2, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import PaymentShell, { StatusBadge } from "../components/payment/PaymentShell.jsx";
import PurchaseSuccess from "../components/payment/PurchaseSuccess.jsx";
import { premiumPath } from "../lib/seo.js";
import { useAuth } from "../lib/auth.jsx";
import { capturePaypalOrder } from "../lib/billing.js";

// صفحة العودة من PayPal — تلتقط الطلب وتعرض النتيجة.
export default function PaymentReturnPaypal() {
  const { loading: authLoading, refreshProfile } = useAuth();
  const { t, i18n } = useTranslation();
  const [params] = useSearchParams();
  const [state, setState] = useState("checking"); // checking | success | failed | error
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

  // نجاح: نفس صفحة النجاح الموحّدة (ملخص الشراء + الخطوة الجاية)
  if (state === "success") return <PurchaseSuccess />;

  if (state === "checking") {
    return (
      <PaymentShell>
        <StatusBadge>
          <Loader2 size={28} className="animate-spin" />
        </StatusBadge>
        <h1 className="mt-6 text-[24px] font-black tracking-tight">{t("payment.return.checkingTitle")}</h1>
        <p className="mt-2 text-[15px] text-[var(--text-soft)]" aria-live="polite">
          {t("payment.return.checkingPaypal")}
        </p>
      </PaymentShell>
    );
  }

  // failed أو error
  return (
    <PaymentShell>
      <StatusBadge tone="error">
        <XCircle size={30} className="text-red-400" />
      </StatusBadge>
      <h1 className="mt-6 text-[24px] font-black tracking-tight">{t("payment.return.failTitle")}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-[var(--text-soft)]">
        {reason === "COMPLIANCE_VIOLATION"
          ? t("payment.return.failCompliance")
          : reason === "cancelled"
            ? t("payment.return.failCancelled")
            : t("payment.return.failPaypal")}
      </p>
      {reason && <p className="mt-2 font-mono text-[11px] text-[var(--color-mute)]">{t("payment.return.codeLabel", { code: reason })}</p>}
      <div className="mt-7 flex w-full flex-col gap-2.5 sm:flex-row sm:justify-center">
        <Link
          to={premiumPath(i18n.language)}
          className="inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-[15px] font-extrabold text-[#1d1403]"
          style={{ background: "linear-gradient(135deg, #ffe486, #f0c63c 55%, #cf9a1e)" }}
        >
          <Crown size={17} /> {t("purchase.failBack")}
        </Link>
        <Link to="/" className="inline-flex items-center justify-center rounded-2xl border border-[var(--color-ink-line)] px-6 py-3.5 text-[15px] font-bold text-[var(--text)] transition-colors hover:bg-[var(--fill)]">
          {t("payment.back")}
        </Link>
      </div>
    </PaymentShell>
  );
}
