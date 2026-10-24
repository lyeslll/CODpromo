import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, BellRing, Loader2, Check, ShieldCheck } from "lucide-react";
import { useTranslation, Trans } from "react-i18next";
import { useAuth } from "../lib/auth.jsx";
import { subscribeEmail } from "../lib/subscribers.js";

// ============================================================
//  نافذة قائمة الانتظار (تنبيهات الأكواد بالبريد) — الرئيسية و /offers برك.
//  - ما تطلعش كي يدخل الزائر: بعد 40 ثانية في الموقع + نزول 55% من الصفحة (ولا نيّة الخروج في الكمبيوتر بعد 20 ثانية).
//  - ما تطلعش للمسجّل، ولا للي سجّل بريدو من قبل، ولا قبل 30 يوم من آخر مرة بانت (و "1" القديمة = أغلقها → ما ترجعش).
//  - الهاتف: لوحة من تحت (bottom sheet)، الكمبيوتر: بطاقة في الوسط. نفس عائلة تذاكر الكوبون.
//  - النص صادق: نظام إرسال الأكواد بالبريد مازال ما تبناش، هاذي قائمة انتظار.
// ============================================================
const SEEN_KEY = "codpromo:newsletter";
const SESSION_KEY = "codpromo:session-start";
const COOLDOWN_MS = 30 * 24 * 3600 * 1000;
const MIN_TIME_MS = 40000;
const EXIT_MIN_MS = 20000;
const SCROLL_RATIO = 0.55;

function readSeen() {
  try {
    const v = localStorage.getItem(SEEN_KEY);
    if (!v) return null;
    if (v === "1" || v === "subscribed") return { forever: true };
    const at = Number(v);
    return Number.isFinite(at) ? { at } : { forever: true };
  } catch {
    return { forever: true }; // تخزين ممنوع → ما نزعجوش
  }
}
const writeSeen = (v) => {
  try {
    localStorage.setItem(SEEN_KEY, String(v));
  } catch {
    /* تجاهل */
  }
};
/** بداية الجلسة (sessionStorage): الوقت يتحسب على الموقع كامل، ماشي على الصفحة برك. */
function sessionStart() {
  try {
    const v = Number(sessionStorage.getItem(SESSION_KEY));
    if (v) return v;
    const now = Date.now();
    sessionStorage.setItem(SESSION_KEY, String(now));
    return now;
  } catch {
    return Date.now();
  }
}

export default function EmailPopup() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const triggered = useRef(false);
  const [mobile] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches);

  useEffect(() => {
    if (loading || user) return;
    const seen = readSeen();
    if (seen?.forever || (seen?.at && Date.now() - seen.at < COOLDOWN_MS)) return;
    const start = sessionStart();

    const show = () => {
      if (triggered.current) return;
      triggered.current = true;
      writeSeen(Date.now()); // بانت → ما ترجعش قبل 30 يوم، حتى إذا ما سكّرهاش
      setOpen(true);
    };
    const ready = () => Date.now() - start >= MIN_TIME_MS;
    const scrolled = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      return h > 0 && window.scrollY / h >= SCROLL_RATIO;
    };
    const check = () => ready() && scrolled() && show();
    const onScroll = () => check();
    const timer = setInterval(check, 4000);
    const onLeave = (e) => {
      if (e.clientY <= 0 && Date.now() - start >= EXIT_MIN_MS) show();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("mouseleave", onLeave);
    return () => {
      clearInterval(timer);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, [loading, user]);

  // Esc يسكّر
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => setOpen(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError(t("emailPopup.errEmail"));
    if (!consent) return setError(t("emailPopup.errConsent"));
    setSubmitting(true);
    try {
      await subscribeEmail(email, true, "popup");
      writeSeen("subscribed");
      setDone(true);
      setTimeout(() => setOpen(false), 2600);
    } catch {
      setError(t("emailPopup.errGeneric"));
    } finally {
      setSubmitting(false);
    }
  };

  const sheet = mobile
    ? { initial: { y: "100%" }, animate: { y: 0 }, exit: { y: "100%" }, transition: { type: "spring", stiffness: 340, damping: 34 } }
    : { initial: { opacity: 0, y: 24, scale: 0.97 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: 16, scale: 0.98 }, transition: { type: "spring", stiffness: 320, damping: 28 } };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`fixed inset-0 z-[100] flex ${mobile ? "items-end" : "items-center justify-center p-4"}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="np-title"
        >
          <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={close} />

          <motion.div
            {...sheet}
            className={`ticket relative w-full ${mobile ? "" : "max-w-[440px]"}`}
            style={{ "--edge-base": "#a6f00040", "--edge-strong": "#a6f00080", "--perf": "#a6f00066", "--r": "14px" }}
          >
            {/* الجزء العلوي: الوعد */}
            <div
              className={`ticket-top relative overflow-hidden px-6 pb-5 pt-6 ${mobile ? "!rounded-b-none" : ""}`}
              style={{ background: "radial-gradient(110% 80% at 50% -10%, rgba(166,240,0,0.16), transparent 60%), var(--color-ink-card)" }}
            >
              <span aria-hidden className="ticket-ring ticket-ring-l" />
              <span aria-hidden className="ticket-ring ticket-ring-r" />
              {mobile && <span aria-hidden className="mx-auto mb-4 block h-1 w-10 rounded-full bg-white/15" />}
              <button
                type="button"
                onClick={close}
                aria-label={t("emailPopup.close")}
                className="absolute end-3 top-3 z-10 grid h-11 w-11 place-items-center rounded-xl text-[var(--color-mute)] transition-colors hover:bg-[var(--fill)] hover:text-[var(--text)]"
              >
                <X size={18} />
              </button>
              {done ? (
                <div className="flex flex-col items-center gap-3 py-4 text-center" role="status">
                  <span className="grid h-14 w-14 place-items-center rounded-2xl border border-[var(--color-lime)]/35 bg-[var(--color-lime)]/15">
                    <Check size={28} strokeWidth={3} className="text-[var(--color-lime)]" />
                  </span>
                  <h2 id="np-title" className="text-[20px] font-black text-[var(--text)]">
                    {t("emailPopup.doneTitle")}
                  </h2>
                  <p className="max-w-[34ch] text-[14px] leading-relaxed text-[var(--text-soft)]">{t("emailPopup.doneDesc")}</p>
                </div>
              ) : (
                <div className="pe-8">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl text-[#0a0a0a]" style={{ background: "linear-gradient(150deg, var(--color-lime-soft), var(--color-lime-deep))" }}>
                    <BellRing size={22} />
                  </span>
                  <h2 id="np-title" className="mt-4 text-balance text-[21px] font-black leading-snug text-[var(--text)]">
                    <Trans i18nKey="emailPopup.title" components={[<span className="text-[var(--accent-text)]" />]} />
                  </h2>
                  <p className="mt-2 max-w-[40ch] text-[14px] leading-relaxed text-[var(--text-soft)]">{t("emailPopup.desc")}</p>
                </div>
              )}
            </div>

            {/* الكعب: البريد */}
            {!done && (
              <form
                onSubmit={submit}
                noValidate
                className={`ticket-stub relative flex flex-col gap-3 bg-[var(--color-ink-card)] px-6 pt-5 ${mobile ? "!rounded-none" : ""}`}
                style={{ paddingBottom: mobile ? "calc(20px + env(safe-area-inset-bottom, 0px))" : 22 }}
              >
                <span aria-hidden className="ticket-ring ticket-ring-l" />
                <span aria-hidden className="ticket-ring ticket-ring-r" />
                <span aria-hidden className="ticket-perf" />
                <label className="relative block">
                  <span className="sr-only">{t("emailPopup.emailLabel")}</span>
                  <Mail size={17} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-[var(--color-mute)]" />
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    dir={email ? "ltr" : undefined}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("emailPopup.emailPh")}
                    className="h-[52px] w-full rounded-xl border border-[var(--color-ink-line)] bg-[var(--color-ink)] px-11 text-[16px] font-medium text-[var(--text)] outline-none transition-colors placeholder:text-[var(--color-mute)] focus:border-[var(--color-lime)]"
                  />
                </label>

                <label className="flex cursor-pointer items-start gap-3 text-start">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-[var(--color-lime)]"
                  />
                  <span className="text-[12.5px] leading-relaxed text-[var(--text-soft)]">
                    <Trans i18nKey="emailPopup.consent" components={[<Link to="/privacy" className="font-bold text-[var(--accent-text)] underline underline-offset-2" onClick={close} />]} />
                  </span>
                </label>

                {error && (
                  <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/[0.08] px-3.5 py-2 text-[12.5px] font-semibold text-red-400">
                    {error}
                  </p>
                )}

                <motion.button
                  type="submit"
                  whileTap={{ scale: 0.98 }}
                  disabled={submitting}
                  className="flex min-h-[50px] items-center justify-center gap-2 rounded-xl px-5 text-[15px] font-extrabold text-[#0a0a0a] disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))", boxShadow: "0 14px 34px -14px rgba(166,240,0,0.6)" }}
                >
                  {submitting ? <Loader2 size={18} className="animate-spin" /> : <BellRing size={17} />}
                  {t("emailPopup.submit")}
                </motion.button>

                <p className="flex items-center justify-center gap-1.5 text-center text-[12px] text-[var(--color-mute)]">
                  <ShieldCheck size={13} className="shrink-0 text-[var(--color-lime)]" />
                  {t("emailPopup.noSpam")}
                </p>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
