// ============================================================
//  CODpromo — قسم الأسئلة الشائعة (أكورديون) في صفحة الشركة
//  المحتوى من جدول company_faqs (يُدار من تبويب SEO في الأدمن).
// ============================================================

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, HelpCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function FaqSection({ faqs, lang }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(0);

  const items = (faqs || [])
    .map((f) => ({
      q: (lang !== "ar" && f[`question_${lang}`]) || f.question,
      a: (lang !== "ar" && f[`answer_${lang}`]) || f.answer,
    }))
    .filter((f) => f.q && f.a);

  if (items.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="mb-4 flex items-center gap-2 text-[20px] font-black tracking-tight sm:text-[22px]">
        <HelpCircle size={20} className="text-[var(--accent-text)]" />
        {t("store.faqTitle")}
      </h2>
      <div className="flex flex-col gap-2.5">
        {items.map((f, i) => {
          const isOpen = open === i;
          return (
            <div
              key={i}
              className="overflow-hidden rounded-2xl border border-[var(--color-ink-line)] bg-[var(--color-ink-card)]"
            >
              <button
                onClick={() => setOpen(isOpen ? -1 : i)}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-start"
                aria-expanded={isOpen}
              >
                <span className="text-[14.5px] font-bold text-[var(--text)]">{f.q}</span>
                <ChevronDown
                  size={18}
                  className={`shrink-0 text-[var(--color-mute)] transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <p className="px-5 pb-4 text-[13.5px] leading-[1.7] text-[var(--text-soft)]">{f.a}</p>
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
