import { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Tag, ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCategories } from "../lib/categories.jsx";
import { categoryRecordSlug, categoryName } from "../lib/slug.js";
import { categoryPath, categoriesPath } from "../lib/seo.js";

// أقصى عدد خلايا في صفّ الهوم النظيف (6 = قابلة للقسمة على 2 و3 و6 بلا التفاف مكسور).
// إن زادت الفئات عن 6 نعرض أول 5 + بطاقة "كل الفئات ←" كخلية سادسة → /categories.
const HOME_MAX = 6;

// ============================================================
//  قسم "تصفّح حسب الفئة" — تنقّل فقط (مستقل عن قائمة العروض/البحث/الفلاتر).
//  المصدر: جدول الفئات (useCategories). يعرض الفئات النشطة مرتّبة بـ sort_order،
//  كل بطاقة تنقل إلى /category/:slug. عدد العروض يُحسب عبر category_id مع fallback
//  لمطابقة النص العربي القديم (للشركات غير المربوطة بعد).
// ============================================================
export default function CategoryBrowse({ companies = [] }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { categories, loading } = useCategories();

  // الفئات النشطة فقط، مرتّبة حسب sort_order
  const active = useMemo(
    () =>
      (categories || [])
        .filter((c) => c.is_active !== false)
        .slice()
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [categories]
  );

  // عدد العروض لكل فئة (category_id + fallback للنص العربي)
  const counts = useMemo(() => {
    const map = {};
    for (const cat of active) map[cat.id] = 0;
    for (const c of companies) {
      let id = c.category_id;
      if (!id && c.category) {
        const match = active.find((cat) => cat.name_ar === c.category);
        if (match) id = match.id;
      }
      if (id && map[id] != null) map[id] += 1;
    }
    return map;
  }, [active, companies]);

  // لا نعرض القسم قبل التحميل أو إن لا توجد فئات نشطة
  if (loading || active.length === 0) return null;

  // الهوم نظيف بحدّ أقصى 6 خلايا:
  // - 6 فئات أو أقل → اعرضها كلها بلا زر.
  // - أكثر من 6 → أول 5 فئات + بطاقة "كل الفئات ←" (المجموع 6).
  const hasMore = active.length > HOME_MAX;
  const shown = hasMore ? active.slice(0, HOME_MAX - 1) : active;

  return (
    <section className="mx-auto max-w-6xl px-4 pt-12">
      <div className="mb-5">
        <h2 className="text-[24px] font-black tracking-tight sm:text-[28px]">
          {t("home.browseByCategory")}
        </h2>
      </div>

      {/* أعمدة قابلة للقسمة على 6 بلا التفاف مكسور: هاتف 2، لوح 3، حاسوب 6 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {shown.map((cat, i) => (
          <CategoryTile key={cat.id} cat={cat} count={counts[cat.id] || 0} lang={lang} index={i} t={t} />
        ))}
        {hasMore && <AllCategoriesTile lang={lang} index={shown.length} t={t} />}
      </div>
    </section>
  );
}

// بطاقة "كل الفئات ←" بنفس هوية البطاقات — تنقل إلى /categories.
function AllCategoriesTile({ lang, index, t }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.3), ease: [0.16, 1, 0.3, 1] }}
    >
      <Link
        to={categoriesPath(lang)}
        className="group relative flex h-full flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border p-5 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_42px_-22px_rgba(166,240,0,0.55)]"
        style={{ borderColor: "rgba(166,240,0,0.4)", background: "linear-gradient(150deg, rgba(166,240,0,0.12), rgba(166,240,0,0.03))" }}
      >
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-[#0a0a0a]" style={{ background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" }}>
          <ArrowLeft size={22} className="ltr:rotate-180" />
        </span>
        <span className="text-[14px] font-extrabold text-[var(--text)]">{t("home.allCategories")}</span>
      </Link>
    </motion.div>
  );
}

export function CategoryTile({ cat, count, lang, index, t }) {
  const name = categoryName(cat, lang);
  const slug = categoryRecordSlug(cat);
  const icon = (cat.icon || "").trim();

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.3), ease: [0.16, 1, 0.3, 1] }}
    >
      <Link
        to={categoryPath(slug, lang)}
        className="group relative flex h-full flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] p-5 text-center transition-all duration-300 hover:-translate-y-1 hover:border-[var(--color-lime)]/50 hover:shadow-[0_18px_42px_-22px_rgba(166,240,0,0.45)]"
      >
        {/* توهّج علوي خفيف عند المرور */}
        <span
          className="pointer-events-none absolute -top-px left-1/2 h-px w-2/3 -translate-x-1/2 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: "linear-gradient(90deg, transparent, var(--color-lime), transparent)" }}
        />

        {/* الأيقونة من حقل icon (أو أيقونة افتراضية إن كان فارغاً) */}
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[var(--color-lime)]/10 text-[var(--color-lime)] transition-colors duration-300 group-hover:bg-[var(--color-lime)]/18">
          {icon ? (
            <span className="text-[22px] leading-none" aria-hidden="true">
              {icon}
            </span>
          ) : (
            <Tag size={22} />
          )}
        </span>

        <span className="line-clamp-2 text-[14px] font-extrabold text-[var(--text)] transition-colors duration-300 group-hover:text-[var(--accent-text)]">
          {name}
        </span>
        <span className="text-[12px] font-semibold text-[var(--color-mute)]">
          {t("home.categoryCount", { count })}
        </span>
      </Link>
    </motion.div>
  );
}
