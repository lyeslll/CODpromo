import { supabase } from "./supabaseClient.js";

// ============================================================
//  CODpromo — تقييم الشركات (phase34)
//  الجدول company_ratings مقفول كامل: القراءة والكتابة عبر RPCs برك.
//  rate_company يتحقق من كلش في القاعدة (الحساب، الإيميل، صاحب الشركة، القيم، الحدّ).
// ============================================================

async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}

/** { count, avg, dist, tags: [{ tag, n }], kind } — بلا التقييمات المخبّية. */
export const fetchRatingSummary = (companyId) => rpc("company_rating_summary", { p_company_id: companyId });

/** تقييمي: { stars, tags, updated_at, hidden } ولا null. */
export const fetchMyRating = (companyId) => rpc("my_company_rating", { p_company_id: companyId });

/** { status: ok | auth | unconfirmed | disposable | owner | company_account | rate_limited | unavailable | invalid, mine, summary } */
export const rateCompany = (companyId, stars, tags = []) =>
  rpc("rate_company", { p_company_id: companyId, p_stars: stars, p_tags: tags });

/** الأدمن: آخر التقييمات (كل شركة ولا وحدة). */
export const listRatings = async (companyId = null) => (await rpc("admin_list_ratings", { p_company_id: companyId, p_limit: 500 })) || [];

/** الأدمن: تخبية / إظهار تقييم (المخبّي ما يتحسبش). */
export const setRatingHidden = (id, hidden) => rpc("admin_set_rating_hidden", { p_id: id, p_hidden: hidden });
