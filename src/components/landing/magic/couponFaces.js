// ============================================================
//  رسم وجهي الكوبون السحري على Canvas 2D (يُستعمل كـ texture للـ 3D).
//  الرسم بخطوط الصفحة نفسها (Tajawal / Inter) فيبقى تشكيل العربية صحيحاً.
//  الأبعاد: 1024×640 بكسل ↔ 3.2×2.0 وحدة في المشهد (1 وحدة = 320 بكسل).
// ============================================================

export const COUPON = { W: 3.2, H: 2.0, R: 0.16, NOTCH: 0.15, STUB: 0.64 };
export const TEX_W = 1024;
export const TEX_H = 640;
/** موضع الخط المثقّب (بكسل من الأعلى) — نفس موضع القصّ في المجسّم. */
export const PERF_Y = TEX_H * (1 - COUPON.STUB / COUPON.H);

const GOLD_SOFT = "#ffe486";
const GOLD = "#f0c63c";
const GOLD_DEEP = "#cf9a1e";
const INK = "#1d1403";
const MONO = 'ui-monospace, "Cascadia Mono", "SF Mono", Consolas, monospace';

/** #rrggbb + alpha → rgba() */
export function hexA(hex, a) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, "$&$&") : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

const familyOf = (lang) => (lang === "ar" ? '"Tajawal", sans-serif' : '"Inter", sans-serif');

function setFont(ctx, weight, size, family) {
  ctx.font = `${weight} ${size}px ${family}`;
}

/** أكبر مقاس خط (≤ size) يجعل النص داخل maxW. */
function fitFont(ctx, text, maxW, weight, size, family, min = 18) {
  let s = size;
  setFont(ctx, weight, s, family);
  while (s > min && ctx.measureText(text).width > maxW) {
    s -= 2;
    setFont(ctx, weight, s, family);
  }
  return s;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function dashed(ctx, x1, y, x2, color, width = 4, dash = [18, 14]) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  ctx.restore();
}

/** شريحة نصية (pill). anchorX = طرف البداية حسب align ("left" | "right"). */
function chip(ctx, text, anchorX, y, { fg, bg, border, family, size = 26, weight = 800, align = "left" }) {
  setFont(ctx, weight, size, family);
  const w = ctx.measureText(text).width + 40;
  const h = size + 22;
  const x = align === "right" ? anchorX - w : anchorX;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = bg;
  ctx.fill();
  if (border) {
    ctx.strokeStyle = border;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.fillStyle = fg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + w / 2, y + h / 2 + 1);
  ctx.textBaseline = "alphabetic";
  return w;
}

function drawLogo(ctx, logo, x, y, s, { letter, color, ring }) {
  ctx.save();
  roundRect(ctx, x, y, s, s, 26);
  ctx.fillStyle = logo ? "#ffffff" : "#18181c";
  ctx.fill();
  ctx.clip();
  if (logo) {
    const iw = logo.width || s;
    const ih = logo.height || s;
    const k = Math.max(s / iw, s / ih);
    ctx.drawImage(logo, x + (s - iw * k) / 2, y + (s - ih * k) / 2, iw * k, ih * k);
  } else {
    ctx.fillStyle = color;
    setFont(ctx, 900, s * 0.5, '"Inter", "Tajawal", sans-serif');
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(letter, x + s / 2, y + s / 2 + 4);
    ctx.textBaseline = "alphabetic";
  }
  ctx.restore();
  if (ring) {
    roundRect(ctx, x, y, s, s, 26);
    ctx.strokeStyle = ring;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}

/** قفل صغير مرسوم (لكود Premium المخفي). */
function drawLock(ctx, cx, cy, size, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = size * 0.14;
  ctx.beginPath();
  ctx.arc(cx, cy - size * 0.18, size * 0.26, Math.PI, 0);
  ctx.stroke();
  roundRect(ctx, cx - size * 0.38, cy - size * 0.18, size * 0.76, size * 0.6, size * 0.12);
  ctx.fill();
  ctx.restore();
}

/** تاج صغير مرسوم بجانب كلمة PREMIUM. */
function drawCrown(ctx, x, y, w, color) {
  const h = w * 0.72;
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + h * 0.28);
  ctx.lineTo(x + w * 0.27, y + h * 0.58);
  ctx.lineTo(x + w * 0.5, y);
  ctx.lineTo(x + w * 0.73, y + h * 0.58);
  ctx.lineTo(x + w, y + h * 0.28);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * الوجه الأمامي (عادي): أرضية داكنة، القيمة بلون النوع، والكعب فيه الكود.
 * f: بيانات الوجهين (buildCouponFaces) · labels: نصوص مترجمة · value: القيمة المعروضة.
 */
export function drawFront(ctx, f, { lang, labels, logo }) {
  const W = TEX_W;
  const H = TEX_H;
  const P = PERF_Y;
  const pad = 66;
  const rtl = lang === "ar";
  const fam = familyOf(lang);
  const start = rtl ? W - pad : pad;
  const end = rtl ? pad : W - pad;
  ctx.save();
  ctx.clearRect(0, 0, W, H);

  const base = ctx.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, "#1c1c22");
  base.addColorStop(1, "#101013");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);

  const gx = rtl ? W * 0.8 : W * 0.2;
  const glow = ctx.createRadialGradient(gx, -60, 20, gx, -60, 700);
  glow.addColorStop(0, hexA(f.color, 0.28));
  glow.addColorStop(1, hexA(f.color, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = hexA(f.color, 0.07);
  ctx.fillRect(0, P, W, H - P);
  dashed(ctx, 84, P, W - 84, hexA(f.color, 0.62));

  // الرأس: الشعار + الاسم + الفئة
  const ls = 112;
  const ly = 54;
  const lx = rtl ? W - pad - ls : pad;
  drawLogo(ctx, logo, lx, ly, ls, { letter: (f.name || "C").trim().charAt(0), color: f.color, ring: hexA(f.color, 0.35) });
  ctx.direction = rtl ? "rtl" : "ltr";
  ctx.textAlign = rtl ? "right" : "left";
  const tx = rtl ? lx - 28 : lx + ls + 28;
  const typeW = 230;
  fitFont(ctx, f.name, W - pad * 2 - ls - 28 - typeW, 800, 54, fam);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(f.name, tx, ly + 54);
  fitFont(ctx, f.category || "", W - pad * 2 - ls - 28 - typeW, 500, 30, fam);
  ctx.fillStyle = "#8d8d97";
  ctx.fillText(f.category || "", tx, ly + 98);

  chip(ctx, labels.type, end, ly + 6, {
    fg: f.color,
    bg: hexA(f.color, 0.12),
    border: hexA(f.color, 0.4),
    family: fam,
    align: rtl ? "left" : "right",
  });
  ctx.direction = rtl ? "rtl" : "ltr";
  ctx.textAlign = rtl ? "right" : "left";

  // القيمة
  setFont(ctx, 600, 30, fam);
  ctx.fillStyle = "#8d8d97";
  ctx.fillText(labels.offerValue, start, 262);
  ctx.save();
  ctx.direction = rtl ? "rtl" : "ltr";
  ctx.textAlign = rtl ? "right" : "left";
  ctx.shadowColor = hexA(f.color, 0.6);
  ctx.shadowBlur = 40;
  ctx.fillStyle = f.color;
  fitFont(ctx, f.normal, W - pad * 2, 900, 156, '"Inter", sans-serif', 60);
  ctx.fillText(f.normal, start, 404);
  ctx.restore();

  // الكعب: صندوق الكود
  const bx = pad;
  const bw = W - pad * 2;
  const by = P + 46;
  const bh = 112;
  roundRect(ctx, bx, by, bw, bh, 26);
  ctx.fillStyle = hexA(f.color, 0.06);
  ctx.fill();
  ctx.save();
  ctx.setLineDash([14, 10]);
  ctx.strokeStyle = hexA(f.color, 0.45);
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
  ctx.direction = rtl ? "rtl" : "ltr";
  ctx.textAlign = rtl ? "right" : "left";
  setFont(ctx, 700, 28, fam);
  ctx.fillStyle = "#8d8d97";
  ctx.fillText(labels.code, rtl ? bx + bw - 34 : bx + 34, by + bh / 2 + 10);
  ctx.direction = "ltr";
  ctx.textAlign = rtl ? "left" : "right";
  ctx.fillStyle = "#ffffff";
  if ("letterSpacing" in ctx) ctx.letterSpacing = "6px";
  fitFont(ctx, f.code, bw * 0.62, 800, 54, MONO, 26);
  ctx.fillText(f.code, rtl ? bx + 34 : bx + bw - 34, by + bh / 2 + 19);
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
  ctx.restore();
}

/**
 * الوجه الخلفي (Premium): ذهبي بالكامل، القيمة الأقوى (بعدّاد)، والكود مقفول.
 * value: النص الحالي للقيمة أثناء العدّ (مثلاً من "20%" إلى "30%").
 */
export function drawBack(ctx, f, { lang, labels, value }) {
  const W = TEX_W;
  const H = TEX_H;
  const P = PERF_Y;
  const pad = 66;
  const rtl = lang === "ar";
  const fam = familyOf(lang);
  const start = rtl ? W - pad : pad;
  const end = rtl ? pad : W - pad;
  ctx.save();
  ctx.clearRect(0, 0, W, H);

  const base = ctx.createLinearGradient(0, 0, W, H);
  base.addColorStop(0, "#fff1b8");
  base.addColorStop(0.35, GOLD_SOFT);
  base.addColorStop(0.7, GOLD);
  base.addColorStop(1, GOLD_DEEP);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);

  // نقشة دقيقة (guilloché) تعطي إحساس الورق المالي
  ctx.save();
  ctx.strokeStyle = "rgba(120, 82, 6, 0.12)";
  ctx.lineWidth = 2;
  const cx = rtl ? W * 0.18 : W * 0.82;
  for (let r = 60; r < 760; r += 26) {
    ctx.beginPath();
    ctx.arc(cx, H * 0.36, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // لمعة قطرية
  const sheen = ctx.createLinearGradient(0, 0, W, H * 0.6);
  sheen.addColorStop(0.25, "rgba(255,255,255,0)");
  sheen.addColorStop(0.42, "rgba(255,255,255,0.35)");
  sheen.addColorStop(0.55, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "rgba(90, 60, 0, 0.08)";
  ctx.fillRect(0, P, W, H - P);
  dashed(ctx, 84, P, W - 84, "rgba(90, 60, 0, 0.45)");

  // شارة PREMIUM + الاسم
  ctx.direction = "ltr";
  setFont(ctx, 900, 30, '"Inter", sans-serif');
  const label = labels.premiumBadge;
  const bw = ctx.measureText(label).width + 104;
  const bh = 58;
  const bx = rtl ? W - pad - bw : pad;
  const byTop = 56;
  roundRect(ctx, bx, byTop, bw, bh, bh / 2);
  ctx.fillStyle = INK;
  ctx.fill();
  drawCrown(ctx, bx + 26, byTop + 15, 34, GOLD_SOFT);
  ctx.fillStyle = GOLD_SOFT;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(label, bx + 72, byTop + bh / 2 + 1);
  ctx.textBaseline = "alphabetic";

  ctx.direction = rtl ? "rtl" : "ltr";
  ctx.textAlign = rtl ? "right" : "left";
  fitFont(ctx, f.name, W - pad * 2 - bw - 260, 800, 46, fam);
  ctx.fillStyle = INK;
  ctx.fillText(f.name, rtl ? bx - 26 : bx + bw + 26, byTop + 44);

  // شرائح: الفرق (+10%) أو شارة الكاش باك في المثال التوضيحي
  let cursor = end;
  const chips = [f.delta, f.extraBadge].filter(Boolean);
  for (const text of chips) {
    const w = chip(ctx, text, cursor, byTop + 2, {
      fg: GOLD_SOFT,
      bg: "rgba(29, 20, 3, 0.86)",
      family: fam,
      size: 26,
      align: rtl ? "left" : "right",
    });
    cursor = rtl ? cursor + w + 12 : cursor - w - 12;
  }
  ctx.direction = rtl ? "rtl" : "ltr";
  ctx.textAlign = rtl ? "right" : "left";

  // القيمة (عدّاد)
  setFont(ctx, 700, 30, fam);
  ctx.fillStyle = "rgba(29, 20, 3, 0.72)";
  ctx.fillText(labels.premiumDiscount, start, 262);
  ctx.save();
  ctx.direction = rtl ? "rtl" : "ltr";
  ctx.textAlign = rtl ? "right" : "left";
  ctx.shadowColor = "rgba(255, 255, 255, 0.55)";
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = INK;
  fitFont(ctx, value, W - pad * 2, 900, 156, '"Inter", sans-serif', 60);
  ctx.fillText(value, start, 404);
  ctx.restore();

  // الكعب: كود Premium مقفول
  const sx = pad;
  const sw = W - pad * 2;
  const sy = P + 46;
  const sh = 112;
  roundRect(ctx, sx, sy, sw, sh, 26);
  ctx.fillStyle = "rgba(29, 20, 3, 0.1)";
  ctx.fill();
  ctx.save();
  ctx.setLineDash([14, 10]);
  ctx.strokeStyle = "rgba(29, 20, 3, 0.4)";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
  ctx.direction = rtl ? "rtl" : "ltr";
  ctx.textAlign = rtl ? "right" : "left";
  setFont(ctx, 800, 28, fam);
  ctx.fillStyle = "rgba(29, 20, 3, 0.75)";
  ctx.fillText(labels.premiumCode, rtl ? sx + sw - 34 : sx + 34, sy + sh / 2 + 10);
  const lockX = rtl ? sx + 54 : sx + sw - 54;
  drawLock(ctx, lockX, sy + sh / 2 + 4, 40, INK);
  ctx.direction = "ltr";
  ctx.textAlign = rtl ? "left" : "right";
  ctx.fillStyle = INK;
  setFont(ctx, 900, 44, MONO);
  ctx.fillText("• • • • • •", rtl ? lockX + 40 : lockX - 40, sy + sh / 2 + 16);
  ctx.restore();
}

/** يحمّل شعار الشركة كـ bitmap آمن (fetch ← blob) حتى لا يتلوّث الـ canvas. */
export async function loadLogoBitmap(url) {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    if ("createImageBitmap" in window) return await createImageBitmap(blob);
    return await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = URL.createObjectURL(blob);
    });
  } catch {
    return null;
  }
}

/** ينتظر تحميل خطوط الصفحة قبل الرسم (وإلا تُرسم بخط بديل). */
export async function ensureFonts(lang) {
  if (!document.fonts?.load) return;
  const fam = lang === "ar" ? "Tajawal" : "Inter";
  try {
    await Promise.all([
      document.fonts.load(`900 64px "Inter"`),
      document.fonts.load(`800 54px "${fam}"`),
      document.fonts.load(`500 30px "${fam}"`),
    ]);
  } catch {
    /* نرسم بما هو متاح */
  }
}
