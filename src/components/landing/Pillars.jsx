import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { ArrowLeft, Check, Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getTypeMeta } from "../../lib/types.js";
import { offersLink } from "../../lib/seo.js";
import { TYPE_PARAMS, topOfType } from "../../lib/offerFilters.js";
import { parseVal } from "../../lib/values.js";
import SectionHead from "./SectionHead.jsx";

/** عدّاد دورات للعروض الحيّة: يتقدّم كل period ما دام القسم ظاهراً (ثابت مع تقليل الحركة). */
function useLoop(inView, period = 3600) {
  const reduced = useReducedMotion();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!inView || reduced) return;
    const id = setInterval(() => setTick((x) => x + 1), period);
    return () => clearInterval(id);
  }, [inView, reduced, period]);
  return { tick, reduced };
}

const valueOf = (offer, lang) => (offer ? (lang !== "ar" && offer[`discount_${lang}`]) || offer.discount || "" : "");

/** تخفيض: جزء من "السعر" يُقصّ عند الخط المثقّب ويسقط. */
function DiscountDemo({ offer, color, inView, lang }) {
  const { tick, reduced } = useLoop(inView);
  const value = valueOf(offer, lang);
  const parsed = parseVal(value);
  const pct = parsed && parsed.suffix.trim() === "%" ? Math.min(Math.max(parsed.num, 5), 60) : 25;
  return (
    <div className="relative h-[92px]" aria-hidden>
      <div className="absolute inset-x-0 top-6 h-11 overflow-visible">
        <div className="absolute inset-y-0 start-0 rounded-s-xl" style={{ width: `${100 - pct}%`, background: `linear-gradient(90deg, ${color}33, ${color}55)` }} />
        <motion.div
          key={tick}
          className="absolute inset-y-0 end-0 rounded-e-xl"
          style={{ width: `${pct}%`, background: `${color}22`, borderInlineStart: `2px dashed ${color}` }}
          initial={reduced ? false : { opacity: 1, y: 0, rotate: 0 }}
          animate={reduced ? { opacity: 0.35 } : { opacity: [1, 1, 0], y: [0, 0, 34], rotate: [0, 0, 8] }}
          transition={{ duration: 1.6, times: [0, 0.45, 1], ease: "easeIn" }}
        />
        <motion.span
          key={`v-${tick}`}
          className="absolute -top-6 end-0 text-[15px] font-black"
          style={{ color }}
          initial={reduced ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduced ? 0 : 0.5, duration: 0.35 }}
        >
          <bdi>−{value}</bdi>
        </motion.span>
      </div>
    </div>
  );
}

/** كوبون: الكود يُكتب حرفاً حرفاً ثم يُختم "مُفعّل" مع قيمته. */
function CouponDemo({ offer, color, inView, lang, t }) {
  const { tick, reduced } = useLoop(inView, 4200);
  const code = offer?.code || "";
  const [typed, setTyped] = useState(reduced ? code.length : 0);
  useEffect(() => {
    if (reduced) {
      setTyped(code.length);
      return;
    }
    setTyped(0);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setTyped(i);
      if (i >= code.length) clearInterval(id);
    }, 110);
    return () => clearInterval(id);
  }, [tick, code, reduced]);
  const done = typed >= code.length && code.length > 0;
  return (
    <div className="relative flex h-[92px] items-center gap-3" aria-hidden>
      <div className="flex h-12 flex-1 items-center rounded-xl border border-dashed px-4" style={{ borderColor: `${color}66`, background: `${color}0f` }}>
        <span dir="ltr" className="font-mono text-[16px] font-extrabold tracking-[0.14em] text-[var(--text)]">
          {code.slice(0, typed)}
          {!done && <span className="ms-0.5 inline-block h-5 w-[2px] translate-y-1 animate-pulse" style={{ background: color }} />}
        </span>
      </div>
      <AnimatePresence>
        {done && (
          <motion.span
            key={`ok-${tick}`}
            initial={reduced ? false : { scale: 1.6, opacity: 0, rotate: -12 }}
            animate={{ scale: 1, opacity: 1, rotate: -6 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 18 }}
            className="flex shrink-0 items-center gap-1 rounded-lg border-2 px-2.5 py-1 text-[13px] font-black"
            style={{ borderColor: color, color }}
          >
            <Check size={14} strokeWidth={3} /> {t("pillars.coupon.applied")}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

/** كاش باك: المبلغ يطير ويرجع إلى المحفظة. */
function CashbackDemo({ offer, color, inView, lang }) {
  const { tick, reduced } = useLoop(inView);
  const value = valueOf(offer, lang);
  const boxRef = useRef(null);
  const [dist, setDist] = useState(200);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setDist(Math.max(el.offsetWidth - 96, 60)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const sign = lang === "ar" ? -1 : 1;
  return (
    <div ref={boxRef} className="relative flex h-[92px] items-center justify-between" aria-hidden>
      <span className="h-px flex-1 border-t border-dashed" style={{ borderColor: `${color}55` }} />
      <motion.span
        key={`w-${tick}`}
        className="relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl"
        style={{ background: `${color}1f`, color }}
        initial={false}
        animate={reduced ? {} : { scale: [1, 1, 1.18, 1] }}
        transition={{ duration: 1.5, times: [0, 0.62, 0.78, 1] }}
      >
        <Wallet size={26} />
      </motion.span>
      <motion.span
        key={`c-${tick}`}
        className="absolute top-1/2 rounded-full px-3 py-1 text-[14px] font-black text-[#0a0a0a]"
        style={{ background: color, insetInlineStart: 0 }}
        initial={reduced ? false : { x: 0, y: "-50%", opacity: 0, scale: 0.9 }}
        animate={
          reduced
            ? { y: "-50%", opacity: 1 }
            : { x: [0, sign * dist * 0.55, sign * dist], y: ["-50%", "-150%", "-50%"], opacity: [0, 1, 0], scale: [0.9, 1.05, 0.6] }
        }
        transition={{ duration: 1.2, ease: "easeInOut" }}
      >
        <bdi>+{value}</bdi>
      </motion.span>
    </div>
  );
}

const ITEMS = [
  { key: "discount", Demo: DiscountDemo },
  { key: "coupon", Demo: CouponDemo },
  { key: "cashback", Demo: CashbackDemo },
];

/**
 * 5.5 — الركائز الثلاث: تخفيض / كوبون / كاش باك، كل واحدة بلونها.
 * لوحة واحدة مقسّمة بخطوط مثقّبة (كعوب تذكرة)، وكل عرض حيّ مبني على عرض حقيقي.
 */
export default function Pillars({ companies, voteStats }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const ref = useRef(null);
  const inView = useInView(ref, { margin: "-80px" });

  return (
    <section ref={ref} className="mx-auto max-w-6xl px-4 py-24 sm:py-28">
      <SectionHead title={t("pillars.title")} sub={t("pillars.sub")} />
      <div className="mt-12 grid overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] lg:grid-cols-3">
        {ITEMS.map(({ key, Demo }, i) => {
          const meta = getTypeMeta(TYPE_PARAMS[key]);
          const offer = topOfType(companies, TYPE_PARAMS[key], voteStats);
          const Icon = meta.icon;
          return (
            <article
              key={key}
              className={`relative flex flex-col p-6 sm:p-7 ${i > 0 ? "border-t border-dashed border-[var(--color-ink-line)] lg:border-s lg:border-t-0" : ""}`}
            >
              <span aria-hidden className="absolute inset-x-0 top-0 h-[3px]" style={{ background: meta.color }} />
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: `${meta.color}1a`, color: meta.color }}>
                  <Icon size={21} />
                </span>
                <h3 className="text-[22px] font-black" style={{ color: meta.color }}>
                  {t(`types.${key}`)}
                </h3>
              </div>
              <p className="mt-4 min-h-[52px] text-[15px] leading-[1.7] text-[var(--text-soft)]">{t(`pillars.${key}.def`)}</p>
              <div className="mt-5">
                <Demo offer={offer} color={meta.color} inView={inView} lang={lang} t={t} />
                {offer && (
                  <p className="mt-1 text-[12px] font-semibold text-[var(--color-mute)]">{t("pillars.liveFrom", { name: offer.name })}</p>
                )}
              </div>
              <Link
                to={offersLink(lang, { type: key })}
                className="group mt-6 inline-flex items-center gap-1.5 self-start rounded-xl border px-4 py-2.5 text-[14px] font-extrabold transition-colors"
                style={{ borderColor: `${meta.color}55`, color: meta.color }}
              >
                {t(`pillars.${key}.cta`)}
                <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-0.5 ltr:rotate-180 ltr:group-hover:translate-x-0.5" />
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}
