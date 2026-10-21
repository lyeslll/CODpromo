import { useId, useMemo } from "react";
import { encode } from "uqr";
import { useTranslation } from "react-i18next";
import { PLAY_URL } from "../../lib/appInstall.js";

const INK = "#0b0b0c";
const PAPER = "#f3f6ea";
const QUIET = 2; // هامش هادئ (بالوحدات) حول الرمز

const f = (v) => Math.round(v * 100) / 100;

/** مسار مستطيل بزوايا دائرية (بوحدات الرمز). */
function rr(x, y, w, h, r) {
  return `M${f(x + r)} ${f(y)}h${f(w - 2 * r)}a${r} ${r} 0 0 1 ${r} ${r}v${f(h - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${r}h${f(-(w - 2 * r))}a${r} ${r} 0 0 1 ${-r} ${-r}v${f(-(h - 2 * r))}a${r} ${r} 0 0 1 ${r} ${-r}z`;
}

/**
 * يبني الرمز محلياً (uqr — بلا أي خدمة خارجية) بتصحيح أخطاء عالٍ (H ≈ 30%)،
 * فيبقى مقروءاً رغم أيقونة التطبيق في الوسط (تغطي ≈ 6% فقط من الوحدات).
 */
function buildQr(text) {
  const qr = encode(text, { ecc: "H", border: 0 });
  const n = qr.size;
  let logo = Math.round(n * 0.22);
  if (logo % 2 === 0) logo += 1;
  const c = (n - 1) / 2;
  const clear = (logo + 1) / 2; // نافذة الأيقونة + وحدة هامش
  const inLogo = (x, y) => Math.abs(x - c) <= clear && Math.abs(y - c) <= clear;
  const inFinder = (x, y) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
  let modules = "";
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!qr.data[y][x] || inFinder(x, y) || inLogo(x, y)) continue;
      // فراغ صغير جداً بين الوحدات (0.03) — مُختبَر: يُقرأ بكل المقاسات ومع خط المسح في كل موضع
      modules += rr(x + QUIET + 0.03, y + QUIET + 0.03, 0.94, 0.94, 0.22);
    }
  }
  // مربعات التحديد الثلاثة: حلقة دائرية الزوايا + نواة
  let finders = "";
  for (const [fx, fy] of [[0, 0], [n - 7, 0], [0, n - 7]]) {
    const x = fx + QUIET;
    const y = fy + QUIET;
    finders += rr(x, y, 7, 7, 2.1) + rr(x + 1, y + 1, 5, 5, 1.4) + rr(x + 2, y + 2, 3, 3, 0.95);
  }
  return { view: n + QUIET * 2, modules, finders, logo, center: c + QUIET };
}

/**
 * رمز QR يفتح صفحة التطبيق في Google Play: وحدات داكنة على ورق فاتح (أوضح للماسحات)،
 * أيقونة CODpromo في الوسط، وخط مسح ليموني يتحرك (يتوقف مع تقليل الحركة).
 * hot: عند المرور على شارة Google Play أو الضغط عليها — يكبر ويتنوّر.
 */
export default function PlayQr({ size = 132, hot = false }) {
  const { t } = useTranslation();
  const qr = useMemo(() => buildQr(PLAY_URL), []);
  const half = qr.logo / 2;
  const clipId = `qr-logo-${useId().replace(/:/g, "")}`;

  return (
    <div
      role="img"
      aria-label={t("app.qrLabel")}
      className="relative shrink-0 rounded-2xl p-0 transition-[transform,box-shadow] duration-300 ease-out"
      style={{
        width: size,
        height: size,
        background: PAPER,
        transform: hot ? "scale(1.08)" : "scale(1)",
        boxShadow: hot
          ? "0 0 0 2px rgba(166,240,0,0.9), 0 0 34px 6px rgba(166,240,0,0.45)"
          : "0 0 0 1px rgba(166,240,0,0.28), 0 14px 32px -16px rgba(0,0,0,0.8)",
      }}
    >
      <svg viewBox={`0 0 ${qr.view} ${qr.view}`} className="block h-full w-full" shapeRendering="geometricPrecision" aria-hidden>
        <path d={qr.modules} fill={INK} />
        <path d={qr.finders} fill={INK} fillRule="evenodd" />
        <defs>
          <clipPath id={clipId}>
            <rect x={qr.center - half + 0.5} y={qr.center - half + 0.5} width={qr.logo} height={qr.logo} rx={qr.logo * 0.24} />
          </clipPath>
        </defs>
        <image
          href="/pwa-192.png"
          x={qr.center - half + 0.5}
          y={qr.center - half + 0.5}
          width={qr.logo}
          height={qr.logo}
          clipPath={`url(#${clipId})`}
          preserveAspectRatio="xMidYMid slice"
        />
      </svg>
      {/* خط المسح */}
      <span aria-hidden className="pointer-events-none absolute inset-[5%] overflow-hidden rounded-xl motion-reduce:hidden">
        <span
          className="absolute inset-x-0 top-0 h-[22%] animate-[qr-scan_2.6s_ease-in-out_infinite_alternate]"
          style={{
            animationDuration: hot ? "1.3s" : undefined,
            // ذروة 0.45 فقط حتى لا يحجب الوحدات عن الماسح
            background: "linear-gradient(180deg, transparent, rgba(166,240,0,0.16) 70%, rgba(166,240,0,0.45) 96%, transparent)",
          }}
        />
      </span>
    </div>
  );
}
