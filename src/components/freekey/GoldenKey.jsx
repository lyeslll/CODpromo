import { forwardRef, useId } from "react";

// ============================================================
//  رسم المفتاح الذهبي والقفل (SVG بلا صور). المفتاح افتراضياً: الحلقة يمين والسن يسار
//  (يشير نحو البطاقة في العربية)؛ flip يقلب الرسم برك والكتابة تبقى مقروءة.
//  tipRef / holeRef: نقطتان مخفيّتان (رأس المفتاح وثقب القفل) لحساب طيران المفتاح.
// ============================================================

const W = 260;
const H = 96;

/** المفتاح: label يتنقش على الساق (اختياري). */
export const GoldenKey = forwardRef(function GoldenKey({ label, flip = false, tipRef, className = "", style }, ref) {
  const id = useId().replace(/:/g, "");
  const g = `fk-g-${id}`;
  const b = `fk-b-${id}`;
  const textX = flip ? W - 92 : 92;
  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className={className} style={style} aria-hidden focusable="false">
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3c4" />
          <stop offset="0.32" stopColor="#ffe486" />
          <stop offset="0.62" stopColor="#f0c63c" />
          <stop offset="0.86" stopColor="#cf9a1e" />
          <stop offset="1" stopColor="#a87512" />
        </linearGradient>
        <radialGradient id={b} cx="0.38" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#fff6d5" />
          <stop offset="0.45" stopColor="#f0c63c" />
          <stop offset="1" stopColor="#a87512" />
        </radialGradient>
      </defs>
      <g transform={flip ? `matrix(-1 0 0 1 ${W} 0)` : undefined} stroke="#7a5408" strokeWidth="1">
        {/* الحلقة */}
        <path
          fillRule="evenodd"
          fill={`url(#${b})`}
          d="M248 48a38 38 0 1 1-76 0a38 38 0 1 1 76 0z M224 48a14 14 0 1 0-28 0a14 14 0 1 0 28 0z"
        />
        <circle cx="210" cy="48" r="27" fill="none" stroke="rgba(107,74,5,0.45)" strokeWidth="1.4" />
        {[45, 135, 225, 315].map((a) => (
          <circle key={a} cx={210 + 33 * Math.cos((a * Math.PI) / 180)} cy={48 + 33 * Math.sin((a * Math.PI) / 180)} r="1.7" fill="rgba(107,74,5,0.55)" stroke="none" />
        ))}
        {/* الطوق */}
        <rect x="160" y="34" width="13" height="28" rx="4" fill={`url(#${g})`} />
        <rect x="150" y="37" width="8" height="22" rx="3" fill={`url(#${g})`} />
        {/* الساق + الرأس + الأسنان */}
        <rect x="30" y="38" width="124" height="20" rx="5" fill={`url(#${g})`} />
        <path d="M31 38H24Q16 48 24 58H31Z" fill={`url(#${g})`} />
        <path d="M36 58H86V70H76V64H66V76H54V68H44V74H36Z" fill={`url(#${g})`} />
        {/* لمعة */}
        <rect x="34" y="40.5" width="116" height="2.4" rx="1.2" fill="rgba(255,255,255,0.6)" stroke="none" />
        <path d="M184 30a30 30 0 0 1 22-13" fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth="2.4" strokeLinecap="round" />
        <circle ref={tipRef} cx="19" cy="48" r="0.5" fill="none" stroke="none" />
      </g>
      {label && (
        <g fontWeight="800" fontSize="11.5" textAnchor="middle" style={{ fontFamily: "var(--font-sans)" }}>
          <text x={textX} y={52.6} fill="rgba(255,248,214,0.7)">
            {label}
          </text>
          <text x={textX} y={51.8} fill="#5c3f04">
            {label}
          </text>
        </g>
      )}
    </svg>
  );
});

/** القفل الذهبي: holeRef على ثقب المفتاح. */
export const GoldenLock = forwardRef(function GoldenLock({ holeRef, className = "", style }, ref) {
  const id = useId().replace(/:/g, "");
  const g = `fl-g-${id}`;
  return (
    <svg ref={ref} viewBox="0 0 64 80" className={className} style={style} aria-hidden focusable="false">
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3c4" />
          <stop offset="0.35" stopColor="#ffe486" />
          <stop offset="0.7" stopColor="#f0c63c" />
          <stop offset="1" stopColor="#b8860b" />
        </linearGradient>
      </defs>
      <path d="M17 37V25a15 15 0 0 1 30 0v12" fill="none" stroke="#7a5408" strokeWidth="9" strokeLinecap="round" />
      <path d="M17 37V25a15 15 0 0 1 30 0v12" fill="none" stroke={`url(#${g})`} strokeWidth="7" strokeLinecap="round" />
      <rect x="6" y="34" width="52" height="42" rx="10" fill={`url(#${g})`} stroke="#7a5408" />
      <rect x="11" y="38.5" width="42" height="2.6" rx="1.3" fill="rgba(255,255,255,0.5)" />
      <circle cx="32" cy="51" r="5.6" fill="#3a2803" />
      <path d="M29.3 54h5.4l1.5 11h-8.4z" fill="#3a2803" />
      <circle ref={holeRef} cx="32" cy="55" r="0.5" fill="none" />
    </svg>
  );
});
