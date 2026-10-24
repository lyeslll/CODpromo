import { supabase } from "./supabaseClient.js";

// ============================================================
//  CODpromo — الدفعة الوحدة (Premium مدى الحياة) عبر Edge Functions
//  المتصفّح ما يبعث حتى مبلغ: السعر (إطلاق / عادي) يتقرّر في الخادم.
//  لا تمرّ أي مفاتيح سرّية عبر المتصفّح إطلاقاً.
//  ما نوجّهوش للدفع إلا إذا أكّد الخادم lifetime: true (دالة قديمة = اشتراك بسعر آخر → رفض).
// ============================================================

/** خطأ مقروء: code = 'already_premium' | 'outdated' | … (يترجمو PremiumModal). */
async function invoke(name) {
  const { data, error } = await supabase.functions.invoke(name, { body: { flow: "lifetime" } });
  if (error) {
    let payload = null;
    try {
      payload = await error.context?.json?.();
    } catch {
      /* ردّ بلا JSON */
    }
    const e = new Error(payload?.error || error.message || "payment");
    e.code = payload?.code || (payload?.error === "already_premium" ? "already_premium" : null);
    throw e;
  }
  if (!data?.lifetime || !data?.url) {
    const e = new Error(data?.error || "outdated");
    e.code = "outdated";
    throw e;
  }
  return data;
}

// ===================== Stripe (بطاقة دولية بالدولار) =====================
export async function startStripeCheckout() {
  const data = await invoke("create-checkout-session");
  window.location.href = data.url;
}

// ===================== SlickPay (الدفع الجزائري) =====================

/** ينشئ فاتورة SlickPay ويوجّه المستخدم لصفحة SATIM. */
export async function startSlickpayCheckout() {
  const data = await invoke("slickpay-create-invoice");
  // احفظ معرّف الفاتورة احتياطاً (صفحة العودة تقرأه أيضاً من قاعدة البيانات)
  try {
    sessionStorage.setItem("codpromo:slickpay-invoice", data.invoice_id);
  } catch {
    /* تجاهل آمن */
  }
  window.location.href = data.url;
}

/** يتحقق من حالة فاتورة SlickPay عبر Edge Function (بعد العودة من SATIM). */
export async function checkSlickpayInvoice(invoiceId) {
  const { data, error } = await supabase.functions.invoke("slickpay-invoice-status", {
    body: { invoice_id: invoiceId },
  });
  if (error) throw new Error(error.message || "تعذّر التحقق من حالة الدفع");
  return data;
}

/** آخر فاتورة SlickPay للمستخدم (للاستخدام في صفحة العودة). */
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

// ===================== PayPal (الدفع الدولي بالدولار) =====================

/** ينشئ طلب PayPal ويوجّه المستخدم لصفحة موافقة PayPal. */
export async function startPaypalCheckout() {
  const data = await invoke("paypal-create-order");
  try {
    sessionStorage.setItem("codpromo:paypal-order", data.order_id);
  } catch {
    /* تجاهل آمن */
  }
  window.location.href = data.url;
}

/** يلتقط طلب PayPal بعد العودة من صفحة الموافقة (يفعّل Premium مدى الحياة عند النجاح). */
export async function capturePaypalOrder(orderId) {
  const { data, error } = await supabase.functions.invoke("paypal-capture-order", {
    body: { order_id: orderId },
  });
  if (error) throw new Error(error.message || "تعذّر تأكيد الدفع");
  return data;
}

// ===================== سجلّ المشتريات (داشبورد الزبون) =====================

/** آخر شراء نشط للمستخدم (RLS: مشترياتو برك) — تاريخ الشراء في بطاقة الخطة. */
export async function fetchMyPurchase(userId) {
  const { data } = await supabase
    .from("purchases")
    .select("provider, amount, currency, tier, purchased_at")
    .eq("user_id", userId)
    .is("refunded_at", null)
    .order("purchased_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}
