import { useState, useEffect } from "react";
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
  Smartphone,
} from "lucide-react";
import { useTranslation, Trans } from "react-i18next";
import { usePremium, isPremiumProfile } from "../lib/premium.jsx";
import { useAuth } from "../lib/auth.jsx";
import { startPremiumCheckout, startPaypalCheckout, startSlickpayCheckout } from "../lib/billing.js";
import { isPlayBillingSupported, getPlayDetails, purchasePlay } from "../lib/playBilling.js";
import { USD_PLANS, fmtUSD, DZ_PLANS, fmtDZ } from "../lib/plans.js";

const GOLD_SOFT = "#ffe486";
const GOLD_DEEP = "#cf9a1e";

// طرق الدفع في الخطوة الثانية (النصوص تُترجم في وقت العرض).
const METHODS = [
  { key: "stripe", icon: CreditCard, enabled: true },
  { key: "slickpay", icon: Landmark, enabled: true },
  { key: "paypal", icon: Wallet, enabled: true },
];

/** شارة الباقة المترجمة (الأكثر شيوعاً / الأكثر توفيراً) أو لا شيء. */
const planBadgeKey = (p) => (p.best ? "badgeBest" : p.badge ? "badgePopular" : null);

export default function PremiumModal({ open, onClose }) {
  const { t } = useTranslation();
  const { redeem, isPremiumActive } = usePremium();
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState("home"); // home | pay | stripe | slickpay | paypal | stork
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripePlan, setStripePlan] = useState("year");
  const [paypalLoading, setPaypalLoading] = useState(false);
  const [paypalPlan, setPaypalPlan] = useState("year");
  const [slickpayLoading, setSlickpayLoading] = useState(false);
  const [slickpayPlan, setSlickpayPlan] = useState("year");
  const [payError, setPayError] = useState("");
  // Google Play Billing (داخل تطبيق TWA فقط — لا أثر على الويب)
  const [playAvailable, setPlayAvailable] = useState(false);
  const [playDetails, setPlayDetails] = useState({});
  const [playPlan, setPlayPlan] = useState("year");
  const [playLoading, setPlayLoading] = useState(false);

  const stripeSelected = USD_PLANS.find((p) => p.key === stripePlan) || USD_PLANS[0];
  const paypalSelected = USD_PLANS.find((p) => p.key === paypalPlan) || USD_PLANS[0];
  const slickpaySelected = DZ_PLANS.find((p) => p.key === slickpayPlan) || DZ_PLANS[0];

  // كشف توفّر Google Play Billing مرّة واحدة (صحيح فقط داخل تطبيق TWA المؤهّل).
  // إن لم يتوفّر يبقى playAvailable=false وكل مسارات الدفع الويب كما هي تماماً.
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

  // قائمة طرق الدفع: داخل تطبيق Play تُعرض طريقة Play فقط (سياسة Google)،
  // وعلى الويب تبقى القائمة الأصلية (Stripe / SlickPay / PayPal) دون تغيير.
  const methods = playAvailable
    ? [{ key: "play", icon: Smartphone, enabled: true }]
    : METHODS;

  const close = () => {
    setError("");
    setPayError("");
    setStep("home");
    onClose();
  };

  // زر الرجوع: من خطوة باقات (Stripe/PayPal/SlickPay) يعود لقائمة الطرق، وإلا للبداية
  const goBack = () => {
    setError("");
    setPayError("");
    setStep(["stripe", "paypal", "slickpay", "play"].includes(step) ? "pay" : "home");
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

  // الدفع الدولي عبر Stripe (اشتراك متجدّد بالدولار — شهر/3 أشهر/سنة)
  const payStripe = async () => {
    setPayError("");
    if (requireLogin()) return;
    setStripeLoading(true);
    try {
      await startPremiumCheckout(stripePlan);
    } catch (e) {
      setStripeLoading(false);
      setPayError(e.message || t("premium.payError"));
    }
  };

  // الدفع الدولي عبر PayPal (باقة لمرة واحدة، يوجّه لصفحة موافقة PayPal)
  const payPaypal = async () => {
    setPayError("");
    if (requireLogin()) return;
    setPaypalLoading(true);
    try {
      await startPaypalCheckout(paypalPlan);
    } catch (e) {
      setPaypalLoading(false);
      setPayError(e.message || t("premium.payError"));
    }
  };

  // الدفع الجزائري عبر SlickPay (باقة لمرة واحدة، يوجّه لصفحة SATIM)
  const paySlickpay = async () => {
    setPayError("");
    if (requireLogin()) return;
    setSlickpayLoading(true);
    try {
      await startSlickpayCheckout(slickpayPlan);
    } catch (e) {
      setSlickpayLoading(false);
      setPayError(e.message || t("premium.payError"));
    }
  };

  const pickMethod = (m) => {
    if (!m.enabled) return;
    if (m.key === "stripe") setStep("stripe");
    else if (m.key === "slickpay") setStep("slickpay");
    else if (m.key === "paypal") setStep("paypal");
    else if (m.key === "play") setStep("play");
  };

  // الدفع عبر Google Play (داخل التطبيق فقط). المنح الفعلي خادمي عبر
  // verify-play-purchase؛ هنا نرسل الرمز فقط ثم نحدّث الملف الشخصي عند النجاح.
  const payPlay = async () => {
    setPayError("");
    if (requireLogin()) return;
    setPlayLoading(true);
    // احتياط ضد الدفع المزدوج: أعد التحقّق من الاشتراك قبل بدء الشراء.
    // إن كان نشطاً بالفعل، يتحوّل المودال تلقائياً لرسالة "أنت مشترك Premium".
    const fresh = await refreshProfile?.();
    if (isPremiumProfile(fresh)) {
      setPlayLoading(false);
      return;
    }
    const res = await purchasePlay(playPlan, { onVerified: refreshProfile });
    setPlayLoading(false);
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

  const titles = {
    home: { h: t("premium.titles.homeH"), s: t("premium.titles.homeS") },
    pay: { h: t("premium.titles.payH"), s: t("premium.titles.payS") },
    stripe: { h: t("premium.titles.stripeH"), s: t("premium.titles.stripeS") },
    slickpay: { h: t("premium.titles.slickpayH"), s: t("premium.titles.slickpayS") },
    paypal: { h: t("premium.titles.paypalH"), s: t("premium.titles.paypalS") },
    play: { h: t("premium.titles.playH"), s: t("premium.titles.playS") },
    stork: { h: t("premium.titles.storkH"), s: t("premium.titles.storkS") },
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
              aria-label={t("premium.close")}
              className="absolute end-3 top-3 z-10 grid h-11 w-11 place-items-center rounded-xl border border-[var(--color-ink-line)] bg-[var(--fill)] text-[var(--color-mute)] transition-colors hover:text-[var(--text)]"
            >
              <X size={17} />
            </button>

            {/* زر رجوع (في الخطوات الداخلية) */}
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
              /* حارس منع الدفع المزدوج: مشترك Premium نشط أصلاً → لا أزرار دفع */
              <div className="relative flex flex-col items-center gap-3 py-6 text-center">
                <div className="grid h-16 w-16 place-items-center rounded-2xl" style={{ background: `linear-gradient(135deg, ${GOLD_SOFT}, ${GOLD_DEEP})` }}>
                  <Crown size={30} className="text-[#0a0a0a]" />
                </div>
                <h3 className="text-[20px] font-black text-[var(--text)]">{t("premium.alreadyTitle")}</h3>
                <p className="text-[14px] text-[var(--text-soft)]">{t("premium.alreadyDesc")}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-mute)]">{t("premium.manageHint")}</p>
                <button
                  onClick={close}
                  className="mt-2 rounded-2xl px-6 py-3 text-[14px] font-extrabold text-[#0a0a0a]"
                  style={{ background: `linear-gradient(135deg, ${GOLD_SOFT}, ${GOLD_DEEP})` }}
                >
                  {t("premium.alreadyClose")}
                </button>
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
                          <Sparkles size={17} /> {t("premium.subscribeBtn")}
                        </span>
                        <ChevronLeft size={18} className="ltr:rotate-180" />
                      </button>

                      <button
                        onClick={() => setStep("stork")}
                        className="flex w-full items-center justify-between rounded-2xl border border-[var(--color-ink-line)] bg-[var(--fill)] px-5 py-4 text-[var(--text)] transition-colors hover:bg-[var(--fill-strong)]"
                      >
                        <span className="flex items-center gap-2 text-[15px] font-extrabold">
                          <KeyRound size={17} style={{ color: GOLD_DEEP }} /> {t("premium.storkMemberBtn")}
                        </span>
                        <ChevronLeft size={18} className="text-[var(--color-mute)] ltr:rotate-180" />
                      </button>

                      <p className="mt-1 px-1 text-center text-[12px] leading-relaxed text-[var(--text-soft)]">
                        <Trans
                          i18nKey="premium.benefit"
                          components={[
                            <span className="font-bold" style={{ color: GOLD_DEEP }} />,
                            <span className="font-bold" style={{ color: GOLD_DEEP }} />,
                          ]}
                        />
                      </p>
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
                      {methods.map((m) => {
                        return (
                          <button
                            key={m.key}
                            type="button"
                            onClick={() => pickMethod(m)}
                            disabled={!m.enabled}
                            className="flex w-full items-center gap-3 rounded-2xl border p-3.5 text-start transition-all disabled:cursor-not-allowed"
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
                                <span className="text-[14.5px] font-extrabold text-[var(--text)]">{t(`premium.methods.${m.key}Name`)}</span>
                                {!m.enabled && (
                                  <span className="rounded-full bg-[var(--fill-strong)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-mute)]">
                                    {t("premium.methods.soon")}
                                  </span>
                                )}
                              </span>
                              <span className="mt-0.5 block text-[12px] text-[var(--text-soft)]">{t(`premium.methods.${m.key}Desc`)}</span>
                            </span>
                            {m.enabled && (
                              <ChevronLeft size={18} className="shrink-0 ltr:rotate-180" style={{ color: GOLD_DEEP }} />
                            )}
                          </button>
                        );
                      })}
                      <p className="mt-1 text-center text-[11px] text-[var(--color-mute)]">{t("premium.paySecure")}</p>
                    </motion.div>
                  )}

                  {/* ===== خطوة باقات Stripe (اشتراك متجدّد بالدولار) ===== */}
                  {step === "stripe" && (
                    <motion.div
                      key="stripe"
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -12 }}
                      transition={{ duration: 0.18 }}
                      className="flex flex-col"
                    >
                      <div className="grid grid-cols-3 gap-2 pt-2.5">
                        {USD_PLANS.map((p) => {
                          const active = stripePlan === p.key;
                          return (
                            <button
                              key={p.key}
                              type="button"
                              onClick={() => setStripePlan(p.key)}
                              className="relative flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 text-center transition-all"
                              style={{
                                borderColor: active ? GOLD_DEEP : "var(--color-ink-line)",
                                background: active ? `${GOLD_DEEP}14` : "var(--fill)",
                              }}
                            >
                              {p.badge && (
                                <span
                                  className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[8.5px] font-extrabold"
                                  style={{
                                    background: p.best ? `linear-gradient(135deg, ${GOLD_SOFT}, ${GOLD_DEEP})` : "var(--fill-strong)",
                                    color: p.best ? "#0a0a0a" : "var(--text-soft)",
                                  }}
                                >
                                  {t(`premium.plans.${planBadgeKey(p)}`)}
                                </span>
                              )}
                              <span className="text-[12.5px] font-extrabold text-[var(--text)]">{t(`premium.plans.${p.key}`)}</span>
                              <span
                                className="text-[13px] font-black"
                                style={{ color: active ? GOLD_DEEP : "var(--text)" }}
                              >
                                {fmtUSD(p.price)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <button
                        onClick={payStripe}
                        disabled={stripeLoading}
                        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-[15px] font-extrabold text-[#0a0a0a] disabled:opacity-70"
                        style={{ background: `linear-gradient(135deg, ${GOLD_SOFT}, ${GOLD_DEEP})` }}
                      >
                        {stripeLoading ? <Loader2 size={18} className="animate-spin" /> : <CreditCard size={18} />}
                        {t("premium.stripeBtn")} · {fmtUSD(stripeSelected.price)}
                      </button>
                      <p className="mt-2 text-center text-[11px] text-[var(--color-mute)]">
                        {t("premium.stripeNote")}
                      </p>
                    </motion.div>
                  )}

                  {/* ===== خطوة باقات SlickPay (الدينار الجزائري) ===== */}
                  {step === "slickpay" && (
                    <motion.div
                      key="slickpay"
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -12 }}
                      transition={{ duration: 0.18 }}
                      className="flex flex-col"
                    >
                      <div className="grid grid-cols-3 gap-2 pt-2.5">
                        {DZ_PLANS.map((p) => {
                          const active = slickpayPlan === p.key;
                          return (
                            <button
                              key={p.key}
                              type="button"
                              onClick={() => setSlickpayPlan(p.key)}
                              className="relative flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 text-center transition-all"
                              style={{
                                borderColor: active ? GOLD_DEEP : "var(--color-ink-line)",
                                background: active ? `${GOLD_DEEP}14` : "var(--fill)",
                              }}
                            >
                              {p.badge && (
                                <span
                                  className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[8.5px] font-extrabold"
                                  style={{
                                    background: p.best ? `linear-gradient(135deg, ${GOLD_SOFT}, ${GOLD_DEEP})` : "var(--fill-strong)",
                                    color: p.best ? "#0a0a0a" : "var(--text-soft)",
                                  }}
                                >
                                  {t(`premium.plans.${planBadgeKey(p)}`)}
                                </span>
                              )}
                              <span className="text-[12.5px] font-extrabold text-[var(--text)]">{t(`premium.plans.${p.key}`)}</span>
                              <span
                                className="text-[13px] font-black"
                                style={{ color: active ? GOLD_DEEP : "var(--text)" }}
                              >
                                {fmtDZ(p.price)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <button
                        onClick={paySlickpay}
                        disabled={slickpayLoading}
                        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-[15px] font-extrabold text-[#0a0a0a] disabled:opacity-70"
                        style={{ background: `linear-gradient(135deg, ${GOLD_SOFT}, ${GOLD_DEEP})` }}
                      >
                        {slickpayLoading ? <Loader2 size={18} className="animate-spin" /> : <Landmark size={18} />}
                        {t("premium.slickpayBtn")} · {fmtDZ(slickpaySelected.price)}
                      </button>
                      <p className="mt-2 text-center text-[11px] text-[var(--color-mute)]">
                        {t("premium.slickpayNote")}
                      </p>
                    </motion.div>
                  )}

                  {/* ===== خطوة باقات PayPal ===== */}
                  {step === "paypal" && (
                    <motion.div
                      key="paypal"
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -12 }}
                      transition={{ duration: 0.18 }}
                      className="flex flex-col"
                    >
                      <div className="grid grid-cols-3 gap-2 pt-2.5">
                        {USD_PLANS.map((p) => {
                          const active = paypalPlan === p.key;
                          return (
                            <button
                              key={p.key}
                              type="button"
                              onClick={() => setPaypalPlan(p.key)}
                              className="relative flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 text-center transition-all"
                              style={{
                                borderColor: active ? GOLD_DEEP : "var(--color-ink-line)",
                                background: active ? `${GOLD_DEEP}14` : "var(--fill)",
                              }}
                            >
                              {p.badge && (
                                <span
                                  className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[8.5px] font-extrabold"
                                  style={{
                                    background: p.best ? `linear-gradient(135deg, ${GOLD_SOFT}, ${GOLD_DEEP})` : "var(--fill-strong)",
                                    color: p.best ? "#0a0a0a" : "var(--text-soft)",
                                  }}
                                >
                                  {t(`premium.plans.${planBadgeKey(p)}`)}
                                </span>
                              )}
                              <span className="text-[12.5px] font-extrabold text-[var(--text)]">{t(`premium.plans.${p.key}`)}</span>
                              <span
                                className="text-[13px] font-black"
                                style={{ color: active ? GOLD_DEEP : "var(--text)" }}
                              >
                                {fmtUSD(p.price)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <button
                        onClick={payPaypal}
                        disabled={paypalLoading}
                        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-[15px] font-extrabold text-[#0a0a0a] disabled:opacity-70"
                        style={{ background: `linear-gradient(135deg, ${GOLD_SOFT}, ${GOLD_DEEP})` }}
                      >
                        {paypalLoading ? <Loader2 size={18} className="animate-spin" /> : <Wallet size={18} />}
                        {t("premium.paypalBtn")} · {fmtUSD(paypalSelected.price)}
                      </button>
                      <p className="mt-2 text-center text-[11px] text-[var(--color-mute)]">
                        {t("premium.paypalNote")}
                      </p>
                    </motion.div>
                  )}

                  {/* ===== خطوة باقات Google Play (داخل تطبيق TWA فقط) ===== */}
                  {step === "play" && (
                    <motion.div
                      key="play"
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -12 }}
                      transition={{ duration: 0.18 }}
                      className="flex flex-col"
                    >
                      <div className="grid grid-cols-3 gap-2 pt-2.5">
                        {USD_PLANS.map((p) => {
                          const active = playPlan === p.key;
                          const priceLabel = playDetails[p.key]?.price || fmtUSD(p.price);
                          return (
                            <button
                              key={p.key}
                              type="button"
                              onClick={() => setPlayPlan(p.key)}
                              className="relative flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 text-center transition-all"
                              style={{
                                borderColor: active ? GOLD_DEEP : "var(--color-ink-line)",
                                background: active ? `${GOLD_DEEP}14` : "var(--fill)",
                              }}
                            >
                              {p.badge && (
                                <span
                                  className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[8.5px] font-extrabold"
                                  style={{
                                    background: p.best ? `linear-gradient(135deg, ${GOLD_SOFT}, ${GOLD_DEEP})` : "var(--fill-strong)",
                                    color: p.best ? "#0a0a0a" : "var(--text-soft)",
                                  }}
                                >
                                  {t(`premium.plans.${planBadgeKey(p)}`)}
                                </span>
                              )}
                              <span className="text-[12.5px] font-extrabold text-[var(--text)]">{t(`premium.plans.${p.key}`)}</span>
                              <span
                                className="text-[13px] font-black"
                                style={{ color: active ? GOLD_DEEP : "var(--text)" }}
                              >
                                {priceLabel}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <button
                        onClick={payPlay}
                        disabled={playLoading}
                        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-[15px] font-extrabold text-[#0a0a0a] disabled:opacity-70"
                        style={{ background: `linear-gradient(135deg, ${GOLD_SOFT}, ${GOLD_DEEP})` }}
                      >
                        {playLoading ? <Loader2 size={18} className="animate-spin" /> : <Smartphone size={18} />}
                        {t("premium.playBtn")}
                      </button>
                      <p className="mt-2 text-center text-[11px] text-[var(--color-mute)]">
                        {t("premium.playNote")}
                      </p>
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
                        <KeyRound size={14} style={{ color: GOLD_DEEP }} /> {t("premium.storkLabel")}
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
                          placeholder={t("premium.storkPlaceholder")}
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
                          {loading ? <Loader2 size={18} className="animate-spin" /> : t("premium.storkActivate")}
                        </motion.button>
                      </div>
                      <p className="mt-4 text-center text-[12px] leading-relaxed text-[var(--text-soft)]">
                        {t("premium.storkAbout")}
                      </p>
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
