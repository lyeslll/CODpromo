// ============================================================
//  توليد أيقونات PWA من لوجو CODpromo (public/favicon-1024.png)
//  تشغيل لمرة واحدة:  node scripts/gen-pwa-icons.mjs   (أو: npm run pwa-icons)
//  يحتاج devDependency: sharp
// ============================================================
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const SRC = resolve(root, "public/favicon-1024.png"); // الأيقونة عالية الجودة 1024×1024
const BG = { r: 10, g: 10, b: 10, alpha: 1 }; // #0A0A0A (هوية الموقع)
const p = (f) => resolve(root, "public", f);
const rel = (out) => out.replace(root + "\\", "").replace(root + "/", "");

/** النسخ العادية: الأيقونة تملأ المربّع كاملاً (المصدر مربّع → تعبئة تامة). */
async function makeFill(size, out) {
  await sharp(SRC).resize(size, size, { fit: "cover" }).png().toFile(out);
  console.log("✓ fill    ", rel(out));
}

/** نسخ maskable فقط: هامش أمان ~20٪ حول اللوجو على خلفية ممتلئة (يمنع القصّ الدائري على أندرويد). */
async function makeMaskable(size, out) {
  const margin = 0.2; // 20٪ لكل جهة
  const inner = Math.round(size * (1 - margin * 2)); // اللوجو في وسط ~60٪
  const logo = await sharp(SRC)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: logo, gravity: "centre" }])
    .png()
    .toFile(out);
  console.log("✓ maskable", rel(out));
}

// النسخ العادية (تملأ المربّع كاملاً)
await makeFill(192, p("pwa-192.png"));
await makeFill(512, p("pwa-512.png"));
await makeFill(180, p("apple-touch-icon.png"));
await makeFill(256, p("favicon.png")); // أيقونة المتصفّح (favicon)

// نسخ maskable (هامش أمان 20٪)
await makeMaskable(192, p("pwa-maskable-192.png"));
await makeMaskable(512, p("pwa-maskable-512.png"));

console.log("تم توليد كل الأيقونات.");
