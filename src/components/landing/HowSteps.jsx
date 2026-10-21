import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowLeft, Copy, Search, BadgePercent } from "lucide-react";
import { useTranslation } from "react-i18next";
import SectionHead from "./SectionHead.jsx";
import { offersPath } from "../../lib/seo.js";

const STEPS = [
  { key: "s1", icon: Search, at: 0.12 },
  { key: "s2", icon: Copy, at: 0.48 },
  { key: "s3", icon: BadgePercent, at: 0.84 },
];

/**
 * 5.9 — مجاني + كيف يعمل: ثلاث خطوات متتابعة (ترقيم حقيقي لأنها تسلسل)،
 * وخط تقدّم يمتلئ مع التمرير ويُفعّل كل خطوة حين يصلها. الرابط القديم #how يبقى يعمل.
 */
export default function HowSteps() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const reduced = useReducedMotion();
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.75", "end 0.55"] });
  const fill = useTransform(scrollYProgress, [0, 1], [0, 1]);
  // عدد الخطوات التي وصلها الخط (نحدّث الحالة فقط عند عبور خطوة)
  const [reached, setReached] = useState(reduced ? STEPS.length : 0);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    if (reduced) return;
    const r = STEPS.filter((s) => v >= s.at).length;
    setReached((prev) => (prev === r ? prev : r));
  });

  return (
    <section id="how" ref={ref} className="mx-auto max-w-6xl scroll-mt-24 px-4 py-24 sm:py-28">
      <SectionHead title={t("how.title")} sub={t("how.sub")} />

      <div className="relative mt-14">
        {/* خط التقدّم: أفقي على الحاسوب، عمودي على الهاتف */}
        <div aria-hidden className="absolute inset-x-[16%] top-[26px] hidden h-[2px] bg-[var(--color-ink-line)] md:block">
          <motion.div
            className="h-full origin-[var(--origin)] bg-[var(--color-lime)]"
            style={{ scaleX: reduced ? 1 : fill, "--origin": lang === "ar" ? "right" : "left" }}
          />
        </div>
        <div aria-hidden className="absolute bottom-6 top-6 w-[2px] bg-[var(--color-ink-line)] ltr:left-[26px] rtl:right-[26px] md:hidden">
          <motion.div className="w-full origin-top bg-[var(--color-lime)]" style={{ scaleY: reduced ? 1 : fill, height: "100%" }} />
        </div>

        <ol className="relative grid gap-10 md:grid-cols-3 md:gap-6">
          {STEPS.map((s, i) => {
            const on = i < reached;
            return (
              <li key={s.key} className="relative flex gap-5 md:flex-col md:items-center md:gap-0 md:text-center">
                <motion.span
                  className="relative z-10 grid h-[54px] w-[54px] shrink-0 place-items-center rounded-full border-2 text-[20px] font-black transition-colors duration-300"
                  style={{
                    borderColor: on ? "var(--color-lime)" : "var(--color-ink-line)",
                    background: on ? "var(--color-lime)" : "var(--color-ink)",
                    color: on ? "#0a0a0a" : "var(--text-softer)",
                  }}
                  animate={on && !reduced ? { scale: [1, 1.12, 1] } : { scale: 1 }}
                  transition={{ duration: 0.45 }}
                >
                  {i + 1}
                </motion.span>
                <div className="md:mt-6">
                  <div className="flex items-center gap-2 md:justify-center">
                    <s.icon size={18} className={on ? "text-[var(--accent-text)]" : "text-[var(--color-mute)]"} />
                    <h3 className="text-[20px] font-black text-[var(--text)]">{t(`how.${s.key}.title`)}</h3>
                  </div>
                  <p
                    className="mt-2 max-w-sm text-[15px] leading-[1.7] text-[var(--text-soft)] transition-opacity duration-500 md:mx-auto"
                    style={{ opacity: on ? 1 : 0.55 }}
                  >
                    {t(`how.${s.key}.desc`)}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="mt-12 flex justify-center">
        <Link
          to={offersPath(lang)}
          className="group inline-flex items-center gap-2 rounded-2xl px-6 py-3.5 text-[15px] font-extrabold text-[#0a0a0a] transition-transform hover:scale-[1.02]"
          style={{ background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" }}
        >
          {t("how.cta")}
          <ArrowLeft size={17} className="transition-transform group-hover:-translate-x-0.5 ltr:rotate-180 ltr:group-hover:translate-x-0.5" />
        </Link>
      </div>
    </section>
  );
}
