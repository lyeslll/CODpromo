// ============================================================
//  CODpromo — أدوات مشتركة لدوال PayPal (دفعة وحدة بالدولار = Premium مدى الحياة)
//  المبلغ يتقرّر في الخادم (pricing_settings) ويتحفظ في paypal_orders مع tier.
//  عند الالتقاط: الحالة COMPLETED + المبلغ والعملة تاع الـ capture لازم يطابقو الطلب المحفوظ.
// ============================================================
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { grantLifetime, isTier, sameAmount, type Tier } from "./lifetime.ts";

// قاعدة عنوان PayPal: sandbox افتراضياً للأمان — بدّلها لـ live عبر secret
export const PAYPAL_BASE =
  Deno.env.get("PAYPAL_BASE_URL") || "https://api-m.sandbox.paypal.com";

// مصادقة OAuth2 مع PayPal للحصول على access token (المفتاح السري في secrets فقط)
export async function getAccessToken(): Promise<string> {
  const id = Deno.env.get("PAYPAL_CLIENT_ID") ?? "";
  const secret = Deno.env.get("PAYPAL_SECRET") ?? "";
  const auth = btoa(`${id}:${secret}`);
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.access_token) {
    throw new Error(data?.error_description || "تعذّر المصادقة مع PayPal");
  }
  return data.access_token as string;
}

export interface OrderRow {
  order_id: string;
  user_id: string;
  amount_usd: number;
  tier: Tier | null;
  status: string;
}

export const ORDER_COLUMNS = "order_id, user_id, amount_usd, tier, status";

/** أول capture مكتمل في الطلب (من ردّ capture ولا GET order). */
export function completedCapture(order: unknown) {
  // deno-lint-ignore no-explicit-any
  const units = (order as any)?.purchase_units ?? [];
  for (const u of units) {
    for (const c of u?.payments?.captures ?? []) {
      if (c?.status === "COMPLETED") return c as { id: string; amount?: { currency_code?: string; value?: string } };
    }
  }
  return null;
}

/**
 * بعد ما PayPal يأكّد الدفع: المبلغ والعملة لازم يطابقو الطلب المحفوظ، ثم التسجيل والمنح (idempotent).
 * يرجّع 'granted' | 'duplicate' | 'amount_mismatch' | 'legacy'.
 */
export async function activateOrder(
  admin: SupabaseClient,
  order: OrderRow,
  capture: { id: string; amount?: { currency_code?: string; value?: string } },
): Promise<string> {
  // طلبات الاشتراكات القديمة (قبل الدفعة الوحدة) بلا tier: ما تعطيش مدى الحياة
  if (!isTier(order.tier)) return "legacy";
  if (capture.amount?.currency_code !== "USD" || !sameAmount(capture.amount?.value, order.amount_usd)) {
    console.error(`paypal: order ${order.order_id} amount mismatch (${capture.amount?.value} ${capture.amount?.currency_code})`);
    return "amount_mismatch";
  }
  return await grantLifetime(admin, {
    provider: "paypal",
    ref: order.order_id,
    userId: order.user_id,
    amount: Number(order.amount_usd),
    currency: "USD",
    tier: order.tier,
    paymentRef: capture.id,
  });
}
