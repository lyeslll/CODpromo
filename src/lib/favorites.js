import { supabase } from "./supabaseClient.js";

// ============================================================
//  المفضّلة — مرتبطة بالمستخدم المسجّل (جدول favorites)
// ============================================================

/** يجلب معرّفات الشركات المفضّلة للمستخدم (للتظليل في الصفحة الرئيسية). */
export async function fetchFavoriteIds(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from("favorites")
    .select("company_id")
    .eq("user_id", userId);
  if (error) return [];
  return (data || []).map((r) => r.company_id);
}

/** يجلب المفضّلة مع تفاصيل الشركة (لعرضها في الداشبورد). */
export async function fetchFavoritesWithCompany(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from("favorites")
    .select("company_id, created_at, companies(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).filter((r) => r.companies);
}

/** يضيف شركة للمفضّلة. */
export async function addFavorite(userId, companyId) {
  const { error } = await supabase
    .from("favorites")
    .insert({ user_id: userId, company_id: companyId });
  if (error && !/duplicate|unique/i.test(error.message)) throw new Error(error.message);
}

/** يزيل شركة من المفضّلة. */
export async function removeFavorite(userId, companyId) {
  const { error } = await supabase
    .from("favorites")
    .delete()
    .eq("user_id", userId)
    .eq("company_id", companyId);
  if (error) throw new Error(error.message);
}
