import { Link } from "react-router-dom";
import { XCircle, Crown } from "lucide-react";
import { useTranslation } from "react-i18next";
import PaymentShell, { StatusBadge } from "../components/payment/PaymentShell.jsx";
import { premiumPath } from "../lib/seo.js";
import { homePath } from "../lib/seo.js";

/** صفحة إلغاء الدفع — لم تتم أي عملية خصم. */
export default function PaymentCancel() {
  const { t, i18n } = useTranslation();
  return (
    <PaymentShell>
      <StatusBadge tone="error">
        <XCircle size={30} className="text-red-400" />
      </StatusBadge>
      <h1 className="mt-6 text-[24px] font-black tracking-tight">{t("payment.cancel.title")}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-[var(--text-soft)]">{t("payment.cancel.desc")}</p>
      <div className="mt-7 flex w-full flex-col gap-2.5 sm:flex-row sm:justify-center">
        <Link
          to={premiumPath(i18n.language)}
          className="inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-[15px] font-extrabold text-[#1d1403]"
          style={{ background: "linear-gradient(135deg, #ffe486, #f0c63c 55%, #cf9a1e)" }}
        >
          <Crown size={17} /> {t("purchase.failBack")}
        </Link>
        <Link to={homePath(i18n.language)} className="inline-flex items-center justify-center rounded-2xl border border-[var(--color-ink-line)] px-6 py-3.5 text-[15px] font-bold text-[var(--text)] transition-colors hover:bg-[var(--fill)]">
          {t("payment.back")}
        </Link>
      </div>
    </PaymentShell>
  );
}
