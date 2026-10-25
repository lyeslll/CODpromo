import { supabase } from "./supabaseClient.js";

// ============================================================
//  نقرات ملف العروض العام (phase offers-feed): كل نقرة من ilyesderradji.com تمرّ عبر
//  codpromo.com/go/<id> وتتسجّل في feed_clicks (مقفول: RLS بلا سياسات) — الأرقام عبر RPC برك.
// ============================================================

/** لوحة الشريك: [{ company_id, total, d30 }] لشركاتو برك (company_owners). */
export async function fetchPartnerFeedClicks() {
  const { data, error } = await supabase.rpc("partner_feed_clicks");
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? data : [];
}

/** الأدمين: { d7, d30, total, other } لشركة وحدة (أصفار إذا ما كاين حتى نقرة). */
export async function fetchAdminFeedClicks(companyId) {
  const { data, error } = await supabase.rpc("admin_feed_clicks", { p_company: companyId });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data.find((r) => r.company_id === companyId) : null;
  return { d7: row?.d7 || 0, d30: row?.d30 || 0, total: row?.total || 0, other: row?.other || 0 };
}
