import { forwardRef, useId } from "react";

// ============================================================
//  المفتاح الماسي (SVG بلا صور): رأس = جوهرة مقطوعة (تاج + جناح بوجوه بألوان مختلفة كيما الكريستال)،
//  ساق جليدية وأسنان. نفس مقاس المفتاح الذهبي (260×96) ونفس الاتجاه: الجوهرة يمين والسن يسار
//  (يشير نحو البطاقة في العربية)؛ flip يقلب الرسم. sparkle = نجيمات تلمع (CSS، تتوقّف مع reduced-motion).
// ============================================================

const W = 260;
const H = 96;

// الجوهرة: الطاولة (فوق)، الحزام (الوسط)، القاع
const T = [[188, 20], [208, 20], [228, 20]];
const G = [[168, 38], [189, 38], [208, 38], [227, 38], [248, 38]];
const C = [208, 86];
const pts = (...p) => p.map((x) => x.join(",")).join(" ");

export const DiamondKey = forwardRef(function DiamondKey({ flip = false, sparkle = false, className = "", style }, ref) {
  const id = useId().replace(/:/g, "");
  const shaft = `dk-s-${id}`;
  const shine = `dk-h-${id}`;
  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className={className} style={style} aria-hidden focusable="false">
      <defs>
        <linearGradient id={shaft} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.35" stopColor="#dbeeff" />
          <stop offset="0.7" stopColor="#a9cdff" />
          <stop offset="1" stopColor="#6f8fe6" />
        </linearGradient>
        <linearGradient id={shine} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g transform={flip ? `matrix(-1 0 0 1 ${W} 0)` : undefined} strokeLinejoin="round">
        {/* الساق + الرأس + الأسنان */}
        <g fill={`url(#${shaft})`} stroke="#3f5bb3" strokeWidth="1">
          <rect x="30" y="40" width="128" height="16" rx="4" />
          <path d="M31 40H24Q17 48 24 56H31Z" />
          <path d="M38 56H88V68H78V62H68V74H56V66H46V72H38Z" />
          <rect x="154" y="36" width="14" height="24" rx="4" />
        </g>
        <rect x="34" y="42.5" width="120" height="2.2" rx="1.1" fill="#ffffff" opacity="0.75" />
        {/* الجوهرة: وجوه التاج */}
        <g stroke="#ffffff" strokeOpacity="0.75" strokeWidth="0.9">
          <polygon points={pts(G[0], T[0], G[1])} fill="#cfe8ff" />
          <polygon points={pts(T[0], T[1], G[2], G[1])} fill="#f4fbff" />
          <polygon points={pts(T[1], T[2], G[3], G[2])} fill="#d8c9ff" />
          <polygon points={pts(T[2], G[4], G[3])} fill="#a9cdff" />
          {/* وجوه الجناح (تحت الحزام) */}
          <polygon points={pts(G[0], G[1], C)} fill="#8fb2ff" />
          <polygon points={pts(G[1], G[2], C)} fill="#dbeeff" />
          <polygon points={pts(G[2], G[3], C)} fill="#ffd6f7" />
          <polygon points={pts(G[3], G[4], C)} fill="#6f8fe6" />
        </g>
        <polygon points={pts(G[0], T[0], T[2], G[4], C)} fill="none" stroke="#3f5bb3" strokeWidth="1.2" />
        {/* لمعة على التاج */}
        <polygon points={pts([190, 22], [207, 22], [198, 36])} fill={`url(#${shine})`} />
      </g>
      {sparkle && (
        <g className="dk-spark" fill="#ffffff">
          <path d={star(flip ? W - 244 : 244, 14, 7)} />
          <path d={star(flip ? W - 172 : 172, 74, 5)} style={{ animationDelay: "0.9s" }} />
          <path d={star(flip ? W - 222 : 222, 62, 4)} style={{ animationDelay: "1.7s" }} />
        </g>
      )}
    </svg>
  );
});

/** نجمة بأربع نقاط (لمعة). */
function star(x, y, r) {
  const k = r * 0.28;
  return `M${x} ${y - r}L${x + k} ${y - k}L${x + r} ${y}L${x + k} ${y + k}L${x} ${y + r}L${x - k} ${y + k}L${x - r} ${y}L${x - k} ${y - k}Z`;
}

/** أيقونة صغيرة (العدّاد، الأزرار): جوهرة بوجوه — نفس ألوان المفتاح. */
export function DiamondGlyph({ size = 16, className = "", style }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} style={style} aria-hidden focusable="false">
      <g stroke="#ffffff" strokeOpacity="0.7" strokeWidth="0.6" strokeLinejoin="round">
        <polygon points="2,9 7,3.5 9.5,9" fill="#cfe8ff" />
        <polygon points="7,3.5 12,3.5 12,9 9.5,9" fill="#f4fbff" />
        <polygon points="12,3.5 17,3.5 14.5,9 12,9" fill="#d8c9ff" />
        <polygon points="17,3.5 22,9 14.5,9" fill="#a9cdff" />
        <polygon points="2,9 9.5,9 12,21" fill="#8fb2ff" />
        <polygon points="9.5,9 14.5,9 12,21" fill="#dbeeff" />
        <polygon points="14.5,9 22,9 12,21" fill="#6f8fe6" />
      </g>
      <polygon points="2,9 7,3.5 17,3.5 22,9 12,21" fill="none" stroke="#3f5bb3" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}
