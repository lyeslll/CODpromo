// ============================================================
//  CODpromo — Edge Function: stripe-webhook
//  يستقبل أحداث Stripe (نجاح/تجديد/إلغاء) ويزامن حالة Premium في profiles.
//  Stripe = مصدر الحقيقة. يتحقّق من توقيع الـ webhook قبل أي تحديث.
//  ملاحظة: هذه الدالة بلا verify_jwt (Stripe لا يرسل JWT) — انظر config.toml.
// ============================================================
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  httpClient: Stripe.createFetchHttpClient(),
});
// مزوّد تشفير غير متزامن للتحقق من التوقيع في بيئة Deno
const cryptoProvider = Stripe.createSubtleCryptoProvider();

// عميل بصلاحيات كاملة لتجاوز RLS عند الكتابة من الخادم
const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

/** يزامن حالة اشتراك Stripe إلى جدول profiles. */
async function syncSubscription(
  sub: Stripe.Subscription,
  userIdHint?: string | null,
  customerId?: string | null,
) {
  const active = ["active", "trialing"].includes(sub.status);
  const premiumUntil = sub.current_period_end
    ? new Date(sub.current_period_end * 1000).toISOString()
    : null;

  // حدّد صاحب الحساب: من الميتاداتا أولاً، وإلا عبر stripe_customer_id
  let targetId = userIdHint || (sub.metadata?.supabase_user_id ?? null);
  const cust = customerId ?? (sub.customer as string | null);
  if (!targetId && cust) {
    const { data } = await admin
      .from("profiles")
      .select("id")
      .eq("stripe_customer_id", cust)
      .maybeSingle();
    targetId = data?.id ?? null;
  }
  if (!targetId) return;

  await admin
    .from("profiles")
    .update({
      is_premium: active,
      premium_until: active ? premiumUntil : null,
      subscription_status: sub.status,
      stripe_customer_id: cust ?? undefined,
    })
    .eq("id", targetId);
}

Deno.serve(async (req) => {
  const signature = req.headers.get("Stripe-Signature");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature ?? "",
      Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "",
      undefined,
      cryptoProvider,
    );
  } catch (err) {
    return new Response(`signature verification failed: ${(err as Error).message}`, {
      status: 400,
    });
  }

  try {
    switch (event.type) {
      // إتمام الدفع لأول مرة
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.subscription) {
          const sub = await stripe.subscriptions.retrieve(s.subscription as string);
          await syncSubscription(
            sub,
            s.client_reference_id ?? s.metadata?.supabase_user_id,
            s.customer as string,
          );
        }
        break;
      }
      // إنشاء/تحديث/إلغاء الاشتراك (تجديد، تغيير حالة، إلغاء)
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await syncSubscription(sub, sub.metadata?.supabase_user_id, sub.customer as string);
        break;
      }
      // نجاح فاتورة التجديد الشهري
      case "invoice.payment_succeeded": {
        const inv = event.data.object as Stripe.Invoice;
        if (inv.subscription) {
          const sub = await stripe.subscriptions.retrieve(inv.subscription as string);
          await syncSubscription(sub, sub.metadata?.supabase_user_id, sub.customer as string);
        }
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(`handler error: ${(e as Error).message}`, { status: 500 });
  }
});
