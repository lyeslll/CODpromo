// ============================================================
//  CODpromo — التحويل /go/<id> لعروض ملف ilyesderradji.com (Vercel Edge)
//  vercel.json يبعث هنا غير الشكل <slug>--<id> (فيه "--"): روابط /go/<slug> تاع العروض بلا كود
//  (كيما /go/youcan) ما يمرّوش من هنا ويبقاو كيما راهم (GoPage).
//  - الوجهة من القاعدة برك (offers_feed_target = نفس قاعدة الملف). ما كاين حتى رابط في الـ URL → ماشي open redirect.
//  - id ما كاينش / شركة مخفية / "قريباً" / مطفية لـ ilyesderradji.com / رابط ماشي https → 404، ماشي تحويل.
//  - ?src= : كلمة من FEED_SOURCES برك (والباقي "other" في القاعدة).
//  - النقرة تتسجّل من متصفّح الزائر (offers_feed_click، POST) باش القاعدة تشوف عنوانو الحقيقي
//    (cf-connecting-ip): زائر = نقرة في اليوم، والروبوتات وصور المعاينة ما يتحسبوش. من بعد
//    location.replace (حتى 1.5 ثانية كأقصى). بلا JavaScript: meta refresh (بلا حساب).
// ============================================================
import { FEED_ID_RE, FEED_SOURCES, GO_TEXT, httpsUrl, plainText } from "../src/lib/feedContent.js";

export const config = { runtime: "edge" };

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://uulcgvdsqivgkiulurhk.supabase.co";
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_kxiLaS2RxTEeZA6TrJQR_w_ws8twFBt";

const CSS =
  ":root{color-scheme:dark}*{box-sizing:border-box}html,body{margin:0;min-height:100%}" +
  "body{display:grid;place-items:center;min-height:100vh;background:#0a0a0a;color:#f4f4f5;" +
  "font-family:Tajawal,system-ui,-apple-system,'Segoe UI',sans-serif;padding:24px 16px;text-align:center}" +
  "main{width:100%;max-width:380px}img{display:block;margin:0 auto}" +
  "h1{font-size:21px;font-weight:800;line-height:1.5;margin:26px 0 8px}" +
  "p{margin:0 0 6px;color:#a1a1aa;font-size:14px;line-height:1.75}.k{color:#a6f000;font-weight:700;margin-top:24px}" +
  "a{color:#a6f000;font-weight:700}.btns{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-top:24px}" +
  ".btn{display:inline-block;min-height:44px;padding:12px 18px;border-radius:12px;border:1px solid #27272a;" +
  "background:#18181b;color:#f4f4f5;text-decoration:none;font-size:14.5px}" +
  ".btn.main{background:#a6f000;border-color:#a6f000;color:#0a0a0a}" +
  ".spin{width:28px;height:28px;margin:30px auto 0;border:3px solid #27272a;border-top-color:#a6f000;border-radius:50%;" +
  "animation:s .8s linear infinite}@keyframes s{to{transform:rotate(360deg)}}" +
  "@media (prefers-reduced-motion:reduce){.spin{animation:none}}";

// ثابت (باش يكون عندو hash في CSP)؛ المعطيات في <script type="application/json" id="go-data">
const SCRIPT =
  "(function(){var d=JSON.parse(document.getElementById('go-data').textContent),done=false;" +
  "function go(){if(done)return;done=true;location.replace(d.to)}" +
  "setTimeout(go,1500);" +
  "try{fetch(d.api,{method:'POST',headers:{apikey:d.key,Authorization:'Bearer '+d.key,'Content-Type':'application/json'}," +
  "body:JSON.stringify({p_id:d.id,p_src:d.src})}).then(go,go)}catch(e){go()}})();";

let hashes = null;
async function sha256b64(s) {
  const buf = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  let bin = "";
  for (const b of buf) bin += String.fromCharCode(b);
  return btoa(bin);
}
function cspHashes() {
  hashes ||= Promise.all([sha256b64(SCRIPT), sha256b64(CSS)]);
  return hashes;
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
// "<" → < (مبني بالحرف 92 باش ما يتبدّلش): المعطيات ما يقدروش يسكّرو <script>
const LT_ESCAPE = String.fromCharCode(92) + "u003c";
const jsonForHtml = (o) => JSON.stringify(o).replace(/</g, LT_ESCAPE);

async function page(status, { title, body, data = null, refresh = null }) {
  const [scriptHash, styleHash] = await cspHashes();
  const csp = [
    "default-src 'none'",
    `style-src 'sha256-${styleHash}'`,
    "img-src 'self'",
    data ? `script-src 'sha256-${scriptHash}'` : "script-src 'none'",
    data ? `connect-src ${SUPABASE_URL}` : null,
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].filter(Boolean).join("; ");
  const html =
    `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">` +
    `<title>${esc(title)}</title><style>${CSS}</style>` +
    (refresh ? `<noscript><meta http-equiv="refresh" content="0;url=${esc(refresh)}"></noscript>` : "") +
    `</head><body><main><img src="/email/logo.png" width="140" height="34" alt="CODpromo">${body}</main>` +
    (data ? `<script type="application/json" id="go-data">${jsonForHtml(data)}</script><script>${SCRIPT}</script>` : "") +
    `</body></html>`;
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": csp,
      "X-Frame-Options": "DENY",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

const notFound = () =>
  page(404, {
    title: GO_TEXT.notFound,
    body:
      `<p class="k">${esc(GO_TEXT.kicker)}</p><h1>${esc(GO_TEXT.notFound)}</h1><p>${esc(GO_TEXT.notFoundDesc)}</p>` +
      `<div class="btns"><a class="btn main" href="/offers">${esc(GO_TEXT.offers)}</a><a class="btn" href="/">${esc(GO_TEXT.home)}</a></div>`,
  });

const unavailable = () =>
  page(503, {
    title: GO_TEXT.title,
    body: `<h1>${esc(GO_TEXT.error)}</h1><div class="btns"><a class="btn main" href="">${esc(GO_TEXT.retry)}</a></div>`,
  });

export default async function handler(req) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("", { status: 405, headers: { Allow: "GET, HEAD", "Cache-Control": "no-store" } });
  }
  const q = new URL(req.url).searchParams;
  const ids = q.getAll("id");
  const id = ids.length === 1 ? ids[0] : "";
  if (id.length > 64 || !FEED_ID_RE.test(id)) return notFound();
  const srcs = q.getAll("src");
  const src = srcs.length === 1 && FEED_SOURCES.includes(srcs[0]) ? srcs[0] : null;

  let row;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 5000);
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/offers_feed_target?p_id=${encodeURIComponent(id)}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Accept: "application/json" },
      signal: ctl.signal,
    });
    clearTimeout(timer);
    if (!r.ok) return unavailable();
    const rows = await r.json();
    row = Array.isArray(rows) && rows.length === 1 ? rows[0] : null;
  } catch {
    return unavailable();
  }
  const to = httpsUrl(row?.url);
  if (!to) return notFound();

  const name = plainText(row.name) || "CODpromo";
  return page(200, {
    title: GO_TEXT.title,
    refresh: to,
    body:
      `<div class="spin" aria-hidden="true"></div><h1 role="status">${esc(GO_TEXT.redirectTo.replace("{{name}}", () => name))}</h1>` +
      `<p><a href="${esc(to)}" rel="nofollow noopener">${esc(GO_TEXT.fallback)}</a></p>`,
    data: { id, src, to, api: `${SUPABASE_URL}/rest/v1/rpc/offers_feed_click`, key: SUPABASE_KEY },
  });
}
