import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import SectionHead from "./SectionHead.jsx";
import { formatPrice } from "../../lib/pricing.jsx";
import { formatNumber } from "../../lib/values.js";

/**
 * أسئلة Premium مدى الحياة (نفس النصوص في الواجهة وفي FAQPage JSON-LD للرئيسية).
 * السعر والمقاعد من pricing_public — بلا أرقام في الكود؛ قبل ما يوصل السعر، سؤال السعر يتخبّى.
 */
export function premiumFaqItems(t, lang, pricing) {
  const items = [{ k: "lifetime" }, { k: "price" }, { k: "renewal" }, { k: "refund" }, { k: "methods" }];
  return items
    .map(({ k }) => {
      if (k === "price") {
        if (!pricing) return null;
        const vars = {
          launch: formatPrice(t, lang, pricing.launchDzd, pricing.launchUsd),
          regular: formatPrice(t, lang, pricing.regularDzd, pricing.regularUsd),
          seats: formatNumber(pricing.seatsTotal, lang),
          left: formatNumber(pricing.seatsLeft, lang),
        };
        return { k, q: t("premiumFaq.price.q"), a: t(pricing.isLaunch ? "premiumFaq.price.aLaunch" : "premiumFaq.price.aRegular", vars) };
      }
      return { k, q: t(`premiumFaq.${k}.q`), a: t(`premiumFaq.${k}.a`) };
    })
    .filter(Boolean);
}

export default function PremiumFaq({ pricing }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [open, setOpen] = useState(0);
  const items = premiumFaqItems(t, lang, pricing);

  return (
    <section className="relative py-20 sm:py-24" aria-labelledby="premium-faq-title">
      <div className="mx-auto max-w-3xl px-4">
        <SectionHead id="premium-faq-title" title={t("premiumFaq.title")} sub={t("premiumFaq.sub")} />
        <div className="mt-10 flex flex-col gap-2.5">
          {items.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={f.k} className="overflow-hidden rounded-2xl border border-[var(--color-ink-line)] bg-[var(--color-ink-card)]">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  className="flex w-full items-center justify-between gap-3 px-5 py-4 text-start"
                  aria-expanded={isOpen}
                  aria-controls={`premium-faq-${f.k}`}
                >
                  <span className="text-[15px] font-bold text-[var(--text)]">{f.q}</span>
                  <ChevronDown size={18} className={`shrink-0 text-[var(--color-mute)] transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={`premium-faq-${f.k}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      <p className="px-5 pb-4 text-[14px] leading-[1.75] text-[var(--text-soft)]">
                        {f.a}
                        {f.k === "refund" && (
                          <>
                            {" "}
                            <Link to="/terms" className="font-bold text-[#ffe486] underline decoration-dotted underline-offset-4">
                              {t("pricing.terms")}
                            </Link>
                          </>
                        )}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
