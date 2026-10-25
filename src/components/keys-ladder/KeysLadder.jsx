import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useReducedMotion } from "framer-motion";
import { Check, Crown, Key } from "lucide-react";
import { useTranslation } from "react-i18next";
import BidiText from "../BidiText.jsx";
import LifetimePrice from "../pricing/LifetimePrice.jsx";
import { GoldenKey } from "../freekey/GoldenKey.jsx";
import { DiamondGlyph, DiamondKey } from "../keys/DiamondKey.jsx";
import { DIA_BG, DIA_DEEP, DIA_INK, DIA_SOFT } from "../keys/diamond.js";
import { formatMoney } from "../keys/money.js";
import { useMobileFx } from "../featured/mobile.js";
import { useAuth } from "../../lib/auth.jsx";
import { usePremium } from "../../lib/premium.jsx";
import { useFreeKey } from "../../lib/freeKeyContext.jsx";
import { useKeys } from "../../lib/keysContext.jsx";
import { usePricing, formatPrice } from "../../lib/pricing.jsx";
import { useAndroidApp } from "../../lib/androidApp.js";
import { setPendingFreeKey } from "../../lib/freeKey.js";
import { demoPacks, fetchKeyPacks } from "../../lib/keys.js";
import { getKeysPlayPrices } from "../../lib/keysPlay.js";
import { offersLink, premiumPath, storePath } from "../../lib/seo.js";
import { formatNumber } from "../../lib/values.js";
import { canUseFx } from "../../lib/fxCapability.js";
import "../keys/keys.css";
import "./keys-ladder.css";

// نافذة الشراء نفسها تاع /premium (بلا أي تبديل): تتحمّل غير كي يقرّب الزائر من زر باقة
const loadCheckout = () => import("../keys/KeysCheckout.jsx");
const KeysCheckout = lazy(loadCheckout);

// لون كل درجة ("R G B" لـ rgb(var(--tone) / a)): ذهبي المفتاح، جليد الماس، ذهبي Premium الساطع
const TONE = { golden: "207 154 30", diamond: "169 205 255", premium: "255 214 92" };
const GOLD = "#f0c63c";
const GOLD_SOFT = "#ffe486";
const GOLD_BG = `linear-gradient(135deg, ${GOLD_SOFT}, ${GOLD} 55%, #cf9a1e)`;
// الكمبيوتر: الدرجة الأولى BASE والكل وحدة تطلع RISE؛ KEY_SPACE = بلاصة المفتاح فوق أعلى تذكرة
const BASE = 40;
const RISE = 48;
const KEY_SPACE = 96;
// الهاتف: طول الدرجات الصغيرة
const TILE_BASE = 128;
const TILE_RISE = 26;
// عمق الـ parallax تاع كل مفتاح (px في حافة القسم)
const DEPTH = { golden: 10, diamond: 14, premium: 18 };
const WIDE = "(min-width: 1024px)";

function useWide() {
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia(WIDE).matches);
  useEffect(() => {
    const mq = window.matchMedia(WIDE);
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener?.("change", sync);
    return () => mq.removeEventListener?.("change", sync);
  }, []);
  return wide;
}

/**
 * "سلّم المفاتيح" في الرئيسية (بعد المفتاح الذهبي): ثلاث درجات جنب بعض — المفتاح الذهبي (مجاني، كود واحد) ←
 * المفاتيح الماسية (باقات، أكواد للأبد) ← Premium (كل الأكواد، الحالية والقادمة)، وزرّ لكل درجة حسب الزائر.
 * الأسعار من القاعدة (my_key_packs + usePricing — /admin/pricing)، والشراء بنفس نافذة /premium (KeysCheckout:
 * داخل التطبيق Google Play برك). المفتاح الذهبي موقوف / Premium هدية → درجتين. Premium حقيقي / أدمن / Stork:
 * القسم ما يتحمّلش أصلاً (KeysLadderSlot). داخل التطبيق: بلا رصيد ولا خصم من Premium ولا سعر للمفتاح.
 * الكمبيوتر: درجات تحت التذاكر، مفاتيح تطفو مع ميلان الماوس، ضوء يطلع السلّم. الهاتف: درجات صغيرة (تنقل
 * للتذكرة) فوق التذاكر، والحركة مرة وحدة. prefers-reduced-motion: كلش ثابت.
 */
export default function KeysLadder({ reserve }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const rtl = i18n.dir() === "rtl";
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isGift } = usePremium();
  const fk = useFreeKey();
  const keys = useKeys();
  const pricing = usePricing();
  const appMode = useAndroidApp();
  const wide = useWide();
  const mobileFx = useMobileFx();
  const reduce = useReducedMotion();
  const [fxOk] = useState(() => canUseFx());
  const live = wide && !mobileFx && fxOk && !reduce;

  const stageRef = useRef(null);
  const [armed, setArmed] = useState(false);
  const [inView, setInView] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const [data, setData] = useState(null);
  const [playPrices, setPlayPrices] = useState({});
  const [checkout, setCheckout] = useState(null);
  const [checkoutOn, setCheckoutOn] = useState(false);

  const goldenOn = fk.enabled && ["guest", "available", "used"].includes(fk.status);
  const ready = !authLoading && fk.status !== "loading";
  const tiers = ready ? [goldenOn && "golden", "diamond", "premium"].filter(Boolean) : [];
  const k = tiers.length;

  // الباقات: نفس قراءة /premium (السعر من /admin/pricing، ولا سعر التجربة لهاد الحساب، والحدّ)
  useEffect(() => {
    if (authLoading) return;
    let alive = true;
    fetchKeyPacks()
      .then((d) => alive && setData(keys.demo ? { ...d, packs: d.packs.map((p) => ({ ...p, fits: true })), maxKeys: null, blocked: false } : d))
      .catch(() => alive && setData(keys.demo ? demoPacks() : { packs: [], error: true }));
    return () => {
      alive = false;
    };
  }, [authLoading, user?.id, keys.demo]);

  // داخل التطبيق: أسعار Google Play
  const productIds = useMemo(() => (data?.packs || []).map((p) => p.playProductId).filter(Boolean), [data]);
  useEffect(() => {
    if (appMode !== "app" || !productIds.length) return;
    let alive = true;
    getKeysPlayPrices(productIds).then((m) => alive && setPlayPrices(m));
    return () => {
      alive = false;
    };
  }, [appMode, productIds]);

  // حركة الدخول تتسلّح بعد أول رسم (بلا JS ولا مع prefers-reduced-motion: كلش باين من الأول)
  useEffect(() => {
    if (!reduce) setArmed(true);
  }, [reduce]);

  // الدخول مرة وحدة كي يبان السلّم، والحركات المستمرّة غير والقسم قدّام الزائر
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      setOnScreen(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        setOnScreen(e.isIntersecting);
        if (e.isIntersecting && e.intersectionRatio >= 0.2) setInView(true);
      },
      { threshold: [0, 0.2] }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [wide, ready]);

  // نافذة الشراء تتحمّل كي يبان السلّم (أول ضغطة على باقة تكون فورية حتى في الهاتف)
  useEffect(() => {
    if (inView) loadCheckout();
  }, [inView]);

  // الكمبيوتر: المفاتيح تتبع الماوس (CSS vars على المسرح، rAF وحدة)
  const raf = useRef(0);
  const target = useRef({ x: 0, y: 0 });
  const onPointerMove = (e) => {
    if (!live || e.pointerType !== "mouse") return;
    const r = stageRef.current?.getBoundingClientRect();
    if (!r?.width) return;
    const clamp = (v) => Math.max(-1, Math.min(1, v));
    target.current = { x: clamp(((e.clientX - r.left) / r.width) * 2 - 1), y: clamp(((e.clientY - r.top) / r.height) * 2 - 1) };
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      stageRef.current?.style.setProperty("--mx", target.current.x.toFixed(3));
      stageRef.current?.style.setProperty("--my", target.current.y.toFixed(3));
    });
  };
  const onPointerLeave = () => {
    cancelAnimationFrame(raf.current);
    raf.current = 0;
    stageRef.current?.style.setProperty("--mx", "0");
    stageRef.current?.style.setProperty("--my", "0");
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  if (!ready) {
    return <section aria-hidden style={{ minHeight: reserve }} />;
  }

  // ===== الباقات =====
  const web = appMode === "web";
  const packs = (data?.packs || []).filter((p) => p.priceDzd != null);
  const maxKeys = data?.maxKeys ?? null;
  const hasTest = packs.some((p) => p.tier === "test");
  const fits = (p) => p.fits && (maxKeys == null || p.keys <= maxKeys);
  const playPrice = (p) => (appMode === "app" ? playPrices[p.playProductId] || null : null);
  const priceOf = (p) => playPrice(p) || formatPrice(t, lang, p.priceDzd, p.priceUsd);
  const cheapest = packs.length ? packs.reduce((a, b) => (b.priceDzd < a.priceDzd ? b : a)) : null;
  const byPerKey = [...packs].sort((a, b) => a.priceDzd / a.keys - b.priceDzd / b.keys);
  const bestId = web && !hasTest && byPerKey.length > 1 && byPerKey[0].priceDzd / byPerKey[0].keys < byPerKey[1].priceDzd / byPerKey[1].keys ? byPerKey[0].id : null;
  const counts = [...new Set(packs.map((p) => p.keys))].sort((a, b) => a - b);
  const num = (v) => formatNumber(v, lang);
  const diamondMetric = !counts.length
    ? ""
    : counts.length === 1
      ? num(counts[0])
      : counts.length === 2
        ? t("keysLadder.diamond.metricTwo", { a: num(counts[0]), b: num(counts[1]) })
        : t("keysLadder.diamond.metricRange", { min: num(counts[0]), max: num(counts[counts.length - 1]) });
  const credit = keys.showCredit && keys.credit && keys.credit.creditDzd > 0 ? keys.credit : null;

  const buy = (p) => {
    if (!fits(p)) return;
    setCheckoutOn(true);
    setCheckout(p);
  };
  const jump = (tier) => document.getElementById(`kl-${tier}`)?.scrollIntoView({ block: "start" });

  const btnCls =
    "flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-center text-[14.5px] font-extrabold leading-snug outline-none transition-transform hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-ink-card)]";
  const goldBtn = `${btnCls} text-[#1d1403] focus-visible:ring-[#ffe486]`;
  const goldStyle = { background: GOLD_BG, boxShadow: "0 14px 34px -16px rgba(240,198,60,0.75)" };
  const noteCls = "mt-4 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[12.5px] font-bold leading-relaxed text-[var(--text-softer)]";
  const noteStyle = { borderColor: "rgba(240,198,60,0.3)", background: "rgba(240,198,60,0.06)" };

  // ===== المفتاح الذهبي =====
  const usedName = fk.usedCompany?.name;
  const golden = {
    chip: t("keysLadder.golden.chip"),
    name: t("keysLadder.golden.name"),
    icon: <Key size={19} className="text-[#1d1403]" />,
    iconBg: GOLD_BG,
    metric: num(1),
    unit: t("keysLadder.golden.unit"),
    unitShort: t("keysLadder.golden.unitShort"),
    priceShort: t("keysLadder.golden.price"),
    price: (
      <p className="text-[30px] font-black leading-none" style={{ color: GOLD_SOFT }}>
        {t("keysLadder.golden.price")}
      </p>
    ),
    desc: t("keysLadder.golden.desc"),
    perks: [t("keysLadder.golden.perks.noCard"), t("keysLadder.golden.perks.once"), t("keysLadder.golden.perks.account")],
    actions:
      fk.status === "guest" ? (
        <button
          type="button"
          onClick={() => {
            setPendingFreeKey(null, lang);
            navigate("/signup");
          }}
          className={goldBtn}
          style={goldStyle}
        >
          <Key size={17} className="shrink-0" /> {t("keysLadder.golden.ctaGuest")}
        </button>
      ) : fk.status === "available" ? (
        <Link to={offersLink(lang, { mode: "premium" })} className={goldBtn} style={goldStyle}>
          <Key size={17} className="shrink-0" /> {t("keysLadder.golden.ctaAvailable")}
        </Link>
      ) : (
        <>
          <p className="flex items-start gap-2 text-[13.5px] font-extrabold leading-snug" style={{ color: GOLD_SOFT }}>
            <Check size={16} strokeWidth={3} className="mt-[1px] shrink-0" />
            <span className="min-w-0">
              {usedName ? (
                <BidiText text={t("keysLadder.golden.usedOn", { company: usedName })} rtl={rtl} />
              ) : fk.usedInbox ? (
                t("keysLadder.golden.usedInbox")
              ) : (
                t("keysLadder.golden.usedGeneric")
              )}
            </span>
          </p>
          {fk.usedCompany?.slug && (
            <Link
              to={storePath(fk.usedCompany.slug, lang)}
              className={`${btnCls} mt-3 border text-[#ffe486] hover:bg-[#f0c63c]/10 focus-visible:ring-[#ffe486]`}
              style={{ borderColor: "rgba(240,198,60,0.5)" }}
            >
              {t("keysLadder.golden.ctaUsed")}
            </Link>
          )}
        </>
      ),
  };

  // ===== المفاتيح الماسية =====
  const diamond = {
    chip: t("keysLadder.diamond.chip"),
    name: t("keysLadder.diamond.name"),
    icon: <DiamondGlyph size={20} />,
    iconBg: DIA_BG,
    metric: diamondMetric,
    unit: t("keysLadder.diamond.unit"),
    unitShort: t("keysLadder.diamond.unitShort"),
    priceShort: cheapest ? t("keysLadder.diamond.fromShort", { price: playPrice(cheapest) || formatMoney(t, lang, cheapest.priceDzd, "DZD") }) : "\u00a0",
    price: (
      <div>
        <p className="text-[12px] font-bold text-[var(--text-soft)]">{t("keysLadder.diamond.from")}</p>
        <p className="mt-1.5 text-[26px] font-black leading-none" style={{ color: DIA_SOFT }}>
          <bdi>{cheapest ? priceOf(cheapest) : "\u00a0"}</bdi>
        </p>
      </div>
    ),
    desc: t("keysLadder.diamond.desc"),
    perks: [
      t("keysLadder.diamond.perks.forever"),
      t("keysLadder.diamond.perks.noExpiry"),
      t("keysLadder.diamond.perks.refund"),
      // النظام العادل: الموقع برك (داخل التطبيق ولا وقت الفحص: ما يتذكرش)
      ...(web ? [{ text: t("keysLadder.diamond.fair"), gold: true }] : []),
    ],
    actions: (
      <>
        <div className="flex flex-col gap-2.5">
          {(data ? packs : [null, null]).map((p, i) =>
            p ? (
              <button
                key={p.id}
                type="button"
                onClick={() => buy(p)}
                onPointerEnter={loadCheckout}
                onFocus={loadCheckout}
                disabled={!fits(p)}
                aria-label={t("keysLadder.diamond.buyAria", { pack: t("keys.count", { count: p.keys }), price: priceOf(p) })}
                className="group relative flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-start transition-colors hover:border-[#a9cdff]/70 hover:bg-[rgba(169,205,255,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a9cdff] disabled:cursor-not-allowed disabled:opacity-50"
                style={{ borderColor: `${DIA_DEEP}66`, background: "linear-gradient(170deg, rgba(169,205,255,0.1), rgba(169,205,255,0.02) 70%), var(--color-ink)" }}
              >
                <DiamondGlyph size={20} className="shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14.5px] font-extrabold text-[var(--text)]">
                    {t("keys.count", { count: p.keys })}
                    {p.tier === "test" && (
                      <span className="rounded-full border border-[#38bdf8]/50 bg-[#38bdf8]/15 px-2 py-0.5 text-[10.5px] font-black text-[#7dd3fc]">{t("pricing.testBadge")}</span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-[13px] font-bold leading-snug" style={{ color: DIA_SOFT }}>
                    <bdi>{priceOf(p)}</bdi>
                  </span>
                </span>
                <span className="dk-glint shrink-0 rounded-lg px-3.5 py-2 text-[13.5px] font-extrabold" style={{ background: DIA_BG, color: DIA_INK }}>
                  {t("keysLadder.diamond.buy")}
                </span>
                {p.id === bestId && (
                  <span className="absolute -top-2.5 end-3 rounded-full px-2 py-0.5 text-[10.5px] font-black" style={{ background: DIA_BG, color: DIA_INK }}>
                    {t("keysLadder.diamond.best")}
                  </span>
                )}
              </button>
            ) : (
              <div key={i} aria-hidden className="h-[66px] animate-pulse rounded-xl bg-[var(--fill-strong)]" />
            )
          )}
        </div>
        {data?.error && !packs.length && (
          <Link to={`${premiumPath(lang)}#keys`} className={`${btnCls} mt-1 border text-[#dbeeff] focus-visible:ring-[#a9cdff]`} style={{ borderColor: `${DIA_DEEP}88` }}>
            {t("keysLadder.diamond.packs")}
          </Link>
        )}
        {user && data && packs.length > 0 && !packs.some(fits) && (
          <p className="mt-2.5 text-[12px] font-bold leading-relaxed text-[var(--text-soft)]">{t("keys.section.limit", { count: Math.max(maxKeys ?? 0, 0) })}</p>
        )}
        {keys.status === "ok" && keys.balance > 0 && (
          <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] font-bold text-[var(--text-soft)]">
            <span>{t("keys.dash.has", { count: keys.balance })}</span>
            <Link to={offersLink(lang, { mode: "premium" })} className="font-extrabold underline decoration-dotted underline-offset-4" style={{ color: DIA_SOFT }}>
              {t("keysLadder.diamond.use")}
            </Link>
          </p>
        )}
      </>
    ),
  };

  // ===== Premium =====
  const left = Math.max(0, pricing?.seatsLeft ?? 0);
  const premium = {
    chip: t("keysLadder.premium.chip"),
    name: t("keysLadder.premium.name"),
    icon: <Crown size={19} className="text-[#1d1403]" />,
    iconBg: GOLD_BG,
    metric: t("keysLadder.premium.metric"),
    unit: t("keysLadder.premium.unit"),
    unitShort: t("keysLadder.premium.unitShort"),
    priceShort: pricing?.dzd != null ? t("pricing.dzd", { dzd: num(pricing.dzd) }) : "\u00a0",
    price: pricing ? (
      <div>
        <LifetimePrice pricing={pricing} size="md" />
        {pricing.isLaunch && pricing.seatsTotal > 0 && (
          <p className="mt-2 text-[12px] font-extrabold" style={{ color: GOLD_SOFT }}>
            {t("pricing.seatsLeft", { count: left, n: num(left) })}
          </p>
        )}
      </div>
    ) : (
      <div aria-hidden className="h-[52px]" />
    ),
    desc: t("keysLadder.premium.desc"),
    // ما دفعو في المفاتيح ينقص من Premium (الموقع برك)
    note: credit ? (
      <p className={noteCls} style={noteStyle}>
        <DiamondGlyph size={14} className="mt-[3px] shrink-0" />
        <span>
          {credit.covered
            ? t("keys.credit.covered", { paid: formatMoney(t, lang, credit.creditDzd, "DZD") })
            : t("keys.credit.line", { paid: formatMoney(t, lang, credit.creditDzd, "DZD"), due: formatPrice(t, lang, credit.dueDzd, credit.dueUsd) })}
        </span>
      </p>
    ) : null,
    perks: [t("pricing.perks.all"), t("pricing.perks.noRenewal"), t("pricing.perks.refund")],
    actions: (
      <Link to={premiumPath(lang)} className={goldBtn} style={goldStyle}>
        <Crown size={17} className="shrink-0" /> {isGift ? t("keysLadder.premium.ctaGift") : t("keysLadder.premium.cta")}
      </Link>
    ),
  };

  const cards = { golden, diamond, premium };

  // العنوان على سطرين: الوقفة بعد "…" هي السطر الأول (كيما قسم المفتاح الذهبي)
  const title = t("keysLadder.title");
  const cut = title.indexOf("…");

  return (
    <section aria-labelledby="kl-title" className={`relative overflow-hidden py-24 sm:py-28 ${live ? "kl-fx" : "kl-light"} ${onScreen ? "is-live" : ""}`}>
      <div aria-hidden className="kl-bg" />
      <div className="relative mx-auto max-w-6xl px-4">
        <header className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-ink-line)] bg-[var(--fill)] px-3.5 py-1.5 text-[12.5px] font-extrabold text-[var(--text-softer)]">
            <Key size={14} aria-hidden style={{ color: GOLD }} />
            <DiamondGlyph size={14} />
            <Crown size={14} aria-hidden style={{ color: GOLD_SOFT }} />
            <span className="ms-0.5">{t("keysLadder.eyebrow")}</span>
          </span>
          <h2 id="kl-title" className="mt-5 text-balance text-[30px] font-black leading-[1.15] tracking-tight sm:text-[40px] lg:text-[46px]">
            {cut > 0 ? (
              <>
                {title.slice(0, cut + 1)}
                <br />
                {title.slice(cut + 1).trim()}
              </>
            ) : (
              title
            )}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-balance text-[16px] leading-[1.75] text-[var(--text-soft)] sm:text-[17px]">
            {goldenOn ? t("keysLadder.sub") : t("keysLadder.subNoGolden")}
          </p>
        </header>

        {wide ? (
          // الكمبيوتر: التذاكر واقفة على درجات تطلع (الأولى في بداية القراءة)
          <div
            ref={stageRef}
            onPointerMove={onPointerMove}
            onPointerLeave={onPointerLeave}
            className={`relative mx-auto mt-12 ${k === 2 ? "max-w-[820px]" : "max-w-[1120px]"} ${armed ? "kl-armed" : ""} ${inView ? "is-in" : ""}`}
          >
            <div className="grid" style={{ gridTemplateColumns: `repeat(${k}, minmax(0, 1fr))` }}>
              {tiers.map((tier, i) => (
                <div key={tier} className="kl-col flex flex-col" style={{ "--i": i, "--tone": TONE[tier] }}>
                  <div className="flex flex-1 flex-col px-[18px]" style={{ paddingTop: (k - 1 - i) * RISE + KEY_SPACE }}>
                    <div className="kl-card-in relative flex flex-1 flex-col">
                      <TierVisual tier={tier} rtl={rtl} sparkle={live && onScreen} />
                      <TierCard tier={tier} step={i + 1} total={k} c={cards[tier]} />
                    </div>
                  </div>
                  <div aria-hidden className="kl-step">
                    <div className="kl-step-top" />
                    <div className="kl-step-front" style={{ height: BASE + i * RISE }} />
                  </div>
                </div>
              ))}
            </div>
            <StairPath k={k} stageRef={stageRef} />
            <div aria-hidden className="kl-floor" />
          </div>
        ) : (
          <>
            {/* الهاتف: الثلاثة جنب بعض كدرجات (الضغط ينقل للتذكرة)، والتذاكر تحتهم */}
            <div
              ref={stageRef}
              className={`mx-auto mt-10 grid max-w-[560px] items-end gap-2.5 pt-16 ${armed ? "kl-armed" : ""} ${inView ? "is-in" : ""}`}
              style={{ gridTemplateColumns: `repeat(${k}, minmax(0, 1fr))` }}
            >
              {tiers.map((tier, i) => (
                <div key={tier} className="kl-tile-in" style={{ "--i": i }}>
                  <button
                    type="button"
                    onClick={() => jump(tier)}
                    aria-label={t("keysLadder.jump", { name: cards[tier].name })}
                    className="kl-tile w-full rounded-b-[14px] outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                    style={{ "--tone": TONE[tier], "--i": i, height: TILE_BASE + i * TILE_RISE }}
                  >
                    <span aria-hidden className="kl-tile-visual">
                      <span className="kl-visual-in block">
                        <span className="kl-tilt block" style={{ "--kr": tier === "premium" ? "0deg" : `${rtl ? -14 : 14}deg` }}>
                          <KeyArt tier={tier} rtl={rtl} small />
                        </span>
                      </span>
                    </span>
                    <span aria-hidden className="kl-tile-top" />
                    <span aria-hidden className="kl-tile-front px-1.5 pb-3 pt-2 text-center">
                      <span className={`kl-metric font-black [font-family:Inter,Tajawal,sans-serif] ${tier === "premium" ? "text-[38px] leading-[0.72]" : "text-[27px] leading-none"}`}>{cards[tier].metric || "\u00a0"}</span>
                      <span className="mt-1.5 text-[11.5px] font-bold leading-tight text-[var(--text-softer)]">{cards[tier].unitShort}</span>
                      <span className="mt-2 max-w-full rounded-full px-2 py-0.5 text-[11px] font-extrabold" style={{ background: `rgb(${TONE[tier]} / 0.16)`, color: `rgb(${TONE[tier]})` }}>
                        <bdi>{cards[tier].priceShort}</bdi>
                      </span>
                    </span>
                  </button>
                </div>
              ))}
            </div>
            <div className="mx-auto mt-9 grid max-w-[560px] grid-cols-[minmax(0,1fr)] gap-6">
              {tiers.map((tier, i) => (
                <TierCard key={tier} tier={tier} step={i + 1} total={k} c={cards[tier]} compact />
              ))}
            </div>
          </>
        )}
      </div>

      {checkoutOn && (
        <Suspense fallback={null}>
          <KeysCheckout open={!!checkout} pack={checkout} maxKeys={maxKeys} onClose={() => setCheckout(null)} />
        </Suspense>
      )}
    </section>
  );
}

/** تذكرة الدرجة (نفس عائلة تذاكر الكوبون): الاسم، ما تفتح، السعر، الشرح | المزايا + الزر. */
function TierCard({ tier, step, total, c, compact = false }) {
  const { t } = useTranslation();
  const tone = TONE[tier];
  return (
    <article
      id={`kl-${tier}`}
      aria-labelledby={`kl-${tier}-name`}
      className={`kl-card ticket relative flex h-full scroll-mt-28 flex-col ${tier === "premium" ? "kl-card-premium" : ""}`}
      style={{ "--r": "14px", "--tone": tone, "--edge-base": `rgb(${tone} / 0.34)`, "--edge-strong": `rgb(${tone} / 0.72)`, "--perf": `rgb(${tone} / 0.5)` }}
    >
      <div
        className={`ticket-top relative ${compact ? "px-5 pb-6 pt-5" : "px-6 pb-6 pt-14"}`}
        style={{ background: `radial-gradient(120% 75% at 50% 0%, rgb(${tone} / 0.15), transparent 62%), var(--color-ink-card)` }}
      >
        <span className="ticket-ring ticket-ring-l" />
        <span className="ticket-ring ticket-ring-r" />
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full border px-2.5 py-1 text-[11.5px] font-extrabold" style={{ borderColor: `rgb(${tone} / 0.45)`, color: `rgb(${tone})`, background: `rgb(${tone} / 0.08)` }}>
            {c.chip}
          </span>
          <StepBars step={step} total={total} label={t("keysLadder.step", { n: step, total })} />
        </div>
        <div className="mt-3.5 flex items-center gap-3">
          {compact && (
            <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: c.iconBg }}>
              {c.icon}
            </span>
          )}
          <h3 id={`kl-${tier}-name`} className="min-w-0 text-[21px] font-black leading-tight text-[var(--text)]">
            {c.name}
          </h3>
        </div>
        {!compact && (
          <p className="mt-3 flex items-end gap-2.5">
            <span className={`kl-metric shrink-0 whitespace-nowrap font-black tracking-tight [font-family:Inter,Tajawal,sans-serif] ${tier === "premium" ? "text-[70px] leading-[0.66]" : "text-[52px] leading-[0.95]"}`}>{c.metric || "\u00a0"}</span>
            <span className="pb-1 text-[13px] font-bold leading-snug text-[var(--text-softer)]">{c.unit}</span>
          </p>
        )}
        <div className="mt-4">{c.price}</div>
        <p className="mt-3 text-[14px] leading-[1.75] text-[var(--text-soft)]">{c.desc}</p>
        {c.note}
      </div>
      <div
        className="ticket-stub relative flex flex-1 flex-col px-6 pb-6 pt-5"
        style={{ background: `linear-gradient(rgb(${tone} / 0.035), rgb(${tone} / 0.035)), var(--color-ink-card)` }}
      >
        <span className="ticket-ring ticket-ring-l" />
        <span className="ticket-ring ticket-ring-r" />
        <span className="ticket-perf" />
        <ul className="grid gap-2 text-[13.5px] leading-snug text-[var(--text-softer)]">
          {c.perks.map((p) => {
            const gold = typeof p === "object";
            const text = gold ? p.text : p;
            return (
              <li key={text} className={`flex items-start gap-2.5 ${gold ? "font-bold text-[#ffe486]" : ""}`}>
                {gold ? (
                  <Crown size={15} aria-hidden className="mt-[2px] shrink-0" style={{ color: GOLD }} />
                ) : (
                  <Check size={15} strokeWidth={3} aria-hidden className="mt-[2px] shrink-0" style={{ color: `rgb(${tone})` }} />
                )}
                <span>{text}</span>
              </li>
            );
          })}
        </ul>
        <div className="mt-auto pt-5">{c.actions}</div>
      </div>
    </article>
  );
}

/** مستوى الدرجة: أعمدة تطلع، المشعولة = رقم الدرجة. */
function StepBars({ step, total, label }) {
  return (
    <span className="kl-bars" role="img" aria-label={label}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={i < step ? "on" : undefined} style={{ height: 7 + i * 5 }} />
      ))}
    </span>
  );
}

/** رسم الدرجة: المفتاح الذهبي / الماسي (نفس رسومات الموقع) ولا عملة Premium بالتاج. */
function KeyArt({ tier, rtl, sparkle = false, small = false }) {
  if (tier === "golden") return <GoldenKey flip={!rtl} className="kl-key-svg" />;
  if (tier === "diamond") return <DiamondKey flip={!rtl} sparkle={sparkle} className="kl-key-svg" />;
  return (
    <span className="kl-coin-wrap block">
      <span className="kl-rays" />
      <span className="kl-coin-spin block">
        <span className="kl-coin">
          <Crown size={small ? 24 : 46} strokeWidth={2.2} />
        </span>
      </span>
    </span>
  );
}

/** المفتاح فوق التذكرة (الكمبيوتر): الدخول ← الماوس (parallax) ← الطفو ← الميلان عند المرور. */
function TierVisual({ tier, rtl, sparkle }) {
  return (
    <div aria-hidden className="kl-visual">
      <div className="kl-visual-in">
        {tier !== "premium" && <span className="kl-shade" />}
        <div className="kl-par" style={{ "--depth": DEPTH[tier] }}>
          <div className="kl-float">
            <div className="kl-tilt" style={{ "--kr": tier === "premium" ? "0deg" : `${rtl ? -14 : 14}deg` }}>
              <KeyArt tier={tier} rtl={rtl} sparkle={sparkle} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** الخيط اللي يطلع السلّم فوق حافات الدرجات (بالـ px، يتعاود يتحسب كي يتبدّل العرض). */
function StairPath({ k, stageRef }) {
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    setW(Math.round(el.getBoundingClientRect().width));
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [stageRef]);
  if (!w || !k) return null;
  const h = BASE + (k - 1) * RISE;
  const cw = w / k;
  let d = `M0 ${h - BASE}`;
  for (let i = 0; i < k; i++) {
    if (i > 0) d += ` V${h - (BASE + i * RISE)}`;
    d += ` H${Math.round(cw * (i + 1))}`;
  }
  return (
    <svg aria-hidden className="kl-path" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <path className="kl-path-draw" d={d} pathLength="100" />
      <path className="kl-path-glow" d={d} pathLength="100" />
      <path className="kl-path-spark" d={d} pathLength="100" />
    </svg>
  );
}
