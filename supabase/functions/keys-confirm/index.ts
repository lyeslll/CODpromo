// ============================================================
//  CODpromo — Edge Function: keys-confirm (المفاتيح الماسية، phase37)
//  صفحة /keys/return تناديها بعد الرجوع من البوابة (بلا ما تستنى الـ webhook):
//   POST { provider: "stripe" | "slickpay" | "paypal", ref? } + JWT
//     → الطلب لازم يكون تاع هاد الحساب، والتحقق دايماً عند البوابة بمفتاحنا السري.
//   POST { provider: "sync" } → يعاود يتحقق من الطلبات المعلّقة تاع الحساب (آخر 3 أيام): دفع كمل والمتصفّح تسكّر.
//  المفاتيح تتزاد مرة وحدة برك (keys_order_paid، idempotent مع الـ webhooks).
// ============================================================
import { adminClient, authUser, corsHeaders, json } from "../_shared/lifetime.ts";
import {
  isKeysProvider,
  keysPaypalCapture,
  keysSlickpayConfirm,
  keysStripeSession,
  ownOrder,
  stripeClient,
  type KeysProvider,
} from "../_shared/keys.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/** يتحقق من طلب واحد عند البوابة. 'paid' | 'pending' | 'failed' | 'mismatch' */
async function confirm(admin: SupabaseClient, provider: KeysProvider, ref: string): Promise<{ status: string; reason?: string | null }> {
  if (provider === "stripe") {
    const s = await stripeClient().checkout.sessions.retrieve(ref);
    if (s.status === "expired") return { status: "failed" };
    const r = await keysStripeSession(admin, s);
    return { status: r === "granted" || r === "duplicate" ? "paid" : r === "not paid yet" ? "pending" : "mismatch", reason: r };
  }
  if (provider === "slickpay") {
    const r = await keysSlickpayConfirm(admin, ref);
    return { status: r === "granted" || r === "duplicate" ? "paid" : r === "pending" || r === "failed" ? r : "mismatch", reason: r };
  }
  const r = await keysPaypalCapture(admin, ref);
  return { status: r.status === "granted" || r.status === "duplicate" ? "paid" : r.status === "pending" || r.status === "failed" ? r.status : "mismatch", reason: r.reason ?? r.status };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const user = await authUser(req);
    if (!user) return json({ error: "unauthorized" }, 401);
    const body = await req.json().catch(() => ({}));
    const admin = adminClient();

    if (body?.provider === "sync") {
      const since = new Date(Date.now() - 3 * 864e5).toISOString();
      const { data: rows } = await admin
        .from("key_orders")
        .select("provider, provider_ref")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .in("provider", ["stripe", "slickpay", "paypal"])
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(5);
      let paid = 0;
      for (const o of rows ?? []) {
        try {
          const r = await confirm(admin, o.provider as KeysProvider, o.provider_ref);
          if (r.status === "paid") paid += 1;
        } catch {
          /* البوابة ما ردّتش: المرة الجاية */
        }
      }
      return json({ keys: true, paid });
    }

    const provider = body?.provider;
    if (!isKeysProvider(provider)) return json({ error: "bad request" }, 400);
    const order = await ownOrder(admin, user.id, provider, body?.ref ? String(body.ref) : null);
    if (!order) return json({ error: "not found" }, 404);
    if (order.status === "paid") return json({ keys: true, status: "paid", count: order.keys });

    const r = await confirm(admin, provider, order.provider_ref);
    return json({ keys: true, status: r.status, count: order.keys, reason: r.status === "paid" ? null : r.reason ?? null });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
