import { supabase } from "./supabaseClient.js";

// يستدعي Edge Function الآمنة لإنشاء جلسة دفع Stripe، ثم يوجّه المستخدم
// إلى صفحة Stripe المستضافة. لا تمرّ أي مفاتيح سرّية عبر المتصفّح إطلاقاً.
export async function startPremiumCheckout() {
  const { data, error } = await supabase.functions.invoke("create-checkout-session", {
    body: {},
  });
  if (error) throw new Error(error.message || "تعذّر بدء عملية الدفع");
  if (!data?.url) throw new Error("لم يصل رابط الدفع من الخادم");
  window.location.href = data.url;
}
