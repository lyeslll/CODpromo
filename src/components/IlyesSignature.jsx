/**
 * IlyesSignature — توقيع "من تطوير Ilyes Derradji" (مكوّن مستقل قابل للنسخ لأي موقع React).
 *
 * لا يعتمد على أي شيء خاص بـ CODpromo: لا Tailwind، لا i18n، لا مكتبات — React فقط،
 * والتنسيق كله داخل الملف (وسم <style> بأصناف تبدأ بـ ilyes-sig).
 *
 * الاستعمال:
 *   <IlyesSignature />                         // عربي، لخلفية داكنة
 *   <IlyesSignature lang="en" />               // "Made by"
 *   <IlyesSignature tone="dark" />             // لخلفية فاتحة (يقلب لون الشعار للأسود)
 *   <IlyesSignature label="تصميم وتطوير" />    // نص مخصّص
 *
 * يحتاج ملف الشعار في public/brand/ilyes-derradji.png (أو مرّر logoSrc).
 */

const LABELS = { ar: "من تطوير", en: "Made by", fr: "Conçu par" };

const CSS = `
.ilyes-sig{display:inline-flex;align-items:center;gap:.55em;font:inherit;font-size:12.5px;line-height:1;text-decoration:none;color:var(--ilyes-sig-text);border-radius:999px;padding:.35em .2em;outline:none;transition:color .3s ease}
.ilyes-sig:hover,.ilyes-sig:focus-visible{color:var(--ilyes-sig-text-hover)}
.ilyes-sig:focus-visible{box-shadow:0 0 0 2px var(--ilyes-sig-glow)}
.ilyes-sig__logo{display:block;height:1.6em;width:auto;opacity:.82;transition:transform .45s cubic-bezier(.2,.9,.3,1.3),filter .45s ease,opacity .3s ease;filter:var(--ilyes-sig-tone) drop-shadow(0 0 0 transparent)}
.ilyes-sig:hover .ilyes-sig__logo,.ilyes-sig:focus-visible .ilyes-sig__logo{opacity:1;transform:translateY(-1px) rotate(-8deg) scale(1.12);filter:var(--ilyes-sig-tone) drop-shadow(0 0 7px var(--ilyes-sig-glow))}
.ilyes-sig__name{font-weight:700;letter-spacing:.01em}
@media (prefers-reduced-motion: reduce){.ilyes-sig,.ilyes-sig__logo{transition:none}.ilyes-sig:hover .ilyes-sig__logo,.ilyes-sig:focus-visible .ilyes-sig__logo{transform:none}}
`;

export default function IlyesSignature({
  lang = "ar",
  label,
  tone = "light",
  showName = false,
  logoSrc = "/brand/ilyes-derradji.png",
  href = "https://ilyesderradji.com",
  glow,
  className = "",
  style,
}) {
  const text = label ?? LABELS[lang] ?? LABELS.en;
  const light = tone !== "dark";
  const vars = {
    "--ilyes-sig-text": light ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.55)",
    "--ilyes-sig-text-hover": light ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.9)",
    "--ilyes-sig-glow": glow ?? (light ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.35)"),
    "--ilyes-sig-tone": light ? "invert(0)" : "invert(1)",
    ...style,
  };
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      aria-label={`${text} Ilyes Derradji`}
      className={`ilyes-sig ${className}`}
      style={vars}
    >
      <style>{CSS}</style>
      <span>{text}</span>
      <img className="ilyes-sig__logo" src={logoSrc} alt="Ilyes Derradji" width={219} height={176} loading="lazy" decoding="async" />
      {showName && <span className="ilyes-sig__name">Ilyes Derradji</span>}
    </a>
  );
}
