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

/** يجد الفئة (بقيمتها العربية المرجعية) المطابقة لـ slug من قائمة الشركات (fallback قديم). */
export function findCategoryBySlug(companies, slug) {
  const target = String(slug || "").toLowerCase();
  for (const c of companies) {
    if (c.category && categorySlug(c) === target) return c.category;
  }
  return null;
}

// ===================== الفئات من جدول categories (المصدر الحقيقي) =====================

/** slug ثابت لسجلّ فئة من الجدول: عمود slug، وإلا الإنجليزي، وإلا العربي. */
export function categoryRecordSlug(cat) {
  if (!cat) return "";
  if (cat.slug) return cat.slug;
  return slugify(cat.name_en) || slugify(cat.name_ar) || "";
}

/** اسم الفئة بلغة العرض من سجلّ الجدول مع fallback للعربية ثم للـ slug. */
export function categoryName(cat, lang = "ar") {
  if (!cat) return "";
  return (lang !== "ar" && cat[`name_${lang}`]) || cat.name_ar || cat.slug || "";
}

/** وصف الفئة بلغة العرض من سجلّ الجدول مع fallback للعربية. */
export function categoryDesc(cat, lang = "ar") {
  if (!cat) return "";
  return (lang !== "ar" && cat[`description_${lang}`]) || cat.description_ar || "";
}

/** يجد سجلّ الفئة المطابق لـ slug من قائمة فئات الجدول. */
export function findCategoryRecordBySlug(categories, slug) {
  const target = String(slug || "").toLowerCase();
  return (categories || []).find((c) => categoryRecordSlug(c).toLowerCase() === target) || null;
}

/**
 * سجلّ فئة شركة: عبر category_id من خريطة الفئات (المصدر الحقيقي)،
 * وإلا مطابقة النص العربي القديم باسم فئة موجودة (توافق قبل/بدون ربط).
 */
export function companyCategoryRecord(company, byId, categories) {
  if (!company) return null;
  if (company.category_id && byId?.[company.category_id]) return byId[company.category_id];
  if (company.category && categories) {
    return categories.find((c) => c.name_ar === company.category) || null;
  }
  return null;
}
