// ============================================================
//  CODpromo — الأدمن: المفاتيح الماسية (phase37). كلش عبر RPCs تبدا بـ admin_assert() (SECURITY DEFINER).
//  المبيعات بلا التجربة ولا حسابات الأدمن؛ الدفتر ما يتبدّلش (الهدية والاسترداد = حركات جديدة).
// ============================================================
import { supabase } from "./supabaseClient.js";

async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    const e = new Error(error.message);
    e.code = error.code;
    throw e;
  }
  return data;
}

/** { orders, keys_sold, buyers, refunded_orders, tests, keys_used, keys_gifted, keys_removed, keys_outstanding, revenue[], by_pack, by_provider, upgraded, credit_full, credit_checkout, series[{t, sold, used}], packs } */
export const fetchKeysStats = () => rpc("admin_keys_stats");

/** الحسابات اللي عندهم حركة: { user_id, email, full_name, balance, bought, used, gifted, removed, premium, last_at, total_count }[] */
export const listKeysAccounts = async (search = "", limit = 50, offset = 0) =>
  (await rpc("admin_keys_accounts", { p_search: search || null, p_limit: limit, p_offset: offset })) || [];

/** { balance, locked, credit, rows: [{ id, kind, delta, created_at, note, source, by, company, order }] } */
export const fetchKeysHistory = (userId) => rpc("admin_keys_history", { p_user: userId });

/** إهداء مفاتيح بالإيميل مع السبب (1–20). P0002 = الإيميل ما كاينش. */
export const giftKeys = (email, count, reason) =>
  rpc("admin_gift_keys", { p_email: String(email || "").trim(), p_count: Math.round(Number(count)), p_reason: String(reason || "").trim() });

/** filter: all | paid | eligible | refunded | pending */
export const listKeyOrders = async (filter = "all", limit = 50, offset = 0) =>
  (await rpc("admin_list_key_orders", { p_filter: filter, p_limit: limit, p_offset: offset })) || [];

/** "سجّل الاسترداد": المفاتيح اللي ما تستعملوش تتنحّى → { status: refunded | already | all_used | not_found, removed, amount, currency } */
export const refundKeyOrder = (id) => rpc("admin_refund_key_order", { p_id: id });

/** شراءات Premium اللي تحسب فيها رصيد المفاتيح (+ التفعيل الكامل بالرصيد) */
export const listCreditUses = async () => (await rpc("admin_credit_uses")) || [];

/** رجوع تفعيل Premium بالرصيد كامل (تجربة مثلاً): 'revoked' | 'not_found' */
export const revokeCreditUpgrade = (id) => rpc("admin_revoke_credit_upgrade", { p_id: id });

/** إلغاء حجز دفع Premium بالرصيد اللي ما كملش (الفاتورة القديمة ما تعطيش Premium): 'voided' | 'completed' | 'not_found' */
export const voidCreditCheckout = (id) => rpc("admin_void_credit_checkout", { p_id: id });

/**
 * تنبيهات /admin/sales (phase38): { open: [{ id, kind: refund_needed | uncovered, note, provider, amount, currency,
 * at, email, payment_ref, amount_due, credit }], granted: [{ id, provider, amount, currency, at, email }] }
 */
export const fetchCreditAlerts = () => rpc("admin_credit_alerts");

/** action: refunded | grant | keep → 'refunded' | 'granted' | 'kept' | 'has_premium' | 'amount' | 'failed' | 'not_found' */
export const resolveCreditAlert = (id, action) => rpc("admin_credit_alert_resolve", { p_id: id, p_action: action });

/** { packs: [{ id, keys, price_dzd, price_usd, play_product_id, is_active, position, updated_at }], pricing } */
export const fetchAdminKeyPacks = () => rpc("admin_key_packs");

export const saveKeyPack = (p) =>
  rpc("admin_save_key_pack", {
    p_id: p.id,
    p_keys: Math.round(Number(p.keys)),
    p_dzd: Math.round(Number(p.price_dzd)),
    p_usd: Number(p.price_usd),
    p_active: !!p.is_active,
    p_position: Math.round(Number(p.position) || 0),
  });
