import { useState, useEffect } from "react";
import { cachedTone, detectTone, logoSrc, logoSrcSet, tileStyle } from "../lib/logoImage.js";

/** هل القيمة رابط صورة؟ */
export const isImageUrl = (v) =>
  typeof v === "string" && /^(https?:\/\/|data:image\/|\/)/i.test(v.trim());

/**
 * يعرض لوجو الشركة في مربع موحّد:
 *  - صورة حقيقية إن كان الحقل رابطاً (بالحجم المعروض، WebP عبر Supabase)، بخلفية مربع
 *    من bg (logo_bg في الأدمن) ولا من حواف الصورة (أبيض / داكن / الصورة كاملة) + حشو مناسب
 *  - إيموجي إن كان رمزاً قصيراً
 *  - أول حرف من الاسم (fallback أنيق) عند الفشل أو الغياب
 *  eager: للوغو اللي يبان في أول شاشة (صفحة الشركة) — بلا lazy.
 */
export default function CompanyLogo({ logo, name, size = 56, accent = "#a6f000", className = "", bg = null, eager = false }) {
  // 0 = النسخة المصغّرة، 1 = الملف الأصلي (إذا فشلت المصغّرة)، 2 = فشل → الحرف
  const [fail, setFail] = useState(0);
  const showImage = isImageUrl(logo) && fail < 2;
  const [tone, setTone] = useState(() => (showImage && !bg ? cachedTone(logo) : undefined));

  useEffect(() => setFail(0), [logo]);
  useEffect(() => {
    if (!showImage || bg) return;
    let alive = true;
    const known = cachedTone(logo);
    if (known) setTone(known);
    else detectTone(logo).then((t) => alive && setTone(t));
    return () => {
      alive = false;
    };
  }, [logo, bg, showImage]);

  const showEmoji = !showImage && logo && !isImageUrl(logo);
  const letter = (name || "؟").trim().charAt(0);
  const tile = showImage ? tileStyle(bg, tone) : null;
  const pad = tile ? Math.round(size * tile.pad) : 0;

  return (
    <div
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-xl ${className}`}
      style={{
        width: size,
        height: size,
        background: showImage ? tile.background : "linear-gradient(150deg, #1c1c20, #141417)",
        border: "1px solid var(--color-ink-line)",
        boxShadow: `0 6px 18px -10px ${accent}55`,
        padding: pad,
        transition: "padding 0.2s ease, background-color 0.2s ease",
      }}
    >
      {showImage ? (
        <img
          src={fail ? logo : logoSrc(logo, size * 2)}
          srcSet={fail ? undefined : logoSrcSet(logo, size)}
          width={size}
          height={size}
          alt={name || "logo"}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onError={() => setFail((n) => n + 1)}
          className={`h-full w-full ${pad ? "object-contain" : "object-cover"}`}
        />
      ) : showEmoji ? (
        <span style={{ fontSize: size * 0.5, lineHeight: 1 }}>{logo}</span>
      ) : (
        <span
          className="font-black"
          style={{ fontSize: size * 0.42, color: accent, lineHeight: 1 }}
        >
          {letter}
        </span>
      )}
    </div>
  );
}
