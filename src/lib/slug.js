// ============================================================
//  CODpromo — توليد روابط (slugs) نظيفة للسيو
//  يطابق دالة slugify في supabase-phase13-seo.sql:
//  أحرف لاتينية صغيرة + شرطات، وأي رمز آخر (بما فيه العربية) يصير شرطة.
// ============================================================

/** "YouCan Store" → "youcan-store" · النص العربي البحت يعطي "" (فارغ). */
export function slugify(v) {
  return String(v || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** slug آمن دائماً لشركة: من الاسم، وإلا "store-<id>". */
export function companySlug(company) {
  if (company?.slug) return company.slug;
  const s = slugify(company?.name);
  return s || (company?.id != null ? `store-${company.id}` : "");
}

/**
 * slug ثابت لفئة: نعتمد الاسم الإنجليزي للفئة (روابط لاتينية مستقرة)،
 * ثم العربي كـ fallback. يُستعمل في روابط /category داخل الموقع وفي الـ sitemap.
 */
export function categorySlug(company) {
  const en = slugify(company?.category_en);
  if (en) return en;
  const ar = slugify(company?.category);
  return ar || "";
}

/** يجد الفئة (بقيمتها العربية المرجعية) المطابقة لـ slug معيّن من قائمة الشركات. */
export function findCategoryBySlug(companies, slug) {
  const target = String(slug || "").toLowerCase();
  for (const c of companies) {
    if (c.category && categorySlug(c) === target) return c.category;
  }
  return null;
}
