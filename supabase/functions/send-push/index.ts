// ============================================================
//  CODpromo — Edge Function: send-push (phase "notifications")
//  يبعث إشعارات الهاتف (Web Push) لدفعة من public.push_batches.
//
//  ينادوها غير القاعدة (pg_net من push_dispatch_due كل دقيقة، ولا admin_push_test) بـ { batch }
//  + رأس x-push-secret (نفس القيمة في private.app_secrets.push_hook_secret وفي secret PUSH_HOOK_SECRET).
//  بلا JWT. المتصفّح ما يقدر يبعث حتى push: الدفعة تتحجز مرة وحدة (push_batch_claim: pending → sending)،
//  والأجهزة والنصوص تتقرا من القاعدة (service_role برك). نفس الدفعة مرّتين = والو.
//
//  Secrets: PUSH_HOOK_SECRET، VAPID_PUBLIC_KEY، VAPID_PRIVATE_KEY (الخاص في السيرفر برك)،
//  اختياري VAPID_SUBJECT (الافتراضي mailto:contact@codpromo.com).
//  النشر: supabase functions deploy send-push --no-verify-jwt --project-ref uulcgvdsqivgkiulurhk
// ============================================================
import { adminClient, json } from "../_shared/lifetime.ts";
import { sendWebPush, type VapidKeys } from "./webpush.ts";
import { buildPayload, testPayload, type NotifData } from "./render.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

const PAGE = 200;
const PARALLEL = 10;
const LANGS = new Set(["ar", "en", "fr"]);

/** مقارنة بزمن ثابت (ما تكشفش طول التطابق). */
function safeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

const admin = adminClient();

interface Target {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  lang: string;
  ids: number[];
  waited?: number[]; // phase coming-soon: اللي ضغط "أعلمني" عليهم (من push_batch_targets)
}

interface Batch {
  id: number;
  mode: "test" | "live" | "self";
  self: boolean;
  notifications: NotifData[];
}

async function finish(batch: number, ok: number[], gone: number[], failed: number[], error: string | null) {
  await admin.rpc("push_batch_done", { p_batch: batch, p_ok: ok, p_gone: gone, p_failed: failed, p_error: error?.slice(0, 500) ?? null });
}

async function run(batch: Batch, keys: VapidKeys) {
  const byId = new Map(batch.notifications.map((n) => [Number(n.id), n]));
  const ok: number[] = [];
  const gone: number[] = [];
  const failed: number[] = [];
  const statuses: Record<string, number> = {};
  let error: string | null = null;
  let after = 0;

  try {
    for (;;) {
      const { data, error: e } = await admin.rpc("push_batch_targets", { p_batch: batch.id, p_after: after, p_limit: PAGE });
      if (e) {
        error = `targets: ${e.message}`;
        break;
      }
      const items: Target[] = data?.items ?? [];
      for (let i = 0; i < items.length; i += PARALLEL) {
        await Promise.all(
          items.slice(i, i + PARALLEL).map(async (t) => {
            const lang = (LANGS.has(t.lang) ? t.lang : "ar") as "ar" | "en" | "fr";
            const payload = batch.self
              ? testPayload(lang)
              : buildPayload((t.ids ?? []).map((id) => byId.get(Number(id))).filter(Boolean) as NotifData[], lang, new Set((t.waited ?? []).map(Number)));
            if (!payload) return;
            const r = await sendWebPush(t, payload, keys, batch.self ? 600 : 86400);
            statuses[r.status] = (statuses[r.status] ?? 0) + 1;
            (r.result === "ok" ? ok : r.result === "gone" ? gone : failed).push(t.id);
          }),
        );
      }
      if (data?.last == null) break;
      after = Number(data.last);
    }
  } catch (e) {
    error = `run: ${(e as Error).message}`;
  }
  if (!error && failed.length && !ok.length) error = `all_failed ${JSON.stringify(statuses)}`;
  await finish(batch.id, ok, gone, failed, error);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const secret = Deno.env.get("PUSH_HOOK_SECRET") ?? "";
  if (!secret || !safeEqual(req.headers.get("x-push-secret") ?? "", secret)) return json({ error: "forbidden" }, 403);

  const body = await req.json().catch(() => ({}));
  const id = Number(body?.batch);
  if (!Number.isSafeInteger(id) || id <= 0) return json({ error: "bad batch" }, 400);

  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
  const subject = Deno.env.get("VAPID_SUBJECT") || "mailto:contact@codpromo.com";

  // حجز الدفعة + الإشعارات. null = محجوزة ولا مبعوثة.
  const { data: batch, error } = await admin.rpc("push_batch_claim", { p_batch: id });
  if (error) return json({ error: "claim" }, 500);
  if (!batch) return json({ skipped: true });
  if (!publicKey || !privateKey) {
    await finish(id, [], [], [], "not_configured");
    return json({ error: "not_configured" }, 503);
  }

  const work = run(batch as Batch, { publicKey, privateKey, subject });
  // الرد في الحين (pg_net ما يستناش)، والإرسال يكمّل في الخلفية
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
    EdgeRuntime.waitUntil(work);
    return json({ accepted: true }, 202);
  }
  await work;
  return json({ done: true });
});
