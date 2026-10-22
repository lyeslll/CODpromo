import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Building2, ClipboardEdit, MessageCircle, Target, Megaphone, Crown, BarChart3, Ticket, Link2, ChevronDown, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import Navbar from "../components/Navbar.jsx";
import Footer from "../components/Footer.jsx";
import Seo from "../components/Seo.jsx";
import SectionHead from "../components/landing/SectionHead.jsx";
import IssuingCoupon from "../components/partners/IssuingCoupon.jsx";
import { useSharedStats } from "../components/header/headerData.js";
import { useAuth } from "../lib/auth.jsx";
import { buildAlternates, partnersUrl, homeUrl, SITE_URL } from "../lib/seo.js";
import { formatNumber } from "../lib/values.js";

const LIME = "#a6f000";
const GOLD = "#f0c63c";
const FAQ_KEYS = ["cost", "who", "time", "codes", "edit", "stats", "commission"];

/** رقم مختصر حسب اللغة (855 ألف / 855K / 855 k). */
function compact(n, lang) {
  try {
    return new Intl.NumberFormat(lang === "ar" ? "ar-u-nu-latn" : lang, { notation: "compact", maximumFractionDigits: 1 }).format(n);
  } catch {
    return formatNumber(n, lang);
  }
}

/** وجهة زر "سجّل شركتك": حساب شركة → فورم العرض؛ غير مسجّل → إنشاء حساب شركة. */
function useJoinTarget() {
  const { user, accountType } = useAuth();
  if (user && accountType === "company") return "/dashboard/offers/new";
  return "/signup?type=company";
}

/** بوابة الشركات العامة: لماذا CODpromo، كيف يعمل، ماذا نطلب، أسئلة شائعة. */
export default function PartnersPage({ lang = "ar" }) {
  const { t } = useTranslation();
  const stats = useSharedStats();
  const join = useJoinTarget();
  const canonical = partnersUrl(lang);

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_KEYS.map((k) => ({ "@type": "Question", name: t(`partners.faq.${k}.q`), acceptedAnswer: { "@type": "Answer", text: t(`partners.faq.${k}.a`) } })),
  };
  const jsonLd = [
    { "@context": "https://schema.org", "@type": "WebPage", name: t("partners.seo.title"), description: t("partners.seo.description"), url: canonical, inLanguage: lang },
    faqLd,
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: t("store.breadcrumbHome"), item: homeUrl(lang) },
        { "@type": "ListItem", position: 2, name: t("partners.breadcrumb"), item: canonical },
      ],
    },
  ];

  const audience = stats?.audienceFollowers ? compact(stats.audienceFollowers, lang) : null;
  const numbers = [
    { key: "users", value: stats?.usersCount },
    { key: "codes", value: stats?.totalCodes },
    { key: "partners", value: stats?.partnersCount },
    { key: "audience", value: stats?.audienceFollowers, compact: true },
  ].filter((n) => n.value != null);

  return (
    <div className="min-h-screen text-[var(--text)]">
      <Seo lang={lang} title={t("partners.seo.title")} description={t("partners.seo.description")} canonical={canonical} alternates={buildAlternates("partners")} jsonLd={jsonLd} image={`${SITE_URL}/logo-dark.png`} />
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(55% 60% at 70% 35%, ${LIME}1a, transparent 70%)` }} />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-[120px] sm:pt-[140px] lg:grid-cols-[1.1fr_0.9fr] lg:pb-24">
          <div>
            <h1 className="text-balance text-[38px] font-black leading-[1.08] tracking-tight sm:text-[54px] lg:text-[62px]">{t("partners.hero.title")}</h1>
            <p className="mt-5 max-w-xl text-[17px] leading-[1.8] text-[var(--text-soft)] sm:text-[18px]">{t("partners.hero.sub")}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to={join} className="inline-flex items-center gap-2 rounded-2xl px-6 py-3.5 text-[16px] font-extrabold text-[#0a0a0a] transition-transform hover:scale-[1.02]" style={{ background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))", boxShadow: `0 16px 40px -18px ${LIME}` }}>
                <Building2 size={18} /> {t("partners.cta")}
              </Link>
              <a href="#partners-how" className="rounded-2xl border border-[var(--color-ink-line)] px-5 py-3.5 text-[15px] font-bold text-[var(--text)] transition-colors hover:bg-[var(--fill)]">
                {t("partners.hero.how")}
              </a>
            </div>
            <p className="mt-4 text-[13px] text-[var(--color-mute)]">{t("partners.hero.free")}</p>
          </div>
          <div className="flex justify-center lg:justify-end">
            <IssuingCoupon audience={audience} />
          </div>
        </div>
      </section>

      {/* الأرقام: شريط إيصال */}
      {numbers.length > 0 && (
        <section className="mx-auto max-w-6xl px-4" aria-label={t("partners.numbers.label")}>
          <dl className="grid grid-cols-2 overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] lg:grid-cols-4">
            {numbers.map((n, i) => (
              <div key={n.key} className={`p-5 sm:p-7 ${i % 2 ? "border-s border-dashed border-[var(--color-ink-line)]" : ""} ${i >= 2 ? "border-t border-dashed border-[var(--color-ink-line)] lg:border-t-0" : ""} ${i === 2 ? "lg:border-s" : ""}`}>
                <dd className="text-[32px] font-black leading-none tabular-nums sm:text-[42px]" style={n.key === "audience" ? { color: LIME } : undefined}>
                  {n.compact ? compact(n.value, lang) : formatNumber(n.value, lang)}
                </dd>
                <dt className="mt-2 text-[13.5px] font-semibold text-[var(--text-soft)]">{t(`partners.numbers.${n.key}`)}</dt>
              </div>
            ))}
          </dl>
        </section>
      )}

      <WhySection />
      <HowSection join={join} />
      <AskSection />
      <FaqSection />

      {/* CTA أخير */}
      <section className="mx-auto max-w-6xl px-4 pb-24">
        <div className="ticket relative" style={{ "--edge-base": `${LIME}55`, "--perf": `${LIME}88` }}>
          <div className="ticket-top relative px-6 py-10 text-center sm:px-12" style={{ background: `radial-gradient(70% 90% at 50% 0%, ${LIME}1f, transparent 70%), var(--color-ink-card)` }}>
            <h2 className="mx-auto max-w-2xl text-balance text-[28px] font-black leading-tight sm:text-[38px]">{t("partners.final.title")}</h2>
            <p className="mx-auto mt-3 max-w-xl text-[15.5px] leading-[1.8] text-[var(--text-soft)]">{t("partners.final.sub")}</p>
          </div>
          <div className="ticket-stub relative flex flex-wrap items-center justify-center gap-3 px-6 py-6" style={{ background: `${LIME}0a` }}>
            <span className="ticket-ring ticket-ring-l" />
            <span className="ticket-ring ticket-ring-r" />
            <span className="ticket-perf" />
            <Link to={join} className="inline-flex items-center gap-2 rounded-2xl px-6 py-3.5 text-[16px] font-extrabold text-[#0a0a0a]" style={{ background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" }}>
              <Building2 size={18} /> {t("partners.cta")}
            </Link>
          </div>
        </div>
      </section>

      <Footer showCta={false} />
    </div>
  );
}

function WhySection() {
  const { t } = useTranslation();
  const items = [
    { key: "audience", icon: Target, color: LIME, big: true },
    { key: "ilyes", icon: Megaphone, color: "#38bdf8" },
    { key: "premium", icon: Crown, color: GOLD },
    { key: "dashboard", icon: BarChart3, color: "#fbbf24" },
  ];
  return (
    <section className="mx-auto max-w-6xl px-4 py-24 sm:py-28">
      <SectionHead title={t("partners.why.title")} sub={t("partners.why.sub")} />
      <div className="mt-12 grid gap-4 md:grid-cols-3 md:grid-rows-2">
        {items.map((it) => (
          <article
            key={it.key}
            className={`rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] p-6 sm:p-7 ${it.big ? "md:row-span-2 md:flex md:flex-col md:justify-between" : ""} ${it.key === "dashboard" ? "md:col-span-2" : ""}`}
            style={it.big ? { background: `linear-gradient(170deg, ${LIME}14, transparent 55%), var(--color-ink-card)` } : undefined}
          >
            <span className="grid h-12 w-12 place-items-center rounded-2xl" style={{ background: `${it.color}1a`, color: it.color }}>
              <it.icon size={22} />
            </span>
            <div className={it.big ? "mt-10" : "mt-5"}>
              <h3 className={`font-black text-[var(--text)] ${it.big ? "text-[24px] sm:text-[28px]" : "text-[19px]"}`}>{t(`partners.why.${it.key}.title`)}</h3>
              <p className="mt-2 text-[15px] leading-[1.75] text-[var(--text-soft)]">{t(`partners.why.${it.key}.desc`)}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

const STEPS = [
  { key: "s1", icon: Building2, at: 0.12 },
  { key: "s2", icon: ClipboardEdit, at: 0.48 },
  { key: "s3", icon: MessageCircle, at: 0.84 },
];

/** ثلاث خطوات متتابعة (ترقيم حقيقي): خط يمتلئ مع التمرير ويُفعّل كل خطوة يصلها. */
function HowSection({ join }) {
  const { t, i18n } = useTranslation();
  const reduced = useReducedMotion();
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.75", "end 0.55"] });
  const fill = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const [reached, setReached] = useState(reduced ? STEPS.length : 0);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    if (reduced) return;
    const r = STEPS.filter((s) => v >= s.at).length;
    setReached((prev) => (prev === r ? prev : r));
  });

  return (
    <section id="partners-how" ref={ref} className="mx-auto max-w-6xl scroll-mt-24 px-4 py-24 sm:py-28">
      <SectionHead title={t("partners.how.title")} sub={t("partners.how.sub")} />
      <div className="relative mt-14">
        <div aria-hidden className="absolute inset-x-[16%] top-[26px] hidden h-[2px] bg-[var(--color-ink-line)] md:block">
          <motion.div className="h-full bg-[var(--color-lime)]" style={{ scaleX: reduced ? 1 : fill, transformOrigin: i18n.language === "ar" ? "right" : "left" }} />
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
                  style={{ borderColor: on ? "var(--color-lime)" : "var(--color-ink-line)", background: on ? "var(--color-lime)" : "var(--color-ink)", color: on ? "#0a0a0a" : "var(--text-softer)" }}
                  animate={on && !reduced ? { scale: [1, 1.12, 1] } : { scale: 1 }}
                  transition={{ duration: 0.45 }}
                >
                  {i + 1}
                </motion.span>
                <div className="md:mt-6">
                  <div className="flex items-center gap-2 md:justify-center">
                    <s.icon size={18} className={on ? "text-[var(--accent-text)]" : "text-[var(--color-mute)]"} />
                    <h3 className="text-[20px] font-black text-[var(--text)]">{t(`partners.how.${s.key}.title`)}</h3>
                  </div>
                  <p className="mt-2 max-w-sm text-[15px] leading-[1.7] text-[var(--text-soft)] transition-opacity duration-500 md:mx-auto" style={{ opacity: on ? 1 : 0.55 }}>
                    {t(`partners.how.${s.key}.desc`)}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
        <div className="mt-12 flex justify-center">
          <Link to={join} className="inline-flex items-center gap-2 rounded-2xl border border-[var(--color-lime)]/50 px-5 py-3 text-[15px] font-extrabold text-[var(--accent-text)] transition-colors hover:bg-[var(--color-lime)]/10">
            <Building2 size={17} /> {t("partners.cta")}
          </Link>
        </div>
      </div>
    </section>
  );
}

/** ماذا نطلب: ثلاثة كعوب كوبون (عادي / Premium ذهبي / إحالة اختيارية). */
function AskSection() {
  const { t } = useTranslation();
  const items = [
    { key: "normal", icon: Ticket, color: LIME, sample: "ILYES10" },
    { key: "premium", icon: Crown, color: GOLD, sample: "ILY-X7Q9" },
    { key: "referral", icon: Link2, color: "#38bdf8", sample: null },
  ];
  return (
    <section className="mx-auto max-w-6xl px-4 pb-24 sm:pb-28">
      <SectionHead title={t("partners.ask.title")} sub={t("partners.ask.sub")} />
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {items.map((it) => (
          <div key={it.key} className="ticket relative" style={{ "--edge-base": `${it.color}55`, "--perf": `${it.color}80` }}>
            <div className="ticket-top relative p-6" style={{ background: `linear-gradient(160deg, ${it.color}14, transparent 60%), var(--color-ink-card)` }}>
              <div className="flex items-center justify-between gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: `${it.color}1a`, color: it.color }}>
                  <it.icon size={20} />
                </span>
                {it.key === "referral" && <span className="rounded-full border border-[var(--color-ink-line)] px-2.5 py-1 text-[12px] font-bold text-[var(--color-mute)]">{t("partners.ask.optional")}</span>}
              </div>
              <h3 className="mt-5 text-[19px] font-black text-[var(--text)]">{t(`partners.ask.${it.key}.title`)}</h3>
              <p className="mt-2 text-[14.5px] leading-[1.75] text-[var(--text-soft)]">{t(`partners.ask.${it.key}.desc`)}</p>
            </div>
            <div className="ticket-stub relative px-6 py-4" style={{ background: `${it.color}0a` }}>
              <span className="ticket-ring ticket-ring-l" />
              <span className="ticket-ring ticket-ring-r" />
              <span className="ticket-perf" />
              {it.sample ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[12px] font-bold text-[var(--color-mute)]">{t("partners.ask.example")}</span>
                  <span className="font-mono text-[17px] font-black tracking-[0.1em]" style={{ color: it.color }} dir="ltr">
                    {it.sample}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-[13px] text-[var(--text-soft)]">
                  <Lock size={14} style={{ color: it.color }} /> {t("partners.ask.private")}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FaqSection() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(FAQ_KEYS[0]);
  return (
    <section className="mx-auto max-w-3xl px-4 pb-24 sm:pb-28">
      <SectionHead title={t("partners.faq.title")} center />
      <div className="mt-10 divide-y divide-[var(--color-ink-line)] rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)]">
        {FAQ_KEYS.map((k) => {
          const isOpen = open === k;
          return (
            <div key={k}>
              <h3>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : k)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-${k}`}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-start text-[16px] font-extrabold text-[var(--text)] sm:px-6"
                >
                  {t(`partners.faq.${k}.q`)}
                  <ChevronDown size={18} className={`shrink-0 text-[var(--color-mute)] transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
              </h3>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div id={`faq-${k}`} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                    <p className="px-5 pb-5 text-[15px] leading-[1.8] text-[var(--text-soft)] sm:px-6">{t(`partners.faq.${k}.a`)}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </section>
  );
}
