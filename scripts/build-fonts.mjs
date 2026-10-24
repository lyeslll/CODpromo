// Download the needed woff2 subsets from Google Fonts and write a self-hosted @font-face CSS.
// Keeps: Tajawal (arabic + latin), Inter (latin + latin-ext). Output: public/fonts/*.woff2 + src/assets/fonts/fonts.css
import fs from "node:fs";
import path from "node:path";
const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^/([A-Z]:)/, "$1")), "..");
const css = fs.readFileSync(process.argv[2] || "google.css", "utf8");
const blocks = [...css.matchAll(/\/\* ([a-z-]+) \*\/\s*@font-face\s*\{([\s\S]*?)\}/g)];
const keep = { Tajawal: ["arabic", "latin"], Inter: ["latin", "latin-ext"] };
const outDir = path.join(repo, "public/fonts");
fs.mkdirSync(outDir, { recursive: true });
const faces = [];
const seen = new Map();
for (const [, subset, body] of blocks) {
  const family = body.match(/font-family:\s*'([^']+)'/)[1];
  if (!keep[family]?.includes(subset)) continue;
  const weight = body.match(/font-weight:\s*(\d+)/)[1];
  const src = body.match(/url\((https:[^)]+)\)/)[1];
  const range = body.match(/unicode-range:\s*([^;]+);/)[1].trim();
  const ver = (src.match(/\/v(\d+)\//) || [])[1] || "x";
  // Inter is a variable font on Google: same file for every weight → one file per subset
  let name = seen.get(src);
  if (!name) {
    name = `${family.toLowerCase()}-v${ver}-${subset}${family === "Inter" ? "" : `-${weight}`}.woff2`;
    const buf = Buffer.from(await (await fetch(src)).arrayBuffer());
    fs.writeFileSync(path.join(outDir, name), buf);
    seen.set(src, name);
    console.log(name, buf.length);
  }
  faces.push({ family, weight, name, range, subset });
}
const lines = [
  "/* ============================================================",
  "   الخطوط من الموقع نفسه (بلاصة fonts.googleapis.com — طلب CSS يحبس أول رسم + اتصالين جداد).",
  "   Tajawal (العربية): arabic + latin. Inter (en/fr): latin + latin-ext (ملف متغيّر لكل الأوزان).",
  "   font-display: swap، و unicode-range باش المتصفح يحمّل غير اللي يلزم. رخصة OFL (Google Fonts).",
  "   مولّد بـ scripts/build-fonts.mjs — ما تبدّلش باليد.",
  "   ============================================================ */",
];
for (const f of faces) {
  lines.push(
    `@font-face {\n  font-family: "${f.family}";\n  font-style: normal;\n  font-weight: ${f.weight};\n  font-display: swap;\n  src: url("/fonts/${f.name}") format("woff2");\n  unicode-range: ${f.range};\n}`
  );
}
fs.mkdirSync(path.join(repo, "src/assets/fonts"), { recursive: true });
fs.writeFileSync(path.join(repo, "src/assets/fonts/fonts.css"), lines.join("\n") + "\n");
console.log("faces", faces.length, "files", seen.size);
