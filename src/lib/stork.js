import { supabase } from "./supabaseClient.js";

const PREMIUM_DAYS = 30;

/**
 * يفعّل كود Stork:
 *  - يتحقق من وجوده وعدم استخدامه
 *  - يعلّمه مستخدماً (used_by للمسجّل)
 *  - يمنح المستخدم المسجّل صفة Premium لمدة 30 يوماً
 * يعيد { ok } أو { ok:false, error }.
 */
export async function redeemStork(code, userId) {
  // الأخطاء تُعاد كمفاتيح (errorKey) ليترجمها الواجهة عبر t(`premium.storkErr.${key}`).
  const c = (code || "").trim().toUpperCase();
  if (!c) return { ok: false, errorKey: "enter" };

  const { data, error } = await supabase
    .from("stork_codes")
    .select("id,is_used")
    .eq("code", c)
    .maybeSingle();
  if (error) return { ok: false, errorKey: "verify" };
  if (!data) return { ok: false, errorKey: "invalid" };
  if (data.is_used) return { ok: false, errorKey: "used" };

  const { error: uErr } = await supabase
    .from("stork_codes")
    .update({ is_used: true, used_by: userId || null, used_at: new Date().toISOString() })
    .eq("id", data.id);
  if (uErr) return { ok: false, errorKey: "activate" };

  if (userId) {
    await supabase
      .from("profiles")
      .update({
        is_premium: true,
        premium_until: new Date(Date.now() + PREMIUM_DAYS * 86400000).toISOString(),
      })
      .eq("id", userId);
  }
  return { ok: true };
}

// ===================== إدارة (لوحة الأدمن) =====================

export async function fetchStorkCodes() {
  const { data, error } = await supabase
    .from("stork_codes")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function addStorkCode(code) {
  const { data, error } = await supabase
    .from("stork_codes")
    .insert({ code: code.trim().toUpperCase() })
    .select()
    .single();
  if (error) throw new Error(/duplicate|unique|23505/i.test(error.message) ? "هذا الكود موجود مسبقاً" : error.message);
  return data;
}
