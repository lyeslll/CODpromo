import { supabase } from "./supabaseClient.js";

// ============================================================
//  مشتركو النشرة البريدية (email_subscribers)
// ============================================================

/**
 * يشترك بإيميل + موافقة. يعيد { duplicate } دون رمي خطأ عند التكرار.
 */
export async function subscribeEmail(email, consent, source = "popup") {
  const { error } = await supabase
    .from("email_subscribers")
    .insert({ email: email.trim().toLowerCase(), consent, source });
  if (error) {
    if (/duplicate|unique|23505/i.test(error.message)) return { duplicate: true };
    throw new Error(error.message);
  }
  return { duplicate: false };
}

/** يجلب كل المشتركين (لوحة الأدمن). */
export async function fetchSubscribers() {
  const { data, error } = await supabase
    .from("email_subscribers")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}
