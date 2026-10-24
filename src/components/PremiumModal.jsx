import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Crown,
  Loader2,
  Check,
  KeyRound,
  CreditCard,
  Landmark,
  Wallet,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
  Smartphone,
  RefreshCw,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePremium, isPremiumProfile, isLifetimeProfile } from "../lib/premium.jsx";
import { useAuth } from "../lib/auth.jsx";
import { usePricing, usePricingRefresh } from "../lib/pricing.jsx";
import { startStripeCheckout, startPaypalCheckout, startSlickpayCheckout } from "../lib/billing.js";
import { isPlayBillingSupported, getPlayDetails, purchasePlay, syncPlayPurchases } from "../lib/playBilling.js";
import LifetimePrice from "./pricing/LifetimePrice.jsx";
import SeatsMeter from "./pricing/SeatsMeter.jsx";

const GOLD_SOFT = "#ffe486";
const GOLD = "#f0c63c";
const GOLD_DEEP = "#cf9a1e";
const GOLD_BG = `linear-gradient(135deg, ${GOLD_SOFT}, ${GOLD} 55%, ${GOLD_DEEP})`;

// ألوان تذكرة Premium (نفس متغيّرات .ticket في البطاقات)
const TICKET_VARS = {
  "--edge-base": "rgba(240,198,60,0.42)",
  "--edge-strong": "rgba(240,198,60,0.7)",
  "--perf": "rgba(240,198,60,0.55)",
};

// طرق الدفع على الويب (Google Play يبان داخل التطبيق برك). الضغط يبدا الدفع مباشرة.
const WEB_METHODS = [
  { key: "stripe", icon: CreditCard, start: startStripeCheckout },
  { key: "slickpay", icon: Landmark, start: startSlickpayCheckout },
  { key: "paypal", icon: Wallet, start: startPaypalCheckout },
];

const fade = {
  initial: { opacity: 0, x: 12 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -12 },
  transition: { duration: 0.18 },
};

/**
 * نافذة Premium: دفعة واحدة · Premium مدى الحياة.
 *  - بطاقة وحدة (تذكرة ذهبية): وقت الإطلاق السعر العادي مشطوب ← سعر الإطلاق + عدّاد المقاعد الحقيقي؛
 *    بعد المقاعد السعر العادي برك بلا شطب وبلا عدّاد. السعر من pricing_public (للعرض)، والمبلغ
 *    الموثوق يتقرّر في الخادم.
 *  - تحتها طرق الدفع (ويب: Stripe / SlickPay / PayPal — داخل التطبيق: Google Play وحدو).
 *  - "أنا عضو Stork" ورابط الشروط وسياسة الاسترداد (/terms).
 * initialStep: "home" (افتراضي) ولا "stork".
 */
export default function PremiumModal({ open, onClose, initialStep = "home" }) {
  const { t } = useTranslation();
  const { redeem, isPremiumActive, isLifetime } = usePremium();
  const { user, refreshProfile } = useAuth();
  const pricing = usePricing();
  const refreshPricing = usePricingRefresh();
  const navigate = useNavigate();

  const [step, setStep] = useState("home"); // home | stork
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [paying, setPaying] = useState(null); // مفتاح الطريقة اللي راهي تبدا الدفع
  const [payError, setPayError] = useState("");
  const [pricingFailed, setPricingFailed] = useState(false);
  // Google Play Billing (داخل تطبيق TWA فقط — لا أثر على الويب)
  const [playAvailable, setPlayAvailable] = useState(false);
  const [playDetails, setPlayDetails] = useState({});

  // كشف توفّر Google Play Billing مرّة واحدة (صحيح فقط داخل تطبيق TWA المؤهّل).
  useEffect(() => {
    if (!isPlayBillingSupported()) return;
    let active = true;
    setPlayAvailable(true);
    getPlayDetails().then((d) => {
      if (active) setPlayDetails(d);
    });
    return () => {
      active = false;
    };
  }, []);

  // فتح النافذة: الخطوة المطلوبة + السعر والعدّاد من جديد (باش يكونو حقيقيين في هاد اللحظة)
  useEffect(() => {
    if (!open) return;
    setStep(initialStep === "stork" ? "stork" : "home");
    setPricingFailed(false);
    refreshPricing().then((p) => setPricingFailed(!p));
  }, [open, initialStep, refreshPricing]);

  // داخل التطبيق: شراء Play ما تأكّدش عندنا (انقطع الاتصال…) يتأكّد وحدو
  useEffect(() => {
    if (!open || !playAvailable || !user || isPremiumActive) return;
    syncPlayPurchases({ onVerified: refreshProfile });
  }, [open, playAvailable, user, isPremiumActive, refreshProfile]);

  const close = () => {
    setError("");
    setPayError("");
    setPaying(null);
    setStep("home");
    onClose();
  };

  const goBack = () => {
    setError("");
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

  const payErrorText = (e) =>
    e?.code === "already_premium"
      ? t("premium.errors.already")
      : e?.code === "outdated" || e?.code === "legacy_ui"
        ? t("premium.errors.outdated")
        : t("premium.payError");

  // احتياط ضد الدفع المزدوج: نعاودو نقراو الملف قبل ما نبداو (الخادم يرفض أيضاً)
  const stillFree = async () => {
    const fresh = await refreshProfile?.();
    return !(isPremiumProfile(fresh) || isLifetimeProfile(fresh));
  };

  const payWeb = async (m) => {
    setPayError("");
    if (requireLogin() || paying) return;
    setPaying(m.key);
    if (!(await stillFree())) return setPaying(null);
    try {
      await m.start();
    } catch (e) {
      setPaying(null);
      setPayError(payErrorText(e));
    }
  };

  // Google Play (داخل التطبيق فقط): المنتوج حسب السعر الحالي، والمنح خادمي عبر verify-play-purchase
  const payPlay = async () => {
    setPayError("");
    if (requireLogin() || paying || !pricing) return;
    setPaying("play");
    if (!(await stillFree())) return setPaying(null);
    const res = await purchasePlay(pricing.tier, { onVerified: refreshProfile });
    setPaying(null);
    if (!res.ok) {
      if (res.errorKey === "cancelled") return; // إلغاء صامت — بلا رسالة خطأ
      return setPayError(t(`premium.playErr.${res.errorKey || "generic"}`));
    }
    setDone(true);
    setTimeout(close, 1700);
  };

  // تفعيل كود Stork
  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await redeem(code);
    setLoading(false);
    if (!res.ok) return setError(t(`premium.storkErr.${res.errorKey || "generic"}`));
    setDone(true);
    setTimeout(close, 1700);
  };

  const retryPricing = () => {
    setPricingFailed(false);
    refreshPricing().then((p) => setPricingFailed(!p));
  };

  const methods = playAvailable ? [{ key: "play", icon: Smartphone }] : WEB_METHODS;
  const playPrice = pricing ? playDetails[pricing.tier]?.price : null;

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
            role="dialog"
            aria-modal="true"
            aria-labelledby="premium-modal-title"
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-[var(--radius-card)] border bg-[var(--color-ink-card)] p-5 sm:p-7"
            style={{ borderColor: `${GOLD_DEEP}66`, boxShadow: `0 30px 80px -30px rgba(0,0,0,0.7), 0 0 0 1px ${GOLD_DEEP}22` }}
          >
            <div
              className="pointer-events-none absolute -top-20 left-1/2 h-44 w-72 -translate-x-1/2 rounded-full blur-[80px]"
              style={{ background: `radial-gradient(circle, ${GOLD_DEEP}40, transparent 65%)` }}
            />

            {/* زر إغلاق */}
            <button
              onClick={close}
              aria-label={t("premium.close")}
              className="absolute end-3 top-3 z-10 grid h-11 w-11 place-items-center rounded-xl border border-[var(--color-ink-line)] bg-[var(--fill)] text-[var(--color-mute)] transition-colors hover:text-[var(--text)]"
            >
              <X size={17} />
            </button>

            {/* زر رجوع (خطوة Stork) */}
            {!done && !isPremiumActive && step !== "home" && (
              <button
                onClick={goBack}
                aria-label={t("premium.back")}
                className="absolute start-3 top-3 z-10 grid h-11 w-11 place-items-center rounded-xl border border-[var(--color-ink-line)] bg-[var(--fill)] text-[var(--color-mute)] transition-colors hover:text-[var(--text)]"
              >
                <ChevronRight size={18} className="ltr:rotate-180" />
              </button>
            )}

            {done ? (
              <div className="relative flex flex-col items-center gap-3 py-6 text-center">
                <div className="grid h-16 w-16 place-items-center rounded-2xl" style={{ background: `${GOLD_DEEP}22`, border: `1px solid ${GOLD_DEEP}55` }}>
                  <Check size={32} style={{ color: GOLD_SOFT }} strokeWidth={3} />
                </div>
                <h3 className="text-[20px] font-black text-[var(--text)]">{t("premium.doneTitle")}</h3>
                <p className="text-[14px] text-[var(--text-soft)]">{t("premium.doneDesc")}</p>
              </div>
            ) : isPremiumActive ? (
              /* حارس منع الدفع المزدوج: Premium نشط أصلاً → لا أزرار دفع */
              <div className="relative flex flex-col items-center gap-3 py-6 text-center">
                <div className="grid h-16 w-16 place-items-center rounded-2xl" style={{ background: GOLD_BG }}>
                  <Crown size={30} className="text-[#0a0a0a]" />
                </div>
                <h3 className="text-[20px] font-black text-[var(--text)]">{isLifetime ? t("premium.lifetime") : t("premium.alreadyTitle")}</h3>
                <p className="text-[14px] text-[var(--text-soft)]">{t("premium.alreadyDesc")}</p>
                <button onClick={close} className="mt-2 rounded-2xl px-6 py-3 text-[14px] font-extrabold text-[#0a0a0a]" style={{ background: GOLD_BG }}>
                  {t("premium.alreadyClose")}
                </button>
              </div>
            ) : (
              <div className="relative">
                <AnimatePresence mode="wait">
                  {step === "home" && (
                    <motion.div key="home" {...fade} className="flex flex-col">
                      {/* الرأس */}
                      <div className="mb-5 flex flex-col items-center px-8 text-center">
                        <span className="grid h-14 w-14 place-items-center rounded-2xl text-[#0a0a0a]" style={{ background: GOLD_BG }}>
                          <Crown size={26} />
                        </span>
                        <h2 id="premium-modal-title" className="mt-4 text-[22px] font-black text-[var(--text)]">
                          {t("premium.titles.homeH")}
                        </h2>
                        <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--text-soft)]">{t("premium.titles.homeS")}</p>
                      </div>

                      {/* البطاقة الوحدة = تذكرة ذهبية */}
                      <div className="ticket ticket-premium" style={TICKET_VARS}>
                        <div
                          className="ticket-top relative p-5"
                          style={{ background: "linear-gradient(160deg, rgba(240,198,60,0.16), rgba(240,198,60,0.04) 60%), var(--color-ink-card)" }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-[13px] font-extrabold" style={{ color: GOLD_SOFT }}>
                              {t("pricing.oneTime")}
                            </p>
                            {pricing?.isLaunch && (
                              <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black text-[#1d1403]" style={{ background: GOLD_BG }}>
                                {t("pricing.launchBadge")}
                              </span>
                            )}
                          </div>

                          {pricing ? (
                            <LifetimePrice pricing={pricing} size="lg" className="mt-3" />
                          ) : pricingFailed ? (
                            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/[0.08] px-3.5 py-2.5">
                              <p className="text-[12.5px] font-semibold text-red-300">{t("pricing.error")}</p>
                              <button type="button" onClick={retryPricing} className="flex shrink-0 items-center gap-1.5 text-[12.5px] font-extrabold text-[var(--text)]">
                                <RefreshCw size={14} /> {t("pricing.retry")}
                              </button>
                            </div>
                          ) : (
                            <div aria-hidden className="mt-3 h-[58px] w-2/3 animate-pulse rounded-xl bg-[var(--fill-strong)]" />
                          )}

                          <ul className="mt-4 grid gap-1.5 text-[13px] text-[var(--text-soft)]">
                            {["all", "noRenewal", "refund"].map((k) => (
                              <li key={k} className="flex items-start gap-2">
                                <Check size={15} strokeWidth={3} className="mt-0.5 shrink-0" style={{ color: GOLD }} />
                                <span>{t(`pricing.perks.${k}`)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        {pricing?.isLaunch && (
                          <div className="ticket-stub relative px-5 pb-5 pt-4" style={{ background: "rgba(240,198,60,0.06)" }}>
                            <span className="ticket-ring ticket-ring-l" />
                            <span className="ticket-ring ticket-ring-r" />
                            <span className="ticket-perf" />
                            <SeatsMeter pricing={pricing} />
                          </div>
                        )}
                      </div>

                      {/* طرق الدفع تحت البطاقة */}
                      <p className="mb-2.5 mt-5 text-[13px] font-extrabold text-[var(--text-softer)]">{t("premium.titles.payH")}</p>

                      {payError && (
                        <div role="alert" className="mb-2.5 rounded-xl border border-red-500/30 bg-red-500/[0.08] px-3.5 py-2 text-[12.5px] font-semibold text-red-400">
                          {payError}
                        </div>
                      )}

                      <div className="flex flex-col gap-2">
                        {methods.map((m) => {
                          const busy = paying === m.key;
                          const disabled = !pricing || (paying && !busy);
                          return (
                            <button
                              key={m.key}
                              type="button"
                              onClick={() => (m.key === "play" ? payPlay() : payWeb(m))}
                              disabled={disabled}
                              aria-busy={busy}
                              className="flex w-full items-center gap-3 rounded-2xl border p-3 text-start transition-colors hover:bg-[rgba(240,198,60,0.1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c63c] disabled:cursor-not-allowed disabled:opacity-55"
                              style={{ borderColor: `${GOLD_DEEP}55`, background: `${GOLD_DEEP}0d` }}
                            >
                              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[#0a0a0a]" style={{ background: GOLD_BG }}>
                                {busy ? <Loader2 size={19} className="animate-spin" /> : <m.icon size={20} />}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-[14.5px] font-extrabold text-[var(--text)]">{t(`premium.methods.${m.key}Name`)}</span>
                                <span className="mt-0.5 block text-[12px] text-[var(--text-soft)]">
                                  {m.key === "play" && playPrice ? t("premium.playPrice", { price: playPrice }) : t(`premium.methods.${m.key}Desc`)}
                                </span>
                              </span>
                              <ChevronLeft size={18} className="shrink-0 ltr:rotate-180" style={{ color: GOLD_DEEP }} />
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-2.5 text-center text-[11px] text-[var(--color-mute)]">{t("premium.paySecure")}</p>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-dashed border-[var(--color-ink-line)] pt-4 text-[12.5px]">
                        <button
                          type="button"
                          onClick={() => setStep("stork")}
                          className="flex items-center gap-1.5 font-bold text-[var(--text-soft)] transition-colors hover:text-[var(--text)]"
                        >
                          <KeyRound size={15} style={{ color: GOLD_DEEP }} /> {t("premium.storkMemberBtn")}
                        </button>
                        <Link to="/terms" onClick={close} className="font-bold text-[var(--text-soft)] underline decoration-dotted underline-offset-4 transition-colors hover:text-[var(--text)]">
                          {t("pricing.terms")}
                        </Link>
                      </div>
                    </motion.div>
                  )}

                  {/* ===== خطوة كود Stork ===== */}
                  {step === "stork" && (
                    <motion.form key="stork" {...fade} onSubmit={submit}>
                      <div className="mb-5 flex flex-col items-center px-8 text-center">
                        <span className="grid h-14 w-14 place-items-center rounded-2xl text-[#0a0a0a]" style={{ background: GOLD_BG }}>
                          <KeyRound size={24} />
                        </span>
                        <h2 id="premium-modal-title" className="mt-4 text-[22px] font-black text-[var(--text)]">
                          {t("premium.titles.storkH")}
                        </h2>
                        <p className="mt-1.5 text-[13.5px] text-[var(--text-soft)]">{t("premium.titles.storkS")}</p>
                      </div>
                      <label htmlFor="stork-code" className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-bold text-[var(--text-softer)]">
                        <KeyRound size={14} style={{ color: GOLD_DEEP }} /> {t("premium.storkLabel")}
                      </label>
                      {error && (
                        <div role="alert" className="mb-2 rounded-xl border border-red-500/30 bg-red-500/[0.08] px-3.5 py-2 text-[12.5px] font-semibold text-red-400">
                          {error}
                        </div>
                      )}
                      <div className="flex items-stretch gap-2">
                        <input
                          id="stork-code"
                          value={code}
                          onChange={(e) => setCode(e.target.value)}
                          placeholder={t("premium.storkPlaceholder")}
                          dir="ltr"
                          autoFocus
                          className="w-full min-w-0 rounded-xl border border-[var(--color-ink-line)] bg-[var(--color-ink)] px-3.5 py-3 text-left font-mono text-[14px] font-bold tracking-wider text-[var(--text)] outline-none transition-colors placeholder:font-sans placeholder:tracking-normal placeholder:text-[var(--color-mute)] focus:border-[color:var(--gold)]"
                          style={{ ["--gold"]: GOLD_DEEP }}
                        />
                        <motion.button
                          type="submit"
                          whileTap={{ scale: 0.97 }}
                          disabled={loading}
                          className="grid w-[104px] shrink-0 place-items-center rounded-xl px-4 text-[14px] font-extrabold text-[#0a0a0a] disabled:opacity-60"
                          style={{ background: GOLD_BG }}
                        >
                          {loading ? <Loader2 size={18} className="animate-spin" /> : t("premium.storkActivate")}
                        </motion.button>
                      </div>
                      <p className="mt-4 text-center text-[12px] leading-relaxed text-[var(--text-soft)]">{t("premium.storkAbout")}</p>
                      <a
                        href="https://www.stork.team/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border px-4 py-2.5 text-[12.5px] font-bold transition-colors"
                        style={{ borderColor: `${GOLD_DEEP}55`, color: GOLD_DEEP, background: `${GOLD_DEEP}0d` }}
                      >
                        <ExternalLink size={14} /> {t("premium.storkDiscover")}
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
