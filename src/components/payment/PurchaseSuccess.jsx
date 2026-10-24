import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, Crown, Loader2, LayoutDashboard, RefreshCw, LogIn } from "lucide-react";
import { useTranslation } from "react-i18next";
import PaymentShell, { StatusBadge } from "./PaymentShell.jsx";
import GiftConfetti from "../gift/GiftConfetti.jsx";
import { useAuth } from "../../lib/auth.jsx";
import { isLifetimeProfile } from "../../lib/premium.jsx";
import { fetchMyPurchase } from "../../lib/billing.js";
import { fetchMyCreditUpgrade } from "../../lib/keys.js";
import { formatMoney } from "../keys/money.js";
import { usePricing } from "../../lib/pricing.jsx";
import { useLocale } from "../../lib/locale.jsx";
import { offersLink } from "../../lib/seo.js";

const GOLD_SOFT = "#ffe486";
const GOLD = "#f0c63c";
const GOLD_BG = "linear-gradient(135deg, #ffe486, #f0c63c 55%, #cf9a1e)";
const TICKET_VARS = { "--r": "13px", "--edge-base": "rgba(240,198,60,0.45)", "--perf": "rgba(240,198,60,0.55)" };
const METHOD_KEY = { stripe: "stripe", slickpay: "slickpay", paypal: "paypal", google_play: "play" };
// الـ webhook يوصل بعد لحظات: نعاودو نقراو الشراء كل ثانيتين حتى ~24 ثانية
const POLL_MS = 2000;
const POLL_TRIES = 12;

// معاينة بلا دفع: /payment-success?demo=1 (ولا slickpay | stripe | paypal | google_play | pending، + &lang=ar|en|fr).
// روابط preview تاع Vercel (VERCEL_ENV=preview → __PURCHASE_DEMO__ في vite.config.js) و npm run dev برك.
// في build الإنتاج DEMO = false وهاد الكود يتنحّى من الحزمة. ما يقرا ولا يكتب والو في القاعدة.
const DEMO = import.meta.env.DEV || __PURCHASE_DEMO__;
const DEMO_METHODS = ["slickpay", "stripe", "paypal", "google_play"];

/** شراء تجريبي بالسعر الحالي (pricing_public): الدينار لـ SlickPay و Google Play، الدولار لـ Stripe و PayPal. */
function demoPurchase(kind, pricing, credit = 0) {
  const provider = DEMO_METHODS.includes(kind) ? kind : "slickpay";
  const usd = provider === "stripe" || provider === "paypal";
  // المعاينة بالرصيد (&credit=1): الباقي بعد 2,300 دج (بنسبة سعر Premium)
  const ratio = pricing?.dzd && pricing?.usd ? pricing.dzd / pricing.usd : null;
  const cut = credit && ratio ? (usd ? Math.floor((credit / ratio) * 100) / 100 : credit) : 0;
  return {
    provider,
    amount: pricing ? Math.round(((usd ? pricing.usd : pricing.dzd) - cut) * 100) / 100 : "",
    currency: usd ? "USD" : "DZD",
    tier: pricing?.tier === "test" ? "test" : "launch",
    purchased_at: new Date().toISOString(),
  };
}

/** "9,900 دج" / "39$" / "0.50$" (سعر التجربة) — نفس كتابة الأسعار في الموقع. */
function formatAmount(t, lang, amount, currency) {
  if (amount == null || amount === "") return "";
  const n = Number(amount);
  if (!Number.isFinite(n)) return "";
  const digits = Number.isInteger(n) ? 0 : 2;
  const s = new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-US", { minimumFractionDigits: digits, maximumFractionDigits: 2 }).format(n);
  const cur = String(currency || "").toUpperCase();
  if (cur === "DZD") return t("pricing.dzd", { dzd: s });
  if (cur === "USD") return t("purchase.usd", { usd: s });
  return `${s} ${cur}`;
}

/**
 * نجاح الشراء — نفس الصفحة للبوابات الأربعة (Stripe: /payment-success، SlickPay: /payment-return،
 * PayPal: /payment-return-paypal، Google Play: /payment-success?via=google_play) وتخدم في التطبيق.
 * تستنى حتى يتسجّل الشراء (purchases، RLS: المستخدم يقرا تاعو برك) ثم: احتفال (قصاصات ذهبية + ختم)،
 * ملخص (المبلغ، الطريقة، التاريخ)، والخطوة الجاية (عروض Premium + كيفاش يكشف الكود). بلا إيموجي.
 */
export default function PurchaseSuccess() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { user, loading: authLoading, refreshProfile } = useAuth();
  const [state, setState] = useState("confirming"); // confirming | done | pending | guest
  const [purchase, setPurchase] = useState(null);
  const [fire, setFire] = useState(0);
  const [round, setRound] = useState(0);
  const [params] = useSearchParams();
  const demo = DEMO ? params.get("demo") : null;
  // Premium بالرصيد كامل (المفاتيح الماسية): بلا سطر في purchases → السجلّ من key_credit_uses
  const viaCredit = params.get("via") === "credit";
  const [creditUse, setCreditUse] = useState(null);
  const pricing = usePricing();
  const { setLang } = useLocale();

  // المعاينة: اللغة من الرابط (&lang=en)، ثم "نؤكّد دفعتك" لحظة، ثم النجاح (ولا "قيد التأكيد")
  useEffect(() => {
    if (!demo) return;
    const l = params.get("lang");
    if (l) setLang(l);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo]);

  useEffect(() => {
    if (demo) {
      setState("confirming");
      const timer = setTimeout(() => {
        if (demo === "pending") return setState("pending");
        setState("done");
        setFire((n) => n + 1);
      }, 1400);
      return () => clearTimeout(timer);
    }
    if (authLoading) return;
    if (!user) {
      setState("guest");
      return;
    }
    let active = true;
    let tries = 0;
    let timer = null;
    setState("confirming");
    const check = async () => {
      tries += 1;
      const [p, prof, cu] = await Promise.all([
        viaCredit ? Promise.resolve(null) : fetchMyPurchase(user.id).catch(() => null),
        refreshProfile?.().catch(() => null),
        fetchMyCreditUpgrade().catch(() => null),
      ]);
      if (!active) return;
      // الرصيد اللي تحسب في هاد الشراء (آخر ساعة)
      if (cu && Date.now() - new Date(cu.created_at).getTime() < 3600e3) setCreditUse(cu);
      if (viaCredit && cu?.kind === "full") {
        setState("done");
        setFire((n) => n + 1);
        return;
      }
      if (p) {
        setPurchase(p);
        setState("done");
        setFire((n) => n + 1);
        return;
      }
      if (tries >= POLL_TRIES) {
        // أدمن ولا Premium مدى الحياة بلا سطر شراء ظاهر → نجاح بلا ملخص
        setState(isLifetimeProfile(prof) ? "done" : "pending");
        return;
      }
      timer = setTimeout(check, POLL_MS);
    };
    check();
    return () => {
      active = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id, round, demo]);

  const offersTo = offersLink(lang, { mode: "premium" });

  if (state === "guest") {
    return (
      <PaymentShell>
        <StatusBadge>
          <Crown size={28} />
        </StatusBadge>
        <h1 className="mt-6 text-[24px] font-black">{t("purchase.title")}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[var(--text-soft)]">{t("purchase.loginDesc")}</p>
        <Link to="/login" className="mt-7 inline-flex items-center gap-2 rounded-2xl px-7 py-3.5 text-[15px] font-extrabold text-[#1d1403]" style={{ background: GOLD_BG }}>
          <LogIn size={17} /> {t("purchase.login")}
        </Link>
      </PaymentShell>
    );
  }

  if (state === "confirming" || state === "pending") {
    const pending = state === "pending";
    return (
      <PaymentShell>
        <StatusBadge>{pending ? <Crown size={28} /> : <Loader2 size={28} className="animate-spin" />}</StatusBadge>
        <h1 className="mt-6 text-[24px] font-black">{pending ? t("purchase.pendingTitle") : t("purchase.confirmingTitle")}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[var(--text-soft)]" aria-live="polite">
          {pending ? t("purchase.pendingDesc") : t("purchase.confirmingDesc")}
        </p>
        {pending && (
          <div className="mt-7 flex w-full flex-col gap-2.5 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => setRound((n) => n + 1)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-[15px] font-extrabold text-[#1d1403]"
              style={{ background: GOLD_BG }}
            >
              <RefreshCw size={16} /> {t("purchase.retry")}
            </button>
            <Link to="/dashboard" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-ink-line)] px-6 py-3.5 text-[15px] font-bold text-[var(--text)]">
              <LayoutDashboard size={16} /> {t("purchase.account")}
            </Link>
          </div>
        )}
      </PaymentShell>
    );
  }

  const shown = DEMO && demo ? demoPurchase(demo, pricing, params.get("credit") ? 2300 : 0) : purchase;
  const demoCredit = DEMO && demo && params.get("credit") ? { kind: demo === "credit" ? "full" : "checkout", credit: 2300, currency: "DZD" } : null;
  const usedCredit = demoCredit || creditUse;
  const creditRow = usedCredit ? [[t("keys.credit.row"), `−${formatMoney(t, lang, usedCredit.credit, usedCredit.currency)}`]] : [];
  const rows = usedCredit?.kind === "full"
    ? [
        [t("purchase.plan"), t("purchase.planV")],
        ...creditRow,
        [t("purchase.method"), t("keys.credit.method")],
        [t("purchase.date"), new Date(usedCredit.created_at || Date.now()).toLocaleDateString(lang, { day: "numeric", month: "long", year: "numeric" })],
      ]
    : shown
    ? [
        [t("purchase.plan"), t("purchase.planV")],
        ...creditRow,
        [t("purchase.amount"), formatAmount(t, lang, shown.amount, shown.currency), shown.tier === "test" ? t("purchase.testTag") : null],
        [t("purchase.method"), METHOD_KEY[shown.provider] ? t(`premium.methods.${METHOD_KEY[shown.provider]}Name`) : shown.provider],
        [t("purchase.date"), new Date(shown.purchased_at).toLocaleDateString(lang, { day: "numeric", month: "long", year: "numeric" })],
      ]
    : null;

  return (
    <PaymentShell wide>
      <GiftConfetti fire={fire} origin={{ x: 0.5, y: 0.28 }} />

      {/* البطاقة الذهبية + ختم "مفعّل" */}
      <div className="relative w-full max-w-[340px]">
        <div aria-hidden className="pointer-events-none absolute inset-x-6 -bottom-4 top-6 rounded-[40px]" style={{ background: "radial-gradient(60% 60% at 50% 60%, rgba(240,198,60,0.35), transparent 72%)" }} />
        <motion.div
          initial={{ opacity: 0, y: 30, rotateX: 25 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ type: "spring", stiffness: 90, damping: 16 }}
          className="ticket ticket-premium relative"
          style={{ ...TICKET_VARS, transformPerspective: 900 }}
        >
          <div className="ticket-top relative px-5 pb-5 pt-4 text-start" style={{ background: "radial-gradient(120% 80% at 100% 0%, rgba(240,198,60,0.2), transparent 55%), linear-gradient(170deg, #1a1710, var(--color-ink-card) 70%)" }}>
            <div className="flex items-center gap-2.5">
              <img src="/logo-dark.png" alt="" width={1917} height={459} className="h-5 w-auto" decoding="async" />
              <span className="h-4 w-px bg-[rgba(240,198,60,0.35)]" />
              <span className="text-[12.5px] font-black" style={{ color: GOLD_SOFT }}>
                {t("premiumToggle.premium")}
              </span>
            </div>
            <p className="mt-5 text-[34px] font-black leading-none" style={{ background: "linear-gradient(135deg,#fff4c2,#ffe486 30%,#f0c63c 62%,#cf9a1e)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
              {t("premiumPage.pass.lifetime")}
            </p>
          </div>
          <div className="ticket-stub relative flex items-center justify-between px-5 py-3.5" style={{ background: "rgba(240,198,60,0.07)" }}>
            <span className="ticket-ring ticket-ring-l" />
            <span className="ticket-ring ticket-ring-r" />
            <span className="ticket-perf" />
            <span className="text-[13px] font-extrabold" style={{ color: GOLD_SOFT }}>
              {t("pricing.productName")}
            </span>
          </div>
          <motion.span
            className="absolute -end-3 -top-4 inline-flex items-center gap-1.5 rounded-full border-2 bg-[var(--color-ink)] px-3.5 py-1.5 text-[14px] font-black"
            style={{ borderColor: GOLD, color: GOLD_SOFT }}
            initial={{ scale: 2.2, opacity: 0, rotate: -24 }}
            animate={{ scale: 1, opacity: 1, rotate: -8 }}
            transition={{ type: "spring", stiffness: 420, damping: 16, delay: 0.45 }}
          >
            <Check size={15} strokeWidth={3.5} /> {t("premiumPage.pass.active")}
          </motion.span>
        </motion.div>
      </div>

      <h1 className="mt-10 text-balance text-[30px] font-black leading-tight sm:text-[36px]">{t("purchase.title")}</h1>
      <p className="mt-3 max-w-md text-[15.5px] leading-[1.8] text-[var(--text-soft)]">{t("purchase.sub")}</p>

      {/* ملخص الشراء = إيصال */}
      {rows && (
        <section aria-labelledby="purchase-summary" className="mt-8 w-full rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] p-5 text-start sm:p-6">
          <h2 id="purchase-summary" className="text-[14px] font-extrabold text-[var(--text-softer)]">
            {t("purchase.summary")}
          </h2>
          <dl className="mt-3 divide-y divide-dashed divide-[var(--color-ink-line)]">
            {rows.map(([k, v, tag]) => (
              <div key={k} className="flex items-baseline justify-between gap-4 py-2.5">
                <dt className="text-[13.5px] text-[var(--text-soft)]">{k}</dt>
                <dd className="flex items-center gap-2 text-end text-[14.5px] font-extrabold text-[var(--text)]">
                  {tag && <span className="rounded-full border border-[#38bdf8]/50 bg-[#38bdf8]/15 px-2 py-0.5 text-[10.5px] font-black text-[#7dd3fc]">{tag}</span>}
                  <bdi>{v}</bdi>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* الخطوة الجاية */}
      <section aria-labelledby="purchase-next" className="mt-4 w-full rounded-[var(--radius-card)] border p-5 text-start sm:p-6" style={{ borderColor: "rgba(240,198,60,0.32)", background: "linear-gradient(160deg, rgba(240,198,60,0.1), rgba(240,198,60,0.02))" }}>
        <h2 id="purchase-next" className="text-[17px] font-black text-[var(--text)]">
          {t("purchase.nextTitle")}
        </h2>
        <ol className="mt-4 grid gap-3">
          {["s1", "s2", "s3"].map((k, i) => (
            <li key={k} className="flex items-center gap-3 text-[14.5px] text-[var(--text-softer)]">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[13px] font-black" style={{ borderColor: "rgba(240,198,60,0.5)", color: GOLD_SOFT }}>
                {i + 1}
              </span>
              {t(`purchase.steps.${k}`)}
            </li>
          ))}
        </ol>
        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
          <Link to={offersTo} className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl px-6 py-4 text-[16px] font-extrabold text-[#1d1403]" style={{ background: GOLD_BG, boxShadow: "0 16px 40px -18px rgba(240,198,60,0.8)" }}>
            <Crown size={18} /> {t("purchase.cta")}
          </Link>
          <Link to="/dashboard" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-ink-line)] px-6 py-4 text-[15px] font-bold text-[var(--text)] transition-colors hover:bg-[var(--fill)]">
            <LayoutDashboard size={17} /> {t("purchase.account")}
          </Link>
        </div>
      </section>

      <p className="mt-5 max-w-md text-[12.5px] leading-relaxed text-[var(--color-mute)]">
        {t("purchase.refundNote")}{" "}
        <Link to="/terms" className="font-bold text-[var(--text-soft)] underline decoration-dotted underline-offset-4">
          {t("pricing.terms")}
        </Link>
      </p>
    </PaymentShell>
  );
}
