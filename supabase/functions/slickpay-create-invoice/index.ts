// ============================================================
//  CODpromo — Edge Function: slickpay-create-invoice
//  ينشئ فاتورة SlickPay (دفع لمرة واحدة بالبطاقة الجزائرية CIB/Edahabia)
//  لباقة Premium مختارة، ويعيد رابط دفع SATIM.
//  المفتاح السري لـ SlickPay يبقى في secrets فقط.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  PLANS,
  SLICKPAY_BASE,
  corsHeaders,
  json,
  slickpayHeaders,
  adminClient,
} from "../_shared/slickpay.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // 1) تحقّق من هوية المستخدم عبر JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    // 2) تحقّق من الباقة (المبلغ والمدة من الخادم فقط — لا يُوثق بالمتصفّح)
    const { plan } = await req.json().catch(() => ({}));
    const cfg = PLANS[plan as string];
    if (!cfg) return json({ error: "باقة غير صالحة" }, 400);

    // 3) احصل على UUID الحساب (من secret إن وُجد، وإلا من /users/accounts)
    let accountUuid = Deno.env.get("SLICKPAY_ACCOUNT_UUID") || "";
    if (!accountUuid) {
      const accRes = await fetch(`${SLICKPAY_BASE}/users/accounts`, {
        headers: slickpayHeaders(),
      });
      const accJson = await accRes.json().catch(() => ({}));
      const accounts = accJson?.data ?? [];
      const def = accounts.find((a: { default: number }) => a.default === 1) ?? accounts[0];
      accountUuid = def?.uuid ?? "";
      if (!accountUuid) return json({ error: "تعذّر تحديد حساب SlickPay" }, 400);
    }

    // 4) أنشئ الفاتورة
    const supaUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const siteUrl =
      Deno.env.get("SITE_URL") || req.headers.get("origin") || "http://localhost:5173";

    const invoicePayload = {
      amount: cfg.amount,
      account: accountUuid,
      url: `${siteUrl}/payment-return`,
      fees: 0, // التاجر يتحمّل العمولة → الزبون يدفع السعر المعروض تماماً
      items: [{ name: cfg.label, price: cfg.amount, quantity: 1 }],
      firstname: user.user_metadata?.full_name || "CODpromo",
      lastname: "User",
      email: user.email ?? undefined,
      webhook_url: `${supaUrl}/functions/v1/slickpay-webhook`,
      webhook_signature: Deno.env.get("SLICKPAY_WEBHOOK_SIGNATURE") ?? "",
      webhook_meta_data: { user_id: user.id, plan },
    };

    const res = await fetch(`${SLICKPAY_BASE}/users/invoices`, {
      method: "POST",
      headers: slickpayHeaders(),
      body: JSON.stringify(invoicePayload),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data?.url || !data?.id) {
      const msg = data?.message || "تعذّر إنشاء فاتورة الدفع";
      return json({ error: msg, details: data?.errors ?? null }, 400);
    }

    // 5) احفظ الفاتورة (ربط موثوق: invoice → user + plan) عبر service role
    const admin = adminClient();
    await admin.from("slickpay_invoices").insert({
      invoice_id: String(data.id),
      user_id: user.id,
      plan_type: plan,
      amount: cfg.amount,
      status: "pending",
    });

    return json({ url: data.url, invoice_id: String(data.id) });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
