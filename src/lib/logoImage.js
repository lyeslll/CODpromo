// ============================================================
//  CODpromo — لوغوهات الشركات: الحجم الصحيح + خلفية المربع
//  1) الصور في bucket logos تتخدم عبر Supabase Image Transformation بالحجم اللي يلزم
//     (WebP وحدو إذا المتصفّح يقبلو) — بلاصة الملف الأصلي (كاين لوغو فيه 1MB).
//  2) خلفية المربع: logo_bg من الأدمن (white / dark / transparent / #rrggbb)، وإلا نقراو
//     حواف الصورة مرة وحدة (canvas صغير 24px، محفوظ) ونختارو: أبيض، داكن، ولا الصورة كاملة.
// ============================================================

const STORAGE_PUBLIC = "/storage/v1/object/public/";
const STORAGE_RENDER = "/storage/v1/render/image/public/";
const TONE_KEY = "codpromo:logo-tone:v1";

/** رابط بحجم معيّن (px مربّع) لصورة من Supabase Storage؛ أي رابط آخر يرجع كيما هو. */
export function logoSrc(url, px) {
  if (typeof url !== "string" || !url.includes(STORAGE_PUBLIC) || /\.svg(\?|$)/i.test(url)) return url;
  const size = Math.max(16, Math.round(px));
  return `${url.replace(STORAGE_PUBLIC, STORAGE_RENDER)}?width=${size}&height=${size}&resize=contain&quality=80`;
}

/** srcSet 1x/2x للحجم المعروض. */
export function logoSrcSet(url, size) {
  const one = logoSrc(url, size);
  if (one === url) return undefined;
  return `${one} 1x, ${logoSrc(url, size * 2)} 2x`;
}

// ===================== خلفية المربع =====================
let cache = null;
function loadCache() {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(TONE_KEY) || "{}") || {};
  } catch {
    cache = {};
  }
  return cache;
}
function saveCache() {
  try {
    localStorage.setItem(TONE_KEY, JSON.stringify(cache));
  } catch {
    /* تجاهل */
  }
}
// الخدمة تتأجّل لوقت الفراغ (ماشي وسط تحميل الصفحة): قراءة البكسلات + كتابة وحدة في localStorage لكل اللوغوهات
const idle = (fn) => (typeof requestIdleCallback === "function" ? requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(fn, 1));
let saveQueued = false;
function queueSave() {
  if (saveQueued) return;
  saveQueued = true;
  idle(() => {
    saveQueued = false;
    saveCache();
  });
}

/** النتيجة المحفوظة (متزامن) — undefined إذا ما تحسبتش بعد. */
export function cachedTone(url) {
  return loadCache()[url];
}

const pending = new Map();

/**
 * يقرا حواف اللوغو: "light" (خلفية بيضاء) | "dark" (خلفية داكنة) | "clear" (شفافة) | "full" (الصورة تعمّر المربع).
 * يحتاج CORS (Supabase Storage يبعث Access-Control-Allow-Origin: *). أي فشل → "full" (كيما قبل).
 */
export function detectTone(url) {
  const known = cachedTone(url);
  if (known) return Promise.resolve(known);
  if (pending.has(url)) return pending.get(url);
  const p = new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => idle(() => {
      let tone = "full";
      try {
        const n = 24;
        const c = document.createElement("canvas");
        c.width = n;
        c.height = n;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, n, n);
        const d = ctx.getImageData(0, 0, n, n).data;
        let clear = 0, light = 0, dark = 0, count = 0;
        for (let y = 0; y < n; y++) {
          for (let x = 0; x < n; x++) {
            if (x > 1 && x < n - 2 && y > 1 && y < n - 2) continue; // الحواف برك
            const i = (y * n + x) * 4;
            const a = d[i + 3];
            const lum = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
            count++;
            if (a < 40) clear++;
            else if (lum > 228) light++;
            else if (lum < 40) dark++;
          }
        }
        if (clear / count > 0.6) tone = "clear";
        else if (light / count > 0.7) tone = "light";
        else if (dark / count > 0.7) tone = "dark";
      } catch {
        tone = "full";
      }
      loadCache()[url] = tone;
      queueSave();
      resolve(tone);
    });
    img.onerror = () => resolve("full");
    img.src = logoSrc(url, 24);
  });
  pending.set(url, p);
  return p;
}

/**
 * شكل المربع من logo_bg (الأدمن) ولا من الحواف.
 * يرجع { background, pad } — pad = نسبة الحشو (0 = الصورة تعمّر المربع).
 */
export function tileStyle(bg, tone) {
  if (bg === "white") return { background: "#ffffff", pad: 0.14 };
  if (bg === "dark") return { background: "#141417", pad: 0.14 };
  if (bg === "transparent") return { background: "transparent", pad: 0 };
  if (typeof bg === "string" && /^#[0-9a-f]{6}$/i.test(bg)) return { background: bg, pad: 0.14 };
  if (tone === "light") return { background: "#ffffff", pad: 0.12 };
  if (tone === "dark") return { background: "#0e0e10", pad: 0.1 };
  if (tone === "clear") return { background: "linear-gradient(150deg, #1d1d22, #131316)", pad: 0.16 };
  return { background: "transparent", pad: 0 };
}
