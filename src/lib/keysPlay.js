// ============================================================================
// المفاتيح الماسية داخل تطبيق Android (TWA) — Google Play برك (Digital Goods API + Payment Request).
// منتوجات consumable (تتشرى بزاف المرات): play_product_id تاع كل باقة (key_packs).
// المنح خادمي فقط: keys-play-verify يتحقق عند Google، يسجّل، ومن بعد acknowledge و consume.
// احتياط: consume من التطبيق (service.consume) كي يقول الخادم تسجّل وما تستهلكش.
// خارج التطبيق كل دالة ترجع قيمة فارغة بلا أثر (نفس playBilling.js، اللي يبقى كيما راه).
// ============================================================================
import { supabase } from "./supabaseClient.js";
import { detectAndroidApp } from "./androidApp.js";

const PLAY_METHOD = "https://play.google.com/billing";

async function getService() {
  if (!(await detectAndroidApp()) || !("getDigitalGoodsService" in window)) return null;
  try {
    return await window.getDigitalGoodsService(PLAY_METHOD);
  } catch {
    return null;
  }
}

function formatMoney(value, currency) {
  const n = Number(value);
  if (Number.isNaN(n)) return `${value} ${currency}`;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n);
  } catch {
    return `${value} ${currency}`;
  }
}

/** أسعار Play المحلية للمنتوجات → { [productId]: "900 DZD" }، ولا {} خارج التطبيق. */
export async function getKeysPlayPrices(productIds) {
  const service = await getService();
  if (!service || !productIds?.length) return {};
  try {
    const items = await service.getDetails(productIds);
    const out = {};
    for (const it of items || []) {
      const v = it.price?.value;
      const c = it.price?.currency;
      if (it.itemId && v != null && c) out[it.itemId] = formatMoney(v, c);
    }
    return out;
  } catch {
    return {};
  }
}

async function verify(purchaseToken, productId) {
  const { data, error } = await supabase.functions.invoke("keys-play-verify", { body: { purchaseToken, productId } });
  if (error || !data?.ok) return { ok: false, pending: !!data?.pending };
  return { ok: true, consumed: data.consumed === true };
}

async function consumeLocally(service, purchaseToken) {
  try {
    await service?.consume?.(purchaseToken);
  } catch {
    /* يتعاود في المزامنة الجاية */
  }
}

/**
 * شراء باقة عبر Google Play. productId = play_product_id. يرجّع { ok: true } ولا { ok: false, errorKey }
 * (errorKey يتترجم في الواجهة: keys.playErr.*).
 */
export async function purchaseKeysPlay(productId) {
  if (!(await detectAndroidApp()) || typeof PaymentRequest === "undefined" || !productId) return { ok: false, errorKey: "unavailable" };
  let response;
  try {
    const request = new PaymentRequest([{ supportedMethods: PLAY_METHOD, data: { sku: productId } }], {
      total: { label: "Total", amount: { currency: "USD", value: "0" } },
    });
    response = await request.show();
  } catch (e) {
    return { ok: false, errorKey: e?.name === "AbortError" ? "cancelled" : "unavailable" };
  }
  try {
    const token = response?.details?.token || response?.details?.purchaseToken || "";
    if (!token) {
      await response.complete("fail");
      return { ok: false, errorKey: "verify" };
    }
    const r = await verify(token, productId);
    if (!r.ok) {
      await response.complete("fail");
      return { ok: false, errorKey: r.pending ? "pending" : "verify" };
    }
    if (!r.consumed) await consumeLocally(await getService(), token);
    await response.complete("success");
    return { ok: true };
  } catch {
    try {
      await response.complete("fail");
    } catch {
      /* تجاهل آمن */
    }
    return { ok: false, errorKey: "generic" };
  }
}

/** مشتريات مفاتيح ما تأكّدتش / ما تستهلكتش (انقطع الاتصال…) → التحقق والمنح (idempotent). true إذا تزاد شي. */
export async function syncKeysPlay(productIds) {
  const service = await getService();
  if (!service?.listPurchases || !productIds?.length) return false;
  try {
    const ours = new Set(productIds);
    let granted = false;
    for (const p of (await service.listPurchases()) || []) {
      if (!ours.has(p.itemId) || !p.purchaseToken) continue;
      const r = await verify(p.purchaseToken, p.itemId);
      if (r.ok) {
        granted = true;
        if (!r.consumed) await consumeLocally(service, p.purchaseToken);
      }
    }
    return granted;
  } catch {
    return false;
  }
}
