import { useRef } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowRight, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import Logo from "../Logo.jsx";
import LanguageSwitcher from "../LanguageSwitcher.jsx";
import { MiniTicket } from "../app/AppPhone.jsx";
import { useSharedStats } from "../header/headerData.js";
import { premiumMultiplier } from "../../lib/siteStats.js";
import { formatNumber } from "../../lib/values.js";

// نمط حقول الإدخال المشترك في صفحات الحساب — ضوء ليموني خفيف حول الحقل أثناء الكتابة
export const authInputCls =
  "w-full rounded-xl border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] px-3.5 py-3 text-[14.5px] font-medium text-[var(--text)] outline-none transition-[border-color,box-shadow] duration-300 placeholder:text-[var(--color-mute)] hover:border-[#34363c] focus:border-[var(--color-lime)]/70 focus:shadow-[0_0_0_4px_rgba(166,240,0,0.1),0_0_26px_-8px_rgba(166,240,0,0.55)]";

/** زر "متابعة عبر Google" بشعار Google الرسمي. */
export function GoogleButton({ onClick, loading, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-[var(--color-ink-line)] bg-[var(--fill)] px-4 py-3 text-[14.5px] font-bold text-[var(--text)] transition-colors hover:bg-[var(--fill-strong)] disabled:opacity-60"
    >
      {loading ? (
        <Loader2 size={18} className="animate-spin" />
      ) : (
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z" />
          <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
          <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
          <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
        </svg>
      )}
      {label}
    </button>
  );
}

// كوبونات اللوحة: الموضع (نسبة)، العمق (تحرّك مع الفأرة)، والضبابية للبعيدة — مثل الـ Hero
const COUPONS = [
  { top: "9%", end: "9%", w: 124, r: -12, color: "#a6f000", to: "#8bd000", depth: 26, dur: 9 },
  { top: "27%", end: "34%", w: 66, r: 14, color: "#38bdf8", to: "#0284c7", depth: 10, dur: 11, blur: 1.4, delay: -3 },
  { top: "47%", end: "6%", w: 92, r: 8, color: "#fbbf24", to: "#d97706", depth: 20, dur: 10, delay: -5 },
  { top: "63%", end: "30%", w: 58, r: -16, color: "#ffe486", to: "#cf9a1e", depth: 8, dur: 12, blur: 1.8, delay: -2 },
  { top: "21%", end: "60%", w: 44, r: 20, color: "#a6f000", to: "#8bd000", depth: 5, dur: 13, blur: 2.4, delay: -7 },
];

/** لوحة الهوية (الحاسوب): ضوء ليموني، كوبونات تطفو، اللوغو، العنوان، وأرقام site_stats. */
function IdentityPanel() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const reduced = useReducedMotion();
  const ref = useRef(null);
  const stats = useSharedStats();
  const multiplier = premiumMultiplier(stats?.premiumUnlockValueUsd ?? null);
  const numbers = [
    stats?.totalCodes != null && { key: "codes", value: formatNumber(stats.totalCodes, lang), label: t("stats.codes") },
    stats?.partnersCount != null && { key: "partners", value: formatNumber(stats.partnersCount, lang), label: t("stats.partners") },
    multiplier && { key: "x", value: `×${formatNumber(multiplier, lang)}`, label: t("stats.multiplier"), gold: true },
  ].filter(Boolean);

  // الكوبونات تتحرك مع الفأرة بعمق مختلف (متغيّرات CSS، بلا re-render)
  const onMove = (e) => {
    if (reduced || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    ref.current.style.setProperty("--px", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
    ref.current.style.setProperty("--py", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
  };

  return (
    <aside
      ref={ref}
      onPointerMove={onMove}
      className="relative hidden overflow-hidden border-s border-[var(--color-ink-line)] bg-[var(--color-ink-soft)] lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:justify-between lg:p-12 xl:p-16"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid opacity-70" />
      <div aria-hidden className="pointer-events-none absolute -top-40 start-[-10%] h-[520px] w-[720px] rounded-full blur-[120px]" style={{ background: "radial-gradient(circle, rgba(166,240,0,0.2), transparent 62%)" }} />
      <div aria-hidden className="pointer-events-none absolute -bottom-48 end-[-15%] h-[460px] w-[620px] rounded-full blur-[130px]" style={{ background: "radial-gradient(circle, rgba(240,198,60,0.12), transparent 62%)" }} />

      {COUPONS.map((c, i) => (
        <div
          key={i}
          aria-hidden
          className="pointer-events-none absolute transition-transform duration-500 ease-out"
          style={{
            top: c.top,
            insetInlineEnd: c.end,
            transform: `translate3d(calc(var(--px, 0) * ${c.depth}px), calc(var(--py, 0) * ${c.depth}px), 0) rotate(${c.r}deg)`,
            filter: c.blur ? `blur(${c.blur}px)` : undefined,
            opacity: c.blur ? 0.8 : 1,
          }}
        >
          <div className="motion-safe:animate-[app-coupon_var(--d)_ease-in-out_infinite]" style={{ "--d": `${c.dur}s`, animationDelay: `${c.delay || 0}s` }}>
            <MiniTicket color={c.color} to={c.to} w={c.w} />
          </div>
        </div>
      ))}

      <div className="relative">
        <Logo />
      </div>

      <h2 className="relative max-w-[560px] text-balance text-[clamp(36px,3.5vw,54px)] font-black leading-[1.12] tracking-tight text-[var(--text)]">
        <span className="block">{t("hero.titleLine1")}</span>
        <span className="block">{t("hero.titleLine2")}</span>
      </h2>

      {numbers.length > 0 && (
        <dl className="relative flex flex-wrap items-stretch border-t border-dashed border-[var(--color-ink-line)] pt-7">
          {numbers.map((n, i) => (
            <div key={n.key} className={`min-w-[120px] flex-1 ${i ? "border-s border-dashed border-[var(--color-ink-line)] ps-6" : ""} pe-6`}>
              <dt className="sr-only">{n.label}</dt>
              <dd>
                <bdi className={`inline-block text-[34px] font-black leading-none tracking-tight [font-family:Inter,sans-serif] ${n.gold ? "text-[#ffe486]" : "text-[var(--text)]"}`}>{n.value}</bdi>
                <span aria-hidden className="mt-2 block text-[13px] font-semibold leading-snug text-[var(--color-mute)]">
                  {n.label}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </aside>
  );
}

/**
 * إطار موحّد لصفحات الحساب (دخول/تسجيل/استعادة/إعادة تعيين).
 * الحاسوب: شاشة مقسومة — النموذج في جهة، ولوحة هوية CODpromo في الجهة الأخرى.
 * الهاتف: النموذج فقط، مع شريط هوية صغير في الأعلى (اللوغو + العنوان).
 */
export default function AuthShell({ title, subtitle, children, footer }) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen w-full overflow-x-clip bg-[var(--color-ink)] text-[var(--text)] lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)]">
      {/* ===== جهة النموذج ===== */}
      <div className="relative flex min-h-screen flex-col">
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-24 h-[360px] w-[520px] max-w-[100vw] -translate-x-1/2 rounded-full blur-[120px] lg:hidden" style={{ background: "radial-gradient(circle, rgba(166,240,0,0.13), transparent 65%)" }} />

        {/* رجوع + لغة */}
        <div className="relative z-10 mx-auto flex w-full max-w-md items-center justify-between px-4 pt-5 lg:max-w-none lg:px-12">
          <Link to="/" className="group inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--color-mute)] transition-colors hover:text-[var(--text)]">
            <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5 ltr:rotate-180 ltr:group-hover:-translate-x-0.5" />
            {t("auth.backToSite")}
          </Link>
          <LanguageSwitcher />
        </div>

        {/* شريط الهوية (الهاتف) */}
        <div className="relative mx-auto mt-6 w-full max-w-md px-4 lg:hidden">
          <div className="border-b border-dashed border-[var(--color-ink-line)] pb-5">
            <Logo compact />
            <p className="mt-3 text-balance text-[17px] font-black leading-snug text-[var(--text-softer)]">
              {t("hero.titleLine1")} {t("hero.titleLine2")}
            </p>
          </div>
        </div>

        <main className="relative flex flex-1 items-center justify-center px-4 pb-12 pt-7 lg:px-12 lg:py-14">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="w-full min-w-0 max-w-[420px]"
          >
            <div className="mb-7">
              <h1 className="text-[28px] font-black leading-tight tracking-tight sm:text-[32px]">{title}</h1>
              {subtitle && <p className="mt-2 text-[14.5px] leading-relaxed text-[var(--text-soft)]">{subtitle}</p>}
            </div>

            {children}

            {footer && <div className="mt-7 border-t border-dashed border-[var(--color-ink-line)] pt-5 text-[13.5px] text-[var(--color-mute)]">{footer}</div>}
          </motion.div>
        </main>
      </div>

      {/* ===== لوحة الهوية (الحاسوب) ===== */}
      <IdentityPanel />
    </div>
  );
}

/** تنبيه ملوّن (خطأ/نجاح) داخل صفحات الحساب. */
export function AuthAlert({ type = "error", children }) {
  const error = type === "error";
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        role={error ? "alert" : "status"}
        className="mb-4 flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-[13px] font-semibold"
        style={{
          borderColor: error ? "rgba(239,68,68,0.3)" : "rgba(166,240,0,0.35)",
          background: error ? "rgba(239,68,68,0.08)" : "rgba(166,240,0,0.08)",
          color: error ? "#f87171" : "var(--accent-text)",
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
