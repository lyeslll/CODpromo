import { supabase } from "./supabaseClient.js";

// ============================================================
//  حساب الزبون (الداشبورد): الاسم، عدد التصويتات، نوع الدخول
// ============================================================

/** عدد التصويتات التي سجّلها المستخدم (code_votes.user_id). */
export async function countMyVotes(userId) {
  if (!userId) return 0;
  const { count, error } = await supabase
    .from("code_votes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return count || 0;
}

/** يحدّث الاسم في profiles (صفّه فقط عبر RLS) وفي بيانات الجلسة (الهيدر يقرأ منها). */
export async function updateMyName(userId, fullName) {
  const name = (fullName || "").trim();
  const { error } = await supabase.from("profiles").update({ full_name: name }).eq("id", userId);
  if (error) throw new Error(error.message);
  const { error: e2 } = await supabase.auth.updateUser({ data: { full_name: name } });
  if (e2) throw new Error(e2.message);
}

/** حساب بالإيميل وكلمة سر؟ (حسابات Google فقط لا تملك كلمة سر نغيّرها). */
export function hasPasswordLogin(user) {
  const ids = user?.identities;
  if (Array.isArray(ids) && ids.length) return ids.some((i) => i.provider === "email");
  return user?.app_metadata?.provider === "email";
}

/** لغة إيميلات الحساب (التأكيد، الترحيب، الشراء…) = user_metadata.lang. يتحدّث كي تتبدّل لغة الواجهة. */
export async function syncEmailLang(user, lang) {
  if (!user || !["ar", "en", "fr"].includes(lang) || user.user_metadata?.lang === lang) return;
  await supabase.auth.updateUser({ data: { lang } });
}
