import { useEffect, useId, useLayoutEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, Crown } from "lucide-react";
import { useTranslation } from "react-i18next";
import MagicCoupon2D from "./magic/MagicCoupon2D.jsx";
import { premiumMultiplier } from "../../lib/siteStats.js";
import { formatNumber } from "../../lib/values.js";
import { formatPrice, usePricing } from "../../lib/pricing.jsx";
import { offersLink, offersPath } from "../../lib/seo.js";
import { categoryName, categoryRecordSlug } from "../../lib/slug.js";
import "./hero-mobile.css";

// ============================================================
//  Hero الهاتف (أقل من 768px) — أول شاشة كيما تطبيق: الكوبون، العنوان، السطر الليموني، الزرّان،
//  وشريط القيمة. الكوبون نسخة خفيفة بـ CSS 3D (بلا WebGL): يميل مع الهاتف (DeviceOrientation؛
//  iPhone يطلب الإذن كي يلمس الزائر الكوبون)، ينقلب للذهبي باللمس، ويتأرجح بخفّة بلا ميلان.
//  الحركة كلها transform في حلقة rAF واحدة (تتوقّف برا الشاشة). prefers-reduced-motion → ثابت.
//  الحالة (الوجه، الانقلاب، التشغيل التلقائي) تبقى في LandingHero.
// ============================================================

const clamp = (v, a = -1, b = 1) => Math.min(Math.max(v, a), b);
const TILT_Y = 14; // أقصى ميلان يمين/يسار (deg)
const TILT_X = 10; // أقصى ميلان فوق/تحت (deg)

// ثلاث كوبونات صغيرة تطلّ من خلف زوايا الكوبون (ألوان الأنواع الثلاثة). مواضعها نسبةً للكوبون،
// والأقرب (depth أكبر) يتحرّك أكثر مع الميلان. ما تخرجش لمنطقة النص ولا الأزرار.
const MINIS = [
  { color: "#a6f000", deep: "#6f9f00", w: 46, rot: -14, depth: 1, delay: "0s", pos: { top: -8, insetInlineStart: -14 } },
  { color: "#38bdf8", deep: "#1d7fb0", w: 38, rot: 11, depth: 0.7, delay: "-2.2s", pos: { top: "38%", insetInlineEnd: -15 } },
  { color: "#fbbf24", deep: "#b7810f", w: 34, rot: 7, depth: 0.5, delay: "-4.1s", pos: { bottom: -12, insetInlineStart: "22%" } },
];

/** كوبون صغير مرسوم (SVG): نفس قصّة التذكرة (نصفا دائرة + خط مثقّب). */
function MiniTicket({ color, deep, w }) {
  const id = useId();
  return (
    <svg width={w} height={(w * 40) / 64} viewBox="0 0 64 40" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={color} />
          <stop offset="1" stopColor={deep} />
        </linearGradient>
      </defs>
      <path
        d="M6 0H58A6 6 0 0 1 64 6V22A4 4 0 0 0 64 30V34A6 6 0 0 1 58 40H6A6 6 0 0 1 0 34V30A4 4 0 0 0 0 22V6A6 6 0 0 1 6 0Z"
        fill={`url(#${id})`}
      />
      <path d="M9 26H55" stroke="rgba(10,10,10,0.38)" strokeWidth="1.6" strokeDasharray="3 3" />
      <rect x="9" y="8" width="22" height="4" rx="2" fill="rgba(10,10,10,0.28)" />
      <rect x="9" y="15" width="13" height="4" rx="2" fill="rgba(10,10,10,0.2)" />
    </svg>
  );
}

/**
 * نص الزر: يصغر شوية (حتى min) إذا ما دخلش في سطر واحد؛ ما زال ما دخلش → نخبّيو الأيقونة
 * (data-tight) ونعاودو؛ وفي الآخر برك يتقسم على سطرين — ما نقصّوش الكلمات.
 * يتعاود الحساب مع تغيّر العرض واللغة والخطوط.
 */
function FitLabel({ children, max = 15, min = 12 }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const over = () => el.scrollWidth > el.clientWidth + 0.5;
    const shrink = () => {
      let size = max;
      el.style.fontSize = `${size}px`;
      while (over() && size > min) {
        size -= 0.5;
        el.style.fontSize = `${size}px`;
      }
    };
    const fit = () => {
      const btn = el.parentElement;
      btn.removeAttribute("data-tight");
      el.style.whiteSpace = "nowrap";
      el.style.lineHeight = "";
      shrink();
      if (!over()) return;
      btn.setAttribute("data-tight", "");
      shrink();
      if (over()) {
        el.style.whiteSpace = "normal";
        el.style.lineHeight = "1.15";
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el.parentElement);
    document.fonts?.ready?.then(fit).catch(() => {});
    return () => ro.disconnect();
  }, [children, max, min]);
  return (
    <span ref={ref} className="block min-w-0 text-center">
      {children}
    </span>
  );
}

/** شريط القيمة (رقيق): مجاني للجميع · بـ السعر تفتح +القيمة — والمضاعف ×N بالذهبي على الجنب. نفس أرقام site_stats. */
function HeroValueStrip({ stats, lang, t }) {
  const pricing = usePricing();
  // قبل ما يوصل السعر: نفس المكان فارغ (بلا قفزة كي يبان الشريط)
  if (!pricing) return <div aria-hidden className="mt-3 h-[46px] rounded-2xl border border-[var(--color-ink-line)]/60" />;
  const unlock = stats?.premiumUnlockValueUsd ?? null;
  const multiplier = premiumMultiplier(unlock, pricing.usd);
  const priceText = formatPrice(t, lang, pricing.dzd, pricing.usd);
  return (
    <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-[#f0c63c]/30 bg-[linear-gradient(120deg,rgba(166,240,0,0.06),rgba(240,198,60,0.09))] px-3.5 py-2.5">
      {/* كل جزء يبقى مجموع: إذا ما دخلش في سطر، يتقسم بين "مجاني للجميع" وجملة السعر */}
      <p className="min-w-0 text-start text-[12.5px] font-bold leading-snug text-[var(--text-softer)]">
        <span className="inline-flex items-center gap-1 whitespace-nowrap align-middle font-black text-[var(--color-lime)]">
          <Check size={14} strokeWidth={3} aria-hidden />
          {t("hero.value.free")}
          <span aria-hidden className="mx-1 font-bold text-[var(--color-mute)]">
            ·
          </span>
        </span>{" "}
        <span className="inline-block whitespace-nowrap">
          {unlock != null
            ? t("hero.value.unlockStrip", { price: priceText, value: formatNumber(unlock, lang) })
            : t("hero.value.unlockShort", { price: priceText })}
        </span>
      </p>
      {multiplier && (
        <bdi
          dir="ltr"
          aria-label={t("hero.value.multiplierAria", { x: multiplier })}
          className="shrink-0 text-[26px] font-black leading-none tracking-tight text-[#ffe486] [font-family:Inter,sans-serif]"
          style={{ textShadow: "0 0 22px rgba(240,198,60,0.45)" }}
        >
          ×{formatNumber(multiplier, lang)}
        </bdi>
      )}
    </div>
  );
}

export default function HeroMobile({
  faces,
  labels,
  mode,
  angleDeg,
  dragging,
  reduced,
  inView,
  stageRef,
  onStageDown,
  onStageMove,
  onStageUp,
  onToggle,
  stats,
  memberCta,
  onOpenPremium,
  chips,
  counts,
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const premium = mode === "premium";
  const tiltRef = useRef(null);
  const floorRef = useRef(null);
  const miniRefs = useRef([]);
  const gyro = useRef({ x: 0, y: 0, at: 0, base: null });

  // ===== ميلان الهاتف =====
  useEffect(() => {
    if (reduced) return;
    const onOri = (e) => {
      if (e.gamma == null || e.beta == null) return;
      const g = gyro.current;
      if (g.base == null) g.base = e.beta;
      g.base += (e.beta - g.base) * 0.008; // يرجع للمركز بشوية مع زاوية مسك الهاتف
      g.x = clamp(e.gamma / 30);
      g.y = clamp((e.beta - g.base) / 30);
      g.at = performance.now();
    };
    window.addEventListener("deviceorientation", onOri);
    return () => window.removeEventListener("deviceorientation", onOri);
  }, [reduced]);

  // iPhone: إذن الميلان يتطلب داخل لمسة (pointerup/touchend) — مرّة، ونعاود إذا ما تحسبتش لمسة
  const asked = useRef(false);
  const requestTilt = () => {
    const DOE = typeof window !== "undefined" ? window.DeviceOrientationEvent : null;
    if (asked.current || !DOE || typeof DOE.requestPermission !== "function") return;
    asked.current = true;
    DOE.requestPermission().catch(() => {
      asked.current = false;
    });
  };

  // ===== حلقة الحركة: ميلان الكوبون + parallax الكوبونات الصغيرة + الظلّ تحتو =====
  useEffect(() => {
    const tilt = tiltRef.current;
    const floor = floorRef.current;
    const minis = miniRefs.current;
    const reset = () => {
      if (tilt) tilt.style.transform = "";
      if (floor) floor.style.transform = "";
      minis.forEach((m) => m && (m.style.transform = ""));
    };
    if (reduced || !inView || !tilt) {
      reset();
      return;
    }
    const cur = { rx: 0, ry: 0 };
    const t0 = performance.now();
    let last = t0;
    let raf = 0;
    const loop = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const g = gyro.current;
      const live = now - g.at < 1500;
      const s = (now - t0) / 1000;
      // بلا ميلان: تأرجح خفيف يبيّن أنو كوبون حقيقي
      const ry = live ? g.x * TILT_Y : Math.sin(s * 0.8) * 6;
      const rx = live ? g.y * TILT_X : Math.sin(s * 0.55 + 1.2) * 3;
      const k = 1 - Math.exp(-dt * 7);
      cur.rx += (rx - cur.rx) * k;
      cur.ry += (ry - cur.ry) * k;
      tilt.style.transform = `rotateX(${cur.rx.toFixed(2)}deg) rotateY(${cur.ry.toFixed(2)}deg)`;
      if (floor) floor.style.transform = `translate3d(${(-cur.ry * 0.9).toFixed(2)}px,0,0) scaleX(${(1 - Math.abs(cur.ry) / 140).toFixed(3)})`;
      for (let i = 0; i < MINIS.length; i++) {
        const el = minis[i];
        if (!el) continue;
        const d = MINIS[i].depth;
        el.style.transform = `translate3d(${((cur.ry / TILT_Y) * d * 7).toFixed(2)}px,${((-cur.rx / TILT_X) * d * 5).toFixed(2)}px,0)`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      reset();
    };
  }, [reduced, inView]);

  const onUp = (e) => {
    if (e.pointerType !== "mouse") requestTilt();
    onStageUp(e);
  };
  const onKeyDown = (e) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      onToggle();
    }
  };

  const btn =
    "hm-btn relative flex h-[52px] min-w-0 items-center justify-center gap-1.5 rounded-2xl px-3 font-extrabold outline-none transition-transform active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-ink)]";
  const goldBtn = `${btn} border focus-visible:ring-[#f0c63c]`;
  const goldStyle = { borderColor: "rgba(240,198,60,0.55)", color: "#ffe486", background: "rgba(240,198,60,0.06)" };

  return (
    <div className="relative mx-auto max-w-md px-4 text-center">
      {/* ===== الكوبون السحري (CSS 3D) ===== */}
      <div className="hm-rise relative mx-auto" style={{ width: "min(84vw, 336px)" }}>
        {MINIS.map((m, i) => (
          <div key={m.color} ref={(el) => (miniRefs.current[i] = el)} aria-hidden className="pointer-events-none absolute z-0" style={m.pos}>
            <div className="hm-bob" style={{ animationDelay: m.delay }}>
              <div style={{ transform: `rotate(${m.rot}deg)`, opacity: 0.55 + m.depth * 0.35 }}>
                <MiniTicket color={m.color} deep={m.deep} w={m.w} />
              </div>
            </div>
          </div>
        ))}
        {/* ضوء تحت الكوبون: ليموني، ويولّي ذهبي في Premium */}
        <span ref={floorRef} aria-hidden className="pointer-events-none absolute inset-x-[10%] -bottom-[14px] z-0 h-[22px]">
          <span
            className="absolute inset-0 rounded-[50%] transition-opacity duration-700"
            style={{ background: "radial-gradient(closest-side, rgba(166,240,0,0.42), transparent)", opacity: premium ? 0 : 1 }}
          />
          <span
            className="absolute inset-0 rounded-[50%] transition-opacity duration-700"
            style={{ background: "radial-gradient(closest-side, rgba(240,198,60,0.55), transparent)", opacity: premium ? 1 : 0 }}
          />
        </span>

        <div className="relative z-10" style={{ perspective: "900px" }}>
          <div ref={tiltRef} style={{ transformStyle: "preserve-3d", willChange: reduced ? undefined : "transform" }}>
            <div
              ref={stageRef}
              role="switch"
              tabIndex={0}
              aria-checked={premium}
              aria-label={t("hero.magic.switchLabel")}
              onPointerDown={onStageDown}
              onPointerMove={onStageMove}
              onPointerUp={onUp}
              onPointerCancel={onStageUp}
              onKeyDown={onKeyDown}
              className="@container relative aspect-[1.6] w-full cursor-pointer select-none rounded-[var(--radius-card)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-lime)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--color-ink)]"
              style={{ touchAction: "pan-y", WebkitTapHighlightColor: "transparent" }}
            >
              <MagicCoupon2D faces={faces} labels={labels} mode={mode} angleDeg={angleDeg} dragging={dragging} reduced={!!reduced} hidden={false} />
              {faces && !faces.real && (
                <span className="absolute -top-3 start-6 z-10 rounded-full bg-[var(--elev)] px-2.5 py-1 text-[11px] font-bold text-[var(--color-mute)] ring-1 ring-[var(--color-ink-line)]">
                  {t("hero.magic.example")}
                </span>
              )}
              <span className="sr-only" aria-live="polite">
                {faces ? `${faces.name}: ${premium ? faces.premium : faces.normal}` : ""}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ===== العنوان + السطر الليموني (الشرح الطويل في الكمبيوتر برك) ===== */}
      <h1 className="mt-[clamp(18px,3svh,28px)] text-balance text-[clamp(26px,7.4vw,30px)] font-black leading-[1.2] tracking-tight text-[var(--text)]">
        <span className="block">{t("hero.titleLine1")}</span>
        <span className="block">{t("hero.titleLine2")}</span>
      </h1>
      <p className="mt-2 text-balance text-[17px] font-black leading-snug text-[var(--color-lime)]">{t("hero.tagline")}</p>

      {/* ===== الزرّان: نفس العرض ونفس الطول ===== */}
      <div className="mt-[clamp(16px,2.6svh,24px)] grid grid-cols-2 gap-2.5">
        <Link
          to={offersPath(lang)}
          className={`${btn} text-[#0a0a0a] shadow-[0_14px_36px_-14px_rgba(166,240,0,0.6)] focus-visible:ring-[var(--color-lime)]`}
          style={{ background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" }}
        >
          <FitLabel>{t("hero.ctaExplore")}</FitLabel>
          <ArrowLeft size={17} aria-hidden className="shrink-0 ltr:rotate-180" />
        </Link>
        {memberCta ? (
          <Link to={offersLink(lang, { mode: "premium" })} className={goldBtn} style={goldStyle}>
            <Crown size={16} aria-hidden className="shrink-0" />
            <FitLabel>{t("hero.ctaMember")}</FitLabel>
          </Link>
        ) : (
          <button type="button" onClick={onOpenPremium} className={goldBtn} style={goldStyle}>
            <Crown size={16} aria-hidden className="shrink-0" />
            <FitLabel>{t("hero.ctaPremium")}</FitLabel>
          </button>
        )}
      </div>

      <HeroValueStrip stats={stats} lang={lang} t={t} />

      {/* شرائح التصنيفات: شريط متحرك (تحت أول شاشة) — مكانها محجوز قبل ما توصل الفئات */}
      {chips.length === 0 && <div aria-hidden className="mt-6 h-[33px]" />}
      {chips.length > 0 && (
        <div className="marquee-wrap no-scrollbar relative -mx-4 mt-6 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
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
  );
}
