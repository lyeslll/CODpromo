// ============================================================
//  CODpromo — Edge Function: slickpay-create-invoice
//  ينشئ فاتورة SlickPay (دفعة وحدة بالبطاقة الجزائرية CIB/Edahabia) = Premium مدى الحياة.
//  المبلغ (سعر الإطلاق ولا العادي) يتقرّر هنا من pricing_settings — المتصفّح ما يبعث حتى مبلغ.
//  المفتاح السري لـ SlickPay يبقى في secrets فقط.
// ============================================================
import {
  adminClient,
  alreadyPremium,
  authUser,
  corsHeaders,
  dzdFor,
  getPricing,
  json,
  PRODUCT_LABEL,
  siteUrl,
} from "../_shared/lifetime.ts";
import { SLICKPAY_BASE, slickpayHeaders } from "../_shared/slickpay.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // 1) هوية المستخدم عبر JWT
    const user = await authUser(req);
    if (!user) return json({ error: "unauthorized" }, 401);

    // واجهة قديمة (باقات شهر/فصل/سنة): مرفوضة باش ما يتخلّصش حتى واحد بسعر ما شافوش
    const body = await req.json().catch(() => ({}));
    if (body?.plan) return json({ error: "تم تحديث نظام الدفع — حدّث الصفحة", code: "legacy_ui" }, 409);

    const admin = adminClient();
    if (await alreadyPremium(admin, user.id)) return json({ error: "already_premium" }, 409);

    // 2) السعر من الخادم
    const pricing = await getPricing(admin);
    const tier = pricing.tier;
    const amount = dzdFor(pricing, tier);

    // 3) UUID الحساب (من secret إن وُجد، وإلا من /users/accounts)
    let accountUuid = Deno.env.get("SLICKPAY_ACCOUNT_UUID") || "";
    if (!accountUuid) {
      const accRes = await fetch(`${SLICKPAY_BASE}/users/accounts`, { headers: slickpayHeaders() });
      const accJson = await accRes.json().catch(() => ({}));
      const accounts = accJson?.data ?? [];
      const def = accounts.find((a: { default: number }) => a.default === 1) ?? accounts[0];
      accountUuid = def?.uuid ?? "";
      if (!accountUuid) return json({ error: "تعذّر تحديد حساب SlickPay" }, 400);
    }

    // 4) أنشئ الفاتورة
    const supaUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const invoicePayload = {
      amount,
      account: accountUuid,
      url: `${siteUrl(req)}/payment-return`,
      fees: 0, // التاجر يتحمّل العمولة → الزبون يدفع السعر المعروض تماماً
      // SlickPay (prod) يفرض حقل address — منتوج رقمي بلا عنوان شحن، فنضع افتراضياً
      address: user.user_metadata?.address || "Algérie",
      items: [{ name: PRODUCT_LABEL, price: amount, quantity: 1 }],
      firstname: user.user_metadata?.full_name || "CODpromo",
      lastname: "User",
      email: user.email ?? undefined,
      webhook_url: `${supaUrl}/functions/v1/slickpay-webhook`,
      webhook_signature: Deno.env.get("SLICKPAY_WEBHOOK_SIGNATURE") ?? "",
      webhook_meta_data: { user_id: user.id, tier },
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

    // 5) الربط الموثوق: الفاتورة → الحساب + tier + المبلغ المنتظر. بلاه ما نعطيوش رابط الدفع.
    const { error: insErr } = await admin.from("slickpay_invoices").insert({
      invoice_id: String(data.id),
      user_id: user.id,
      plan_type: "lifetime",
      tier,
      amount,
      status: "pending",
    });
    if (insErr) return json({ error: "تعذّر حفظ الفاتورة" }, 500);

    return json({ lifetime: true, url: data.url, invoice_id: String(data.id) });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
