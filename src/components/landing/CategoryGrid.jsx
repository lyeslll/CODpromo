import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import SectionHead from "./SectionHead.jsx";
import { offersLink } from "../../lib/seo.js";
import { categoryName, categoryRecordSlug } from "../../lib/slug.js";

/**
 * 5.8 — شبكة التصنيفات: كل فئة تذكرة صغيرة (الاسم فوق، وعدد العروض في الكعب)،
 * وكل واحدة تفتح /offers?category=… . الفئات الفارغة لا تظهر.
 */
export default function CategoryGrid({ categories, counts }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const shown = (categories || []).filter((c) => (counts[c.id] || 0) > 0);
  if (!shown.length) return null;

  return (
    <section id="categories" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-24 sm:py-28">
      <SectionHead title={t("catGrid.title")} sub={t("catGrid.sub")} />
      <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {shown.map((cat) => {
          const icon = (cat.icon || "").trim();
          return (
            <Link
              key={cat.id}
              to={offersLink(lang, { category: categoryRecordSlug(cat) })}
              className="ticket group flex flex-col transition-transform duration-300 hover:-translate-y-1"
              style={{ "--r": "9px", "--edge-base": "rgba(255,255,255,0.08)", "--edge-strong": "rgba(166,240,0,0.55)", "--perf": "rgba(166,240,0,0.4)" }}
            >
              <div className="ticket-top relative flex min-h-[92px] items-end bg-[var(--color-ink-card)] p-4 pb-3">
                <span aria-hidden className="ticket-ring ticket-ring-l" />
                <span aria-hidden className="ticket-ring ticket-ring-r" />
                <span className="line-clamp-2 text-[15px] font-extrabold leading-snug text-[var(--text)] transition-colors group-hover:text-[var(--accent-text)]">
                  {icon && (
                    <span className="me-1.5" aria-hidden>
                      {icon}
                    </span>
                  )}
                  {categoryName(cat, lang)}
                </span>
              </div>
              <div className="ticket-stub relative bg-[var(--color-ink-card)] px-4 pb-3.5 pt-3">
                <span aria-hidden className="ticket-ring ticket-ring-l" />
                <span aria-hidden className="ticket-ring ticket-ring-r" />
                <span aria-hidden className="ticket-perf" />
                <span className="text-[12.5px] font-bold text-[var(--color-mute)] transition-colors group-hover:text-[var(--text-softer)]">
                  {t("home.categoryCount", { count: counts[cat.id] })}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
