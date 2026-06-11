// ============================================================
//  Supabase data layer  —  CODpromo
//  (نفس عنوان URL والمفتاح كما هو، بدون أي تغيير)
// ============================================================
export const SUPABASE_URL = "https://uulcgvdsqivgkiulurhk.supabase.co";
export const SUPABASE_KEY = "sb_publishable_kxiLaS2RxTEeZA6TrJQR_w_ws8twFBt";

export const LOGOS_BUCKET = "logos";

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
};

const jsonHeaders = { ...headers, "Content-Type": "application/json" };

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
  "name", "logo", "category", "code", "discount", "premium_discount",
  "supports_premium", "type", "description", "link", "status",
  // ترجمات المحتوى الديناميكي (تُولَّد تلقائياً — العربية تبقى المصدر/الـ fallback)
  "description_en", "description_fr", "category_en", "category_fr",
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

// الحقول النصية القابلة للترجمة (تظهر في البطاقة).
const I18N_FIELDS = ["description", "category"];

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

/** يضيف شركة جديدة (مع ترجمة تلقائية للوصف والفئة) ويعيد السجل المُنشأ. */
export async function addCompany(payload) {
  const translated = await withTranslations(payload);
  const body = { status: "active", ...clean(translated) };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/companies`, {
    method: "POST",
    headers: { ...jsonHeaders, Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await toError(res, "تعذّر إضافة الشركة");
  const data = await res.json();
  return Array.isArray(data) ? data[0] : data;
}

/** يحدّث شركة موجودة (يعيد ترجمة الوصف/الفئة إن تغيّرا) ويعيد السجل المُحدَّث. */
export async function updateCompany(id, payload) {
  const translated = await withTranslations(payload);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/companies?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...jsonHeaders, Prefer: "return=representation" },
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
    headers,
  });
  if (!res.ok) throw await toError(res, "تعذّر حذف الشركة");
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
    headers: {
      ...headers,
      "Content-Type": file.type || "application/octet-stream",
      "x-upsert": "true",
    },
    body: file,
  });
  if (!res.ok) throw await toError(res, "تعذّر رفع الصورة");

  return `${SUPABASE_URL}/storage/v1/object/public/${LOGOS_BUCKET}/${safe}`;
}
