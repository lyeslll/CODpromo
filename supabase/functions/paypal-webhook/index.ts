// ============================================================
//  CODpromo — Edge Function: paypal-webhook
//  الاسترداد من PayPal → Premium يتنحّى وحدو.
//  الأحداث: PAYMENT.CAPTURE.REFUNDED و PAYMENT.CAPTURE.REVERSED.
//  الأمان: التوقيع يتحقق منو PayPal نفسو (POST /v1/notifications/verify-webhook-signature
//  بـ PAYPAL_WEBHOOK_ID)، ومن بعد نقراو حالة الـ capture عند PayPal بمفتاحنا:
//  REFUNDED (استرداد كامل) ولا REVERSED برك ينحّيو Premium — الجزئي لا.
//  بلا verify_jwt (PayPal لا يرسل JWT) — انظر config.toml.
// ============================================================
import { adminClient, json, revokeLifetime } from "../_shared/lifetime.ts";
import { PAYPAL_BASE, getAccessToken } from "../_shared/paypal.ts";
// المفاتيح الماسية (phase37): الاسترداد على capture تاع key_orders برك (capture تاع Premium = بلا أثر هنا)
import { keysRefundGateway } from "../_shared/keys.ts";

const EVENTS = new Set(["PAYMENT.CAPTURE.REFUNDED", "PAYMENT.CAPTURE.REVERSED"]);

/** معرّف الـ capture: من رابط "up" في الاسترداد، ولا الـ resource نفسو. */
// deno-lint-ignore no-explicit-any
function captureIdOf(resource: any): string | null {
  const up = (resource?.links ?? []).find((l: { rel: string; href: string }) => l.rel === "up")?.href ?? "";
  const m = /\/captures\/([^/?#]+)/.exec(up);
  if (m) return decodeURIComponent(m[1]);
  return resource?.id ? String(resource.id) : null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const webhookId = Deno.env.get("PAYPAL_WEBHOOK_ID") ?? "";
  if (!webhookId) return json({ error: "not configured" }, 503);

  try {
    const raw = await req.text();
    const event = JSON.parse(raw);
    const token = await getAccessToken();

    // 1) التوقيع عند PayPal (مصدر الحقيقة)
    const vRes = await fetch(`${PAYPAL_BASE}/v1/notifications/verify-webhook-signature`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        auth_algo: req.headers.get("paypal-auth-algo"),
        cert_url: req.headers.get("paypal-cert-url"),
        transmission_id: req.headers.get("paypal-transmission-id"),
        transmission_sig: req.headers.get("paypal-transmission-sig"),
        transmission_time: req.headers.get("paypal-transmission-time"),
        webhook_id: webhookId,
        webhook_event: event,
      }),
    });
    const verify = await vRes.json().catch(() => ({}));
    if (verify?.verification_status !== "SUCCESS") return json({ error: "invalid signature" }, 401);

    if (!EVENTS.has(event?.event_type)) return json({ received: true });

    // 2) الحالة الموثوقة تاع الـ capture
    const captureId = captureIdOf(event?.resource);
    if (!captureId) return json({ received: true });
    const cRes = await fetch(`${PAYPAL_BASE}/v2/payments/captures/${encodeURIComponent(captureId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const capture = await cRes.json().catch(() => ({}));
    if (capture?.status === "REFUNDED" || capture?.status === "REVERSED") {
      await revokeLifetime(adminClient(), "paypal", captureId);
    }
    // مفاتيح: حتى الاسترداد الجزئي (PARTIALLY_REFUNDED) ينحّي المفاتيح اللي ما تستعملوش من هاد الطلب
    if (capture?.status === "REFUNDED" || capture?.status === "REVERSED" || capture?.status === "PARTIALLY_REFUNDED") {
      const full = capture?.status !== "PARTIALLY_REFUNDED";
      const refunded = full ? Number(capture?.amount?.value) : Number(event?.resource?.amount?.value);
      await keysRefundGateway(adminClient(), "paypal", captureId, Number.isFinite(refunded) ? refunded : 0);
    }
    return json({ received: true });
  } catch (e) {
    // 500 → PayPal يعاود يبعث الحدث (السحب idempotent)
    return json({ error: (e as Error).message }, 500);
  }
});
