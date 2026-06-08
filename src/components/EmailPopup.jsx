import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, Gift, Loader2, Check, ShieldCheck } from "lucide-react";
import { useAuth } from "../lib/auth.jsx";
import { subscribeEmail } from "../lib/subscribers.js";

const SEEN_KEY = "codpromo:newsletter";
const DELAY_MS = 12000; // يظهر بعد ~12 ثانية أو عند محاولة المغادرة

const seen = () => {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
};
const markSeen = () => {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* تجاهل آمن */
  }
};

export default function EmailPopup() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const triggered = useRef(false);

  // مؤقّت + نية المغادرة (exit-intent) — لغير المسجّلين ومرة واحدة فقط
  useEffect(() => {
    if (loading || user || seen()) return;

    const show = () => {
      if (triggered.current) return;
      triggered.current = true;
      setOpen(true);
    };

    const timer = setTimeout(show, DELAY_MS);
    const onLeave = (e) => {
      if (e.clientY <= 0) show();
    };
    document.addEventListener("mouseleave", onLeave);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, [loading, user]);

  const close = () => {
    markSeen();
    setOpen(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("أدخل بريداً صحيحاً");
    if (!consent) return setError("يرجى الموافقة على استلام العروض للمتابعة");

    setSubmitting(true);
    try {
      await subscribeEmail(email, true, "popup");
      markSeen();
      setDone(true);
      setTimeout(() => setOpen(false), 2400);
    } catch (err) {
      setError(err.message || "تعذّر الاشتراك، حاول لاحقاً");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] grid place-items-center p-4"
        >
          {/* الخلفية */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />

          {/* البطاقة */}
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className="relative w-full max-w-md overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] p-7 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)]"
          >
            {/* توهّج علوي */}
            <div
              className="pointer-events-none absolute -top-20 left-1/2 h-44 w-72 -translate-x-1/2 rounded-full blur-[80px]"
              style={{ background: "radial-gradient(circle, rgba(166,240,0,0.22), transparent 65%)" }}
            />

            {/* زر الإغلاق — منطقة ضغط أكبر (p-3) مع إبقاء المربع المرئي بنفس الحجم */}
            <button
              onClick={close}
              aria-label="إغلاق"
              className="absolute left-1 top-1 grid place-items-center p-3 text-[var(--color-mute)] transition-colors hover:text-[var(--text)]"
            >
              <span className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--color-ink-line)] bg-[var(--fill)]">
                <X size={17} />
              </span>
            </button>

            {done ? (
              <div className="relative flex flex-col items-center gap-3 py-6 text-center">
                <div
                  className="grid h-16 w-16 place-items-center rounded-2xl"
                  style={{ background: "rgba(166,240,0,0.14)", border: "1px solid rgba(166,240,0,0.3)" }}
                >
                  <Check size={32} className="text-[var(--color-lime)]" strokeWidth={3} />
                </div>
                <h3 className="text-[20px] font-black text-[var(--text)]">تم الاشتراك! 🎉</h3>
                <p className="text-[14px] text-[var(--text-soft)]">ستصلك أفضل العروض الحصرية على بريدك.</p>
              </div>
            ) : (
              <div className="relative">
                <div className="mb-4 flex flex-col items-center text-center">
                  <span
                    className="grid h-14 w-14 place-items-center rounded-2xl"
                    style={{ background: "linear-gradient(150deg, var(--color-lime-soft), var(--color-lime-deep))", color: "#0a0a0a" }}
                  >
                    <Gift size={26} />
                  </span>
                  <h2 className="mt-4 text-balance text-[22px] font-black leading-snug text-[var(--text)]">
                    احصل على كوبونات وعروض <span className="text-[var(--accent-text)]">حصرية</span> في بريدك
                  </h2>
                  <p className="mt-1.5 text-[13.5px] text-[var(--text-soft)]">
                    انضم لآلاف الموفّرين — أفضل أكواد الخصم أسبوعياً.
                  </p>
                </div>

                {error && (
                  <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/[0.08] px-3.5 py-2 text-[12.5px] font-semibold text-red-400">
                    {error}
                  </div>
                )}

                <form onSubmit={submit} className="flex flex-col gap-3">
                  <div className="relative flex items-center">
                    <Mail size={17} className="pointer-events-none absolute right-3 text-[var(--color-mute)]" />
                    <input
                      type="email"
                      dir="ltr"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full rounded-xl border border-[var(--color-ink-line)] bg-[var(--color-ink)] px-3.5 py-3 pr-10 text-left text-[14.5px] font-medium text-[var(--text)] outline-none transition-colors placeholder:text-[var(--color-mute)] focus:border-[var(--color-lime)]"
                    />
                  </div>

                  {/* الموافقة */}
                  <label className="flex cursor-pointer items-start gap-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => setConsent((v) => !v)}
                      className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors"
                      style={{
                        borderColor: consent ? "var(--color-lime)" : "var(--color-ink-line)",
                        background: consent ? "var(--color-lime)" : "transparent",
                      }}
                      aria-pressed={consent}
                    >
                      {consent && <Check size={13} strokeWidth={3} className="text-[#0a0a0a]" />}
                    </button>
                    <span className="text-[12px] leading-relaxed text-[var(--text-soft)]" onClick={() => setConsent((v) => !v)}>
                      أوافق على استلام عروض وكوبونات عبر البريد وعلى{" "}
                      <span className="font-bold text-[var(--accent-text)] underline">سياسة الخصوصية</span>.
                    </span>
                  </label>

                  <motion.button
                    type="submit"
                    whileTap={{ scale: 0.98 }}
                    disabled={submitting}
                    className="mt-1 flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-[15px] font-extrabold text-[#0a0a0a] disabled:opacity-60"
                    style={{ background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" }}
                  >
                    {submitting ? <Loader2 size={18} className="animate-spin" /> : <Gift size={17} />}
                    اشترك واحصل على العروض
                  </motion.button>

                  <p className="flex items-center justify-center gap-1.5 text-[11px] text-[var(--color-mute)]">
                    <ShieldCheck size={12} className="text-[var(--color-lime)]" />
                    لا رسائل مزعجة — يمكنك إلغاء الاشتراك في أي وقت.
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
