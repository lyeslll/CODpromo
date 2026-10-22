import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import FeaturedMobileCarousel from "./FeaturedMobileCarousel.jsx";
import { useMobileFx, useDesktopFx } from "./mobile.js";

/**
 * صف "العروض المميّزة" أعلى شبكة /offers.
 * موبايل (أقل من 1024px أو لمس): شريط سحب خفيف بلا مؤثرات (FeaturedMobileCarousel).
 * كمبيوتر: رفّ البطاقات المضيئة (FeaturedShelf) — يُحمَّل ديناميكياً فقط هنا.
 */
export default function FeaturedRow({ items, premiumMode, favorites, onToggleFav, onCopy, unlocked, onUnlock, onShowAll }) {
  const { t } = useTranslation();
  const mobile = useMobileFx();
  const fxMod = useDesktopFx(!mobile);
  const cardProps = { items, premiumMode, favorites, onToggleFav, onCopy, unlocked, onUnlock };

  return (
    <section aria-labelledby="featured-row-title" className="mb-2">
      <div className="flex items-center justify-between gap-3">
        <h2 id="featured-row-title" className="flex items-center gap-2 text-[18px] font-black sm:text-[20px]">
          <Sparkles size={18} className="text-[var(--accent-text)]" aria-hidden />
          {t("featured.rowTitle")}
        </h2>
        <button
          type="button"
          onClick={onShowAll}
          className="rounded-xl px-2.5 py-1.5 text-[13px] font-bold text-[var(--text-softer)] transition-colors hover:bg-[var(--fill)] hover:text-[var(--text)]"
        >
          {t("featured.showAll")}
        </button>
      </div>
      {mobile ? (
        <FeaturedMobileCarousel {...cardProps} />
      ) : fxMod ? (
        <fxMod.FeaturedShelf {...cardProps} />
      ) : (
        <div className="min-h-[560px]" />
      )}
    </section>
  );
}
