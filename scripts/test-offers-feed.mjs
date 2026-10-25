// ============================================================
//  CODpromo — تجربة ملف العروض العام (codpromo.offers.v1) + التحويل /go/<id>
//
//  node scripts/test-offers-feed.mjs                 → الدوال محلياً (api/offers-feed.js و api/go.js) على بيانات الإنتاج (المفتاح العام)
//  node scripts/test-offers-feed.mjs --live           → https://codpromo.com (بعد النشر): الملف + الـ headers + /go/ + الصفحات القديمة
//  node scripts/test-offers-feed.mjs --base <url>     → نفس --live على عنوان آخر
//
//  يفحص: الشكل كامل حسب العقد (نفس قواعد القارئ تاع ilyesderradji.com)، الحجم ≤ 512 KB و ≤ 500 عرض، بلا حتى
//  مفتاح ولا حقل داخلي (كود/رابط/قيمة Premium، إيميلات، أعضاء)، brand_slug من ملف الأمثلة، /go/<id> يحوّل
//  للوجهة اللي في القاعدة برك (https)، والـ id الغالط / المحاولات نحو موقع آخر = 404.
//  ما يكتب والو في القاعدة (حتى نقرة: صفحة التحويل ما تتنفّذش هنا).
// ============================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildFeed, buildOffer, feedBody, checkFeed, parseValue, feedTitle, feedLogo, plainText,
  FEED_ID_RE, FEED_MAX_OFFERS, GO_TEXT, GO_TEXT_KEYS, feedGoUrl,
} from "../src/lib/feedContent.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const live = args.includes("--live") || args.includes("--base");
const base = (args.includes("--base") ? args[args.indexOf("--base") + 1] : "https://codpromo.com").replace(/\/$/, "");
const SAMPLE = "D:/ILYES DERRADJI.COM/PROJET-V2/wp-content/plugins/ilyes-core/modules/directory/data/codpromo-sample.json";

let pass = 0;
const fails = [];
function ok(name, cond, detail = "") {
  if (cond) pass++;
  else fails.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

// ===================== 1) الوحدات =====================
ok("value 10%", JSON.stringify(parseValue("10%")) === JSON.stringify({ type: "percent", amount: 10, currency: null }));
ok("value 5$", JSON.stringify(parseValue("5$")) === JSON.stringify({ type: "amount", amount: 5, currency: "USD" }));
ok("value 500 دج", JSON.stringify(parseValue("500 دج")) === JSON.stringify({ type: "amount", amount: 500, currency: "DZD" }));
ok("value 1,400 دج", parseValue("1,400 دج").amount === 1400);
ok("value 2.5€", JSON.stringify(parseValue("2.5€")) === JSON.stringify({ type: "amount", amount: 2.5, currency: "EUR" }));
ok("value text", parseValue("5$ هدية").type === "text" && parseValue("أولوية VIP").type === "text");
ok("title discount", feedTitle("تخفيض", "10%", "X") === "خصم 10%");
ok("title cashback", feedTitle("كاش باك", "10$", "X") === "كاش باك 10$");
ok("title coupon amount", feedTitle("كوبون", "500 دج", "X") === "كوبون بقيمة 500 دج");
ok("title coupon text", feedTitle("كوبون", "35 SMS مجانية", "X") === "35 SMS مجانية");
ok("title empty", feedTitle("تخفيض", "", "Brand") === "كود خصم Brand");
ok("plain strips html", plainText('<b>خصم</b> <script>alert(1)</script>10%') === "خصم alert(1) 10%");
ok("plain strips controls", plainText("a" + String.fromCharCode(0) + "b" + String.fromCharCode(0x202e) + "c") === "a b c");
ok("logo bucket", feedLogo("https://uulcgvdsqivgkiulurhk.supabase.co/storage/v1/object/public/logos/1-a.png") ===
  "https://uulcgvdsqivgkiulurhk.supabase.co/storage/v1/render/image/public/logos/1-a.png?width=256&height=256&resize=contain&quality=80");
ok("logo partner bucket → null", feedLogo("https://uulcgvdsqivgkiulurhk.supabase.co/storage/v1/object/public/partner-logos/00000000-0000-4000-8000-000000000001/a.png") === null);
ok("logo http/emoji → null", feedLogo("http://x.example/a.png") === null && feedLogo("🏢") === null);
ok("logo other host → null", feedLogo("https://evil.example/storage/v1/object/public/logos/a.png") === null);
const good = { feed_id: "spybox--22", brand_slug: "spybox", slug: "spybox", name: "SpyBox", type: "تخفيض", discount: "20%", code: "ILYES20", logo: null, code_checked_at: null, has_premium: true };
ok("offer built", buildOffer(good)?.url === "https://codpromo.com/go/spybox--22?src=ilyesderradji");
ok("offer bad id", buildOffer({ ...good, feed_id: "spybox" }) === null && buildOffer({ ...good, feed_id: "https://evil--1" }) === null);
ok("offer bad code", buildOffer({ ...good, code: "BAD CODE" }) === null && buildOffer({ ...good, code: "" }) === null);
ok("offer bad brand_slug", buildOffer({ ...good, brand_slug: "Bad Slug" }) === null);
ok("offer ignores extra columns", !("premium_code" in buildOffer({ ...good, premium_code: "SECRET", premium_url: "https://x" })));
ok("offer html name", buildOffer({ ...good, name: "<img src=x onerror=alert(1)>Spy" }).brand === "Spy");
const many = Array.from({ length: 700 }, (_, i) => ({ ...good, feed_id: `s${i}--${i + 1}`, brand_slug: `s${i}` }));
const big = buildFeed(many);
ok("max 500 offers", big.offers.length === FEED_MAX_OFFERS && big.count === FEED_MAX_OFFERS);
const huge = buildFeed(Array.from({ length: 500 }, (_, i) => ({ ...good, feed_id: `s${i}--${i + 1}`, brand_slug: `s${i}`, name: "ا".repeat(300), discount: "ب".repeat(300) })));
const hugeBody = feedBody(huge);
ok("size cap 512 KB", Buffer.byteLength(hugeBody) <= 512 * 1024, `${Buffer.byteLength(hugeBody)} bytes`);
ok("size cap keeps count", JSON.parse(hugeBody).count === JSON.parse(hugeBody).offers.length);
ok("dup ids dropped", buildFeed([good, good]).count === 1);
ok("checker accepts good", checkFeed(feedBody(buildFeed([good]))).length === 0, checkFeed(feedBody(buildFeed([good]))).join("; "));
const tampered = (patch) => {
  const f = buildFeed([good]);
  patch(f);
  return checkFeed(JSON.stringify(f)).length > 0;
};
ok("checker: premium key", tampered((f) => (f.offers[0].premium = true)));
ok("checker: premium tier", tampered((f) => (f.offers[0].tier = "premium")));
ok("checker: premium_code key", tampered((f) => (f.offers[0].premium_code = "X")));
ok("checker: http url", tampered((f) => (f.offers[0].url = "http://codpromo.com/go/spybox--22?src=ilyesderradji")));
ok("checker: foreign url", tampered((f) => (f.offers[0].url = "https://evil.example/")));
ok("checker: email", tampered((f) => (f.offers[0].brand = "a@b.co")));
ok("checker: uuid", tampered((f) => (f.offers[0].brand = "00000000-0000-4000-8000-000000000001")));
ok("checker: schema", tampered((f) => (f.schema = "codpromo.offers.v2")));
ok("checker: expired", tampered((f) => (f.offers[0].ends_at = "2020-01-01T00:00:00Z")));
ok("checker: html title", tampered((f) => (f.offers[0].title_ar = "<b>خصم</b>")));

// نصوص /go/ = ar.json بالحرف
const ar = JSON.parse(fs.readFileSync(path.join(ROOT, "src/i18n/locales/ar.json"), "utf8"));
for (const [k, key] of Object.entries(GO_TEXT_KEYS)) {
  ok(`go text ${key}`, GO_TEXT[k] === key.split(".").reduce((o, p) => o?.[p], ar));
}

// ===================== 2) الملف الحقيقي =====================
async function localFeed() {
  const { default: handler } = await import("../api/offers-feed.js");
  const headers = {};
  let status = 0;
  let body = "";
  const res = {
    setHeader: (k, v) => (headers[k.toLowerCase()] = String(v)),
    set statusCode(v) { status = v; },
    get statusCode() { return status; },
    end: (b) => (body = b == null ? "" : String(b)),
  };
  await handler({ method: "GET", headers: {} }, res);
  return { status, headers, body };
}
async function liveFeed() {
  const r = await fetch(`${base}/feeds/offers.v1.json`, { headers: { "User-Agent": "ilyesderradji.com/codpromo-feed (+read-only)", Accept: "application/json" }, redirect: "manual" });
  const headers = {};
  r.headers.forEach((v, k) => (headers[k] = v));
  return { status: r.status, headers, body: await r.text() };
}

const feed = live ? await liveFeed() : await localFeed();
ok("feed 200", feed.status === 200, `status ${feed.status}`);
ok("content-type", feed.headers["content-type"] === "application/json; charset=utf-8", feed.headers["content-type"]);
ok("cache-control max-age=3600", /(^|,\s*)public(,|$)/.test(feed.headers["cache-control"] || "") && /max-age=3600/.test(feed.headers["cache-control"] || ""), feed.headers["cache-control"]);
ok("etag", /^(W\/)?"[^"]+"$/.test(feed.headers.etag || ""), feed.headers.etag);
const problems = checkFeed(feed.body);
ok("contract (all rules)", problems.length === 0, problems.slice(0, 8).join("; "));
const data = JSON.parse(feed.body);
const bytes = Buffer.byteLength(feed.body);
ok("size ≤ 512 KB", bytes <= 512 * 1024, `${bytes}`);
ok("≤ 500 offers", data.offers.length <= 500);
ok("has offers", data.offers.length > 0);
ok("no Trackili (hidden)", !data.offers.some((o) => /trackili/i.test(o.id + o.brand + o.brand_slug)));
ok("ids are /go/ ids", data.offers.every((o) => FEED_ID_RE.test(o.id) && o.url === feedGoUrl(o.id)));
ok("generated_at fresh", Math.abs(Date.now() - Date.parse(data.generated_at)) < 2 * 3600 * 1000, data.generated_at);

// brand_slug من ملف الأمثلة (معرّفات الدليل) للشركات المشتركة
if (fs.existsSync(SAMPLE)) {
  const sample = JSON.parse(fs.readFileSync(SAMPLE, "utf8"));
  const dirIds = new Set(sample.offers.map((o) => o.brand_slug));
  const linked = data.offers.filter((o) => dirIds.has(o.brand_slug));
  ok("brand_slug = directory ids", linked.length >= 23, `${linked.length} linked`);
  for (const [slug, dir] of [["bybit", "bybit-card"], ["order", "orderdz"], ["just-sell", "justsell"]]) {
    const o = data.offers.find((x) => x.store_url === `https://codpromo.com/store/${slug}`);
    ok(`brand_slug ${slug} → ${dir}`, o?.brand_slug === dir, o?.brand_slug);
  }
  // نفس الأكواد العادية اللي في ملف الأمثلة (للشركات المشتركة)
  const byDir = Object.fromEntries(sample.offers.map((o) => [o.brand_slug, o.code]));
  const diff = linked.filter((o) => byDir[o.brand_slug] && byDir[o.brand_slug] !== o.code).map((o) => o.brand_slug);
  ok("codes = sample codes", diff.length === 0, diff.join(","));
}

// ===================== 3) /go/<id> =====================
const first = data.offers[0];
async function goLocal(pathAndQuery) {
  const { default: handler } = await import("../api/go.js");
  // نفس الـ rewrite: /go/<id>?q → /api/go?id=<id>&q
  const u = new URL(`https://codpromo.com${pathAndQuery}`);
  const m = u.pathname.match(/^\/go\/([a-z0-9-]+--[0-9]+)$/);
  if (!m) return { status: "spa", headers: {}, body: "" };
  u.searchParams.delete("id");
  const dest = new URL(`https://codpromo.com/api/go?id=${m[1]}`);
  u.searchParams.forEach((v, k) => dest.searchParams.append(k, v));
  const r = await handler(new Request(dest.href));
  const headers = {};
  r.headers.forEach((v, k) => (headers[k] = v));
  return { status: r.status, headers, body: await r.text() };
}
async function goLive(pathAndQuery) {
  const r = await fetch(`${base}${pathAndQuery}`, { redirect: "manual" });
  const headers = {};
  r.headers.forEach((v, k) => (headers[k] = v));
  return { status: r.status, headers, body: await r.text() };
}
const go = live ? goLive : goLocal;
const destOf = (body) => (body.match(/id="go-data">([^<]*)<\/script>/) || [])[1];

const okPage = await go(`/go/${first.id}?src=ilyesderradji`);
ok("go 200", okPage.status === 200, `status ${okPage.status}`);
const goData = destOf(okPage.body) ? JSON.parse(destOf(okPage.body)) : null;
ok("go destination https", /^https:\/\//.test(goData?.to || "") && !/codpromo\.com/.test(goData?.to || ""), goData?.to);
ok("go src kept", goData?.src === "ilyesderradji" && goData?.id === first.id);
ok("go no-store", /no-store/.test(okPage.headers["cache-control"] || ""));
ok("go csp", /script-src 'sha256-/.test(okPage.headers["content-security-policy"] || "") && /frame-ancestors 'none'/.test(okPage.headers["content-security-policy"] || ""));
ok("go noindex", /noindex/.test(okPage.headers["x-robots-tag"] || ""));
ok("go no Location header", !okPage.headers.location);
const bad = [
  `/go/${first.id.replace(/--\d+$/, "--999999999")}`,              // id ما كاينش
  `/go/trackili--23`,                                                 // شركة مخفية
  `/go/${first.id.replace(/^[a-z0-9-]+--/, "other-slug--")}`,         // slug ماشي تاعو
];
for (const p of bad) {
  const r = await go(p);
  ok(`404 ${p}`, r.status === 404 && !destOf(r.body) && !r.headers.location, `status ${r.status}`);
}
// كل وحدة: ولا 404، ولا نفس الوجهة تاع العرض (من القاعدة) — عمرها موقع آخر
const probes = [
  `/go/${first.id}?id=bigspy--19`,
  `/go/${first.id}?to=https://evil.example`,
  `/go/${first.id}?url=https://evil.example&redirect=https://evil.example`,
  `/go/${first.id}?src=https://evil.example`,
  `/go/${first.id}?src=ilyesderradji&src=evil`,
  `/go/${first.id}?src=%0d%0aLocation:%20https://evil.example`,
];
for (const p of probes) {
  const r = await go(p);
  const d = destOf(r.body) ? JSON.parse(destOf(r.body)) : null;
  ok(`no open redirect ${p}`, !r.headers.location && !/evil\.example/.test(r.body) && (!d || d.to === goData?.to), `status ${r.status}`);
  if (/src=/.test(p) && d) ok(`src not a URL ${p}`, d.src === null || d.src === "ilyesderradji");
}

if (live) {
  // الصفحات القديمة تخدم كيما قبل
  for (const [p, want] of [["/", 200], ["/offers", 200], ["/store/spybox", 200], ["/premium", 200], ["/api/og?slug=spybox", 200], ["/go/youcan", 200], ["/sitemap.xml", 200]]) {
    const r = await fetch(`${base}${p}`, { redirect: "manual" });
    ok(`page ${p}`, r.status === want, `status ${r.status}`);
  }
  const nf = await fetch(`${base}/this-page-does-not-exist-${Date.now()}`, { redirect: "manual" });
  const nfBody = await nf.text();
  ok("unknown page = SPA (NotFound)", nf.status === 200 && nfBody.includes('id="root"'), `status ${nf.status}`);
  const youcan = await fetch(`${base}/go/youcan`, { redirect: "manual" });
  ok("/go/youcan = SPA (GoPage)", (await youcan.text()).includes('id="root"'));
}

// ===================== النتيجة =====================
console.log(`feed: ${data.offers.length} offers, ${bytes} bytes, generated_at ${data.generated_at}`);
console.log(`checks: ${pass} passed, ${fails.length} failed`);
for (const f of fails) console.log(`  FAIL ${f}`);
process.exit(fails.length ? 1 : 0);
