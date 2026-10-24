// ============================================================
//  CODpromo — صورة المشاركة لكل شركة (/api/og?slug=just-sell) — Vercel Edge + @vercel/og
//  اللوغو + الاسم + القيمة (+ قيمة Premium) + codpromo.com، 1200×630، باش الرابط يبان مليح في
//  واتساب وفيسبوك و X. النص لاتيني برك (القيم بنسخة en: "10%"، "$5 gift") لأن مولّد الصور ما يشكّلش
//  الحروف العربية. أي فشل → تحويل للصورة العامة (logo-dark.png). Cache: يوم في المتصفح، أسبوع في CDN.
// ============================================================
import { ImageResponse } from "@vercel/og";

export const config = { runtime: "edge" };

const SITE = "https://codpromo.com";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://uulcgvdsqivgkiulurhk.supabase.co";
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_kxiLaS2RxTEeZA6TrJQR_w_ws8twFBt";
const TYPE_COLORS = { "تخفيض": "#a6f000", "كوبون": "#38bdf8", "كاش باك": "#fbbf24" };
const FONT_CSS = "https://fonts.googleapis.com/css2?family=Inter:wght@800";

let fontCache = null;
async function interFont() {
  if (fontCache) return fontCache;
  // بلا woff2: user-agent قديم → Google يرجّع TTF (المولّد ما يقراش woff2)
  const css = await (await fetch(FONT_CSS, { headers: { "User-Agent": "Mozilla/4.0" } })).text();
  const url = (css.match(/url\((https:[^)]+\.ttf)\)/) || [])[1];
  if (!url) throw new Error("font");
  fontCache = await (await fetch(url)).arrayBuffer();
  return fontCache;
}

/** اللوغو كـ data URI (PNG / JPEG / SVG برك — WebP ما يتقراش). */
async function logoData(logo) {
  if (!/^https?:\/\//i.test(logo || "")) return null;
  const src = logo.includes("/storage/v1/object/public/")
    ? `${logo.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/")}?width=360&height=360&resize=contain&format=origin`
    : logo;
  const r = await fetch(src, { headers: { Accept: "image/png,image/jpeg,image/svg+xml" } });
  if (!r.ok) return null;
  const type = (r.headers.get("content-type") || "").split(";")[0];
  if (!/^image\/(png|jpeg|svg\+xml)$/.test(type)) return null;
  const buf = new Uint8Array(await r.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return `data:${type};base64,${btoa(bin)}`;
}

const h = (type, props, ...children) => ({ type, props: { ...props, children: children.length <= 1 ? children[0] : children } });
const latin = (s) => String(s || "").replace(/[؀-ۿ]+/g, "").replace(/\s{2,}/g, " ").trim();

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const slug = (searchParams.get("slug") || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 80);
  const fallback = () => Response.redirect(`${SITE}/logo-dark.png`, 302);
  if (!slug) return fallback();
  try {
    const q = `${SUPABASE_URL}/rest/v1/companies?slug=eq.${slug}&select=name,logo,type,discount,discount_en,premium_discount_en,premium_discount,has_premium_code,supports_premium`;
    const rows = await (await fetch(q, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } })).json();
    const c = Array.isArray(rows) ? rows[0] : null;
    if (!c) return fallback();
    const [font, logo] = await Promise.all([interFont(), logoData(c.logo).catch(() => null)]);
    const accent = TYPE_COLORS[c.type] || "#a6f000";
    const value = latin(c.discount_en || c.discount);
    const premium = c.has_premium_code && c.supports_premium !== false ? latin(c.premium_discount_en || c.premium_discount) : "";
    const name = latin(c.name) || c.slug;

    const card = h(
      "div",
      { style: { width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 64, background: "#0a0a0a", backgroundImage: `radial-gradient(900px 500px at 85% -10%, ${accent}33, transparent 60%)`, color: "#fff", fontFamily: "Inter" } },
      h(
        "div",
        { style: { display: "flex", alignItems: "center", gap: 40 } },
        h(
          "div",
          { style: { display: "flex", width: 200, height: 200, borderRadius: 44, background: "#fff", alignItems: "center", justifyContent: "center", overflow: "hidden", border: `3px solid ${accent}66` } },
          logo ? h("img", { src: logo, width: 168, height: 168, style: { objectFit: "contain" } }) : h("div", { style: { fontSize: 96, color: accent } }, name.charAt(0))
        ),
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: 10, maxWidth: 760 } },
          h("div", { style: { fontSize: 64, lineHeight: 1.05, letterSpacing: -2 } }, name),
          h("div", { style: { fontSize: 30, color: "#a1a1aa" } }, "Promo code · CODpromo")
        )
      ),
      h(
        "div",
        { style: { display: "flex", alignItems: "flex-end", justifyContent: "space-between" } },
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: 14 } },
          h("div", { style: { fontSize: value.length > 10 ? 96 : 150, lineHeight: 0.9, color: accent, letterSpacing: -4 } }, value || name),
          premium ? h("div", { style: { display: "flex", alignItems: "center", gap: 14, fontSize: 40, color: "#ffe486" } }, h("div", { style: { width: 18, height: 18, borderRadius: 9, background: "#f0c63c" } }), `${premium} with Premium`) : h("div", { style: { display: "flex" } })
        ),
        h("div", { style: { fontSize: 34, color: "#a6f000" } }, "codpromo.com")
      )
    );

    return new ImageResponse(card, {
      width: 1200,
      height: 630,
      fonts: [{ name: "Inter", data: font, weight: 800, style: "normal" }],
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800" },
    });
  } catch {
    return fallback();
  }
}
