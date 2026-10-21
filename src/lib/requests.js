import { supabase } from "./supabaseClient.js";

// ============================================================
//  طلبات الشركات (company_requests) — بوابة الشركات (phase26)
//  الشركة تقرأ وتنشئ طلباتها فقط (RLS + trigger guard_company_request):
//  الحالة دائماً pending، 5 طلبات معلّقة كحدّ أقصى، وطلب التعديل لشركة تملكها فقط.
//  المراجعة/النشر/الرفض للأدمن عبر RPCs تتحقق من is_admin() في القاعدة.
// ============================================================

// حقول الطلب التي ترسلها الشركة (نفس أعمدة العرض + التواصل والشراكة)
const OFFER_FIELDS = [
  "company_name", "logo", "category_id", "type", "discount", "code", "link", "description",
  "premium_discount", "premium_code", "premium_url", "premium_description", "supports_premium",
];
const CONTACT_FIELDS = ["website_url", "contact_name", "whatsapp", "contact_email", "affiliate_url", "affiliate_dashboard_url", "commission_pct", "message"];

function clean(obj, keys) {
  const out = {};
  for (const k of keys) {
    let v = obj?.[k];
    if (v === undefined) continue;
    if (typeof v === "string") v = v.trim();
    if (k === "commission_pct") v = v === "" || v == null ? null : Number(v);
    out[k] = v === "" ? null : v;
  }
  return out;
}

/**
 * يحوّل ما يُرجعه CompanyOfferForm (company, contact) إلى سطر طلب.
 * title يبقى للتوافق مع الطلبات القديمة (= قيمة العرض).
 */
export function requestFromForm(company, contact) {
  return {
    ...clean({ ...company, company_name: company.name }, OFFER_FIELDS),
    title: (company.discount || company.name || "").trim() || null,
    ...clean(contact, CONTACT_FIELDS),
  };
}

/** يجلب طلبات الشركة الحالية مرتبة من الأحدث. */
export async function fetchMyRequests(userId) {
  if (!userId) return [];
  const { data, error } = await supabase.from("company_requests").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

/** ينشئ طلب عرض (جديد أو تعديل لشركة تملكها). يرمي Error بمفتاح مفهوم عند رفض الحارس. */
export async function createRequest(userId, row, { type = "new", companyId = null } = {}) {
  const body = { ...row, user_id: userId, status: "pending", request_type: type, company_id: type === "edit" ? companyId : null };
  const { data, error } = await supabase.from("company_requests").insert(body).select().single();
  if (error) {
    const m = error.message || "";
    if (/too_many_pending/.test(m)) throw new Error("too_many_pending");
    if (/company_account_required/.test(m)) throw new Error("company_account_required");
    if (/not_your_company/.test(m)) throw new Error("not_your_company");
    throw new Error(m);
  }
  return data;
}

/** إحصائيات الشركة (عروضها المنشورة فقط) — RPC partner_overview بعدّ دقيق. */
export async function fetchPartnerOverview() {
  const { data, error } = await supabase.rpc("partner_overview");
  if (error) throw new Error(error.message);
  return data;
}

/** تفاصيل عرض منشور تملكه الشركة (لتعمير "اطلب تعديل"). */
export async function fetchPartnerOfferDetail(companyId) {
  const { data, error } = await supabase.rpc("partner_offer_detail", { p_company_id: companyId });
  if (error) throw new Error(error.message);
  return data;
}

export const PARTNER_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const PARTNER_LOGO_MAX = 1024 * 1024;

/** يرفع لوغو الشركة إلى bucket partner-logos في دوسيه الحساب (uid/…). PNG/JPG/WebP، 1MB. */
export async function uploadPartnerLogo(file, userId) {
  if (!PARTNER_LOGO_TYPES.includes(file?.type)) throw new Error("logo_type");
  if (file.size > PARTNER_LOGO_MAX) throw new Error("logo_size");
  const ext = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }[file.type];
  const path = `${userId}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("partner-logos").upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);
  return supabase.storage.from("partner-logos").getPublicUrl(path).data.publicUrl;
}

// ===================== الأدمن =====================

/** النشر: يربط الطلب بالشركة المنشأة/المحدّثة ويربط الشركة بحساب صاحبها. */
export async function publishRequest(requestId, companyId) {
  const { error } = await supabase.rpc("admin_publish_request", { p_request_id: requestId, p_company_id: companyId });
  if (error) throw new Error(error.message);
}

/** الرفض مع سبب يظهر للشركة. */
export async function rejectRequest(requestId, reason) {
  const { error } = await supabase.rpc("admin_reject_request", { p_request_id: requestId, p_reason: reason });
  if (error) throw new Error(error.message);
}

/** رقم واتساب بصيغة wa.me (أرقام فقط؛ 0XXXXXXXXX الجزائري → 213XXXXXXXXX). */
export function waNumber(raw) {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10 && d.startsWith("0")) d = `213${d.slice(1)}`;
  return d;
}
