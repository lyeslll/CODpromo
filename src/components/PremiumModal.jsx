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
  Lock,
  UserPlus,
  LogIn,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePremium, isPremiumProfile, isLifetimeProfile } from "../lib/premium.jsx";
import { useAuth } from "../lib/auth.jsx";
import { usePricing, usePricingRefresh } from "../lib/pricing.jsx";
import { startStripeCheckout, startPaypalCheckout, startSlickpayCheckout } from "../lib/billing.js";
import { getPlayDetails, purchasePlay, syncPlayPurchases } from "../lib/playBilling.js";
import { useAndroidApp } from "../lib/androidApp.js";
import { setPendingPremium } from "../lib/goPremium.js";
import { offersLink } from "../lib/seo.js";
import LifetimePrice from "./pricing/LifetimePrice.jsx";
import SeatsMeter from "./pricing/SeatsMeter.jsx";

const GOLD_SOFT = "#ffe486";
const GOLD = "#f0c63c";
const GOLD_DEEP = "#cf9a1e";
const GOLD_BG = `linear-gradient(135deg, ${GOLD_SOFT}, ${GOLD} 55%, ${GOLD_DEEP})`;

// ألوان تذكرة Premium (نفس متغيّرات .ticket في البطاقات)
const TICKET_VARS = {
  "--r": "11px",
  "--edge-base": "rgba(240,198,60,0.42)",
  "--edge-strong": "rgba(240,198,60,0.6)",
  "--perf": "rgba(240,198,60,0.55)",
};

// طرق الدفع على الويب (Google Play يبان داخل التطبيق برك). الضغط يبدا الدفع مباشرة.
// currency: العملة اللي يتخلّص بيها (للعرض برك، المبلغ يتقرّر في الخادم).
const WEB_METHODS = [
  { key: "slickpay", icon: Landmark, start: startSlickpayCheckout, currency: "dzd" },
  { key: "stripe", icon: CreditCard, start: startStripeCheckout, currency: "usd" },
  { key: "paypal", icon: Wallet, start: startPaypalCheckout, currency: "usd" },
];

const fade = {
  initial: { opacity: 0, x: 12 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -12 },
  transition: { duration: 0.18 },
};

const isPhone = () => typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches;

/**
 * نافذة الدفع: دفعة واحدة · Premium مدى الحياة (تتحلّ من /premium، ومن الداشبورد لـ "أنا عضو Stork").
 *  - الهاتف: لوحة من تحت (bottom sheet). الكمبيوتر: نافذة في الوسط.
 *  - ملخص الطلب (تذكرة ذهبية صغيرة: المنتوج، السعر الحقيقي من pricing_public، العدّاد) ثم طرق الدفع.
 *    المبلغ الموثوق يتقرّر في الخادم. ويب: SlickPay / Stripe / PayPal — داخل التطبيق: Google Play وحدو
 *    (androidApp.js، و"checking" = حتى طريقة ما تبان).
 *  - زائر بلا حساب: خطوة "أنشئ حسابك أولاً" → التسجيل / الدخول ثم يرجع لـ /premium?checkout=1.
 *  - Google Play ناجح → صفحة النجاح الموحّدة (/payment-success?via=google_play).
 * initialStep: "home" (افتراضي) ولا "stork".
 */
export default function PremiumModal({ open, onClose, initialStep = "home" }) {
  const { t, i18n } = useTranslation();
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
  const [sheet, setSheet] = useState(isPhone);
  // داخل تطبيق Android (TWA): Google Play برك — في المتصفح: البوابات الثلاث برك (androidApp.js).
  // "checking" = الفحص مازال (أقل من ثانيتين): حتى طريقة ما تبان باش ما تبانش الغالطة.
  const appMode = useAndroidApp();
  const playAvailable = appMode === "app";
  const [playDetails, setPlayDetails] = useState({});

  // أسعار Play المحلية (داخل التطبيق برك)
  useEffect(() => {
    if (!playAvailable) return;
    let active = true;
    getPlayDetails().then((d) => {
      if (active) setPlayDetails(d);
    });
    return () => {
      active = false;
    };
  }, [playAvailable]);

  // فتح النافذة: الخطوة المطلوبة + السعر والعدّاد من جديد (باش يكونو حقيقيين في هاد اللحظة)
  useEffect(() => {
    if (!open) return;
    setStep(initialStep === "stork" ? "stork" : "home");
    setDone(false);
    setSheet(isPhone());
    setPricingFailed(false);
    refreshPricing().then((p) => setPricingFailed(!p));
  }, [open, initialStep, refreshPricing]);

  // Escape يسكّر
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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

  // زائر بلا حساب: نحفظو "راه يشري" ونبعثوه للتسجيل / الدخول (يرجع لـ /premium والنافذة تتحلّ)
  const toAuth = (path) => {
    setPendingPremium(i18n.language);
    close();
    navigate(path);
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
    if (!user || paying) return;
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
    if (!user || paying || !pricing) return;
    setPaying("play");
    if (!(await stillFree())) return setPaying(null);
    const res = await purchasePlay(pricing.tier, { onVerified: refreshProfile });
    setPaying(null);
    if (!res.ok) {
      if (res.errorKey === "cancelled") return; // إلغاء صامت — بلا رسالة خطأ
      return setPayError(t(`premium.playErr.${res.errorKey || "generic"}`));
    }
    close();
    navigate("/payment-success?via=google_play");
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
  };

  const retryPricing = () => {
    setPricingFailed(false);
    refreshPricing().then((p) => setPricingFailed(!p));
  };

  const methods = appMode === "app" ? [{ key: "play", icon: Smartphone }] : appMode === "web" ? WEB_METHODS : [];
  const playPrice = pricing ? playDetails[pricing.tier]?.price : null;
  const view = done ? "done" : isPremiumActive ? "already" : !user ? "account" : step;

  const panelMotion = sheet
    ? { initial: { y: "100%" }, animate: { y: 0 }, exit: { y: "100%" }, transition: { type: "spring", stiffness: 380, damping: 38 } }
    : { initial: { opacity: 0, y: 24, scale: 0.97 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: 16, scale: 0.98 }, transition: { type: "spring", stiffness: 340, damping: 28 } };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] flex items-end justify-center sm:items-center sm:p-4"
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={close} />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="premium-modal-title"
            {...panelMotion}
            className="relative max-h-[92dvh] w-full overflow-y-auto overscroll-contain rounded-t-[26px] border border-b-0 bg-[var(--color-ink-card)] px-5 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] pt-3 sm:max-w-[440px] sm:rounded-[var(--radius-card)] sm:border-b sm:p-7"
            style={{ borderColor: `${GOLD_DEEP}55`, boxShadow: `0 -20px 60px -20px rgba(0,0,0,0.8), 0 0 0 1px ${GOLD_DEEP}1f` }}
          >
            <div
              className="pointer-events-none absolute -top-24 left-1/2 h-48 w-80 -translate-x-1/2 rounded-full blur-[80px]"
              style={{ background: `radial-gradient(circle, ${GOLD_DEEP}3d, transparent 65%)` }}
            />
            {/* مقبض اللوحة (الهاتف) */}
            <span aria-hidden className="mx-auto mb-3 block h-1.5 w-11 rounded-full bg-[var(--fill-strong)] sm:hidden" />

            {/* الرأس: رجوع (Stork) + العنوان + إغلاق */}
            <div className="relative mb-5 flex items-center gap-3">
              {view === "stork" && initialStep !== "stork" ? (
                <button
                  onClick={goBack}
                  aria-label={t("premium.back")}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--color-ink-line)] bg-[var(--fill)] text-[var(--color-mute)] transition-colors hover:text-[var(--text)]"
                >
                  <ChevronRight size={18} className="ltr:rotate-180" />
                </button>
              ) : (
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[#1d1403]" style={{ background: GOLD_BG }}>
                  {view === "stork" ? <KeyRound size={18} /> : <Crown size={19} />}
                </span>
              )}
              <h2 id="premium-modal-title" className="min-w-0 flex-1 text-[18px] font-black leading-tight text-[var(--text)]">
                {view === "stork"
                  ? t("premium.titles.storkH")
                  : view === "account"
                    ? t("checkout.accountTitle")
                    : view === "done"
                      ? t("checkout.storkDoneTitle")
                      : view === "already"
                        ? isLifetime
                          ? t("premium.lifetime")
                          : t("premium.alreadyTitle")
                        : t("checkout.title")}
              </h2>
              <button
                onClick={close}
                aria-label={t("premium.close")}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--color-ink-line)] bg-[var(--fill)] text-[var(--color-mute)] transition-colors hover:text-[var(--text)]"
              >
                <X size={17} />
              </button>
            </div>

            <div className="relative">
              <AnimatePresence mode="wait" initial={false}>
                {view === "done" && (
                  <motion.div key="done" {...fade} className="flex flex-col items-center gap-3 py-4 text-center">
                    <span className="grid h-16 w-16 place-items-center rounded-2xl" style={{ background: `${GOLD_DEEP}22`, border: `1px solid ${GOLD_DEEP}55` }}>
                      <Check size={32} style={{ color: GOLD_SOFT }} strokeWidth={3} />
                    </span>
                    <p className="text-[14.5px] leading-relaxed text-[var(--text-soft)]">{t("checkout.storkDoneDesc")}</p>
                    <Link
                      to={offersLink(i18n.language, { mode: "premium" })}
                      onClick={close}
                      className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-[15px] font-extrabold text-[#1d1403]"
                      style={{ background: GOLD_BG }}
                    >
                      <Crown size={17} /> {t("checkout.toOffers")}
                    </Link>
                  </motion.div>
                )}

                {/* حارس منع الدفع المزدوج: Premium نشط أصلاً → لا أزرار دفع */}
                {view === "already" && (
                  <motion.div key="already" {...fade} className="flex flex-col items-center gap-3 py-4 text-center">
                    <p className="text-[14.5px] leading-relaxed text-[var(--text-soft)]">{t("premium.alreadyDesc")}</p>
                    <Link
                      to={offersLink(i18n.language, { mode: "premium" })}
                      onClick={close}
                      className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-[15px] font-extrabold text-[#1d1403]"
                      style={{ background: GOLD_BG }}
                    >
                      <Crown size={17} /> {t("checkout.toOffers")}
                    </Link>
                  </motion.div>
                )}

                {view === "account" && (
                  <motion.div key="account" {...fade} className="flex flex-col">
                    <p className="text-[14.5px] leading-[1.75] text-[var(--text-soft)]">{t("checkout.accountDesc")}</p>
                    <button
                      type="button"
                      onClick={() => toAuth("/signup")}
                      className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-[15.5px] font-extrabold text-[#1d1403]"
                      style={{ background: GOLD_BG }}
                    >
                      <UserPlus size={18} /> {t("checkout.accountSignup")}
                    </button>
                    <button
                      type="button"
                      onClick={() => toAuth("/login")}
                      className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--color-ink-line)] px-6 py-3.5 text-[15px] font-bold text-[var(--text)] transition-colors hover:bg-[var(--fill)]"
                    >
                      <LogIn size={17} /> {t("checkout.accountLogin")}
                    </button>
                    <p className="mt-4 flex items-start gap-2 text-[12.5px] leading-relaxed text-[var(--color-mute)]">
                      <Lock size={13} className="mt-[3px] shrink-0" /> {t("checkout.refund")}
                    </p>
                  </motion.div>
                )}

                {view === "home" && (
                  <motion.div key="home" {...fade} className="flex flex-col">
                    {/* ملخص الطلب = تذكرة ذهبية صغيرة */}
                    <div className="ticket ticket-premium" style={TICKET_VARS}>
                      <div
                        className="ticket-top relative px-4 pb-4 pt-3.5"
                        style={{ background: "linear-gradient(160deg, rgba(240,198,60,0.15), rgba(240,198,60,0.03) 65%), var(--color-ink-card)" }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[14px] font-extrabold text-[var(--text)]">{t("pricing.productName")}</p>
                            <p className="mt-0.5 text-[12px] font-bold" style={{ color: GOLD }}>
                              {t("premiumPage.pass.oneTime")}
                            </p>
                          </div>
                          {pricing?.isTest ? (
                            <span className="shrink-0 rounded-full border border-[#38bdf8]/50 bg-[#38bdf8]/15 px-2.5 py-1 text-[11px] font-black text-[#7dd3fc]">
                              {t("pricing.testBadge")}
                            </span>
                          ) : (
                            pricing?.isLaunch && (
                              <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black text-[#1d1403]" style={{ background: GOLD_BG }}>
                                {t("pricing.launchBadge")}
                              </span>
                            )
                          )}
                        </div>

                        {pricing ? (
                          <LifetimePrice pricing={pricing} size="md" className="mt-3" />
                        ) : pricingFailed ? (
                          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/[0.08] px-3.5 py-2.5">
                            <p className="text-[12.5px] font-semibold text-red-300">{t("pricing.error")}</p>
                            <button type="button" onClick={retryPricing} className="flex shrink-0 items-center gap-1.5 text-[12.5px] font-extrabold text-[var(--text)]">
                              <RefreshCw size={14} /> {t("pricing.retry")}
                            </button>
                          </div>
                        ) : (
                          <div aria-hidden className="mt-3 h-[46px] w-2/3 animate-pulse rounded-xl bg-[var(--fill-strong)]" />
                        )}
                      </div>
                      {pricing?.isLaunch && (
                        <div className="ticket-stub relative px-4 pb-4 pt-3.5" style={{ background: "rgba(240,198,60,0.06)" }}>
                          <span className="ticket-ring ticket-ring-l" />
                          <span className="ticket-ring ticket-ring-r" />
                          <span className="ticket-perf" />
                          <SeatsMeter pricing={pricing} />
                        </div>
                      )}
                    </div>

                    {/* طرق الدفع */}
                    <p className="mb-2.5 mt-6 text-[13px] font-extrabold text-[var(--text-softer)]">{t("checkout.methodsLabel")}</p>

                    {payError && (
                      <div role="alert" className="mb-2.5 rounded-xl border border-red-500/30 bg-red-500/[0.08] px-3.5 py-2 text-[12.5px] font-semibold text-red-400">
                        {payError}
                      </div>
                    )}

                    <div className="flex flex-col gap-2" aria-busy={appMode === "checking"}>
                      {appMode === "checking" && <div aria-hidden className="h-[72px] animate-pulse rounded-2xl bg-[var(--fill-strong)]" />}
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
                            className="group flex w-full items-center gap-3 rounded-2xl border p-3 text-start transition-colors hover:border-[#f0c63c]/70 hover:bg-[rgba(240,198,60,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c63c] disabled:cursor-not-allowed disabled:opacity-55"
                            style={{
                              borderColor: busy ? GOLD : "var(--color-ink-line)",
                              background: busy ? "rgba(240,198,60,0.1)" : "var(--color-ink)",
                            }}
                          >
                            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border" style={{ borderColor: `${GOLD_DEEP}55`, background: `${GOLD_DEEP}14`, color: GOLD_SOFT }}>
                              {busy ? <Loader2 size={19} className="animate-spin" /> : <m.icon size={20} />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2">
                                <span className="text-[14.5px] font-extrabold text-[var(--text)]">{t(`premium.methods.${m.key}Name`)}</span>
                                {m.currency && (
                                  <span className="rounded-md bg-[var(--fill-strong)] px-1.5 py-0.5 text-[10.5px] font-bold text-[var(--text-soft)]">{t(`checkout.${m.currency}`)}</span>
                                )}
                              </span>
                              <span className="mt-0.5 block text-[12px] text-[var(--text-soft)]">
                                {busy
                                  ? t("checkout.redirecting")
                                  : m.key === "play" && playPrice
                                    ? t("premium.playPrice", { price: playPrice })
                                    : t(`premium.methods.${m.key}Desc`)}
                              </span>
                            </span>
                            <ChevronLeft size={18} className="shrink-0 text-[var(--color-mute)] transition-colors group-hover:text-[#f0c63c] ltr:rotate-180" />
                          </button>
                        );
                      })}
                    </div>

                    <p className="mt-4 flex items-start gap-2 text-[12px] leading-relaxed text-[var(--color-mute)]">
                      <Lock size={13} className="mt-[2px] shrink-0" /> {t("checkout.secure")}
                    </p>
                    <p className="mt-1.5 flex items-start gap-2 text-[12px] leading-relaxed text-[var(--color-mute)]">
                      <Check size={13} strokeWidth={3} className="mt-[2px] shrink-0 text-[var(--color-lime)]" /> {t("checkout.refund")}
                    </p>

                    <div className="mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-dashed border-[var(--color-ink-line)] pt-4 text-[12.5px]">
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
                {view === "stork" && (
                  <motion.form key="stork" {...fade} onSubmit={submit}>
                    <p className="mb-4 text-[14px] leading-relaxed text-[var(--text-soft)]">{t("premium.titles.storkS")}</p>
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
                        autoFocus={!sheet}
                        className="w-full min-w-0 rounded-xl border border-[var(--color-ink-line)] bg-[var(--color-ink)] px-3.5 py-3 text-left font-mono text-[14px] font-bold tracking-wider text-[var(--text)] outline-none transition-colors placeholder:font-sans placeholder:tracking-normal placeholder:text-[var(--color-mute)] focus:border-[color:var(--gold)]"
                        style={{ ["--gold"]: GOLD_DEEP }}
                      />
                      <motion.button
                        type="submit"
                        whileTap={{ scale: 0.97 }}
                        disabled={loading}
                        className="grid w-[104px] shrink-0 place-items-center rounded-xl px-4 text-[14px] font-extrabold text-[#1d1403] disabled:opacity-60"
                        style={{ background: GOLD_BG }}
                      >
                        {loading ? <Loader2 size={18} className="animate-spin" /> : t("premium.storkActivate")}
                      </motion.button>
                    </div>
                    <p className="mt-4 text-[12.5px] leading-relaxed text-[var(--text-soft)]">{t("premium.storkAbout")}</p>
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
