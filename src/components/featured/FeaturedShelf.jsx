import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import CompanyCard from "../CompanyCard.jsx";
import FeaturedFrame, { frameTone } from "./FeaturedFrame.jsx";
import FeaturedCarousel from "./FeaturedCarousel.jsx";
import { canUseFx } from "../../lib/fxCapability.js";
import { useElementWidth } from "./hooks.js";

const SHELF_MIN = 940;

/**
 * صف "العروض المميّزة" في /offers — نسخة الكمبيوتر (تُحمَّل ديناميكياً عبر desktop.js):
 * رفّ من 3 بطاقات مضيئة (يتمرّر بالأسهم إن كانت أكثر).
 */
export default function FeaturedShelf({ items, premiumMode, favorites, onToggleFav, onCopy, unlocked, onUnlock }) {
  const { i18n } = useTranslation();
  const rtl = i18n.dir(i18n.language) === "rtl";
  const wrapRef = useRef(null);
  const width = useElementWidth(wrapRef);
  const fx = useMemo(() => canUseFx(), []);
  const tones = useMemo(
    () => items.map((it) => frameTone(it.company, premiumMode && it.company.supports_premium !== false)),
    [items, premiumMode]
  );

  const renderCard = (it, i) => (
    <CompanyCard
      company={it.company}
      index={i}
      isFavorite={favorites.includes(it.company.id)}
      onToggleFav={onToggleFav}
      onCopy={onCopy}
      premium={premiumMode && it.company.supports_premium !== false}
      unlocked={unlocked}
      onUnlock={onUnlock}
      copySource="featured"
    />
  );

  return (
    <div ref={wrapRef}>
      {width > 0 &&
        (width < SHELF_MIN ? (
          <FeaturedCarousel items={items} tones={tones} fx={fx} renderCard={renderCard} width={width} />
        ) : (
          <Shelf items={items} tones={tones} fx={fx} renderCard={renderCard} rtl={rtl} />
        ))}
    </div>
  );
}

/* رفّ الحاسوب: 3 بطاقات في العرض، والأسهم تظهر فقط إن كان هناك ما يُمرَّر */
function Shelf({ items, tones, fx, renderCard, rtl }) {
  const { t } = useTranslation();
  const ref = useRef(null);
  const [edge, setEdge] = useState({ start: true, end: true });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const pos = Math.abs(el.scrollLeft);
    setEdge((p) => {
      const n = { start: pos <= 8, end: pos >= max - 8 };
      return p.start === n.start && p.end === n.end ? p : n;
    });
  }, []);

  useEffect(() => {
    update();
    const ro = new ResizeObserver(update);
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [update, items.length]);

  const page = (dir) => {
    const el = ref.current;
    el?.scrollBy({ left: dir * (rtl ? -1 : 1) * el.clientWidth * 0.9, behavior: "smooth" });
  };

  return (
    <div className="relative">
      <div ref={ref} onScroll={update} className="fx-track fx-shelf no-scrollbar flex gap-4 overflow-x-auto py-7">
        {items.map((it, i) => (
          <div key={it.company.id} className="fx-slide shrink-0" style={{ width: "calc((100% - 2rem) / 3)" }}>
            <FeaturedFrame tone={tones[i]} label={it.label} variant="row" lit fx={fx} tilt track>
              {renderCard(it, i)}
            </FeaturedFrame>
          </div>
        ))}
      </div>
      {!edge.start && (
        <ShelfArrow side="start" label={t("featured.prev")} onClick={() => page(-1)}>
          <ChevronRight size={18} className="ltr:rotate-180" />
        </ShelfArrow>
      )}
      {!edge.end && (
        <ShelfArrow side="end" label={t("featured.next")} onClick={() => page(1)}>
          <ChevronLeft size={18} className="ltr:rotate-180" />
        </ShelfArrow>
      )}
    </div>
  );
}

function ShelfArrow({ side, label, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`absolute top-1/2 z-20 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] text-[var(--text-softer)] shadow-[0_8px_24px_-8px_rgba(0,0,0,0.8)] transition-colors hover:text-[var(--text)] ${
        side === "start" ? "-start-3" : "-end-3"
      }`}
    >
      {children}
    </button>
  );
}
