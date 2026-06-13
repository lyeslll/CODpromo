// ============================================================
//  Supabase data layer  —  CODpromo
//  (نفس عنوان URL والمفتاح كما هو، بدون أي تغيير)
// ============================================================
export const SUPABASE_URL = "https://uulcgvdsqivgkiulurhk.supabase.co";
export const SUPABASE_KEY = "sb_publishable_kxiLaS2RxTEeZA6TrJQR_w_ws8twFBt";

export const LOGOS_BUCKET = "logos";

import { slugify } from "./slug.js";
import { supabase as sessionClient } from "./supabaseClient.js";

// ترويسات القراءة العامة (وتتبّع النقرات): تستعمل المفتاح العام (anon) كما كان.
const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
};

const jsonHeaders = { ...headers, "Content-Type": "application/json" };

// ============================================================
//  ترويسات الكتابة الإدارية — بهوية المستخدم المُصادَق (S1)
//  apikey يبقى المفتاح العام (يتطلّبه PostgREST دائماً)، أمّا Authorization
//  فيحمل توكن جلسة المستخدم (JWT) بدل مفتاح anon — حتى تُنسَب الكتابة للمستخدم
//  وتحمل صلاحياته (is_admin) مستقبلاً. إن لم تكن هناك جلسة نرجع لمفتاح anon
//  (fallback) كي لا تنكسر اللوحة الآن، لأن سياسات RLS لم تتغيّر بعد.
// ============================================================
async function getAccessToken() {
  try {
    const { data } = await sessionClient.auth.getSession();
    return data?.session?.access_token || null;
  } catch {
    return null;
  }
}

/** ترويسات كتابة بهوية المستخدم المُصادَق (مع fallback لمفتاح anon). */
async function adminHeaders(extra = {}) {
  const token = await getAccessToken();
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${token || SUPABASE_KEY}`,
    ...extra,
  };
}

/** مثل adminHeaders لكن مع Content-Type: application/json. */
async function adminJsonHeaders(extra = {}) {
  return adminHeaders({ "Content-Type": "application/json", ...extra });
}

/** يحوّل استجابة خطأ من Supabase إلى رسالة مفهومة. */
async function toError(res, fallback) {
  let detail = "";
  try {
    const data = await res.json();
    detail = data?.message || data?.error || data?.msg || "";
  } catch {
    /* ignore */
  }
  if (res.status === 401 || res.status === 403 || /row-level security/i.test(detail)) {
    return new Error(
      "صلاحيات الكتابة محجوبة (RLS). شغّل ملف supabase-setup.sql مرة واحدة في Supabase."
    );
  }
  if (/bucket not found/i.test(detail)) {
    return new Error("حاوية التخزين logos غير موجودة. شغّل supabase-setup.sql لإنشائها.");
  }
  return new Error(detail || fallback);
}

// ===================== قراءة =====================

/** يجلب كل الشركات مرتبة من الأحدث للأقدم. */
export async function fetchCompanies() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/companies?select=*&order=created_at.desc`,
    { headers }
  );
  if (!res.ok) throw new Error("فشل الاتصال بالخادم");
  return res.json();
}

/**
 * يزيد عدّاد النقرات لشركة معيّنة (تتبّع استخدام الكود).
 * يفشل بصمت إن لم تتوفّر صلاحية الكتابة — لا يكسر تجربة المستخدم.
 */
export async function trackClick(id, currentClicks = 0) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/companies?id=eq.${id}`, {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify({ clicks: (currentClicks || 0) + 1 }),
    });
  } catch {
    /* تجاهل — التتبّع اختياري */
  }
}

// ===================== كتابة (لوحة التحكم) =====================

const ALLOWED = [
  "name", "logo", "category", "category_id", "code", "discount", "premium_discount",
  "supports_premium", "type", "description", "link", "status",
  // كود ورابط عرض Premium (universal — لا تُترجَم)
  "premium_code", "premium_url",
  // ترجمات المحتوى الديناميكي (تُولَّد تلقائياً — العربية تبقى المصدر/الـ fallback)
  "description_en", "description_fr", "category_en", "category_fr",
  "discount_en", "discount_fr", "premium_discount_en", "premium_discount_fr",
  // SEO: الرابط + عنوان/وصف/كلمات مفتاحية (+ ترجماتها)
  "slug",
  "seo_title", "seo_title_en", "seo_title_fr",
  "seo_description", "seo_description_en", "seo_description_fr",
  "seo_keywords", "seo_keywords_en", "seo_keywords_fr",
];

/** يبقي فقط الحقول المسموح بها ويحوّل الفراغات إلى null. */
function clean(payload) {
  const out = {};
  for (const k of ALLOWED) {
    if (payload[k] === undefined) continue;
    const v = typeof payload[k] === "string" ? payload[k].trim() : payload[k];
    out[k] = v === "" ? null : v;
  }
  return out;
}

// الحقول النصية القابلة للترجمة (تظهر في البطاقة): الوصف، الفئة، وقيمة العرض.
// قيمة العرض تُترجَم وتُنسَّق حسب اللغة (مثل "5$ هدية" → "$5 gift" / "5$ cadeau").
const I18N_FIELDS = ["description", "category", "discount", "premium_discount"];

/**
 * يترجم حقولاً عربية إلى en + fr عبر Edge Function translate-company.
 * @param {Record<string,string>} fields مثل { description, category }
 * @returns {Promise<{en:Object, fr:Object}>}
 */
export async function translateCompanyFields(fields) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/translate-company`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw await toError(res, "تعذّرت الترجمة التلقائية");
  return res.json();
}

/**
 * يضيف أعمدة الترجمة (en/fr) للحقول النصية الموجودة في الـ payload.
 * إن فشلت الترجمة لا نكسر الحفظ — نحفظ بالعربية فقط (تُترجَم لاحقاً بزر "ترجم الكل").
 */
async function withTranslations(payload) {
  const src = {};
  for (const f of I18N_FIELDS) {
    if (typeof payload[f] === "string" && payload[f].trim()) src[f] = payload[f].trim();
  }
  if (Object.keys(src).length === 0) return payload;
  try {
    const { en = {}, fr = {} } = await translateCompanyFields(src);
    const out = { ...payload };
    for (const f of I18N_FIELDS) {
      if (en[f] != null) out[`${f}_en`] = en[f];
      if (fr[f] != null) out[`${f}_fr`] = fr[f];
    }
    return out;
  } catch (e) {
    console.warn("translate-company failed, saving Arabic only:", e?.message);
    return payload;
  }
}

/** يضيف شركة جديدة (مع ترجمة تلقائية للوصف والفئة + توليد slug للسيو) ويعيد السجل المُنشأ. */
export async function addCompany(payload) {
  const translated = await withTranslations(payload);
  const base = { status: "active", ...clean(translated) };
  // توليد slug للسيو إن لم يُحدَّد يدوياً (من الاسم، وإلا من الوقت كاحتياط).
  if (!base.slug) base.slug = slugify(payload.name) || `store-${Date.now().toString(36)}`;

  // محاولة الإدراج مع معالجة تعارض الـ slug الفريد (نُلحق لاحقة قصيرة ونعيد المحاولة مرة).
  const insert = async (body) => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/companies`, {
      method: "POST",
      headers: await adminJsonHeaders({ Prefer: "return=representation" }),
      body: JSON.stringify(body),
    });
    return res;
  };

  let res = await insert(base);
  if (res.status === 409) {
    // slug مكرّر — أعد المحاولة بلاحقة عشوائية قصيرة.
    res = await insert({ ...base, slug: `${base.slug}-${Math.random().toString(36).slice(2, 6)}` });
  }
  if (!res.ok) throw await toError(res, "تعذّر إضافة الشركة");
  const data = await res.json();
  return Array.isArray(data) ? data[0] : data;
}

/** يحدّث شركة موجودة (يعيد ترجمة الوصف/الفئة إن تغيّرا) ويعيد السجل المُحدَّث. */
export async function updateCompany(id, payload) {
  const translated = await withTranslations(payload);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/companies?id=eq.${id}`, {
    method: "PATCH",
    headers: await adminJsonHeaders({ Prefer: "return=representation" }),
    body: JSON.stringify(clean(translated)),
  });
  if (!res.ok) throw await toError(res, "تعذّر تحديث الشركة");
  const data = await res.json();
  return Array.isArray(data) ? data[0] : data;
}

/** يحذف شركة. */
export async function deleteCompany(id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/companies?id=eq.${id}`, {
    method: "DELETE",
    headers: await adminHeaders(),
  });
  if (!res.ok) throw await toError(res, "تعذّر حذف الشركة");
  return true;
}

// ===================== التصنيفات (الفئات) =====================
// جدول categories: المصدر العربي في name_ar / description_ar، وen/fr ترجمة تلقائية.

// الأعمدة المسموح كتابتها على categories.
const CATEGORY_ALLOWED = [
  "slug", "icon",
  "name_ar", "name_en", "name_fr",
  "description_ar", "description_en", "description_fr",
  "sort_order", "is_active",
];

/** يبقي فقط أعمدة الفئة المسموح بها مع ضبط الأنواع (sort_order رقم، is_active منطقي، النصوص الفارغة → null). */
function cleanCategory(payload) {
  const out = {};
  for (const k of CATEGORY_ALLOWED) {
    if (payload[k] === undefined) continue;
    let v = payload[k];
    if (k === "sort_order") {
      const n = Number(v);
      out[k] = Number.isFinite(n) ? Math.trunc(n) : 0;
    } else if (k === "is_active") {
      out[k] = !(v === false || v === "false" || v === 0);
    } else {
      if (typeof v === "string") v = v.trim();
      out[k] = v === "" ? null : v;
    }
  }
  return out;
}

/**
 * يضيف ترجمة en/fr لاسم/وصف الفئة عبر نفس Edge Function (translate-company).
 * المصدر العربي: name_ar → name، description_ar → description.
 * إن فشلت الترجمة لا نكسر الحفظ — نحفظ بالعربية فقط (تُترجَم لاحقاً عند التعديل).
 */
async function withCategoryTranslations(payload) {
  const src = {};
  if (typeof payload.name_ar === "string" && payload.name_ar.trim()) src.name = payload.name_ar.trim();
  if (typeof payload.description_ar === "string" && payload.description_ar.trim())
    src.description = payload.description_ar.trim();
  if (Object.keys(src).length === 0) return payload;
  try {
    const { en = {}, fr = {} } = await translateCompanyFields(src);
    const out = { ...payload };
    if (en.name != null) out.name_en = en.name;
    if (fr.name != null) out.name_fr = fr.name;
    if (en.description != null) out.description_en = en.description;
    if (fr.description != null) out.description_fr = fr.description;
    return out;
  } catch (e) {
    console.warn("translate category failed, saving Arabic only:", e?.message);
    return payload;
  }
}

/** يجلب كل الفئات مرتّبة حسب sort_order ثم الأحدث. */
export async function fetchCategories() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/categories?select=*&order=sort_order.asc,created_at.desc`,
    { headers }
  );
  if (!res.ok) throw new Error("فشل الاتصال بالخادم");
  return res.json();
}

/** يضيف فئة جديدة (ترجمة تلقائية للاسم/الوصف + توليد slug مرّة واحدة) ويعيد السجل المُنشأ. */
export async function addCategory(payload) {
  const translated = await withCategoryTranslations(payload);
  const base = cleanCategory(translated);
  // الـ slug يتولّد مرّة واحدة عند الإنشاء: من name_en المترجم، وإلا name_ar، وإلا احتياط.
  if (!base.slug) {
    base.slug =
      slugify(translated.name_en) || slugify(payload.name_ar) || `cat-${Date.now().toString(36)}`;
  }

  const insert = async (body) =>
    fetch(`${SUPABASE_URL}/rest/v1/categories`, {
      method: "POST",
      headers: await adminJsonHeaders({ Prefer: "return=representation" }),
      body: JSON.stringify(body),
    });

  let res = await insert(base);
  if (res.status === 409) {
    // slug مكرّر — أعد المحاولة بلاحقة عشوائية قصيرة.
    res = await insert({ ...base, slug: `${base.slug}-${Math.random().toString(36).slice(2, 6)}` });
  }
  if (!res.ok) throw await toError(res, "تعذّر إضافة الفئة");
  const data = await res.json();
  return Array.isArray(data) ? data[0] : data;
}

/**
 * يحدّث فئة موجودة (يعيد ترجمة الاسم/الوصف). لا يُعيد توليد الـ slug تلقائياً —
 * يبقى كما هو إلا إن مرّره المستخدم صراحةً في الـ payload (تعديل يدوي).
 */
export async function updateCategory(id, payload) {
  const translated = await withCategoryTranslations(payload);
  const body = cleanCategory(translated);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/categories?id=eq.${id}`, {
    method: "PATCH",
    headers: await adminJsonHeaders({ Prefer: "return=representation" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await toError(res, "تعذّر تحديث الفئة");
  const data = await res.json();
  return Array.isArray(data) ? data[0] : data;
}

/**
 * يحذف فئة. عمود companies.category_id معرّف بـ ON DELETE SET NULL (راجع phase14)،
 * فتتحوّل category_id للشركات المرتبطة إلى null تلقائياً دون حذف الشركات.
 */
export async function deleteCategory(id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/categories?id=eq.${id}`, {
    method: "DELETE",
    headers: await adminHeaders(),
  });
  if (!res.ok) throw await toError(res, "تعذّر حذف الفئة");
  return true;
}

// ===================== رفع الصور =====================

/**
 * يرفع صورة لوجو إلى حاوية logos العامة ويعيد الرابط العام.
 * @param {File} file
 * @returns {Promise<string>} الرابط العام للصورة
 */
export async function uploadLogo(file) {
  if (!file) throw new Error("لم يتم اختيار ملف");
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const safe = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${LOGOS_BUCKET}/${safe}`, {
    method: "POST",
    headers: await adminHeaders({
      "Content-Type": file.type || "application/octet-stream",
      "x-upsert": "true",
    }),
    body: file,
  });
  if (!res.ok) throw await toError(res, "تعذّر رفع الصورة");

  return `${SUPABASE_URL}/storage/v1/object/public/${LOGOS_BUCKET}/${safe}`;
}

// ===================== SEO: تحديث بدون إعادة ترجمة =====================

/**
 * يحدّث شركة موجودة دون استدعاء الترجمة التلقائية (للحقول التي لا تحتاجها مثل
 * slug وحقول SEO — الترجمة هنا تُدار يدوياً بزر "ترجمة تلقائية" في تبويب SEO).
 */
export async function updateCompanyRaw(id, payload) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/companies?id=eq.${id}`, {
    method: "PATCH",
    headers: await adminJsonHeaders({ Prefer: "return=representation" }),
    body: JSON.stringify(clean(payload)),
  });
  if (!res.ok) throw await toError(res, "تعذّر حفظ بيانات SEO");
  const data = await res.json();
  return Array.isArray(data) ? data[0] : data;
}

// ===================== صفحة الشركة العامة =====================

/** يجلب شركة واحدة بالـ slug مع أسئلتها الشائعة (مرتّبة)، أو null إن لم توجد. */
export async function fetchCompanyBySlug(slug) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/companies?slug=eq.${encodeURIComponent(slug)}&select=*,company_faqs(*)`,
    { headers }
  );
  if (!res.ok) throw new Error("فشل الاتصال بالخادم");
  const data = await res.json();
  const company = Array.isArray(data) ? data[0] : data;
  if (!company) return null;
  // ترتيب الأسئلة حسب sort_order ثم id
  if (Array.isArray(company.company_faqs)) {
    company.company_faqs.sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id - b.id
    );
  }
  return company;
}

// ===================== الأسئلة الشائعة (الأدمن) =====================

/** يجلب عدد الأسئلة الشائعة لكل شركة (خريطة company_id → عدد) — لمؤشّر حالة SEO. */
export async function fetchFaqCounts() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/company_faqs?select=company_id`, { headers });
  if (!res.ok) return {};
  const rows = await res.json();
  const map = {};
  for (const r of rows) map[r.company_id] = (map[r.company_id] || 0) + 1;
  return map;
}

/** يجلب أسئلة شركة مرتّبة. */
export async function fetchCompanyFaqs(companyId) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/company_faqs?company_id=eq.${companyId}&order=sort_order.asc,id.asc`,
    { headers }
  );
  if (!res.ok) throw new Error("تعذّر جلب الأسئلة الشائعة");
  return res.json();
}

/**
 * يستبدل كل أسئلة الشركة بقائمة جديدة (أبسط وأضمن طريقة للإضافة/الحذف/الترتيب).
 * كل عنصر: { question, answer, question_en?, answer_en?, question_fr?, answer_fr? }.
 */
export async function saveCompanyFaqs(companyId, faqs) {
  // 1) حذف القديم
  const del = await fetch(
    `${SUPABASE_URL}/rest/v1/company_faqs?company_id=eq.${companyId}`,
    { method: "DELETE", headers: await adminHeaders() }
  );
  if (!del.ok) throw await toError(del, "تعذّر تحديث الأسئلة الشائعة");

  // 2) إدراج الجديد (مع الترتيب)
  const rows = (faqs || [])
    .filter((f) => (f.question || "").trim() && (f.answer || "").trim())
    .map((f, i) => ({
      company_id: companyId,
      question: f.question.trim(),
      answer: f.answer.trim(),
      question_en: f.question_en?.trim() || null,
      question_fr: f.question_fr?.trim() || null,
      answer_en: f.answer_en?.trim() || null,
      answer_fr: f.answer_fr?.trim() || null,
      sort_order: i,
    }));
  if (rows.length === 0) return [];

  const res = await fetch(`${SUPABASE_URL}/rest/v1/company_faqs`, {
    method: "POST",
    headers: await adminJsonHeaders({ Prefer: "return=representation" }),
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw await toError(res, "تعذّر حفظ الأسئلة الشائعة");
  return res.json();
}

// ===================== إعدادات الموقع العامة (SEO) =====================

/** يجلب صف الإعدادات الوحيد (id = 1)، أو {} إن لم يوجد. */
export async function fetchSiteSettings() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/site_settings?id=eq.1&select=*`, {
    headers,
  });
  if (!res.ok) throw new Error("تعذّر جلب إعدادات الموقع");
  const data = await res.json();
  return (Array.isArray(data) ? data[0] : data) || {};
}

const SETTINGS_ALLOWED = [
  "home_title", "home_title_en", "home_title_fr",
  "home_description", "home_description_en", "home_description_fr",
];

/** يحدّث إعدادات الموقع (يُنشئ الصف إن لزم). */
export async function updateSiteSettings(payload) {
  const body = { id: 1, updated_at: new Date().toISOString() };
  for (const k of SETTINGS_ALLOWED) {
    if (payload[k] === undefined) continue;
    const v = typeof payload[k] === "string" ? payload[k].trim() : payload[k];
    body[k] = v === "" ? null : v;
  }
  // upsert على المفتاح id=1
  const res = await fetch(`${SUPABASE_URL}/rest/v1/site_settings`, {
    method: "POST",
    headers: await adminJsonHeaders({ Prefer: "resolution=merge-duplicates,return=representation" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await toError(res, "تعذّر حفظ إعدادات الموقع");
  const data = await res.json();
  return (Array.isArray(data) ? data[0] : data) || body;
}
