import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { categoryName, categoryRecordSlug } from "../../lib/slug.js";

/**
 * شرائح التصنيفات (من جدول categories) مع عدد العروض في كل واحدة.
 * value: slug الفئة المختارة أو null = كل الفئات. الفئات الفارغة لا تظهر
 * (إلا إن كانت هي المختارة عبر الرابط). صف قابل للتمرير الأفقي على الهاتف.
 */
export default function CategoryChips({ categories, counts, value, onChange }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const railRef = useRef(null);

  const shown = categories.filter((c) => (counts[c.id] || 0) > 0 || categoryRecordSlug(c) === value);

  // إظهار الشريحة المختارة داخل الصف عند فتح رابط جاهز (?category=…)
  useEffect(() => {
    const rail = railRef.current;
    const el = rail?.querySelector('[aria-pressed="true"]');
    if (!rail || !el) return;
    const r = rail.getBoundingClientRect();
    const e = el.getBoundingClientRect();
    if (e.left < r.left || e.right > r.right) {
      rail.scrollBy({ left: e.left - r.left - (r.width - e.width) / 2, behavior: "smooth" });
    }
  }, [value, shown.length]);

  if (!shown.length) return null;

  const chip = (key, label, count, active) => (
    <button
      key={key}
      type="button"
      onClick={() => onChange(key === "all" ? null : key)}
      aria-pressed={active}
      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-colors ${
        active
          ? "border-[var(--color-lime)] bg-[var(--color-lime)]/12 text-[var(--accent-text)]"
          : "border-[var(--color-ink-line)] bg-[var(--fill)] text-[var(--text-softer)] hover:border-[var(--color-lime)]/40 hover:text-[var(--text)]"
      }`}
    >
      {label}
      {count != null && <span className="text-[11px] font-semibold text-[var(--color-mute)]">{count}</span>}
    </button>
  );

  return (
    <div className="relative -mx-4 sm:mx-0">
      <div
        ref={railRef}
        role="group"
        aria-label={t("offers.categoryLabel")}
        className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-1 sm:flex-wrap sm:overflow-visible sm:px-0"
      >
        {chip("all", t("home.allCategories"), null, !value)}
        {shown.map((c) => {
          const slug = categoryRecordSlug(c);
          return chip(slug, categoryName(c, lang), counts[c.id] || 0, value === slug);
        })}
      </div>
    </div>
  );
}
