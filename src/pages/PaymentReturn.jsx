import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Crown, Loader2, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import PaymentShell, { StatusBadge } from "../components/payment/PaymentShell.jsx";
import PurchaseSuccess from "../components/payment/PurchaseSuccess.jsx";
import { premiumPath } from "../lib/seo.js";
import { useAuth } from "../lib/auth.jsx";
import { checkSlickpayInvoice, latestSlickpayInvoiceId } from "../lib/billing.js";

// صفحة العودة من بوّابة SATIM — تتحقق من حالة فاتورة SlickPay وتعرض النتيجة.
export default function PaymentReturn() {
  const { user, loading: authLoading, refreshProfile } = useAuth();
  const { t, i18n } = useTranslation();
  const [state, setState] = useState("checking"); // checking | success | failed | error
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
          {t("payment.return.checkingSlickpay")}
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
      <p className="mt-2 text-[15px] leading-relaxed text-[var(--text-soft)]">{t("payment.return.failSlickpay")}</p>
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
