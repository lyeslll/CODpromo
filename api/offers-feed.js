// ============================================================
//  CODpromo — ملف العروض العام لـ ilyesderradji.com (دالة Vercel Serverless)
//  https://codpromo.com/feeds/offers.v1.json (vercel.json → /api/offers-feed)، schema codpromo.offers.v1.
//  العروض العادية برك تاع الشركات الظاهرة: القاعدة تقرّر شكون يدخل (offers_feed_v1، بالمفتاح العام —
//  أعمدة Premium ممنوعة عليه أصلاً)، و src/lib/feedContent.js يكتب الشكل حسب العقد.
//  Cache: ساعة للقارئ (max-age=3600 كيما العقد)، و 15 دقيقة في الـ CDN (s-maxage) → عرض يتبدّل يبان
//  في أقل من ساعة. خطأ → 503 بلا cache (القارئ يخلّي آخر نسخة صالحة عندو).
//  قبل ما يخرج، نفس الفحص تاع التجربة (checkFeed: العقد + بلا أي أثر سرّ): ملف ما يحترمش → 503 تاني.
// ============================================================
import { createHash } from "node:crypto";
import { buildFeed, feedBody, checkFeed } from "../src/lib/feedContent.js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://uulcgvdsqivgkiulurhk.supabase.co";
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_kxiLaS2RxTEeZA6TrJQR_w_ws8twFBt";

/** body = null → بلا محتوى (304)؛ head → نفس الطول بلا محتوى. */
function send(res, status, headers, body, head = false) {
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  if (body != null) res.setHeader("Content-Length", Buffer.byteLength(body));
  res.statusCode = status;
  res.end(body != null && !head ? body : undefined);
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return send(res, 405, { Allow: "GET, HEAD", "Cache-Control": "no-store" }, "");
  }
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/offers_feed_v1`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Accept: "application/json" },
    });
    if (!r.ok) throw new Error(`supabase ${r.status}`);
    const rows = await r.json();
    if (!Array.isArray(rows)) throw new Error("rows");

    const body = feedBody(buildFeed(rows));
    // الحماية الأخيرة (المراجعة المستقلة): نفس قواعد القارئ + بلا بريد / UUID / مفتاح / عمود داخلي
    const problems = checkFeed(body);
    if (problems.length) throw new Error(`feed check: ${problems.slice(0, 5).join("; ")}`);
    const etag = `"${createHash("sha256").update(body).digest("hex").slice(0, 32)}"`;
    const headers = {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=900",
      ETag: etag,
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
    };
    const match = String(req.headers["if-none-match"] || "").split(",").map((s) => s.trim().replace(/^W\//, ""));
    if (match.includes(etag)) return send(res, 304, headers, null);
    return send(res, 200, headers, body, req.method === "HEAD");
  } catch (e) {
    // سجلّ Vercel برك (الرسالة فيها أسباب الفحص والمعرّفات، بلا قيم سرّية)
    console.error("offers-feed:", e?.message || e);
    return send(
      res,
      503,
      { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Retry-After": "300" },
      JSON.stringify({ error: "unavailable" })
    );
  }
}
