import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Tag } from "lucide-react";
import { useTranslation } from "react-i18next";
import { categoriesPath, offersLink, offersPath } from "../../lib/seo.js";
import { categoryName, categoryRecordSlug } from "../../lib/slug.js";

/**
 * ميغا مينيو "الفئات" (الحاسوب): كل الفئات من قاعدة البيانات (بترتيب الأدمن) مع عدد العروض،
 * بشكل سطور إيصال (الاسم ثم نقاط ثم العدد)، وكل سطر يفتح /offers?category=…
 * تُفتح بالمرور أو بالنقر؛ Esc يغلقها. focusFirst: تركيز أول رابط عند الفتح بلوحة المفاتيح.
 * counts = null ما دامت العروض لم تصل (تظهر الأسماء أولاً ثم الأعداد).
 */
export default function CategoriesMega({ id, open, categories, counts, onEnter, onLeave, onClose, focusFirst }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const panelRef = useRef(null);

  useEffect(() => {
    if (open && focusFirst) panelRef.current?.querySelector("a")?.focus();
  }, [open, focusFirst]);

  // خروج التركيز من القائمة (Tab) إلى خارجها وخارج زر "الفئات" → إغلاق
  const onBlur = (e) => {
    const next = e.relatedTarget;
    if (next && !e.currentTarget.contains(next) && !next.closest?.("[data-mega]")) onClose(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="mega"
          id={id}
          ref={panelRef}
          data-mega
          role="region"
          aria-label={t("nav.categories")}
          initial={{ opacity: 0, y: -8, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.99 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          onPointerEnter={(e) => e.pointerType === "mouse" && onEnter()}
          onPointerLeave={(e) => e.pointerType === "mouse" && onLeave()}
          onKeyDown={(e) => e.key === "Escape" && onClose(true)}
          onBlur={onBlur}
          className="absolute inset-x-4 top-full mt-2 hidden origin-top overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--elev)]/95 shadow-[0_28px_70px_-24px_rgba(0,0,0,0.85)] backdrop-blur-2xl lg:block"
        >
          <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-24" style={{ background: "radial-gradient(70% 100% at 50% 0%, rgba(166,240,0,0.07), transparent 70%)" }} />
          <ul className="relative grid grid-cols-3 gap-x-8 gap-y-0.5 p-5">
            {(categories || []).map((cat) => {
              const n = counts ? counts[cat.id] || 0 : null;
              const icon = (cat.icon || "").trim();
              return (
                <li key={cat.id}>
                  <Link
                    to={offersLink(lang, { category: categoryRecordSlug(cat) })}
                    onClick={() => onClose(false)}
                    className={`group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[14px] font-bold outline-none transition-colors hover:bg-[var(--fill)] focus-visible:bg-[var(--fill)] focus-visible:ring-1 focus-visible:ring-[var(--color-lime)]/50 ${
                      n === 0 ? "text-[var(--color-mute)]" : "text-[var(--text)]"
                    }`}
                  >
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--color-lime)]/10 text-[var(--accent-text)] transition-colors group-hover:bg-[var(--color-lime)]/20">
                      {icon ? <span aria-hidden>{icon}</span> : <Tag size={14} />}
                    </span>
                    <span className="truncate transition-colors group-hover:text-[var(--accent-text)]">{categoryName(cat, lang)}</span>
                    <span aria-hidden className="mx-1 h-0 min-w-4 flex-1 translate-y-1 border-b border-dotted border-[var(--color-ink-line)] transition-colors group-hover:border-[var(--color-lime)]/40" />
                    <span className="shrink-0 text-[12px] font-extrabold tabular-nums text-[var(--color-mute)] transition-colors group-hover:text-[var(--accent-text)]">
                      {n != null && t("home.categoryCount", { count: n })}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {/* كعب القائمة: خط مثقّب ثم روابط "كل العروض" و"كل الفئات" */}
          <div className="relative flex items-center justify-between gap-4 px-6 pb-4 pt-3.5">
            <span aria-hidden className="absolute inset-x-6 top-0 border-t border-dashed border-[var(--color-ink-line)]" />
            <Link
              to={offersPath(lang)}
              onClick={() => onClose(false)}
              className="group inline-flex items-center gap-1.5 text-[13.5px] font-extrabold text-[var(--accent-text)]"
            >
              {t("offers.title")}
              <ArrowLeft size={15} className="transition-transform group-hover:-translate-x-0.5 ltr:rotate-180 ltr:group-hover:translate-x-0.5" />
            </Link>
            <Link
              to={categoriesPath(lang)}
              onClick={() => onClose(false)}
              className="text-[13px] font-bold text-[var(--text-softer)] transition-colors hover:text-[var(--text)]"
            >
              {t("home.allCategories")}
            </Link>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
