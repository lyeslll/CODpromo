import { useTranslation } from "react-i18next";
import { PLAY_URL, badgeSrc } from "../../lib/appInstall.js";

// الهامش الشفاف في الملف الرسمي (42px من 250px في كل جهة)
const PAD = 42 / 250;

/**
 * شارة Google Play الرسمية (صورة Google كما هي — لا تعديل في الألوان ولا الشكل ولا النص).
 * glow: هالة ليمونية خلف الشارة (خارجها) تقوى عند المرور. height = ارتفاع الصورة كاملة
 * (الملف الرسمي فيه هامش شفاف: الشارة الظاهرة ≈ 66% من الارتفاع).
 * flush: إزاحة سالبة بقدر الهامش الشفاف حتى تصطف الشارة الظاهرة مع النص (الصورة نفسها لا تُقصّ).
 * باقي الخصائص (onPointerEnter…) تُمرَّر للرابط.
 */
export default function GooglePlayBadge({ height = 60, glow = false, flush = false, className = "", style, ...rest }) {
  const { t, i18n } = useTranslation();
  return (
    <a
      href={PLAY_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`group/play relative inline-flex shrink-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-lime)]/70 ${className}`}
      style={flush ? { marginInlineStart: -height * PAD, marginBlock: -height * PAD * 0.8, ...style } : style}
      {...rest}
    >
      {glow && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-[8%] inset-y-[20%] rounded-2xl opacity-45 blur-xl transition-opacity duration-300 group-hover/play:opacity-90 group-focus-visible/play:opacity-90 motion-safe:animate-[play-breathe_3.6s_ease-in-out_infinite]"
          style={{ background: "rgba(166,240,0,0.55)" }}
        />
      )}
      <img
        src={badgeSrc(i18n.language)}
        alt={t("app.badgeAlt")}
        width={646}
        height={250}
        draggable={false}
        className="relative block w-auto select-none transition-transform duration-300 group-hover/play:-translate-y-0.5"
        style={{ height }}
      />
    </a>
  );
}
