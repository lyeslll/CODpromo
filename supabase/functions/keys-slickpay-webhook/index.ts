// ============================================================
//  CODpromo — Edge Function: keys-slickpay-webhook (المفاتيح الماسية، phase37)
//  إشعار SlickPay لفواتير المفاتيح برك (webhook_url في الفاتورة اللي صنعتها keys-checkout).
//  نفس طبقات slickpay-webhook: التوقيع (إذا تبعث)، الفاتورة لازم تكون في key_orders (ماشي slickpay_invoices —
//  فاتورة Premium هنا = 404 بلا أثر)، وإعادة التحقق عند SlickPay بمفتاحنا السري + المبلغ لازم يطابق الطلب.
//  بلا verify_jwt (SlickPay لا يرسل JWT) — انظر config.toml.
// ============================================================
import { adminClient, json } from "../_shared/lifetime.ts";
import { keysSlickpayConfirm } from "../_shared/keys.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    const body = await req.json().catch(() => ({}));

    const expected = Deno.env.get("SLICKPAY_WEBHOOK_SIGNATURE") ?? "";
    const provided =
      body?.webhook_signature ||
      req.headers.get("webhook-signature") ||
      req.headers.get("x-webhook-signature") ||
      req.headers.get("signature") ||
      "";
    if (expected && provided && provided !== expected) return json({ error: "invalid signature" }, 401);

    const invoiceId = String(body?.id ?? body?.data?.id ?? "");
    if (!invoiceId) return json({ error: "missing invoice id" }, 400);

    const admin = adminClient();
    const { data: order } = await admin
      .from("key_orders")
      .select("id")
      .eq("provider", "slickpay")
      .eq("provider_ref", invoiceId)
      .maybeSingle();
    if (!order) return json({ error: "unknown invoice" }, 404);

    await keysSlickpayConfirm(admin, invoiceId);
    return json({ received: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
