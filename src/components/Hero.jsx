import { motion } from "framer-motion";
import { ArrowLeft, BadgeCheck, Star } from "lucide-react";
import { useTranslation, Trans } from "react-i18next";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
};

export default function Hero({ stats, onExplore }) {
  const { t } = useTranslation();
  return (
    <section className="relative overflow-hidden pt-28 pb-14 sm:pt-36 sm:pb-20">
      {/* ===== خلفية الأنيميشن ===== */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-grid" />
        {/* أورورا خضراء */}
        <div
          className="absolute left-1/2 top-[-10%] h-[460px] w-[680px] -translate-x-1/2 rounded-full blur-[110px] animate-[aurora_16s_ease-in-out_infinite]"
          style={{ background: "radial-gradient(circle, rgba(166,240,0,0.28), transparent 60%)" }}
        />
        <div
          className="absolute right-[8%] top-[20%] h-[320px] w-[320px] rounded-full blur-[100px] animate-[aurora_20s_ease-in-out_infinite_reverse]"
          style={{ background: "radial-gradient(circle, rgba(56,189,248,0.16), transparent 60%)" }}
        />
        <div
          className="absolute bottom-[-30%] left-1/2 h-[400px] w-[1000px] -translate-x-1/2 rounded-[50%] blur-[120px]"
          style={{ background: "radial-gradient(circle, rgba(166,240,0,0.10), transparent 65%)" }}
        />
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="mx-auto flex max-w-6xl flex-col items-center px-4 text-center"
      >
        {/* شارة علوية */}
        <motion.div variants={item}>
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-ink-line)] bg-[var(--fill)] px-3.5 py-1.5 text-[12.5px] font-semibold text-[var(--text-softer)] backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-lime)] opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--color-lime)]" />
            </span>
            {t("hero.badge")}
          </span>
        </motion.div>

        {/* العنوان */}
        <motion.h1
          variants={item}
          className="mt-6 text-balance px-2 text-[27px] font-black leading-[1.18] tracking-tight sm:text-[56px] sm:leading-[1.08] lg:text-[72px]"
        >
          {t("hero.titleStart")}{" "}
          <br className="hidden sm:block" />
          <span className="relative inline">
            <span className="shimmer-text glow-lime">{t("hero.titleHighlight")}</span>
            <span className="text-[var(--text)]">{t("hero.titleEnd")}</span>
          </span>
        </motion.h1>

        {/* الوصف */}
        <motion.p
          variants={item}
          className="mt-5 max-w-xl text-balance text-[16px] leading-relaxed text-[var(--text-soft)] sm:text-[18px]"
        >
          <Trans i18nKey="hero.desc" components={[<span className="font-bold text-[var(--text)]" />]} />
        </motion.p>

        {/* أزرار CTA */}
        <motion.div variants={item} className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <motion.button
            onClick={onExplore}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            className="group relative flex items-center gap-2 overflow-hidden rounded-2xl px-6 py-3.5 text-[15px] font-extrabold text-[#0a0a0a] shadow-[0_12px_40px_-10px_rgba(166,240,0,0.55)]"
            style={{
              background:
                "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))",
            }}
          >
            <span className="absolute inset-0 -translate-x-full bg-white/30 transition-transform duration-500 group-hover:translate-x-full" />
            <span className="relative">{t("hero.ctaExplore")}</span>
            <ArrowLeft size={18} className="relative transition-transform group-hover:-translate-x-1 ltr:rotate-180" />
          </motion.button>

          <a
            href="#how"
            className="rounded-2xl border border-[var(--color-ink-line)] bg-[var(--fill)] px-6 py-3.5 text-[15px] font-bold text-[var(--text)] backdrop-blur transition-colors hover:bg-[var(--fill-strong)]"
          >
            {t("hero.ctaHow")}
          </a>
        </motion.div>

        {/* الإحصائيات */}
        <motion.div
          variants={item}
          className="mt-12 grid w-full max-w-2xl grid-cols-3 gap-3 sm:gap-5"
        >
          <Stat value={stats.codes} label={t("hero.statCodes")} />
          <Stat value={stats.stores} label={t("hero.statStores")} suffix="+" />
          <Stat
            value={stats.rating}
            label={t("hero.statRating")}
            icon={<Star size={15} className="fill-[var(--color-lime)] text-[var(--color-lime)]" />}
          />
        </motion.div>

        {/* ثقة */}
        <motion.div
          variants={item}
          className="mt-6 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--color-mute)]"
        >
          <BadgeCheck size={15} className="text-[var(--color-lime)]" />
          {t("hero.trust")}
        </motion.div>
      </motion.div>
    </section>
  );
}

function Stat({ value, label, suffix = "", icon }) {
  return (
    <div className="rounded-2xl border border-[var(--color-ink-line)] bg-[var(--fill)] px-3 py-4 backdrop-blur transition-colors hover:border-[var(--color-lime)]/40">
      <div className="flex items-center justify-center gap-1 text-[26px] font-black leading-none text-[var(--text)] sm:text-[32px]">
        {icon}
        <span>
          {value}
          {suffix}
        </span>
      </div>
      <div className="mt-1.5 text-[12px] font-medium text-[var(--color-mute)] sm:text-[13px]">
        {label}
      </div>
    </div>
  );
}
