import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { fetchCompanies } from "../lib/supabase.js";
import { useCategories } from "../lib/categories.jsx";
import {
  categoriesUrl, allCategoriesTitle, allCategoriesDescription,
  buildAlternates, homeUrl, breadcrumbLd,
} from "../lib/seo.js";

import Navbar from "../components/Navbar.jsx";
import Footer from "../components/Footer.jsx";
import Seo from "../components/Seo.jsx";
import Breadcrumbs from "../components/seo/Breadcrumbs.jsx";
import { CategoryTile } from "../components/CategoryBrowse.jsx";

// ============================================================
//  صفحة /categories — كل الفئات النشطة (مرتّبة بـ sort_order)
//  تعيد استخدام نفس بطاقة الفئة (CategoryTile). تنقّل فقط، لا عروض/بحث.
// ============================================================
export default function CategoriesPage({ lang = "ar" }) {
  const { t } = useTranslation();
  const { categories, loading: catsLoading } = useCategories();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  // ملاحظة: لغة/اتجاه الواجهة تُضبط مركزياً في RouteLangSync (App.jsx) من المسار.
  useEffect(() => {
    let active = true;
    window.scrollTo(0, 0);
    fetchCompanies()
      .then((d) => active && setCompanies(Array.isArray(d) ? d : []))
      .catch(() => active && setCompanies([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  // الفئات النشطة فقط، مرتّبة حسب sort_order
  const active = useMemo(
    () =>
      (categories || [])
        .filter((c) => c.is_active !== false)
        .slice()
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [categories]
  );

  // عدد العروض لكل فئة (category_id + fallback للنص العربي القديم)
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

  const canonical = categoriesUrl(lang);
  const busy = loading || catsLoading;

  const jsonLd = [
    breadcrumbLd([
      { name: t("store.breadcrumbHome"), url: homeUrl(lang) },
      { name: t("home.allCategories"), url: canonical },
    ]),
  ];

  return (
    <div className="min-h-screen bg-[var(--color-ink)] text-[var(--text)]">
      <Seo
        lang={lang}
        title={allCategoriesTitle(lang)}
        description={allCategoriesDescription(active.length, lang)}
        canonical={canonical}
        alternates={buildAlternates("categories")}
        jsonLd={jsonLd}
      />
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 pb-10 pt-[96px] sm:pt-[104px]">
        <Breadcrumbs
          items={[
            { name: t("store.breadcrumbHome"), to: lang === "ar" ? "/" : `/${lang}` },
            { name: t("home.allCategories") },
          ]}
        />

        <header className="mb-6">
          <h1 className="text-[26px] font-black tracking-tight sm:text-[32px]">
            {t("home.allCategories")}
          </h1>
        </header>

        {busy ? (
          <div className="grid min-h-[40vh] place-items-center">
            <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[var(--color-ink-line)] border-t-[var(--color-lime)]" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {active.map((cat, i) => (
              <CategoryTile key={cat.id} cat={cat} count={counts[cat.id] || 0} lang={lang} index={i} t={t} />
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
