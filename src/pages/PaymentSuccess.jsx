import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Crown, Loader2, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import Logo from "../components/Logo.jsx";
import { useAuth } from "../lib/auth.jsx";

const GOLD_SOFT = "#ffe486";
const GOLD_DEEP = "#cf9a1e";

/** صفحة نجاح الدفع — تُحدّث الملف الشخصي بانتظار وصول حدث الـ webhook. */
export default function PaymentSuccess() {
  const { profile, refreshProfile } = useAuth();
  const { t } = useTranslation();
  const [waiting, setWaiting] = useState(true);

  const active = !!(
    profile?.is_premium &&
    (!profile.premium_until || new Date(profile.premium_until) > new Date())
  );

  // الـ webhook يصل بعد لحظات؛ نُحدّث الملف عدة مرات حتى تظهر حالة Premium
  useEffect(() => {
    let tries = 0;
    refreshProfile?.();
    const id = setInterval(() => {
      tries += 1;
      refreshProfile?.();
      if (tries >= 5) {
        clearInterval(id);
        setWaiting(false);
      }
    }, 2000);
    return () => clearInterval(id);
  }, [refreshProfile]);

  useEffect(() => {
    if (active) setWaiting(false);
  }, [active]);

  return (
    <Shell>
      <span
        className="grid h-16 w-16 place-items-center rounded-2xl text-[#0a0a0a]"
        style={{ background: `linear-gradient(135deg, ${GOLD_SOFT}, ${GOLD_DEEP})` }}
      >
        {active ? <Check size={32} strokeWidth={3} /> : <Crown size={30} />}
      </span>

      <h1 className="mt-5 text-[24px] font-black tracking-tight text-[var(--text)]">
        {active ? t("payment.success.activeTitle") : t("payment.success.receivedTitle")}
      </h1>

      <p className="mt-2 text-[14px] leading-relaxed text-[var(--text-soft)]">
        {active ? (
          t("payment.success.activeDesc")
        ) : waiting ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 size={16} className="animate-spin" /> {t("payment.success.confirming")}
          </span>
        ) : (
          t("payment.success.pending")
        )}
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

/** إطار بصري موحّد لصفحات الدفع (نفس هوية صفحات الحساب). */
export function Shell({ children }) {
  return (
    <div
      className="relative mx-auto grid min-h-screen w-full place-items-center overflow-x-hidden bg-[var(--color-ink)] px-4 py-10 text-[var(--text)]"
      style={{ maxWidth: "100vw" }}
    >
      <div
        className="pointer-events-none absolute left-1/2 top-1/4 h-[420px] w-[640px] max-w-[100vw] -translate-x-1/2 rounded-full blur-[120px]"
        style={{ background: `radial-gradient(circle, ${GOLD_DEEP}26, transparent 65%)` }}
      />
      <div className="pointer-events-none absolute inset-0 bg-grid" />

      <motion.div
        initial={{ opacity: 0, y: 22, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex w-full max-w-md flex-col items-center overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] p-7 text-center shadow-[0_24px_70px_-30px_rgba(0,0,0,0.55)]"
      >
        <Logo compact />
        <div className="mt-6 flex flex-col items-center">{children}</div>
      </motion.div>
    </div>
  );
}
