import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { offersPath } from "../../lib/seo.js";

/**
 * 5.12 — دعوة أخيرة: جملة "عادة" على طريقة "قبل ما تدفع، افتح…" داخل تذكرة كبيرة
 * بزر واحد للعروض (زر Premium موجود مباشرة تحتها في الفوتر الحالي).
 */
export default function FinalCta() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  return (
    <section className="mx-auto max-w-6xl px-4 pb-10 pt-12">
      <div className="ticket" style={{ "--r": "18px", "--edge-base": "rgba(166,240,0,0.35)", "--perf": "rgba(166,240,0,0.45)", "--stub": "rgba(166,240,0,0.06)" }}>
        <div className="ticket-top relative overflow-hidden bg-[var(--color-ink-card)] px-6 pb-10 pt-14 text-center sm:px-12">
          <span aria-hidden className="ticket-ring ticket-ring-l" />
          <span aria-hidden className="ticket-ring ticket-ring-r" />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(60% 80% at 50% 0%, rgba(166,240,0,0.16), transparent 70%)" }}
          />
          <h2 className="relative mx-auto max-w-3xl text-balance text-[32px] font-black leading-[1.15] tracking-tight sm:text-[48px]">
            {t("finalCta.title")}
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-[16px] leading-[1.7] text-[var(--text-soft)] sm:text-[17px]">{t("finalCta.sub")}</p>
        </div>
        <div className="ticket-stub relative bg-[var(--color-ink-card)] px-6 pb-8 pt-7">
          <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "var(--stub)" }} />
          <span aria-hidden className="ticket-ring ticket-ring-l" />
          <span aria-hidden className="ticket-ring ticket-ring-r" />
          <span aria-hidden className="ticket-perf" />
          <div className="relative flex flex-wrap items-center justify-center gap-3">
            <Link to={offersPath(lang)}>
              <motion.span
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="group relative flex items-center gap-2 overflow-hidden rounded-2xl px-7 py-4 text-[16px] font-extrabold text-[#0a0a0a] shadow-[0_14px_40px_-12px_rgba(166,240,0,0.6)]"
                style={{ background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" }}
              >
                <span className="absolute inset-0 -translate-x-full bg-white/30 transition-transform duration-500 group-hover:translate-x-full" />
                <span className="relative">{t("finalCta.cta")}</span>
                <ArrowLeft size={18} className="relative ltr:rotate-180" />
              </motion.span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
