import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Crown, LayoutDashboard, Loader2, LogIn, LockOpen, RefreshCw, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import PaymentShell, { StatusBadge } from "../components/payment/PaymentShell.jsx";
import GiftConfetti from "../components/gift/GiftConfetti.jsx";
import Seo from "../components/Seo.jsx";
import { DiamondGlyph, DiamondKey } from "../components/keys/DiamondKey.jsx";
import { DIA_BG, DIA_DEEP, DIA_INK, DIA_SOFT, PRISM } from "../components/keys/diamond.js";
import { formatMoney } from "../components/keys/money.js";
import { useAuth } from "../lib/auth.jsx";
import { useKeys } from "../lib/keysContext.jsx";
import { useLocale } from "../lib/locale.jsx";
import { formatPrice } from "../lib/pricing.jsx";
import { offersLink, premiumPath } from "../lib/seo.js";
import { clearKeysOrder, confirmKeysOrder, KEYS_DEMO, readKeysOrder } from "../lib/keys.js";
import { formatNumber } from "../lib/values.js";

const GOLD = "#f0c63c";
const GOLD_BG = "linear-gradient(135deg, #ffe486, #f0c63c 55%, #cf9a1e)";
const TRIES = 5;
const WAIT_MS = 2500;
const DEMO_PACK_KEYS = { pack3: 3, pack5: 5 };

/**
 * الرجوع بعد شراء مفاتيح (Stripe ?session_id، PayPal ?token، SlickPay من الجلسة، Google Play ?via=google_play):
 * التحقق عند البوابة عبر keys-confirm (الطلب لازم يكون تاع هاد الحساب)، ثم: قصاصات كريستال، "+N مفاتيح"،
 * الرصيد، "افتح الأكواد"، والنظام العادل (الموقع برك: "خلّصت X، Premium يكلّفك Y"). noindex.
 * المعاينة (KEYS_DEMO): ?demo=stripe|slickpay|paypal|google_play|pending&pack=pack3 بلا قراءة ولا كتابة.
 */
export default function KeysReturn() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [params] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const keys = useKeys();
  const { setLang } = useLocale();
  const [state, setState] = useState("checking"); // checking | done | pending | failed | cancel | guest
  const [count, setCount] = useState(null);
  const [fire, setFire] = useState(0);
  const [round, setRound] = useState(0);
  const ran = useRef(-1);
  const demo = KEYS_DEMO ? params.get("demo") : null;
  const refreshKeys = keys.refresh;

  useEffect(() => {
    const l = demo ? params.get("lang") : null;
    if (l) setLang(l);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo]);

  useEffect(() => {
    if (ran.current === round) return;
    if (params.get("cancel")) {
      ran.current = round;
      setState("cancel");
      return;
    }
    if (demo) {
      ran.current = round;
      setState("checking");
      const id = setTimeout(() => {
        if (demo === "pending") return setState("pending");
        setCount(DEMO_PACK_KEYS[params.get("pack")] || 3);
        setState("done");
        setFire((n) => n + 1);
      }, 1300);
      return () => clearTimeout(id);
    }
    if (authLoading) return;
    ran.current = round;
    if (!user) {
      setState("guest");
      return;
    }
    if (params.get("via") === "google_play") {
      setState("done");
      setFire((n) => n + 1);
      refreshKeys();
      return;
    }
    const saved = readKeysOrder();
    const provider = params.get("provider") || saved?.provider;
    const ref = provider === "stripe" ? params.get("session_id") : provider === "paypal" ? params.get("token") || saved?.ref : saved?.provider === provider ? saved?.ref : null;
    if (!provider) {
      setState("failed");
      return;
    }
    let alive = true;
    let tries = 0;
    let timer = null;
    setState("checking");
    const run = async () => {
      tries += 1;
      let r = null;
      try {
        r = await confirmKeysOrder(provider, ref);
      } catch {
        r = null;
      }
      if (!alive) return;
      if (r?.status === "paid") {
        clearKeysOrder();
        setCount(r.count ?? null);
        setState("done");
        setFire((n) => n + 1);
        refreshKeys();
        return;
      }
      if (r?.status === "failed" || r?.status === "mismatch") return setState("failed");
      if (tries < TRIES) timer = setTimeout(run, WAIT_MS);
      else setState("pending");
    };
    run();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [authLoading, user?.id, round, demo]); // eslint-disable-line react-hooks/exhaustive-deps

  const seo = <Seo lang={lang} title={t("keys.ret.seoTitle")} description={t("keys.ret.seoTitle")} noindex />;
  const back = premiumPath(lang);

  if (state === "guest") {
    return (
      <PaymentShell>
        {seo}
        <StatusBadge>
          <DiamondGlyph size={28} />
        </StatusBadge>
        <h1 className="mt-6 text-[24px] font-black">{t("keys.ret.title")}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[var(--text-soft)]">{t("purchase.loginDesc")}</p>
        <Link to="/login" className="mt-7 inline-flex items-center gap-2 rounded-2xl px-7 py-3.5 text-[15px] font-extrabold" style={{ background: DIA_BG, color: DIA_INK }}>
          <LogIn size={17} /> {t("purchase.login")}
        </Link>
      </PaymentShell>
    );
  }

  if (state === "checking" || state === "pending") {
    const pending = state === "pending";
    return (
      <PaymentShell>
        {seo}
        <StatusBadge>{pending ? <DiamondGlyph size={28} /> : <Loader2 size={28} className="animate-spin" />}</StatusBadge>
        <h1 className="mt-6 text-[24px] font-black">{pending ? t("keys.ret.pendingTitle") : t("keys.ret.checkingTitle")}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[var(--text-soft)]" aria-live="polite">
          {pending ? t("keys.ret.pendingDesc") : t("keys.ret.checkingDesc")}
        </p>
        {pending && (
          <div className="mt-7 flex w-full flex-col gap-2.5 sm:flex-row sm:justify-center">
            <button type="button" onClick={() => setRound((n) => n + 1)} className="inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-[15px] font-extrabold" style={{ background: DIA_BG, color: DIA_INK }}>
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

  if (state === "failed" || state === "cancel") {
    return (
      <PaymentShell>
        {seo}
        <StatusBadge tone="error">
          <XCircle size={30} className="text-red-400" />
        </StatusBadge>
        <h1 className="mt-6 text-[24px] font-black tracking-tight">{state === "cancel" ? t("payment.cancel.title") : t("payment.return.failTitle")}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[var(--text-soft)]">{state === "cancel" ? t("payment.cancel.desc") : t("keys.ret.failDesc")}</p>
        <Link to={`${back}#keys`} className="mt-7 inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-[15px] font-extrabold" style={{ background: DIA_BG, color: DIA_INK }}>
          <DiamondGlyph size={17} /> {t("keys.ret.backToKeys")}
        </Link>
      </PaymentShell>
    );
  }

  const credit = keys.showCredit ? keys.credit : null;
  return (
    <PaymentShell wide>
      {seo}
      <GiftConfetti fire={fire} origin={{ x: 0.5, y: 0.28 }} colors={PRISM} />
      <div className="relative w-full max-w-[340px]">
        <div aria-hidden className="pointer-events-none absolute inset-x-6 -bottom-4 top-6 rounded-[40px]" style={{ background: "radial-gradient(60% 60% at 50% 60%, rgba(150,195,255,0.35), transparent 72%)" }} />
        <motion.div initial={{ opacity: 0, y: 26, rotate: -18 }} animate={{ opacity: 1, y: 0, rotate: -6 }} transition={{ type: "spring", stiffness: 90, damping: 15 }} className="relative">
          <DiamondKey sparkle flip={i18n.dir() === "ltr"} className="mx-auto h-auto w-[300px] max-w-full drop-shadow-[0_18px_30px_rgba(150,195,255,0.4)]" />
        </motion.div>
        {count != null && (
          <motion.span
            className="absolute -top-3 end-2 inline-flex items-center gap-1 rounded-full border-2 bg-[var(--color-ink)] px-3.5 py-1.5 text-[15px] font-black tabular-nums"
            style={{ borderColor: DIA_DEEP, color: DIA_SOFT }}
            initial={{ scale: 2, opacity: 0, rotate: -20 }}
            animate={{ scale: 1, opacity: 1, rotate: -6 }}
            transition={{ type: "spring", stiffness: 420, damping: 16, delay: 0.45 }}
            dir="ltr"
          >
            +{formatNumber(count, lang)}
          </motion.span>
        )}
      </div>

      <h1 className="mt-8 text-balance text-[30px] font-black leading-tight sm:text-[36px]">{t("keys.ret.title")}</h1>
      <p className="mt-3 max-w-md text-[15.5px] leading-[1.8] text-[var(--text-soft)]">{count != null ? t("keys.ret.sub", { count }) : t("keys.ret.subPlain")}</p>

      <section className="mt-8 w-full rounded-[var(--radius-card)] border p-5 text-start sm:p-6" style={{ borderColor: `${DIA_DEEP}55`, background: "linear-gradient(160deg, rgba(169,205,255,0.1), rgba(169,205,255,0.02))" }}>
        <div className="flex items-center justify-between gap-4">
          <span className="text-[14px] font-bold text-[var(--text-soft)]">{t("keys.panel.balance")}</span>
          <span className="flex items-center gap-2 text-[26px] font-black tabular-nums" style={{ color: DIA_SOFT }}>
            <DiamondGlyph size={22} /> {formatNumber(keys.balance, lang)}
          </span>
        </div>
        <ol className="mt-4 grid gap-2.5 border-t border-dashed border-[var(--color-ink-line)] pt-4">
          {["s1", "s2", "s3"].map((k, i) => (
            <li key={k} className="flex items-center gap-3 text-[14px] text-[var(--text-softer)]">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[13px] font-black" style={{ borderColor: `${DIA_DEEP}aa`, color: DIA_SOFT }}>
                {i + 1}
              </span>
              {t(`keys.ret.steps.${k}`)}
            </li>
          ))}
        </ol>
        <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
          <Link to={offersLink(lang, { mode: "premium" })} className="dk-glint inline-flex flex-1 items-center justify-center gap-2 rounded-2xl px-6 py-4 text-[16px] font-extrabold" style={{ background: DIA_BG, color: DIA_INK }}>
            <LockOpen size={18} /> {t("keys.ret.cta")}
          </Link>
          <button type="button" onClick={keys.openPanel} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-ink-line)] px-6 py-4 text-[15px] font-bold text-[var(--text)] transition-colors hover:bg-[var(--fill)]">
            <DiamondGlyph size={17} /> {t("keys.ret.history")}
          </button>
        </div>
      </section>

      {/* النظام العادل — الموقع برك (داخل التطبيق: والو) */}
      {credit && credit.creditDzd > 0 && (
        <section className="mt-4 w-full rounded-[var(--radius-card)] border p-5 text-start sm:p-6" style={{ borderColor: "rgba(240,198,60,0.32)", background: "linear-gradient(160deg, rgba(240,198,60,0.1), rgba(240,198,60,0.02))" }}>
          <h2 className="flex items-center gap-2 text-[17px] font-black text-[var(--text)]">
            <Crown size={18} style={{ color: GOLD }} /> {t("keys.ret.premiumTitle")}
          </h2>
          <p className="mt-2 text-[14.5px] leading-relaxed text-[var(--text-softer)]">
            {credit.covered
              ? t("keys.credit.covered", { paid: formatMoney(t, lang, credit.creditDzd, "DZD") })
              : t("keys.credit.line", { paid: formatMoney(t, lang, credit.creditDzd, "DZD"), due: formatPrice(t, lang, credit.dueDzd, credit.dueUsd) })}
          </p>
          <Link to={`${premiumPath(lang)}?checkout=1`} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-[15px] font-extrabold text-[#1d1403] sm:w-auto" style={{ background: GOLD_BG }}>
            <Crown size={17} /> {credit.covered ? t("keys.credit.activate") : t("keys.credit.cta")}
          </Link>
        </section>
      )}

      <p className="mt-5 max-w-md text-[12.5px] leading-relaxed text-[var(--color-mute)]">
        {t("keys.buy.refund")}{" "}
        <Link to="/terms" className="font-bold text-[var(--text-soft)] underline decoration-dotted underline-offset-4">
          {t("pricing.terms")}
        </Link>
      </p>
    </PaymentShell>
  );
}
