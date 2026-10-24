// ============================================================
//  CODpromo — Edge Function: send-email
//  يبعث إيميلات المعاملات من صندوق public.email_outbox (phase33) عبر Resend:
//  الترحيب بعد تأكيد الحساب، تأكيد الشراء، سحب Premium بعد الاسترداد، تفعيل هدية Premium،
//  ومعاينات القوالب (kind = test).
//
//  ينادوها غير القاعدة (pg_net من الـ triggers و cron) بـ { id } + رأس x-email-secret
//  (نفس القيمة في private.app_secrets.email_hook_secret وفي secret EMAIL_HOOK_SECRET). بلا JWT.
//  البيانات الحقيقية (البريد، اللغة، المبلغ…) تتقرا خادمياً عبر RPC email_job_claim (service_role):
//  المتصفّح ما يقدر يبعث حتى إيميل.
//  الإرسال ما يأثّرش أبداً على الدفع: الـ triggers ما يستناوش هاد الدالة، وأي فشل يتسجّل في الصندوق.
//
//  Secrets: EMAIL_HOOK_SECRET، RESEND_API_KEY (بلاه: الإيميل يتسجّل failed / not_configured)،
//  اختياري: EMAIL_FROM (الافتراضي "CODpromo <no-reply@codpromo.com>")، SITE_URL.
// ============================================================
import { adminClient, json } from "../_shared/lifetime.ts";
import { renderEmail } from "../_shared/email/render.js";

const FROM = Deno.env.get("EMAIL_FROM") || "CODpromo <no-reply@codpromo.com>";
const REPLY_TO = "contact@codpromo.com";
const SITE = (Deno.env.get("SITE_URL") || "https://codpromo.com").replace(/\/$/, "");

/** مقارنة بزمن ثابت (ما تكشفش طول التطابق). */
function safeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

const admin = adminClient();

async function done(id: number, ok: boolean, providerId: string | null, error: string | null) {
  await admin.rpc("email_job_done", { p_id: id, p_ok: ok, p_provider_id: providerId, p_error: error?.slice(0, 500) ?? null });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const secret = Deno.env.get("EMAIL_HOOK_SECRET") ?? "";
  if (!secret || !safeEqual(req.headers.get("x-email-secret") ?? "", secret)) return json({ error: "forbidden" }, 403);

  const body = await req.json().catch(() => ({}));
  const id = Number(body?.id);
  if (!Number.isSafeInteger(id) || id <= 0) return json({ error: "bad id" }, 400);

  // حجز المهمة (pending / failed → sending) + كل بياناتها من القاعدة. null = مبعوثة ولا محجوزة.
  const { data: job, error } = await admin.rpc("email_job_claim", { p_id: id });
  if (error) return json({ error: "claim" }, 500);
  if (!job) return json({ skipped: true });

  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) {
    await done(id, false, null, "not_configured");
    return json({ error: "not_configured" }, 503);
  }

  let mail;
  try {
    mail = renderEmail(job.template, job.lang, { ...(job.data ?? {}), name: job.name }, { siteUrl: SITE });
  } catch (e) {
    await done(id, false, null, `render: ${(e as Error).message}`);
    return json({ error: "render" }, 500);
  }

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        // نفس المهمة مرّتين (إعادة محاولة بعد انقطاع) → إيميل واحد
        "Idempotency-Key": `codpromo-email-${id}`,
      },
      body: JSON.stringify({
        from: FROM,
        to: [job.to],
        reply_to: REPLY_TO,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        tags: [{ name: "kind", value: String(job.kind).replace(/[^a-zA-Z0-9_-]/g, "_") }],
      }),
    });
    const res = await r.json().catch(() => ({}));
    if (!r.ok) {
      await done(id, false, null, `resend ${r.status}: ${res?.message ?? res?.name ?? ""}`);
      return json({ error: "send" }, 502);
    }
    await done(id, true, res?.id ?? null, null);
    return json({ sent: true });
  } catch (e) {
    await done(id, false, null, `network: ${(e as Error).message}`);
    return json({ error: "network" }, 502);
  }
});
