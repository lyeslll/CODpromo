// ============================================================
//  CODpromo — الأدمن: الأسعار والمبيعات (phase32، Premium مدى الحياة)
//  كلش عبر RPCs تبدا بـ admin_assert() (SECURITY DEFINER، count دقيق). المبيعات = جدول purchases
//  برك: الهدايا والمفتاح الذهبي ما يكتبوش فيه، وحسابات الأدمن ما تتحسبش.
// ============================================================
import { supabase } from "./supabaseClient.js";

async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}

/** { launch_price_dzd, launch_price_usd, regular_price_dzd, regular_price_usd, launch_seats, seats_sold, seats_left, tier, launch_closed_at, updated_at } */
export const fetchAdminPricing = () => rpc("admin_pricing");

export const saveAdminPricing = (v) =>
  rpc("admin_update_pricing", {
    p_launch_dzd: Math.round(Number(v.launch_price_dzd)),
    p_launch_usd: Number(v.launch_price_usd),
    p_regular_dzd: Math.round(Number(v.regular_price_dzd)),
    p_regular_usd: Number(v.regular_price_usd),
    p_seats: Math.round(Number(v.launch_seats)),
  });

/** { buyers, purchases, refunded, revenue[], refunded_amount[], by_provider, by_tier, after_gift, after_free_key, series, pricing } */
export const fetchSalesStats = () => rpc("admin_sales_stats");

/** filter: all | active | eligible | refunded */
export const listPurchases = async (filter = "all", limit = 50, offset = 0) =>
  (await rpc("admin_list_purchases", { p_filter: filter, p_limit: limit, p_offset: offset })) || [];

/** "سحب Premium بعد الاسترداد": refunded_at + Premium يتنحّى إذا ما بقالو حتى شراء. 'revoked' | 'already' | 'not_found' */
export const revokePurchase = (id) => rpc("admin_revoke_purchase", { p_id: id });

// ===================== سعر التجربة (حساب واحد، 30 دقيقة) =====================

/** { user_id, email, price_dzd, price_usd, expires_at, already_premium } — يرمي P0002 إذا الإيميل ما كاينش. */
export const setTestPrice = (email, dzd, usd) =>
  rpc("admin_set_test_price", { p_email: email, p_dzd: Math.round(Number(dzd)), p_usd: Number(usd) });

/** أسعار التجربة النشطة: [{ user_id, email, price_dzd, price_usd, expires_at }] */
export const listTestPrices = async () => (await rpc("admin_test_prices")) || [];

/** إيقاف قبل الوقت. */
export const stopTestPrice = (userId) => rpc("admin_stop_test_price", { p_user: userId });
