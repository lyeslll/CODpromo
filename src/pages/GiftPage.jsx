import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Crown, Gift, Loader2, LogIn, RotateCw, UserPlus, Check, LayoutDashboard, TicketPercent } from "lucide-react";
import { useTranslation } from "react-i18next";
import Logo from "../components/Logo.jsx";
import Seo from "../components/Seo.jsx";
import { useGoPremium } from "../lib/goPremium.js";
import GiftBox from "../components/gift/GiftBox.jsx";
import GiftConfetti from "../components/gift/GiftConfetti.jsx";
import { useAuth } from "../lib/auth.jsx";
import { usePremium } from "../lib/premium.jsx";
import {
  normalizeGiftCode,
  formatGiftCode,
  giftPath,
  giftDuration,
  previewGift,
  redeemGift,
  getPendingGift,
  setPendingGift,
  clearPendingGift,
} from "../lib/gifts.js";
import { offersLink, offersPath } from "../lib/seo.js";

const GOLD_BG = { background: "linear-gradient(135deg, #ffe486, #f0c63c 55%, #cf9a1e)" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** نص المدة حسب الإعراب: nom (البطاقة) / acc (بعد "أهداك"). */
export function giftDurationText(t, days, kase = "nom") {
  const { unit, count } = giftDuration(days);
  return t(`gift.dur.${unit}${kase === "acc" ? "Acc" : "Nom"}`, { count });
}

/** حالة الخادم → مفتاح الرسالة (gift.state.*). */
function stateKey(r) {
  switch (r?.status) {
    case "invalid":
      return "invalid";
    case "expired":
      return "expired";
    case "exhausted":
      return r.kind === "group" ? "full" : "used";
    case "inactive":
      return "inactive";
    case "already_redeemed":
      return "already";
    case "has_premium":
      return "hasPremium";
    case "rate_limited":
      return "rateLimited";
    case "yours":
      return r.active ? "yours" : "ended";
    default:
      return "error";
  }
}

/**
 * /gift/:code — صفحة الهدية (noindex + Disallow في robots.txt، ماشي في الـ sitemap).
 * زائر بلا حساب: معاينة (gift_preview) + "إنشاء حساب" / "دخول"، والكود يتحفظ (sessionStorage)
 * باش يتفعّل وحدو من بعد الدخول (حتى بـ Google). مسجّل: زر "افتح الهدية" (redeem_gift)، أو تفعيل
 * تلقائي إذا جا من الدخول بنفس الكود المعلّق. النجاح = العلبة تتفتح + قصاصات ذهبية.
 */
export default function GiftPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const { code: raw = "" } = useParams();
  const code = normalizeGiftCode(raw);
  const { user, loading: authLoading } = useAuth();
  const { refreshGift } = usePremium();

  const [res, setRes] = useState(null); // آخر ردّ من الخادم
  const [phase, setPhase] = useState("loading"); // loading | ready | opening | opened | error
  const [celebrate, setCelebrate] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const goPremium = useGoPremium();
  // تفعيل تلقائي جاري { code, promise }: يصمد لإعادة تشغيل الـ effect (ما يتبعثش مرتين)
  const autoRun = useRef(null);

  // الرابط بالشكل المقروء XXXX-XXXX-XXXX-XXXX
  useEffect(() => {
    if (code && raw !== formatGiftCode(code)) navigate(giftPath(code), { replace: true });
  }, [raw, code, navigate]);

  const finishOk = useCallback(
    (r) => {
      clearPendingGift();
      setRes(r);
      setPhase("opened");
      setCelebrate((n) => n + 1);
      refreshGift();
    },
    [refreshGift]
  );

  // نتيجة نهائية (غير ok): الكود المعلّق ما بقاش يفيد
  const settle = useCallback((r) => {
    if (getPendingGift() === normalizeGiftCode(code)) clearPendingGift();
    setRes(r);
    setPhase("ready");
  }, [code]);

  useEffect(() => {
    if (authLoading) return;
    if (code.length < 12) {
      setRes({ status: "invalid" });
      setPhase("ready");
      return;
    }
    let active = true;
    let run;
    let auto = false;
    if (autoRun.current?.code === code) {
      run = autoRun.current.promise;
      auto = true;
    } else if (user && getPendingGift() === code) {
      // جا من الدخول / التسجيل بنفس الكود المعلّق → تفعيل مباشر
      run = Promise.all([redeemGift(code), sleep(reduce ? 0 : 900)]).then(([r]) => r);
      autoRun.current = { code, promise: run };
      auto = true;
    } else {
      run = previewGift(code);
    }
    setPhase(auto ? "opening" : "loading");
    run
      .then((r) => {
        if (!active) return;
        if (auto) autoRun.current = null;
        if (!user) {
          // الزائر: نحفظ الكود باش يتفعّل من بعد الدخول
          if (r?.status === "ok" || r?.status === "rate_limited") setPendingGift(code);
          else if (getPendingGift() === code) clearPendingGift();
          setRes(r);
          setPhase("ready");
          return;
        }
        if (r?.status === "ok" && auto) finishOk(r);
        else if (r?.status === "ok") {
          setRes(r);
          setPhase("ready");
        } else settle(r);
      })
      .catch(() => {
        if (!active) return;
        if (auto) autoRun.current = null;
        setPhase("error");
      });
    return () => {
      active = false;
    };
  }, [code, user?.id, authLoading, attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  const openGift = async () => {
    setPhase("opening");
    try {
      const [r] = await Promise.all([redeemGift(code), sleep(reduce ? 0 : 900)]);
      if (r?.status === "ok") finishOk(r);
      else settle(r);
    } catch {
      setPhase("error");
    }
  };

  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(lang, { day: "numeric", month: "long", year: "numeric" }) : "");
  const days = res?.duration_days;
  const tagMain = days ? giftDurationText(t, days, "nom") : null;
  // التفعيل التلقائي ما يعرفش المدة قبل ردّ الخادم → العنوان العام
  const giftTitle = days ? t("gift.title", { duration: giftDurationText(t, days, "acc") }) : t("gift.titleGeneric");

  // ===== ما يتعرض حسب الحالة =====
  const status = res?.status;
  const isOpened = phase === "opened" || (status === "yours" && res.active);
  const invite = !user && (status === "ok" || status === "rate_limited");
  const canOpen = !!user && status === "ok" && phase !== "opened";
  let boxState = "closed";
  if (phase === "opening") boxState = "opening";
  else if (isOpened) boxState = "open";
  else if (phase === "ready" && ["invalid", "expired", "exhausted", "inactive", "already_redeemed"].includes(status)) boxState = "dim";
  else if (status === "yours" && !res.active) boxState = "dim";

  const key = phase === "error" ? "error" : stateKey(res);
  let title;
  let desc;
  if (phase === "loading") {
    title = null;
  } else if (phase === "opened") {
    title = t("gift.doneTitle");
    desc = t("gift.doneDesc", { date: fmtDate(res?.premium_until) });
  } else if (phase === "opening" || canOpen) {
    title = giftTitle;
    desc = phase === "opening" ? t("gift.opening") : null;
  } else if (invite) {
    title = status === "ok" ? giftTitle : t("gift.titleGeneric");
    desc = t("gift.anonDesc");
  } else {
    title = t(`gift.state.${key}.title`);
    desc = t(`gift.state.${key}.desc`, { date: fmtDate(res?.premium_until) });
  }

  const btn = "inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl px-6 text-[15.5px] font-extrabold transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffe486]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]";
  const gold = `${btn} text-[#1d1403] shadow-[0_14px_34px_-14px_rgba(240,198,60,0.85)] hover:scale-[1.02]`;
  const ghost = `${btn} border border-[var(--color-ink-line)] bg-[var(--fill)] text-[var(--text)] hover:bg-[var(--fill-strong)]`;
  const premiumOffers = offersLink(lang, { mode: "premium" });

  let actions = null;
  if (phase === "error") {
    actions = (
      <button type="button" onClick={() => setAttempt((a) => a + 1)} className={ghost}>
        <RotateCw size={17} /> {t("gift.retry")}
      </button>
    );
  } else if (isOpened) {
    actions = (
      <>
        <Link to={premiumOffers} className={gold} style={GOLD_BG}>
          <Crown size={18} /> {t("compare.seePremium")}
        </Link>
        <Link to="/dashboard" className={ghost}>
          <LayoutDashboard size={17} /> {t("gift.toAccount")}
        </Link>
      </>
    );
  } else if (invite) {
    actions = (
      <>
        <Link to="/signup" className={gold} style={GOLD_BG}>
          <UserPlus size={18} /> {t("gift.signup")}
        </Link>
        <Link to="/login" className={ghost}>
          <LogIn size={17} /> {t("gift.login")}
        </Link>
      </>
    );
  } else if (canOpen || phase === "opening") {
    actions = (
      <button type="button" onClick={openGift} disabled={phase === "opening"} className={`${gold} w-full sm:w-auto sm:min-w-[260px] disabled:opacity-80`} style={GOLD_BG}>
        {phase === "opening" ? <Loader2 size={18} className="motion-safe:animate-spin" /> : <Gift size={18} />}
        {phase === "opening" ? t("gift.opening") : t("gift.open")}
      </button>
    );
  } else if (phase === "ready") {
    if (key === "hasPremium") {
      actions = (
        <Link to={premiumOffers} className={gold} style={GOLD_BG}>
          <Crown size={18} /> {t("compare.seePremium")}
        </Link>
      );
    } else if (key === "already" || key === "ended") {
      actions = (
        <>
          <button type="button" onClick={goPremium} className={gold} style={GOLD_BG}>
            <Crown size={18} /> {t("gift.subscribe")}
          </button>
          <Link to="/dashboard" className={ghost}>
            <LayoutDashboard size={17} /> {t("gift.toAccount")}
          </Link>
        </>
      );
    } else if (key === "rateLimited") {
      actions = (
        <Link to="/dashboard" className={ghost}>
          <LayoutDashboard size={17} /> {t("gift.toAccount")}
        </Link>
      );
    } else {
      actions = (
        <Link to={offersPath(lang)} className={ghost}>
          <TicketPercent size={17} /> {t("gift.browse")}
        </Link>
      );
    }
  }

  const showPerks = invite || canOpen || phase === "opening";

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[var(--color-ink)] text-[var(--text)]">
      <Seo lang={lang} title={t("gift.seoTitle")} description={t("gift.seoDesc")} noindex />
      {/* ضوء المسرح من فوق */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[560px]"
        style={{ background: "radial-gradient(60% 70% at 50% 0%, rgba(240,198,60,0.13), transparent 70%)" }}
      />

      <header className="relative z-10 flex justify-center px-4 pt-6">
        <Logo />
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-[560px] flex-col items-center px-4 pb-16 pt-12 text-center sm:pt-16">
        {/* العلبة تنزل مرة وحدة كي توصل المعاينة (قبلها نفس المساحة فارغة) */}
        {phase === "loading" ? <div className="gbox" aria-hidden /> : <GiftBox state={boxState} tagMain={tagMain} tagSub={tagMain ? t("gift.tagSub") : null} />}

        <div className="mt-12 w-full" aria-live="polite">
          {title ? (
            <motion.div key={`${phase}-${key}`} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
              <h1 className="mx-auto max-w-[20ch] text-balance text-[clamp(26px,7.4vw,40px)] font-black leading-[1.18] tracking-tight">{title}</h1>
              {desc && <p className="mx-auto mt-3 max-w-[44ch] text-[15.5px] leading-[1.75] text-[var(--text-soft)]">{desc}</p>}
              {canOpen && phase !== "opening" && user?.email && (
                <p className="mx-auto mt-3 max-w-[44ch] text-[14.5px] leading-relaxed text-[var(--text-soft)]">
                  {t("gift.userDesc")} <bdi dir="ltr" className="font-bold text-[var(--text)]">{user.email}</bdi>
                </p>
              )}
            </motion.div>
          ) : (
            <div className="flex flex-col items-center gap-3" aria-label={t("gift.loading")}>
              <span className="h-9 w-[78%] max-w-[380px] animate-pulse rounded-xl bg-[var(--fill)]" />
              <span className="h-4 w-[60%] max-w-[300px] animate-pulse rounded-lg bg-[var(--fill)]" />
            </div>
          )}
        </div>

        {actions && <div className="mt-8 flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:justify-center [&>*]:w-full sm:[&>*]:w-auto">{actions}</div>}
        {invite && <p className="mt-3 text-[13px] text-[var(--color-mute)]">{t("gift.googleNote")}</p>}

        {showPerks && <Perks t={t} />}
      </main>

      <GiftConfetti fire={celebrate} />
    </div>
  );
}

/** ماذا يفتح Premium — تذكرة ذهبية بنفس لغة بطاقات الموقع. */
function Perks({ t }) {
  const items = ["codes", "reveal", "nocode"];
  return (
    <section className="ticket ticket-premium mt-14 w-full text-start" style={{ "--edge-base": "rgba(240,198,60,0.4)", "--edge-strong": "rgba(240,198,60,0.62)", "--perf": "rgba(240,198,60,0.5)" }}>
      <div className="ticket-top relative bg-[var(--color-ink-card)] px-5 pb-5 pt-5 sm:px-6">
        <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(90% 80% at 50% 0%, rgba(240,198,60,0.12), transparent 65%)" }} />
        <span aria-hidden className="ticket-ring ticket-ring-l" />
        <span aria-hidden className="ticket-ring ticket-ring-r" />
        <h2 className="relative text-[17px] font-black text-[#ffe486]">{t("gift.perks.title")}</h2>
        <ul className="relative mt-4 space-y-3">
          {items.map((k) => (
            <li key={k} className="flex items-start gap-3 text-[14.5px] leading-[1.6] text-[var(--text-softer)]">
              <span className="gift-perk-dot mt-0.5">
                <Check size={15} strokeWidth={3} />
              </span>
              {t(`gift.perks.${k}`)}
            </li>
          ))}
        </ul>
      </div>
      <div className="ticket-stub relative bg-[var(--color-ink-card)] px-5 pb-5 pt-4 sm:px-6" style={{ background: "linear-gradient(rgba(240,198,60,0.06), rgba(240,198,60,0.06)), var(--color-ink-card)" }}>
        <span aria-hidden className="ticket-ring ticket-ring-l" />
        <span aria-hidden className="ticket-ring ticket-ring-r" />
        <span aria-hidden className="ticket-perf" />
        <p className="relative text-[13px] leading-relaxed text-[var(--text-soft)]">{t("gift.perks.note")}</p>
      </div>
    </section>
  );
}
