import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { ArrowLeft, Crown } from "lucide-react";
import { useTranslation } from "react-i18next";
import CompanyCard from "../CompanyCard.jsx";
import GoldBurst from "../GoldBurst.jsx";
import SectionHead from "./SectionHead.jsx";
import { offersPath } from "../../lib/seo.js";

// أجزاء البطاقة (data-part داخل CompanyCard) بترتيب القراءة، وجهة كل شرح على الحاسوب
// = نفس جهة الجزء في البطاقة (القلب والشارة جهة end، القيمة والكود جهة start).
const PARTS = [
  { part: "fav", side: "end" },
  { part: "premium-badge", side: "end" },
  { part: "value", side: "start" },
  { part: "code", side: "start" },
  { part: "visit", side: "end" },
  { part: "vote", side: "start" },
];

/**
 * 5.6 — تشريح البطاقة: كوبون حقيقي في الوسط، وإشارات متحركة تشرح كل جزء.
 * الخطوط تُرسم من مواقع الأجزاء الفعلية (قياس DOM)، فتبقى دقيقة بكل اللغات والمقاسات.
 */
export default function CardAnatomy({ company, isFavorite, onToggleFav, onCopy, unlocked, onUnlock }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const reduced = useReducedMotion();
  const wrapRef = useRef(null);
  const cardRef = useRef(null);
  const calloutRefs = useRef({});
  const inView = useInView(wrapRef, { once: true, margin: "-120px" });
  const [premium, setPremium] = useState(false);
  const [burst, setBurst] = useState(0);
  const [geo, setGeo] = useState({ parts: {}, callouts: {}, w: 0, h: 0, desktop: false });
  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState(null);

  const measure = useCallback(() => {
    const wrap = wrapRef.current;
    const card = cardRef.current;
    if (!wrap || !card) return;
    const W = wrap.getBoundingClientRect();
    const rtl = lang === "ar";
    const parts = {};
    for (const { part, side } of PARTS) {
      const el = card.querySelector(`[data-part="${part}"]`);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      // نقطة على حافة الجزء المواجهة للشرح
      const towardRight = (side === "start") === rtl;
      parts[part] = {
        x: (towardRight ? r.right - 6 : r.left + 6) - W.left,
        y: r.top + r.height / 2 - W.top,
        cx: r.left + r.width / 2 - W.left,
      };
    }
    const callouts = {};
    for (const { part } of PARTS) {
      const el = calloutRefs.current[part];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const onRight = r.left + r.width / 2 > W.left + W.width / 2;
      callouts[part] = { x: (onRight ? r.left : r.right) - W.left, y: r.top + 22 - W.top };
    }
    setGeo({ parts, callouts, w: W.width, h: W.height, desktop: window.matchMedia("(min-width: 1024px)").matches });
  }, [lang]);

  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(() => measure());
    if (wrapRef.current) ro.observe(wrapRef.current);
    if (cardRef.current) ro.observe(cardRef.current);
    const id = setTimeout(measure, 700); // بعد حركة ظهور البطاقة
    return () => {
      ro.disconnect();
      clearTimeout(id);
    };
  }, [measure, premium, company?.id]);

  // إبراز الأجزاء بالتتابع (يتوقف عند المرور على شرح)
  useEffect(() => {
    if (!inView || reduced || hovered != null) return;
    const id = setInterval(() => setActive((a) => (a + 1) % PARTS.length), 2300);
    return () => clearInterval(id);
  }, [inView, reduced, hovered]);

  if (!company) return null;
  const current = hovered ?? PARTS[active].part;

  const togglePremium = () => {
    setPremium((p) => {
      if (!p) setBurst((b) => b + 1);
      return !p;
    });
  };

  const callout = (p, i, measured = true) => {
    const on = current === p.part;
    const disabled = p.part === "premium-badge" && !premium;
    return (
      <li
        key={p.part}
        ref={measured ? (el) => (calloutRefs.current[p.part] = el) : undefined}
        onMouseEnter={() => setHovered(p.part)}
        onMouseLeave={() => setHovered(null)}
        className="relative flex gap-3 rounded-2xl border p-4 transition-colors duration-300"
        style={{
          borderColor: on ? "rgba(166,240,0,0.45)" : "var(--color-ink-line)",
          background: on ? "rgba(166,240,0,0.06)" : "var(--color-ink-card)",
          opacity: disabled ? 0.55 : 1,
        }}
      >
        <span
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[13px] font-black transition-colors"
          style={{ background: on ? "var(--color-lime)" : "var(--fill-strong)", color: on ? "#0a0a0a" : "var(--text-softer)" }}
        >
          {i + 1}
        </span>
        <div className="min-w-0">
          <h3 className="text-[15px] font-extrabold text-[var(--text)]">{t(`anatomy.parts.${p.part}.title`)}</h3>
          <p className="mt-1 text-[13.5px] leading-[1.6] text-[var(--text-soft)]">{t(`anatomy.parts.${p.part}.desc`)}</p>
          {p.part === "premium-badge" && (
            <button
              type="button"
              onClick={togglePremium}
              className="relative mt-2.5 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-extrabold text-[#0a0a0a]"
              style={{ background: premium ? "var(--fill-strong)" : "linear-gradient(135deg,#ffe486,#cf9a1e)", color: premium ? "var(--text)" : "#0a0a0a" }}
            >
              <Crown size={13} /> {premium ? t("anatomy.showNormal") : t("anatomy.showPremium")}
              <GoldBurst fire={burst} count={14} />
            </button>
          )}
        </div>
      </li>
    );
  };

  const indexOf = (part) => PARTS.findIndex((p) => p.part === part);

  return (
    <section className="mx-auto max-w-6xl px-4 py-24 sm:py-28">
      <SectionHead title={t("anatomy.title")} sub={t("anatomy.sub")} />

      <div ref={wrapRef} className="relative mt-12 grid items-center gap-6 lg:grid-cols-[1fr_minmax(330px,370px)_1fr] lg:gap-10">
        <ol className="hidden flex-col gap-3 lg:flex">{PARTS.filter((p) => p.side === "start").map((p) => callout(p, indexOf(p.part)))}</ol>

        <div ref={cardRef} className="mx-auto w-full max-w-[370px]">
          <CompanyCard
            company={company}
            index={0}
            isFavorite={isFavorite}
            onToggleFav={onToggleFav}
            onCopy={onCopy}
            premium={premium && company.supports_premium !== false}
            unlocked={unlocked}
            onUnlock={onUnlock}
            freeKey={false}
          />
        </div>

        <ol className="hidden flex-col gap-3 lg:flex">
          {PARTS.filter((p) => p.side === "end").map((p) => callout(p, indexOf(p.part)))}
        </ol>

        {/* الهاتف/اللوح: قائمة واحدة مرتّبة تحت البطاقة */}
        <ol className="flex flex-col gap-3 lg:hidden">{PARTS.map((p, i) => callout(p, i, false))}</ol>

        {/* الخطوط (حاسوب) + نقاط مرقّمة فوق الأجزاء (كل المقاسات) */}
        <svg className="pointer-events-none absolute inset-0 hidden h-full w-full overflow-visible lg:block" aria-hidden>
          {geo.desktop &&
            PARTS.map((p) => {
              const a = geo.callouts[p.part];
              const b = geo.parts[p.part];
              if (!a || !b) return null;
              if (p.part === "premium-badge" && !premium) return null;
              const on = current === p.part;
              const mx = (a.x + b.x) / 2;
              const d = `M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`;
              return (
                <motion.path
                  key={`${p.part}-${premium}`}
                  d={d}
                  fill="none"
                  stroke={on ? "#a6f000" : "rgba(255,255,255,0.2)"}
                  strokeWidth={on ? 2 : 1.25}
                  initial={reduced ? false : { pathLength: 0 }}
                  animate={{ pathLength: inView ? 1 : 0 }}
                  transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: reduced ? 0 : indexOf(p.part) * 0.08 }}
                />
              );
            })}
        </svg>
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {PARTS.map((p) => {
            const b = geo.parts[p.part];
            if (!b) return null;
            const on = current === p.part;
            return (
              <span
                key={p.part}
                className="absolute grid h-5 w-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-[10px] font-black transition-colors"
                style={{
                  left: b.x,
                  top: b.y,
                  background: on ? "#a6f000" : "rgba(10,10,10,0.85)",
                  color: on ? "#0a0a0a" : "#c9c9cf",
                  boxShadow: on ? "0 0 0 6px rgba(166,240,0,0.18)" : "0 0 0 1px rgba(255,255,255,0.18)",
                }}
              >
                {indexOf(p.part) + 1}
              </span>
            );
          })}
        </div>
      </div>

      <div className="mt-10 flex justify-center">
        <Link
          to={offersPath(lang)}
          className="group inline-flex items-center gap-2 rounded-2xl border border-[var(--color-lime)]/45 px-6 py-3 text-[15px] font-extrabold text-[var(--accent-text)] transition-colors hover:bg-[var(--color-lime)]/10"
        >
          {t("anatomy.cta")}
          <ArrowLeft size={17} className="transition-transform group-hover:-translate-x-0.5 ltr:rotate-180 ltr:group-hover:translate-x-0.5" />
        </Link>
      </div>
    </section>
  );
}
