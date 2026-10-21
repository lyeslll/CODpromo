import { supabase } from "./supabaseClient.js";

// ============================================================
//  استعلامات لوحة الأدمن (تتطلب سياسات قراءة عامة — راجع supabase-phase4.sql)
// ============================================================

/** كل المستخدمين (من جدول profiles) — مع حقول Premium للوحة الأدمن. */
export async function fetchAllProfiles() {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id,email,full_name,account_type,company_name,phone,website,created_at," +
        "is_premium,premium_until,subscription_status,plan_type,payment_provider,slickpay_invoice_id"
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

/**
 * أصحاب Premium (حاليين أو سابقين): is_premium، أو premium_until، أو طريقة دفع مسجّلة
 * (إلغاء Stripe يفرّغ premium_until) — بلا الأدمن.
 * الواجهة تقسمهم فعّال / منتهي بنفس قاعدة has_premium_access.
 */
export async function fetchPremiumProfiles() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,full_name,created_at,is_premium,premium_until,subscription_status,plan_type,payment_provider,is_admin")
    .or("is_premium.eq.true,premium_until.not.is.null,payment_provider.not.is.null")
    .order("premium_until", { ascending: false, nullsFirst: true });
  if (error) throw new Error(error.message);
  return (data || []).filter((p) => !p.is_admin);
}

/** Premium فعّال (نفس قاعدة has_premium_access في القاعدة، بلا الأدمن). */
export const isActivePremium = (p) => !!(p.is_premium && (!p.premium_until || new Date(p.premium_until) > new Date()));

/** كل طلبات الشركات. */
export async function fetchAllRequests() {
  const { data, error } = await supabase
    .from("company_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}
