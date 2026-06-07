import { supabase } from "./supabaseClient.js";
import { addCompany } from "./supabase.js";

// ============================================================
//  استعلامات لوحة الأدمن (تتطلب سياسات قراءة عامة — راجع supabase-phase4.sql)
// ============================================================

/** كل المستخدمين (من جدول profiles). */
export async function fetchAllProfiles() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,full_name,account_type,company_name,phone,website,created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

/** كل طلبات الشركات. */
export async function fetchAllRequests() {
  const { data, error } = await supabase
    .from("company_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

/** تغيير حالة طلب (accepted / rejected / pending). */
export async function setRequestStatus(id, status) {
  const { error } = await supabase.from("company_requests").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * قبول طلب: ينشئ شركة منشورة في companies ثم يحدّث حالة الطلب إلى accepted.
 * يعيد الشركة المُنشأة.
 */
export async function acceptRequest(req) {
  const company = await addCompany({
    name: req.company_name || req.title,
    logo: req.logo,
    category: "",
    code: req.code,
    discount: req.title, // أفضل قيمة متاحة — قابلة للتعديل لاحقاً من محرّر الشركة
    type: req.type,
    description: req.description,
    link: req.link,
    status: "active",
  });
  await setRequestStatus(req.id, "accepted");
  return company;
}
