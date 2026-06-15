// ============================================================
//  توليد أيقونات PWA من لوجو CODpromo (public/favicon.png)
//  تشغيل لمرة واحدة:  node scripts/gen-pwa-icons.mjs
//  يحتاج devDependency: sharp
// ============================================================
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const SRC = resolve(root, "public/favicon.png");
const BG = { r: 10, g: 10, b: 10, alpha: 1 }; // #0A0A0A (هوية الموقع)

/**
 * يضع اللوجو في مربّع بخلفية داكنة مع padding آمن.
 * @param {number} size  مقاس الأيقونة النهائي
 * @param {number} pad   نسبة الحاشية لكل جهة (0.1 = 10٪)
 * @param {string} out   مسار الإخراج
 * @param {boolean} transparent  خلفية شفافة (للأيقونات العادية any) أو داكنة
 */
async function make(size, pad, out, transparent = false) {
  const inner = Math.round(size * (1 - pad * 2));
  const logo = await sharp(SRC)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: transparent ? { r: 0, g: 0, b: 0, alpha: 0 } : BG,
    },
  })
    .composite([{ input: logo, gravity: "centre" }])
    .png()
    .toFile(out);
  console.log("✓", out.replace(root + "\\", "").replace(root + "/", ""));
}

const p = (f) => resolve(root, "public", f);

await make(192, 0.1, p("pwa-192.png")); // عادية (any) — خلفية داكنة
await make(512, 0.1, p("pwa-512.png"));
await make(192, 0.16, p("pwa-maskable-192.png"), false); // maskable — حاشية آمنة + خلفية ممتلئة
await make(512, 0.16, p("pwa-maskable-512.png"), false);
await make(180, 0.1, p("apple-touch-icon.png")); // iOS
console.log("تم توليد كل الأيقونات.");
