import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Crown,
  Loader2,
  Check,
  KeyRound,
  Sparkles,
  CreditCard,
  Landmark,
  Wallet,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
} from "lucide-react";
import { usePremium } from "../lib/premium.jsx";
import { useAuth } from "../lib/auth.jsx";
import { startPremiumCheckout } from "../lib/billing.js";

const GOLD_SOFT = "#ffe486";
const GOLD_DEEP = "#cf9a1e";

// طرق الدفع في الخطوة الثانية. SlickPay وPayPal معطّلتان مؤقتاً حتى تجهيز الحسابات.
const METHODS = [
  {
    key: "stripe",
    name: "بطاقة دولية",
    desc: "Visa / Mastercard · 10$ شهرياً",
    icon: CreditCard,
    enabled: true,
  },
  {
    key: "slickpay",
    name: "البطاقة الجزائرية",
    desc: "CIB / Edahabia عبر SATIM",
    icon: Landmark,
    enabled: false,
  },
  {
    key: "paypal",
    name: "PayPal",
    desc: "الدفع عبر حساب PayPal",
    icon: Wallet,
    enabled: false,
  },
];

export default function PremiumModal({ open, onClose }) {
  const { redeem } = usePremium();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState("home"); // home | pay | stork
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [payError, setPayError] = useState("");

  const close = () => {
    setError("");
    setPayError("");
    setStep("home");
    onClose();
  };

  const goHome = () => {
    setError("");
    setPayError("");
    setStep("home");
  };

  // الدفع يتطلّب تسجيل الدخول أولاً
  const requireLogin = () => {
    if (!user) {
      close();
      navigate("/login");
      return true;
    }
    return false;
  };

  // الدفع الدولي عبر Stripe (اشتراك شهري بالدولار)
  const payStripe = async () => {
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

  const pickMethod = (m) => {
    if (!m.enabled) return;
    if (m.key === "stripe") payStripe();
  };

  // تفعيل كود Stork
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

  const titles = {
    home: { h: "افتح خصومات Premium", s: "خصومات أقوى وأكواد حصرية" },
    pay: { h: "اختر طريقة الدفع", s: "ادفع بأمان وفعّل Premium فوراً" },
    stork: { h: "عضوية Team Stork", s: "أدخل كودك لفتح كل المزايا" },
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

            {/* زر إغلاق */}
            <button
              onClick={close}
              aria-label="إغلاق"
              className="absolute left-3 top-3 z-10 grid h-11 w-11 place-items-center rounded-xl border border-[var(--color-ink-line)] bg-[var(--fill)] text-[var(--color-mute)] transition-colors hover:text-[var(--text)]"
            >
              <X size={17} />
            </button>

            {/* زر رجوع (في الخطوات الداخلية) */}
            {!done && step !== "home" && (
              <button
                onClick={goHome}
                aria-label="رجوع"
                className="absolute right-3 top-3 z-10 grid h-11 w-11 place-items-center rounded-xl border border-[var(--color-ink-line)] bg-[var(--fill)] text-[var(--color-mute)] transition-colors hover:text-[var(--text)]"
              >
                <ChevronRight size={18} />
              </button>
            )}

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
                {/* رأس موحّد */}
                <div className="mb-5 flex flex-col items-center text-center">
                  <span className="grid h-14 w-14 place-items-center rounded-2xl text-[#0a0a0a]" style={{ background: `linear-gradient(135deg, ${GOLD_SOFT}, ${GOLD_DEEP})` }}>
                    <Crown size={26} />
                  </span>
                  <h2 className="mt-4 text-[22px] font-black text-[var(--text)]">{titles[step].h}</h2>
                  <p className="mt-1.5 text-[13.5px] text-[var(--text-soft)]">{titles[step].s}</p>
                </div>

                {payError && (
                  <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/[0.08] px-3.5 py-2 text-[12.5px] font-semibold text-red-400">
                    {payError}
                  </div>
                )}

                <AnimatePresence mode="wait">
                  {/* ===== المودال الأول: زران فقط ===== */}
                  {step === "home" && (
                    <motion.div
                      key="home"
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -12 }}
                      transition={{ duration: 0.18 }}
                      className="flex flex-col gap-3"
                    >
                      <button
                        onClick={() => setStep("pay")}
                        className="flex w-full items-center justify-between rounded-2xl px-5 py-4 text-[#0a0a0a]"
                        style={{ background: `linear-gradient(135deg, ${GOLD_SOFT}, ${GOLD_DEEP})` }}
                      >
                        <span className="flex items-center gap-2 text-[15px] font-extrabold">
                          <Sparkles size={17} /> اشترك بـ 10$/شهر
                        </span>
                        <ChevronLeft size={18} />
                      </button>

                      <p className="-mt-0.5 px-1 text-center text-[12px] leading-relaxed text-[var(--text-soft)]">
                        مع Premium تحصل على{" "}
                        <span className="font-bold" style={{ color: GOLD_DEEP }}>خصومات أقوى</span> و
                        <span className="font-bold" style={{ color: GOLD_DEEP }}> أكواد حصرية</span>{" "}
                        لا تجدها في النسخة المجانية.
                      </p>

                      <button
                        onClick={() => setStep("stork")}
                        className="flex w-full items-center justify-between rounded-2xl border border-[var(--color-ink-line)] bg-[var(--fill)] px-5 py-4 text-[var(--text)] transition-colors hover:bg-[var(--fill-strong)]"
                      >
                        <span className="flex items-center gap-2 text-[15px] font-extrabold">
                          <KeyRound size={17} style={{ color: GOLD_DEEP }} /> أنا عضو Stork
                        </span>
                        <ChevronLeft size={18} className="text-[var(--color-mute)]" />
                      </button>
                    </motion.div>
                  )}

                  {/* ===== المودال الثاني: طرق الدفع ===== */}
                  {step === "pay" && (
                    <motion.div
                      key="pay"
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -12 }}
                      transition={{ duration: 0.18 }}
                      className="flex flex-col gap-2.5"
                    >
                      {METHODS.map((m) => {
                        const isStripeBusy = m.key === "stripe" && stripeLoading;
                        return (
                          <button
                            key={m.key}
                            type="button"
                            onClick={() => pickMethod(m)}
                            disabled={!m.enabled || isStripeBusy}
                            className="flex w-full items-center gap-3 rounded-2xl border p-3.5 text-right transition-all disabled:cursor-not-allowed"
                            style={{
                              borderColor: m.enabled ? `${GOLD_DEEP}55` : "var(--color-ink-line)",
                              background: m.enabled ? `${GOLD_DEEP}0d` : "var(--fill)",
                              opacity: m.enabled ? 1 : 0.55,
                            }}
                          >
                            <span
                              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
                              style={{
                                background: m.enabled
                                  ? `linear-gradient(135deg, ${GOLD_SOFT}, ${GOLD_DEEP})`
                                  : "var(--fill-strong)",
                                color: m.enabled ? "#0a0a0a" : "var(--color-mute)",
                              }}
                            >
                              <m.icon size={20} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2">
                                <span className="text-[14.5px] font-extrabold text-[var(--text)]">{m.name}</span>
                                {!m.enabled && (
                                  <span className="rounded-full bg-[var(--fill-strong)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-mute)]">
                                    قريباً
                                  </span>
                                )}
                              </span>
                              <span className="mt-0.5 block text-[12px] text-[var(--text-soft)]">{m.desc}</span>
                            </span>
                            {m.enabled &&
                              (isStripeBusy ? (
                                <Loader2 size={18} className="shrink-0 animate-spin" style={{ color: GOLD_DEEP }} />
                              ) : (
                                <ChevronLeft size={18} className="shrink-0" style={{ color: GOLD_DEEP }} />
                              ))}
                          </button>
                        );
                      })}
                      <p className="mt-1 text-center text-[11px] text-[var(--color-mute)]">دفع آمن — لا نحفظ بيانات بطاقتك</p>
                    </motion.div>
                  )}

                  {/* ===== خطوة كود Stork ===== */}
                  {step === "stork" && (
                    <motion.form
                      key="stork"
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -12 }}
                      transition={{ duration: 0.18 }}
                      onSubmit={submit}
                    >
                      <label className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-bold text-[var(--text-softer)]">
                        <KeyRound size={14} style={{ color: GOLD_DEEP }} /> كود Stork الخاص بك
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
                          autoFocus
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
                      <p className="mt-4 text-center text-[12px] leading-relaxed text-[var(--text-soft)]">
                        Team Stork مجتمع للمبدعين ورواد الأعمال — أعضاؤه يحصلون على أكواد
                        Premium حصرية ومزايا إضافية.
                      </p>
                      <a
                        href="https://www.stork.team/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border px-4 py-2.5 text-[12.5px] font-bold transition-colors"
                        style={{ borderColor: `${GOLD_DEEP}55`, color: GOLD_DEEP, background: `${GOLD_DEEP}0d` }}
                      >
                        <ExternalLink size={14} /> اكتشف مجتمع Team Stork
                      </a>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
