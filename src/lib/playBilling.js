// ============================================================================
// Google Play Billing — داخل تطبيق TWA فقط (Digital Goods API + Payment Request)
// ----------------------------------------------------------------------------
// طبقة معزولة تماماً: إن لم يكن Play Billing متوفّراً (أي على الويب أو أي متصفّح
// عادي) فكل دالة هنا ترجع قيمة فارغة (null / [] / {}) ولا تُحدث أي أثر إطلاقاً.
// بهذا يبقى نظام الدفع الويب (Stripe / PayPal / SlickPay) كما هو بلا أي تغيير.
//
// المنح الفعلي لـ Premium يتم خادمياً فقط: الكلاينت يبعث purchaseToken إلى
// Edge Function اسمها 'verify-play-purchase' (تُنشأ لاحقاً) ولا يمنح أي صلاحية
// محلياً. supabase.functions.invoke يُرفق جلسة المستخدم (JWT) تلقائياً.
// ============================================================================

import { supabase } from "./supabaseClient.js";

// طريقة الدفع المعتمدة من Google Play Billing
const PLAY_METHOD = "https://play.google.com/billing";

// خريطة مفاتيح الباقات → معرّفات المنتجات في Google Play Console (بالضبط)
export const PLAY_PRODUCT_IDS = {
  month: "premium_monthly",
  quarter: "premium_quarterly",
  year: "premium_yearly",
};

// كل معرّفات المنتجات (للاستعلام عن الأسعار دفعة واحدة)
const ALL_PRODUCT_IDS = Object.values(PLAY_PRODUCT_IDS);

// ----------------------------------------------------------------------------
// كشف توفّر Play Billing (رَن-تايم). صحيح فقط داخل تطبيق TWA المؤهّل.
// ----------------------------------------------------------------------------
export function isPlayBillingSupported() {
  return (
    typeof window !== "undefined" &&
    "getDigitalGoodsService" in window &&
    typeof document !== "undefined" &&
    document.referrer.startsWith("android-app://")
  );
}

// يجلب خدمة Digital Goods الخاصة بـ Play (أو null إن لم تتوفّر).
async function getService() {
  if (!isPlayBillingSupported()) return null;
  try {
    return await window.getDigitalGoodsService(PLAY_METHOD);
  } catch {
    return null; // غير مؤهّل (متصفّح عادي، أو خطأ) → لا أثر
  }
}

// ----------------------------------------------------------------------------
// جلب تفاصيل/أسعار المنتجات الثلاثة (للعرض فقط). يرجع خريطة:
//   { month: {price, currency, raw}, quarter: {...}, year: {...} }
// إن لم يتوفّر Play أو فشل الجلب → {} (لا أثر).
// ----------------------------------------------------------------------------
export async function getPlayDetails() {
  const service = await getService();
  if (!service) return {};
  try {
    const items = await service.getDetails(ALL_PRODUCT_IDS);
    if (!Array.isArray(items)) return {};
    // اعكس معرّف المنتج → مفتاح الباقة
    const idToKey = Object.fromEntries(
      Object.entries(PLAY_PRODUCT_IDS).map(([key, id]) => [id, key])
    );
    const map = {};
    for (const item of items) {
      const key = idToKey[item.itemId];
      if (!key) continue;
      const value = item.price?.value;
      const currency = item.price?.currency;
      map[key] = {
        currency: currency || "",
        // السعر المنسّق محلياً من Play (مثال: "$9.99")
        price:
          value != null && currency
            ? formatMoney(value, currency)
            : value ?? "",
        raw: item,
      };
    }
    return map;
  } catch {
    return {};
  }
}

// تنسيق مبلغ Play (قيمة نصّية + عملة) بشكل محلّي لطيف، مع fallback آمن.
function formatMoney(value, currency) {
  const num = Number(value);
  if (Number.isNaN(num)) return `${value} ${currency}`;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(num);
  } catch {
    return `${value} ${currency}`;
  }
}

// ----------------------------------------------------------------------------
// شراء باقة عبر Google Play Billing.
//   planKey: "month" | "quarter" | "year"
//   onVerified: دالة تُستدعى بعد تأكيد الخادم (عادةً refreshProfile)
// يرجع: { ok: true } عند النجاح، أو { ok: false, errorKey } عند الفشل/الإلغاء.
// errorKey يُترجَم في الواجهة عبر premium.playErr.<key> (لا نصوص hardcoded هنا).
// ----------------------------------------------------------------------------
export async function purchasePlay(planKey, { onVerified } = {}) {
  if (!isPlayBillingSupported() || typeof PaymentRequest === "undefined") {
    return { ok: false, errorKey: "unavailable" };
  }

  const sku = PLAY_PRODUCT_IDS[planKey];
  if (!sku) return { ok: false, errorKey: "unavailable" };

  let paymentResponse;
  try {
    const request = new PaymentRequest(
      [{ supportedMethods: PLAY_METHOD, data: { sku } }],
      // Play يتجاهل هذا المجموع ويعرض سعره الخاص؛ مطلوب فقط لبناء الطلب.
      { total: { label: "Total", amount: { currency: "USD", value: "0" } } }
    );
    paymentResponse = await request.show();
  } catch (e) {
    // المستخدم ألغى الورقة، أو الطلب غير صالح
    if (e && e.name === "AbortError") return { ok: false, errorKey: "cancelled" };
    return { ok: false, errorKey: "unavailable" };
  }

  try {
    // رمز الشراء من Play (نسخ مختلفة قد تستخدم اسماً مختلفاً)
    const purchaseToken =
      paymentResponse?.details?.token ||
      paymentResponse?.details?.purchaseToken ||
      "";

    if (!purchaseToken) {
      await paymentResponse.complete("fail");
      return { ok: false, errorKey: "verify" };
    }

    // التحقق والمنح خادمياً فقط — JWT يُرفق تلقائياً عبر جلسة supabase.
    const { data, error } = await supabase.functions.invoke(
      "verify-play-purchase",
      { body: { purchaseToken, productId: sku } }
    );

    if (error || !data?.ok) {
      await paymentResponse.complete("fail");
      return { ok: false, errorKey: "verify" };
    }

    // نجح: حدّث الملف الشخصي ثم أكمل ورقة الدفع بنجاح.
    await onVerified?.();
    await paymentResponse.complete("success");
    return { ok: true };
  } catch {
    try {
      await paymentResponse.complete("fail");
    } catch {
      /* تجاهل آمن */
    }
    return { ok: false, errorKey: "generic" };
  }
}
