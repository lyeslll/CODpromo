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

// ===================== SlickPay (الدفع الجزائري) =====================

// ينشئ فاتورة SlickPay لباقة مختارة ويوجّه المستخدم لصفحة SATIM.
export async function startSlickpayCheckout(plan) {
  const { data, error } = await supabase.functions.invoke("slickpay-create-invoice", {
    body: { plan },
  });
  if (error) throw new Error(error.message || "تعذّر بدء عملية الدفع");
  if (!data?.url) throw new Error(data?.error || "لم يصل رابط الدفع من الخادم");
  // احفظ معرّف الفاتورة احتياطاً (صفحة العودة تقرأه أيضاً من قاعدة البيانات)
  try {
    sessionStorage.setItem("codpromo:slickpay-invoice", data.invoice_id);
  } catch {
    /* تجاهل آمن */
  }
  window.location.href = data.url;
}

// يتحقق من حالة فاتورة SlickPay عبر Edge Function (بعد العودة من SATIM).
export async function checkSlickpayInvoice(invoiceId) {
  const { data, error } = await supabase.functions.invoke("slickpay-invoice-status", {
    body: { invoice_id: invoiceId },
  });
  if (error) throw new Error(error.message || "تعذّر التحقق من حالة الدفع");
  return data;
}

// يجلب آخر فاتورة SlickPay للمستخدم (للاستخدام في صفحة العودة).
export async function latestSlickpayInvoiceId(userId) {
  const { data } = await supabase
    .from("slickpay_invoices")
    .select("invoice_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.invoice_id ?? null;
}
