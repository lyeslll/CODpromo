import { useState, useEffect } from "react";

/** هل القيمة رابط صورة؟ */
export const isImageUrl = (v) =>
  typeof v === "string" && /^(https?:\/\/|data:image\/|\/)/i.test(v.trim());

/**
 * يعرض لوجو الشركة:
 *  - صورة حقيقية إن كان الحقل رابطاً
 *  - إيموجي إن كان رمزاً قصيراً
 *  - أول حرف من الاسم (fallback أنيق) عند الفشل أو الغياب
 */
export default function CompanyLogo({ logo, name, size = 56, accent = "#a6f000", className = "" }) {
  const [errored, setErrored] = useState(false);
  useEffect(() => setErrored(false), [logo]);

  const showImage = isImageUrl(logo) && !errored;
  const showEmoji = !showImage && logo && !isImageUrl(logo);
  const letter = (name || "؟").trim().charAt(0);

  return (
    <div
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-xl ${className}`}
      style={{
        width: size,
        height: size,
        background: showImage ? "transparent" : "linear-gradient(150deg, #1c1c20, #141417)",
        border: "1px solid var(--color-ink-line)",
        boxShadow: `0 6px 18px -10px ${accent}55`,
      }}
    >
      {showImage ? (
        <img
          src={logo}
          alt={name || "logo"}
          loading="lazy"
          onError={() => setErrored(true)}
          className="h-full w-full object-cover"
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
