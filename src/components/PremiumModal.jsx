import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Crown, Loader2, Check, KeyRound, Sparkles, Clock } from "lucide-react";
import { usePremium } from "../lib/premium.jsx";

const GOLD_SOFT = "#ffe486";
const GOLD_DEEP = "#cf9a1e";

export default function PremiumModal({ open, onClose }) {
  const { redeem } = usePremium();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [comingSoon, setComingSoon] = useState(false);

  const close = () => {
    setError("");
    setComingSoon(false);
    onClose();
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
            className="relative w-full max-w-md overflow-hidden rounded-[var(--radius-card)] border bg-[var(--color-ink-card)] p-7"
            style={{ borderColor: `${GOLD_DEEP}66`, boxShadow: `0 30px 80px -30px rgba(0,0,0,0.7), 0 0 0 1px ${GOLD_DEEP}22` }}
          >
            <div
              className="pointer-events-none absolute -top-20 left-1/2 h-44 w-72 -translate-x-1/2 rounded-full blur-[80px]"
              style={{ background: `radial-gradient(circle, ${GOLD_DEEP}40, transparent 65%)` }}
            />

            <button
              onClick={close}
              aria-label="إغلاق"
              className="absolute left-4 top-4 grid h-9 w-9 place-items-center rounded-xl border border-[var(--color-ink-line)] bg-[var(--fill)] text-[var(--color-mute)] transition-colors hover:text-[var(--text)]"
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
                  <p className="mt-1.5 text-[13.5px] text-[var(--text-soft)]">خصومات أقوى وأكواد حصرية — بطريقتين:</p>
                </div>

                {/* اشتراك */}
                {comingSoon ? (
                  <div className="mb-4 flex items-center gap-3 rounded-2xl border border-[var(--color-ink-line)] bg-[var(--fill)] p-4">
                    <Clock size={20} style={{ color: GOLD_DEEP }} />
                    <div>
                      <div className="text-[14px] font-extrabold text-[var(--text)]">الدفع قادم قريباً</div>
                      <div className="text-[12.5px] text-[var(--text-soft)]">سنفعّل الاشتراك بـ 10$/شهر هنا. حالياً استخدم كود Stork.</div>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setComingSoon(true)}
                    className="mb-4 flex w-full items-center justify-between rounded-2xl px-5 py-4 text-[#0a0a0a]"
                    style={{ background: `linear-gradient(135deg, ${GOLD_SOFT}, ${GOLD_DEEP})` }}
                  >
                    <span className="flex items-center gap-2 text-[15px] font-extrabold">
                      <Sparkles size={17} /> اشترك بـ 10$/شهر
                    </span>
                    <span className="rounded-lg bg-black/15 px-2 py-1 text-[11px] font-bold">الأفضل قيمة</span>
                  </button>
                )}

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
