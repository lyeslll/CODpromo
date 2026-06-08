import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Crown, Loader2, Check, KeyRound, Sparkles, CreditCard } from "lucide-react";
import { usePremium } from "../lib/premium.jsx";
import { useAuth } from "../lib/auth.jsx";
import { startPremiumCheckout, startSlickpayCheckout } from "../lib/billing.js";
import { DZ_PLANS, fmtDZ } from "../lib/plans.js";

const GOLD_SOFT = "#ffe486";
const GOLD_DEEP = "#cf9a1e";

export default function PremiumModal({ open, onClose }) {
  const { redeem } = usePremium();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [dzLoading, setDzLoading] = useState(false);
  const [payError, setPayError] = useState("");
  const [plan, setPlan] = useState("year");

  const selected = DZ_PLANS.find((p) => p.key === plan) || DZ_PLANS[0];

  const close = () => {
    setError("");
    setPayError("");
    onClose();
  };

  // يتطلّب الدفع تسجيل الدخول أولاً
  const requireLogin = () => {
    if (!user) {
      onClose();
      navigate("/login");
      return true;
    }
    return false;
  };

  // الدفع الدولي عبر Stripe (اشتراك شهري بالدولار)
  const subscribe = async () => {
    setPayError("");
    if (requireLogin()) return;
    setStripeLoading(true);
    try {
      await startPremiumCheckout();
    } catch (e) {
      setStripeLoading(false);
      setPayError(e.message || "تعذّر بدء عملية الدفع");
    }
  };

  // الدفع الجزائري عبر SlickPay (البطاقة المختارة، يوجّه لصفحة SATIM)
  const payDz = async () => {
    setPayError("");
    if (requireLogin()) return;
    setDzLoading(true);
    try {
      await startSlickpayCheckout(plan);
    } catch (e) {
      setDzLoading(false);
      setPayError(e.message || "تعذّر بدء عملية الدفع");
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await redeem(code);
    setLoading(false);
    if (!res.ok) return setError(res.error || "تعذّر تفعيل الكود");
    setDone(true);
    setTimeout(close, 1700);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] grid place-items-center p-4"
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />

          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-[var(--radius-card)] border bg-[var(--color-ink-card)] p-7"
            style={{ borderColor: `${GOLD_DEEP}66`, boxShadow: `0 30px 80px -30px rgba(0,0,0,0.7), 0 0 0 1px ${GOLD_DEEP}22` }}
          >
            <div
              className="pointer-events-none absolute -top-20 left-1/2 h-44 w-72 -translate-x-1/2 rounded-full blur-[80px]"
              style={{ background: `radial-gradient(circle, ${GOLD_DEEP}40, transparent 65%)` }}
            />

            {/* زر إغلاق — مربع 44px والأيقونة في مركزه تماماً (منطقة الضغط = المربع نفسه) */}
            <button
              onClick={close}
              aria-label="إغلاق"
              className="absolute left-3 top-3 z-10 grid h-11 w-11 place-items-center rounded-xl border border-[var(--color-ink-line)] bg-[var(--fill)] text-[var(--color-mute)] transition-colors hover:text-[var(--text)]"
            >
              <X size={17} />
            </button>

            {done ? (
              <div className="relative flex flex-col items-center gap-3 py-6 text-center">
                <div className="grid h-16 w-16 place-items-center rounded-2xl" style={{ background: `${GOLD_DEEP}22`, border: `1px solid ${GOLD_DEEP}55` }}>
                  <Check size={32} style={{ color: GOLD_SOFT }} strokeWidth={3} />
                </div>
                <h3 className="text-[20px] font-black text-[var(--text)]">تم تفعيل Premium! 👑</h3>
                <p className="text-[14px] text-[var(--text-soft)]">كُشفت كل أكواد Premium — استمتع بالخصومات الأقوى.</p>
              </div>
            ) : (
              <div className="relative">
                <div className="mb-5 flex flex-col items-center text-center">
                  <span className="grid h-14 w-14 place-items-center rounded-2xl text-[#0a0a0a]" style={{ background: `linear-gradient(135deg, ${GOLD_SOFT}, ${GOLD_DEEP})` }}>
                    <Crown size={26} />
                  </span>
                  <h2 className="mt-4 text-[22px] font-black text-[var(--text)]">افتح خصومات Premium</h2>
                  <p className="mt-1.5 text-[13.5px] text-[var(--text-soft)]">خصومات أقوى وأكواد حصرية</p>
                </div>

                {payError && (
                  <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/[0.08] px-3.5 py-2 text-[12.5px] font-semibold text-red-400">
                    {payError}
                  </div>
                )}

                {/* الدفع الجزائري — SlickPay (CIB / Edahabia) */}
                <div className="mb-2 flex items-center gap-1.5 text-[12.5px] font-bold text-[var(--text-softer)]">
                  <CreditCard size={14} className="text-[var(--color-lime)]" /> الدفع بالبطاقة الجزائرية
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2.5">
                  {DZ_PLANS.map((p) => {
                    const active = plan === p.key;
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => setPlan(p.key)}
                        className="relative flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 text-center transition-all"
                        style={{
                          borderColor: active ? "var(--color-lime)" : "var(--color-ink-line)",
                          background: active ? "rgba(166,240,0,0.08)" : "var(--fill)",
                        }}
                      >
                        {p.badge && (
                          <span
                            className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[8.5px] font-extrabold text-[#0a0a0a]"
                            style={{ background: p.best ? "var(--color-lime)" : "var(--fill-strong)", color: p.best ? "#0a0a0a" : "var(--text-soft)" }}
                          >
                            {p.badge}
                          </span>
                        )}
                        <span className="text-[12.5px] font-extrabold text-[var(--text)]">{p.label}</span>
                        <span
                          className="text-[12.5px] font-black"
                          style={{ color: active ? "var(--accent-text)" : "var(--text)" }}
                        >
                          {fmtDZ(p.price)}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={payDz}
                  disabled={dzLoading}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-[15px] font-extrabold text-[#0a0a0a] disabled:opacity-70"
                  style={{ background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" }}
                >
                  {dzLoading ? <Loader2 size={18} className="animate-spin" /> : <CreditCard size={18} />}
                  ادفع · {fmtDZ(selected.price)}
                </button>
                <p className="mt-2 text-center text-[11px] text-[var(--color-mute)]">
                  CIB / Edahabia عبر SATIM — دفع آمن
                </p>

                <div className="my-4 flex items-center gap-3 text-[12px] text-[var(--color-mute)]">
                  <span className="h-px flex-1 bg-[var(--color-ink-line)]" /> أو الدفع الدولي <span className="h-px flex-1 bg-[var(--color-ink-line)]" />
                </div>

                {/* الدفع الدولي — Stripe (بالدولار، اشتراك متجدّد) */}
                <button
                  onClick={subscribe}
                  disabled={stripeLoading}
                  className="mb-4 flex w-full items-center justify-between rounded-2xl px-5 py-4 text-[#0a0a0a] disabled:opacity-70"
                  style={{ background: `linear-gradient(135deg, ${GOLD_SOFT}, ${GOLD_DEEP})` }}
                >
                  <span className="flex items-center gap-2 text-[15px] font-extrabold">
                    {stripeLoading ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
                    اشترك بـ 10$/شهر
                  </span>
                  <span className="rounded-lg bg-black/15 px-2 py-1 text-[11px] font-bold">Visa / Mastercard</span>
                </button>

                <div className="my-4 flex items-center gap-3 text-[12px] text-[var(--color-mute)]">
                  <span className="h-px flex-1 bg-[var(--color-ink-line)]" /> أو <span className="h-px flex-1 bg-[var(--color-ink-line)]" />
                </div>

                {/* كود Stork */}
                <form onSubmit={submit}>
                  <label className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-bold text-[var(--text-softer)]">
                    <KeyRound size={14} style={{ color: GOLD_DEEP }} /> أنا عضو في Stork
                  </label>
                  {error && (
                    <div className="mb-2 rounded-xl border border-red-500/30 bg-red-500/[0.08] px-3.5 py-2 text-[12.5px] font-semibold text-red-400">
                      {error}
                    </div>
                  )}
                  <div className="flex items-stretch gap-2">
                    <input
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="أدخل كود Stork الخاص بك"
                      dir="ltr"
                      className="w-full rounded-xl border border-[var(--color-ink-line)] bg-[var(--color-ink)] px-3.5 py-3 text-left font-mono text-[14px] font-bold tracking-wider text-[var(--text)] outline-none transition-colors placeholder:font-sans placeholder:tracking-normal placeholder:text-[var(--color-mute)] focus:border-[color:var(--gold)]"
                      style={{ ["--gold"]: GOLD_DEEP }}
                    />
                    <motion.button
                      type="submit"
                      whileTap={{ scale: 0.97 }}
                      disabled={loading}
                      className="grid w-[110px] shrink-0 place-items-center rounded-xl px-4 text-[14px] font-extrabold text-[#0a0a0a] disabled:opacity-60"
                      style={{ background: `linear-gradient(135deg, ${GOLD_SOFT}, ${GOLD_DEEP})` }}
                    >
                      {loading ? <Loader2 size={18} className="animate-spin" /> : "تفعيل"}
                    </motion.button>
                  </div>
                  <p className="mt-3 text-center text-[11.5px] text-[var(--color-mute)]">
                    جرّب: <span className="font-mono font-bold text-[var(--text-softer)]">STORK-VIP-001</span>
                  </p>
                </form>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
