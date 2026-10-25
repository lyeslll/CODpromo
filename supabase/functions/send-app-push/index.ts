// ============================================================
//  CODpromo — Edge Function: send-app-push (phase "app-push")
//  يبعث إشعارات الهاتف لتطبيق Android (Firebase Cloud Messaging HTTP v1) لدفعة من public.app_push_batches.
//
//  ينادوها غير القاعدة (pg_net من app_push_dispatch_due كل دقيقة، ولا app_push_test_user) بـ { batch }
//  + رأس x-push-secret (نفس القيمة في private.app_secrets.app_push_hook_secret وفي secret APP_PUSH_HOOK_SECRET).
//  بلا JWT. الدفعة تتحجز مرة وحدة (app_push_batch_claim: pending → sending)، والأجهزة والنصوص تتقرا من
//  القاعدة (service_role برك). نفس النصوص تاع Web Push (../send-push/render.ts، قراءة برك).
//
//  Secrets: APP_PUSH_HOOK_SECRET، FCM_SERVICE_ACCOUNT (ملف JSON تاع حساب خدمة Firebase، كامل، في السيرفر برك).
//  بلا FCM_SERVICE_ACCOUNT: الدفعة تتسجّل failed "not_configured" والو ما يتبعث.
//  النشر: supabase functions deploy send-app-push --no-verify-jwt --project-ref uulcgvdsqivgkiulurhk
// ============================================================
import { adminClient, json } from "../_shared/lifetime.ts";
import { buildPayload, testPayload, type NotifData, type PushPayload } from "../send-push/render.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

const PAGE = 200;
const PARALLEL = 10;
const LANGS = new Set(["ar", "en", "fr"]);
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const CHANNEL_ID = "default"; // نفس قناة التطبيق (src/lib/push.ts)

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
  token: string;
  lang: string;
  ids: number[];
  waited?: number[];
}

interface Batch {
  id: number;
  mode: "test" | "live" | "self";
  self: boolean;
  notifications: NotifData[];
}

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** OAuth access token for FCM from the service account (JWT RS256 → Google's token endpoint). */
async function accessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const enc = (o: unknown) => b64url(new TextEncoder().encode(JSON.stringify(o)));
  const unsigned = `${enc({ alg: "RS256", typ: "JWT" })}.${enc({ iss: sa.client_email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 })}`;
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)));
  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${b64url(sig)}` }),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok || typeof body?.access_token !== "string") throw new Error(`oauth ${r.status} ${body?.error ?? ""}`);
  return body.access_token;
}

/** One FCM message: ok | gone (the app was removed / token unknown) | failed (try another time). */
async function sendFcm(sa: ServiceAccount, bearer: string, t: Target, p: PushPayload, ttlSeconds: number): Promise<{ result: "ok" | "gone" | "failed"; status: number }> {
  const message = {
    token: t.token,
    notification: { title: p.title, body: p.body },
    // the app opens this page when the notification is tapped (internal path, checked again in the app)
    data: { url: p.url, tag: p.tag },
    android: {
      priority: "HIGH",
      ttl: `${ttlSeconds}s`,
      collapse_key: p.tag,
      notification: { channel_id: CHANNEL_ID, tag: p.tag, color: "#a6f000" },
    },
  };
  try {
    const r = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(sa.project_id)}/messages:send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    if (r.ok) return { result: "ok", status: r.status };
    const err = await r.json().catch(() => ({}));
    const code = JSON.stringify(err?.error?.details ?? err?.error?.status ?? "");
    // token no longer valid (app removed / data cleared) or from another Firebase project
    if (r.status === 404 || /UNREGISTERED|SENDER_ID_MISMATCH/.test(code) || (r.status === 400 && /INVALID_ARGUMENT/.test(code) && /registration|token/i.test(JSON.stringify(err)))) {
      return { result: "gone", status: r.status };
    }
    return { result: "failed", status: r.status };
  } catch {
    return { result: "failed", status: 0 };
  }
}

async function finish(batch: number, ok: number[], gone: number[], failed: number[], error: string | null) {
  await admin.rpc("app_push_batch_done", { p_batch: batch, p_ok: ok, p_gone: gone, p_failed: failed, p_error: error?.slice(0, 500) ?? null });
}

async function run(batch: Batch, sa: ServiceAccount) {
  const byId = new Map(batch.notifications.map((n) => [Number(n.id), n]));
  const ok: number[] = [];
  const gone: number[] = [];
  const failed: number[] = [];
  const statuses: Record<string, number> = {};
  let error: string | null = null;
  let after = 0;

  try {
    const bearer = await accessToken(sa);
    for (;;) {
      const { data, error: e } = await admin.rpc("app_push_batch_targets", { p_batch: batch.id, p_after: after, p_limit: PAGE });
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
            const r = await sendFcm(sa, bearer, t, payload, batch.self ? 600 : 86400);
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

function serviceAccount(): ServiceAccount | null {
  try {
    const sa = JSON.parse(Deno.env.get("FCM_SERVICE_ACCOUNT") ?? "");
    return typeof sa?.project_id === "string" && typeof sa?.client_email === "string" && typeof sa?.private_key === "string" ? sa : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const secret = Deno.env.get("APP_PUSH_HOOK_SECRET") ?? "";
  if (!secret || !safeEqual(req.headers.get("x-push-secret") ?? "", secret)) return json({ error: "forbidden" }, 403);

  const body = await req.json().catch(() => ({}));
  const id = Number(body?.batch);
  if (!Number.isSafeInteger(id) || id <= 0) return json({ error: "bad batch" }, 400);

  // حجز الدفعة + الإشعارات. null = محجوزة ولا مبعوثة.
  const { data: batch, error } = await admin.rpc("app_push_batch_claim", { p_batch: id });
  if (error) return json({ error: "claim" }, 500);
  if (!batch) return json({ skipped: true });
  const sa = serviceAccount();
  if (!sa) {
    await finish(id, [], [], [], "not_configured");
    return json({ error: "not_configured" }, 503);
  }

  const work = run(batch as Batch, sa);
  // الرد في الحين (pg_net ما يستناش)، والإرسال يكمّل في الخلفية
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
    EdgeRuntime.waitUntil(work);
    return json({ accepted: true }, 202);
  }
  await work;
  return json({ done: true });
});
