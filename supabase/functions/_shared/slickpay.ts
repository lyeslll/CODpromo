// ============================================================
//  CODpromo — أدوات مشتركة لدوال SlickPay (دفعة وحدة بالدينار = Premium مدى الحياة)
//  المبلغ يتقرّر في الخادم (pricing_settings) ويتحفظ في slickpay_invoices مع tier.
//  التحقق دايماً عند SlickPay (GET /users/invoices/{id} بمفتاحنا) + المبلغ لازم يطابق المحفوظ.
// ============================================================
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { grantLifetime, isTier, sameAmount, type Tier } from "./lifetime.ts";

// قاعدة عنوان SlickPay: sandbox افتراضياً (devapi) للأمان — بدّلها لـ prod عبر secret
export const SLICKPAY_BASE =
  Deno.env.get("SLICKPAY_BASE_URL") || "https://devapi.slick-pay.com/api/v2";

export function slickpayHeaders() {
  return {
    Authorization: `Bearer ${Deno.env.get("SLICKPAY_PUBLIC_KEY") ?? ""}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export interface InvoiceRow {
  invoice_id: string;
  user_id: string;
  amount: number;
  tier: Tier | null;
  status: string;
}

export const INVOICE_COLUMNS = "invoice_id, user_id, amount, tier, status";

/** الحالة الموثوقة من SlickPay: مكتملة؟ وبأي مبلغ؟ */
export async function fetchInvoice(invoiceId: string) {
  const res = await fetch(`${SLICKPAY_BASE}/users/invoices/${encodeURIComponent(invoiceId)}`, {
    headers: slickpayHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  const d = data?.data ?? {};
  return {
    ok: res.ok,
    completed: data?.completed === 1 || d?.completed === 1,
    // المبلغ كما سجّلو SlickPay (fees = 0: الزبون يدفع المبلغ تماماً)
    amount: d?.amount ?? data?.amount ?? d?.total ?? null,
    status: d?.status ?? data?.status ?? null,
    reason: d?.rejection_reason ?? null,
  };
}

/**
 * بعد ما SlickPay يأكّد الدفع: المبلغ لازم يطابق الفاتورة المحفوظة، ثم التسجيل والمنح (idempotent).
 * يرجّع 'granted' | 'duplicate' | 'amount_mismatch' | 'legacy'.
 */
export async function activateInvoice(
  admin: SupabaseClient,
  invoice: InvoiceRow,
  paidAmount: unknown,
): Promise<string> {
  // فواتير الاشتراكات القديمة (قبل الدفعة الوحدة) بلا tier: ما تعطيش مدى الحياة
  if (!isTier(invoice.tier)) return "legacy";
  if (!sameAmount(paidAmount, invoice.amount)) {
    console.error(`slickpay: invoice ${invoice.invoice_id} amount mismatch (${paidAmount} ≠ ${invoice.amount})`);
    return "amount_mismatch";
  }
  return await grantLifetime(admin, {
    provider: "slickpay",
    ref: invoice.invoice_id,
    userId: invoice.user_id,
    amount: Number(invoice.amount),
    currency: "DZD",
    tier: invoice.tier,
  });
}
