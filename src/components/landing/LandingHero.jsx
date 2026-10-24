import { Component, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Check, Crown, Hand } from "lucide-react";
import { premiumMultiplier } from "../../lib/siteStats.js";
import { formatNumber } from "../../lib/values.js";
import { formatPrice, usePricing } from "../../lib/pricing.jsx";
import BidiText from "../BidiText.jsx";
import { useTranslation } from "react-i18next";
import { offersLink, offersPath } from "../../lib/seo.js";
import { categoryName, categoryRecordSlug } from "../../lib/slug.js";
import MagicCoupon2D from "./magic/MagicCoupon2D.jsx";
import HeroModeSwitch from "./magic/HeroModeSwitch.jsx";
import HeroMobile from "./HeroMobile.jsx";
import { pickHeroOffer, buildCouponFaces } from "./magic/couponData.js";
import { canUse3D, isIOS } from "./magic/canUse3D.js";

const MagicScene3D = lazy(() => import("./magic/MagicScene3D.jsx"));

/** أي خطأ في WebGL/الـ 3D → نرجع للنسخة 2D بصمت. */
class Fallback3D extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFail?.();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function createStore() {
  return {
    anchor: { ready: false, cx: 0, cy: 0, w: 0, h: 0 },
    flipIndex: 0,
    drag: 0,
    angle: 0,
    vel: 0,
    tilt: { x: 0, y: 0 },
    tiltTarget: { x: 0, y: 0 },
    parallax: { x: 0, y: 0 },
    parallaxTarget: { x: 0, y: 0 },
    scrollPx: 0,
    burst: 0,
    couponScale: 1,
    couponWorld: null,
    measure: null,
    avoid: [],
    reduced: false,
    // ضوء المؤشر على الكوبون: موضع الفأرة/اللمس (إحداثيات الشاشة)، on = نشط، touch = مصدره لمس
    glow: { x: 0, y: 0, on: false, touch: false },
  };
}

const clamp = (v, a = -1, b = 1) => Math.min(Math.max(v, a), b);
// شرائح التصنيفات على الحافة الخارجية للكوبون (بعيداً عن النص والهيدر)
const CHIP_SLOTS = ["top-[2%] end-[-11%]", "top-[40%] end-[-15%]", "top-[78%] end-[-10%]"];

/**
 * 5.2 — Hero: عنوان يربط الدفع عند الاستلام بالخصم + زرّان، و"الكوبون السحري":
 * كوبون 3D حقيقي يميل مع الماوس/ميلان الهاتف، ويُسحب أو يُنقر لينقلب إلى وجهه
 * الذهبي (Premium). شرائح التصنيفات تتحرك حوله وكل واحدة تفتح /offers?category=…
 */
/**
 * مربع القيمة تحت أزرار الـ Hero: "مجاني للجميع" + ما يفتحه Premium مقابل سعره.
 * السعر = الدفعة الوحدة الحالية (pricing_settings)، القيمة X من site_stats، والمضاعف N = X ÷ السعر بالدولار.
 * إذا X فارغ: نكتفي بـ "مجاني للجميع" و"افتح Premium بـ …" بلا رقم ولا مضاعف.
 */
function HeroValueBox({ stats, lang, t }) {
  const pricing = usePricing();
  // قبل ما يوصلو السعر وأرقام site_stats: نفس المربع بالنسخة الطويلة (القيمة + ×N) والنص مخفي (visibility)
  // باش الـ Hero ما يقفزش — حتى رقم ما يبان (88… = مكان محجوز برك)
  const waiting = !pricing || stats == null;
  const unlock = waiting ? 8888 : stats?.premiumUnlockValueUsd ?? null;
  const multiplier = waiting ? 88 : premiumMultiplier(unlock, pricing.usd);
  const priceText = waiting ? formatPrice(t, lang, 88888, 88) : formatPrice(t, lang, pricing.dzd, pricing.usd);

  return (
    <div
      aria-hidden={waiting || undefined}
      className={`mt-7 flex max-w-xl flex-col gap-4 rounded-2xl border border-[#f0c63c]/35 bg-[linear-gradient(120deg,rgba(166,240,0,0.07),rgba(240,198,60,0.1))] p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5 ${waiting ? "[&_bdi]:invisible [&_p]:invisible" : ""}`}
    >
      <span className="flex shrink-0 items-center gap-2 text-[17px] font-black text-[var(--color-lime)]">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--color-lime)] text-[#0a0a0a]">
          <Check size={16} strokeWidth={3} />
        </span>
        {t("hero.value.free")}
      </span>
      <span aria-hidden className="h-px w-full border-t border-dashed border-[#f0c63c]/35 sm:h-auto sm:w-px sm:self-stretch sm:border-s sm:border-t-0" />
      <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
        <p className="min-w-0 text-[14.5px] font-bold leading-snug text-[var(--text-softer)]">
          <BidiText
            rtl={lang === "ar"}
            text={unlock != null ? t("hero.value.unlock", { price: priceText, value: formatNumber(unlock, lang) }) : t("hero.value.unlockShort", { price: priceText })}
          />
        </p>
        {multiplier && (
          <bdi
            dir="ltr"
            aria-label={t("hero.value.multiplierAria", { x: multiplier })}
            className="shrink-0 text-[40px] font-black leading-none tracking-tight text-[#ffe486] [font-family:Inter,sans-serif] sm:text-[46px]"
            style={{ textShadow: "0 0 28px rgba(240,198,60,0.45)" }}
          >
            ×{formatNumber(multiplier, lang)}
          </bdi>
        )}
      </div>
    </div>
  );
}

export default function LandingHero({ companies, loading, voteStats, categories, byId, counts, stats, onOpenPremium, isPremiumActive }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const reduced = useReducedMotion();
  const heroRef = useRef(null);
  const canvasWrapRef = useRef(null);
  const stageRef = useRef(null);
  const textColRef = useRef(null); // العنوان + الأزرار + مربع القيمة (منطقة ممنوعة على الكوبونات الطافية)
  const controlsRef = useRef(null); // مقبض عادي/Premium + التلميح
  const store = useMemo(() => createStore(), []);
  store.reduced = !!reduced;

  const [mode, setMode] = useState("normal");
  const [angleDeg, setAngleDeg] = useState(0); // للنسخة 2D
  const [dragging, setDragging] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const [inView, setInView] = useState(true);
  const [want3D, setWant3D] = useState(false);
  const [ready3D, setReady3D] = useState(false);
  const [failed3D, setFailed3D] = useState(false);
  const [switchBurst, setSwitchBurst] = useState(0);
  const [mobile, setMobile] = useState(false);
  const [stacked, setStacked] = useState(false); // تخطيط عمودي (النص فوق الكوبون) تحت lg
  // الهاتف (أقل من 768px): تخطيط خاص (HeroMobile) — الكوبون بـ CSS 3D، بلا WebGL
  const [small, setSmall] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setSmall(mq.matches);
    sync();
    mq.addEventListener?.("change", sync);
    return () => mq.removeEventListener?.("change", sync);
  }, []);

  const offer = useMemo(() => (loading ? null : pickHeroOffer(companies, voteStats)), [loading, companies, voteStats]);
  const faces = useMemo(
    () => (loading ? null : buildCouponFaces(offer, { t, lang, byId, categories })),
    [loading, offer, t, lang, byId, categories]
  );
  const labels = useMemo(
    () => ({
      type: faces ? t(`types.${faces.typeKey}`) : "",
      offerValue: t("card.offerValue"),
      premiumDiscount: t("card.premiumDiscount"),
      code: t("card.code"),
      premiumCode: t("card.premiumCode"),
      premiumBadge: t("card.premiumBadge"),
    }),
    [t, faces]
  );

  // ===== الانقلاب: flipIndex زوجي = عادي، فردي = Premium (الدوران دائماً للأمام) =====
  const flipTo = useCallback(
    (k) => {
      const prevOdd = Math.abs(store.flipIndex % 2) === 1;
      store.flipIndex = k;
      const odd = Math.abs(k % 2) === 1;
      setAngleDeg(k * 180);
      setMode(odd ? "premium" : "normal");
      if (odd && !prevOdd) setSwitchBurst((b) => b + 1);
    },
    [store]
  );
  const setModeFromSwitch = (m) => {
    const odd = Math.abs(store.flipIndex % 2) === 1;
    if ((m === "premium") !== odd) flipTo(store.flipIndex + 1);
  };

  const orientationAsked = useRef(false);
  const markInteracted = (ask = true) => {
    setInteracted(true);
    // iOS 13+: إذن ميلان الهاتف يُطلب داخل لمسة المستخدم (في تخطيط الهاتف: HeroMobile يطلبو في pointerup)
    if (ask && !orientationAsked.current && typeof DeviceOrientationEvent !== "undefined" && DeviceOrientationEvent.requestPermission) {
      orientationAsked.current = true;
      DeviceOrientationEvent.requestPermission().catch(() => {});
    }
  };

  // ===== قرار الـ 3D (بعد أول رسم، على الأجهزة القادرة فقط) =====
  useEffect(() => {
    const mqStack = window.matchMedia("(max-width: 1023px)");
    const syncStack = () => setStacked(mqStack.matches);
    syncStack();
    mqStack.addEventListener?.("change", syncStack);
    return () => mqStack.removeEventListener?.("change", syncStack);
  }, []);

  useEffect(() => {
    setMobile(window.matchMedia("(max-width: 767px), (pointer: coarse)").matches);
    // تخطيط الهاتف: الكوبون بـ CSS 3D برك — ما نجرّبوش WebGL أصلاً
    if (window.matchMedia("(max-width: 767px)").matches || !canUse3D()) return;
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 500));
    const cancel = window.cancelIdleCallback || clearTimeout;
    const id = idle(() => setWant3D(true));
    return () => cancel(id);
  }, []);

  // ===== الظهور في الشاشة: يوقف حلقة الـ 3D والتشغيل التلقائي خارجها =====
  useEffect(() => {
    const el = heroRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // ===== قياس "المسرح" بالنسبة للـ canvas (الكوبون الـ 3D يلتزم بموضعه ومقاسه) =====
  useEffect(() => {
    store.measure = () => {
      const c = canvasWrapRef.current?.getBoundingClientRect();
      const s = stageRef.current?.getBoundingClientRect();
      if (!c || !s || !s.width) return;
      store.anchor.cx = s.left - c.left + s.width / 2;
      store.anchor.cy = s.top - c.top + s.height / 2;
      store.anchor.w = s.width;
      store.anchor.h = s.height;
      store.anchor.ready = true;
      // مناطق لا تدخلها الكوبونات الطافية أبداً (بالبكسل نسبةً للـ canvas)
      store.avoid = [textColRef.current, controlsRef.current]
        .map((el) => el?.getBoundingClientRect())
        .filter((r) => r && r.width)
        .map((r) => ({ l: r.left - c.left, r: r.right - c.left, t: r.top - c.top, b: r.bottom - c.top }));
    };
    store.measure();
    const ro = new ResizeObserver(() => store.measure());
    if (heroRef.current) ro.observe(heroRef.current);
    if (stageRef.current) ro.observe(stageRef.current);
    const onScroll = () => {
      store.scrollPx = Math.min(window.scrollY, 2000);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", onScroll);
      store.measure = null;
    };
  }, [store]);

  // ===== ميلان الهاتف (gyro) — يُطبَّق على الكوبون وعلى الكوبونات الطافية =====
  useEffect(() => {
    if (!mobile || small) return;
    let base = null;
    const onOri = (e) => {
      if (e.gamma == null || e.beta == null) return;
      if (base == null) base = e.beta;
      const nx = clamp(e.gamma / 28);
      const ny = clamp((e.beta - base) / 28);
      store.tiltTarget.y = nx * 0.42;
      store.tiltTarget.x = ny * 0.3;
      store.parallaxTarget.x = nx * 0.8;
      store.parallaxTarget.y = ny * 0.8;
    };
    window.addEventListener("deviceorientation", onOri);
    return () => window.removeEventListener("deviceorientation", onOri);
  }, [mobile, small, store]);

  // ===== ميلان مع الماوس (الحاسوب) =====
  const onHeroPointerMove = (e) => {
    if (e.pointerType !== "mouse") return;
    Object.assign(store.glow, { x: e.clientX, y: e.clientY, on: true, touch: false });
    const s = stageRef.current?.getBoundingClientRect();
    const h = heroRef.current?.getBoundingClientRect();
    if (!s || !h) return;
    const nx = clamp((e.clientX - (s.left + s.width / 2)) / (h.width * 0.45));
    const ny = clamp((e.clientY - (s.top + s.height / 2)) / (h.height * 0.5));
    store.tiltTarget.y = nx * 0.4;
    store.tiltTarget.x = ny * 0.26;
    store.parallaxTarget.x = clamp((e.clientX - (h.left + h.width / 2)) / (h.width / 2));
    store.parallaxTarget.y = clamp((e.clientY - (h.top + h.height / 2)) / (h.height / 2));
  };
  const onHeroPointerLeave = () => {
    store.glow.on = false;
    store.tiltTarget.x = 0;
    store.tiltTarget.y = 0;
    store.parallaxTarget.x = 0;
    store.parallaxTarget.y = 0;
  };

  // ===== سحب/نقر الكوبون نفسه =====
  const drag = useRef(null);
  const onStageDown = (e) => {
    markInteracted(!small);
    // الهاتف: الضوء يظهر في موضع اللمس
    if (e.pointerType !== "mouse") Object.assign(store.glow, { x: e.clientX, y: e.clientY, on: true, touch: true });
    drag.current = { x: e.clientX, y: e.clientY, w: stageRef.current?.offsetWidth || 300, axis: null, moved: false };
  };
  const onStageMove = (e) => {
    if (e.pointerType !== "mouse" && store.glow.touch && store.glow.on) Object.assign(store.glow, { x: e.clientX, y: e.clientY });
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.axis && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      d.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (d.axis === "x") {
        e.currentTarget.setPointerCapture?.(e.pointerId);
        setDragging(true);
      }
    }
    if (d.axis === "y") {
      drag.current = null; // تمرير عمودي للصفحة
      return;
    }
    if (d.axis === "x") {
      d.moved = true;
      store.drag = (dx / d.w) * Math.PI * 1.15;
      setAngleDeg(store.flipIndex * 180 + (store.drag * 180) / Math.PI);
    }
  };
  const onStageUp = (e) => {
    // رفع الإصبع: الضوء ينطفئ بالتدريج (في المشهد)
    if (e?.pointerType !== "mouse") store.glow.on = false;
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d) return;
    if (!d.moved) {
      store.drag = 0;
      flipTo(store.flipIndex + 1);
      return;
    }
    const total = store.flipIndex * Math.PI + store.drag;
    let k = Math.round(total / Math.PI);
    if (k === store.flipIndex && Math.abs(store.drag) > Math.PI * 0.22) k += Math.sign(store.drag);
    store.drag = 0;
    flipTo(k);
  };

  // ===== تشغيل تلقائي + تلميح "اسحب" حتى أول تفاعل =====
  useEffect(() => {
    if (reduced || interacted || !inView || !faces) return;
    const id = setInterval(() => flipTo(store.flipIndex + 1), 3400);
    return () => clearInterval(id);
  }, [reduced, interacted, inView, faces, flipTo, store]);

  // ===== شرائح التصنيفات حول الكوبون (تتبدّل كل بضع ثوانٍ) =====
  const chips = useMemo(
    () =>
      (categories || [])
        .filter((c) => (counts[c.id] || 0) > 0)
        .sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0)),
    [categories, counts]
  );
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    if (reduced || chips.length <= CHIP_SLOTS.length) return;
    const id = setInterval(() => setCycle((c) => c + 1), 4200);
    return () => clearInterval(id);
  }, [reduced, chips.length]);

  // الـ 3D يُحمَّل عند أول ظهور للـ Hero فقط، ثم يبقى (حلقته تتوقف خارج الشاشة عبر active)
  const [load3D, setLoad3D] = useState(false);
  useEffect(() => {
    if (want3D && inView && !small) setLoad3D(true);
  }, [want3D, inView, small]);
  const show3D = load3D && !failed3D && !!faces && !small;
  const memberCta = isPremiumActive;

  return (
    <section
      ref={heroRef}
      onPointerMove={onHeroPointerMove}
      onPointerLeave={onHeroPointerLeave}
      className={small ? "hero-section relative overflow-hidden pb-10 pt-[112px]" : "hero-section relative overflow-hidden pb-16 pt-28 sm:pt-32 lg:pb-24 lg:pt-36"}
    >
      {/* الخلفية: شبكة + توهّج، ثم طبقة الـ 3D (الكوبونات الطافية + الكوبون الرئيسي) */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-grid" />
        <div
          className="absolute left-1/2 top-[-60px] h-[460px] w-[760px] -translate-x-1/2 rounded-full blur-[120px]"
          style={{ background: "radial-gradient(circle, rgba(166,240,0,0.2), transparent 62%)" }}
        />
        <motion.div
          className="absolute bottom-[-20%] h-[420px] w-[620px] rounded-full blur-[130px] ltr:right-[-10%] rtl:left-[-10%]"
          style={{ background: "radial-gradient(circle, rgba(240,198,60,0.22), transparent 62%)" }}
          initial={false}
          animate={{ opacity: mode === "premium" ? 1 : 0 }}
          transition={{ duration: 0.8 }}
        />
      </div>
      <div ref={canvasWrapRef} className="pointer-events-none absolute inset-0">
        {show3D && (
          <Fallback3D onFail={() => setFailed3D(true)}>
            <Suspense fallback={null}>
              <MagicScene3D
                store={store}
                faces={faces}
                labels={labels}
                lang={lang}
                active={inView}
                mobile={mobile}
                stacked={stacked}
                onReady={() => setReady3D(true)}
              />
            </Suspense>
          </Fallback3D>
        )}
      </div>

      {small ? (
        <HeroMobile
          faces={faces}
          labels={labels}
          mode={mode}
          angleDeg={angleDeg}
          dragging={dragging}
          reduced={!!reduced}
          inView={inView}
          stageRef={stageRef}
          onStageDown={onStageDown}
          onStageMove={onStageMove}
          onStageUp={onStageUp}
          onToggle={() => {
            markInteracted(false);
            flipTo(store.flipIndex + 1);
          }}
          stats={stats}
          memberCta={memberCta}
          onOpenPremium={onOpenPremium}
          chips={chips}
          counts={counts}
        />
      ) : (
      <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)] lg:gap-14">
        {/* ===== النص ===== */}
        <div ref={textColRef}>
          <h1 className="text-balance text-[34px] font-black leading-[1.12] tracking-tight text-[var(--text)] sm:text-[48px] lg:text-[56px]">
            <span className="block">{t("hero.titleLine1")}</span>
            <span className="block">{t("hero.titleLine2")}</span>
          </h1>
          <p className="mt-4 text-[22px] font-black leading-snug text-[var(--color-lime)] sm:text-[26px]">{t("hero.tagline")}</p>
          <p className="mt-5 max-w-xl text-[16px] leading-[1.75] text-[var(--text-soft)] sm:text-[18px]">{t("hero.subtitle")}</p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link to={offersPath(lang)}>
              <motion.span
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="group relative flex items-center gap-2 overflow-hidden rounded-2xl px-6 py-3.5 text-[15.5px] font-extrabold text-[#0a0a0a] shadow-[0_14px_40px_-12px_rgba(166,240,0,0.6)]"
                style={{ background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" }}
              >
                <span className="absolute inset-0 -translate-x-full bg-white/30 transition-transform duration-500 group-hover:translate-x-full" />
                <span className="relative">{t("hero.ctaExplore")}</span>
                <ArrowLeft size={18} className="relative transition-transform group-hover:-translate-x-1 ltr:rotate-180 ltr:group-hover:translate-x-1" />
              </motion.span>
            </Link>

            {memberCta ? (
              <Link
                to={offersLink(lang, { mode: "premium" })}
                className="flex items-center gap-2 rounded-2xl border px-6 py-3.5 text-[15px] font-extrabold transition-colors hover:bg-[#f0c63c]/10"
                style={{ borderColor: "rgba(240,198,60,0.55)", color: "#ffe486" }}
              >
                <Crown size={17} /> {t("hero.ctaMember")}
              </Link>
            ) : (
              <motion.button
                type="button"
                onClick={onOpenPremium}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2 rounded-2xl border px-6 py-3.5 text-[15px] font-extrabold transition-colors hover:bg-[#f0c63c]/10"
                style={{ borderColor: "rgba(240,198,60,0.55)", color: "#ffe486" }}
              >
                <Crown size={17} /> {t("hero.ctaPremium")}
              </motion.button>
            )}
          </div>

          <HeroValueBox stats={stats} lang={lang} t={t} />
        </div>

        {/* ===== الكوبون السحري ===== */}
        <div className="relative mx-auto w-full max-w-[540px]">
          {/* شرائح التصنيفات حول الكوبون (الحاسوب) */}
          <div className="pointer-events-none absolute inset-0 z-20 hidden lg:block">
            {CHIP_SLOTS.map((slot, i) => {
              const cat = chips.length ? chips[(i + cycle * CHIP_SLOTS.length) % chips.length] : null;
              if (!cat || i >= chips.length) return null;
              return (
                <div key={slot} className={`absolute ${slot}`}>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={cat.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.35 }}
                    >
                      <Link
                        to={offersLink(lang, { category: categoryRecordSlug(cat) })}
                        className="pointer-events-auto block whitespace-nowrap rounded-full border border-[var(--color-ink-line)] bg-[var(--elev)]/80 px-3.5 py-1.5 text-[12.5px] font-bold text-[var(--text-softer)] backdrop-blur transition-colors hover:border-[var(--color-lime)]/50 hover:text-[var(--text)] motion-safe:animate-[float-slow_9s_ease-in-out_infinite]"
                        style={{ animationDelay: `${i * -2.2}s` }}
                      >
                        <bdi>{categoryName(cat, lang)}</bdi>
                        <span className="ms-1.5 text-[11px] font-semibold text-[var(--color-mute)]">{counts[cat.id]}</span>
                      </Link>
                    </motion.div>
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          <div
            ref={stageRef}
            onPointerDown={onStageDown}
            onPointerMove={onStageMove}
            onPointerUp={onStageUp}
            onPointerCancel={onStageUp}
            className="@container relative aspect-[1.6] w-full cursor-grab select-none active:cursor-grabbing"
            style={{ touchAction: "pan-y" }}
          >
            <MagicCoupon2D
              faces={faces}
              labels={labels}
              mode={mode}
              angleDeg={angleDeg}
              dragging={dragging}
              reduced={!!reduced}
              hidden={show3D && ready3D}
            />
            {faces && !faces.real && (
              <span className="absolute -top-3 start-6 z-10 rounded-full bg-[var(--elev)] px-2.5 py-1 text-[11px] font-bold text-[var(--color-mute)] ring-1 ring-[var(--color-ink-line)]">
                {t("hero.magic.example")}
              </span>
            )}
            <span className="sr-only" aria-live="polite">
              {faces ? `${faces.name}: ${mode === "premium" ? faces.premium : faces.normal}` : ""}
            </span>
          </div>

          <div ref={controlsRef} className="mt-7 flex flex-col items-center gap-3">
            <HeroModeSwitch
              mode={mode}
              onChange={setModeFromSwitch}
              onInteract={markInteracted}
              burst={switchBurst}
            />
            <AnimatePresence>
              {!interacted && !reduced && (
                <motion.span
                  key="hint"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--color-mute)]"
                >
                  <motion.span animate={{ x: [-6, 6, -6] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}>
                    <Hand size={15} />
                  </motion.span>
                  {t("hero.magic.dragHint")}
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          {/* شرائح التصنيفات (الهاتف): شريط متحرك تحت الكوبون */}
          {chips.length > 0 && (
            <div className="marquee-wrap no-scrollbar relative -mx-4 mt-6 overflow-hidden lg:hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
              <div className="marquee-track flex w-max gap-2 px-4" style={{ "--marquee-duration": "38s" }}>
                {[...chips, ...chips].map((cat, i) => (
                  <Link
                    key={`${cat.id}-${i}`}
                    to={offersLink(lang, { category: categoryRecordSlug(cat) })}
                    aria-hidden={i >= chips.length}
                    tabIndex={i >= chips.length ? -1 : 0}
                    className="whitespace-nowrap rounded-full border border-[var(--color-ink-line)] bg-[var(--fill)] px-3.5 py-1.5 text-[12.5px] font-bold text-[var(--text-softer)]"
                  >
                    <bdi>{categoryName(cat, lang)}</bdi>
                    <span className="ms-1.5 text-[11px] font-semibold text-[var(--color-mute)]">{counts[cat.id]}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      )}
    </section>
  );
}
