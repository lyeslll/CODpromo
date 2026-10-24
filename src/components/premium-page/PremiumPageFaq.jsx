import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import SectionHead from "../landing/SectionHead.jsx";
import { premiumFaqItems } from "../landing/PremiumFaq.jsx";

/**
 * أسئلة صفحة Premium = أسئلة الرئيسية (السعر الحيّ، التجديد، الاسترداد، طرق الدفع) + أسئلة الشراء.
 * appMode: "app" → جواب طرق الدفع = Google Play برك؛ "checking" → سؤال طرق الدفع يتخبّى حتى يتأكّد الكشف
 * (باش ما تبانش البوابات الأخرى داخل التطبيق ولو لحظة). نفس القائمة تولّد FAQPage JSON-LD.
 * withGoldenKey: المفتاح الذهبي شغّال (ماشي موقوف).
 */
export function premiumPageFaqItems(t, lang, pricing, appMode, withGoldenKey) {
  const base = premiumFaqItems(t, lang, pricing, appMode === "app").filter((f) => !(f.k === "methods" && appMode === "checking"));
  const extra = ["account", "frozen", "newCodes", ...(withGoldenKey ? ["goldenKey"] : []), "stork"].map((k) => ({
    k,
    q: t(`premiumPage.faq.${k}.q`),
    a: t(`premiumPage.faq.${k}.a`),
  }));
  // الترتيب: معنى مدى الحياة، السعر، الحساب، طرق الدفع، الاسترداد، التجديد، ثم الباقي
  const order = ["lifetime", "price", "account", "methods", "refund", "renewal", "frozen", "newCodes", "goldenKey", "stork"];
  return [...base, ...extra].sort((a, b) => order.indexOf(a.k) - order.indexOf(b.k));
}

export default function PremiumPageFaq({ items }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(0);

  return (
    <section className="py-20 sm:py-24" aria-labelledby="pp-faq-title">
      <div className="mx-auto max-w-3xl px-4">
        <SectionHead id="pp-faq-title" title={t("premiumPage.faq.title")} sub={t("premiumPage.faq.sub")} />
        <div className="mt-10 flex flex-col gap-2.5">
          {items.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={f.k} className="overflow-hidden rounded-2xl border border-[var(--color-ink-line)] bg-[var(--color-ink-card)]">
                <h3>
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? -1 : i)}
                    className="flex w-full items-center justify-between gap-3 px-5 py-4 text-start"
                    aria-expanded={isOpen}
                    aria-controls={`pp-faq-${f.k}`}
                  >
                    <span className="text-[15.5px] font-bold text-[var(--text)]">{f.q}</span>
                    <ChevronDown size={18} className={`shrink-0 text-[var(--color-mute)] transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                </h3>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={`pp-faq-${f.k}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      style={{ overflow: "hidden" }}
                    >
                      <p className="px-5 pb-4 text-[14.5px] leading-[1.8] text-[var(--text-soft)]">
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
