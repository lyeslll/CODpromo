import { supabase } from "./supabaseClient.js";

/**
 * يفعّل كود Stork عبر RPC خادمية ذرّية (redeem_stork_code):
 *  - يتحقق خادمياً من وجود الكود وعدم استخدامه
 *  - يعلّمه مستخدماً (used_by = صاحب الجلسة) ويمنحه 30 يوم Premium ذرّياً
 * المنطق كله في الخادم — لا كتابة مباشرة على stork_codes/profiles من المتصفّح.
 * يعيد { ok } أو { ok:false, errorKey } لتترجمه الواجهة عبر t(`premium.storkErr.${key}`).
 */
export async function redeemStork(code) {
  const c = (code || "").trim().toUpperCase();
  if (!c) return { ok: false, errorKey: "enter" };

  const { data, error } = await supabase.rpc("redeem_stork_code", { code: c });
  if (error) return { ok: false, errorKey: "verify" };

  if (data === "ok") return { ok: true };
  // خريطة حالات الخادم → مفاتيح ترجمة معروفة (غير المعروف → verify)
  const known = { invalid: "invalid", used: "used", enter: "enter" };
  return { ok: false, errorKey: known[data] || "verify" };
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
