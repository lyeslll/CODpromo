import { useEffect, useRef } from "react";
import { Hourglass, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { categoryName, categoryRecordSlug } from "../../lib/slug.js";
import { SOON } from "../coming-soon/tone.js";

/**
 * شرائح التصنيفات (من جدول categories) مع عدد العروض في كل واحدة.
 * value: slug الفئة المختارة أو null = كل الفئات. الفئات الفارغة لا تظهر
 * (إلا إن كانت هي المختارة عبر الرابط). صف قابل للتمرير الأفقي على الهاتف.
 * featured (اختياري): { active, count, onToggle } → شريحة "مميّز" (?featured=1) في أول الصف.
 * soon (اختياري): نفس الشكل → شريحة "قريباً" (?soon=1، phase coming-soon) بلون القريبة، بعد "مميّز".
 */
export default function CategoryChips({ categories, counts, value, onChange, featured, soon }) {
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

  if (!shown.length && !featured && !soon) return null;

  const chip = (key, label, count, active, onClick = () => onChange(key === "all" ? null : key)) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-colors sm:min-h-0 ${
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
        {featured &&
          chip(
            "featured",
            <>
              <Sparkles size={13} aria-hidden />
              {t("featured.chip")}
            </>,
            featured.count,
            featured.active,
            featured.onToggle
          )}
        {soon && (
          <button
            key="soon"
            type="button"
            onClick={soon.onToggle}
            aria-pressed={soon.active}
            className="flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-colors sm:min-h-0"
            style={
              soon.active
                ? { borderColor: SOON, background: `${SOON}1f`, color: SOON }
                : { borderColor: `${SOON}40`, background: `${SOON}0a`, color: SOON }
            }
          >
            <Hourglass size={13} aria-hidden />
            {t("comingSoon.chip")}
            <span className="text-[11px] font-semibold opacity-75">{soon.count}</span>
          </button>
        )}
        {chip("all", t("home.allCategories"), null, !value)}
        {shown.map((c) => {
          const slug = categoryRecordSlug(c);
          return chip(slug, categoryName(c, lang), counts[c.id] || 0, value === slug);
        })}
      </div>
    </div>
  );
}
