import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Megaphone } from "lucide-react";
import { useTranslation } from "react-i18next";
import CompanyCard from "../CompanyCard.jsx";
import { frameTone } from "./tone.js";
import "./featured-mobile.css";

const toneVars = (tone) => ({ "--fm": tone.color, "--fm-glow": tone.glow, "--fm-line": `${tone.color}40` });

function Badge({ label }) {
  const { t } = useTranslation();
  const sponsored = label === "sponsored";
  const Icon = sponsored ? Megaphone : Sparkles;
  return (
    <span className={`fm-badge ${sponsored ? "is-sponsored" : ""}`}>
      <Icon size={12} strokeWidth={2.6} aria-hidden />
      {t(`featured.badge.${sponsored ? "sponsored" : "featured"}`)}
    </span>
  );
}

/** علامة العرض المميّز داخل شبكة /offers في الموبايل: حافة ثابتة + الوسم، بلا أي مؤثر. */
export function FeaturedMark({ tone, label, children }) {
  return (
    <div className="fm-mark" style={toneVars(tone)}>
      <Badge label={label} />
      <div className="fm-card">{children}</div>
    </div>
  );
}

/**
 * العروض المميّزة في الموبايل (أقل من 1024px أو جهاز لمس): شريط سحب بـ scroll-snap أصلي فقط.
 * البطاقة في الوسط حافتها مضيئة بلون النوع (ثابتة)، والجاران يطلّان من الحافتين.
 * النقطة النشطة من IntersectionObserver (شريط ضيّق في وسط الشريط) — لا حسابات أثناء السحب.
 */
export default function FeaturedMobileCarousel({ items, premiumMode = false, favorites = [], onToggleFav, onCopy, unlocked = false, onUnlock }) {
  const { t } = useTranslation();
  const trackRef = useRef(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number(e.target.dataset.index));
      },
      { root: track, rootMargin: "0px -45% 0px -45%", threshold: 0 }
    );
    track.querySelectorAll("[data-slide]").forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [items.length]);

  // البطاقات نفسها لا تُعاد عند تغيّر البطاقة النشطة (نفس العنصر → React يتجاوزها)؛ تتغيّر الحافة والنقاط فقط
  const cards = useMemo(
    () =>
      items.map((it, i) => (
        <CompanyCard
          company={it.company}
          index={i}
          isFavorite={favorites.includes(it.company.id)}
          onToggleFav={onToggleFav || (() => {})}
          onCopy={onCopy || (() => {})}
          premium={premiumMode && it.company.supports_premium !== false}
          unlocked={unlocked}
          onUnlock={onUnlock}
          copySource="featured"
        />
      )),
    [items, premiumMode, favorites, onToggleFav, onCopy, unlocked, onUnlock]
  );

  const scrollToSlide = (i) => {
    const track = trackRef.current;
    const s = track?.querySelectorAll("[data-slide]")[i];
    if (!s) return;
    const r = track.getBoundingClientRect();
    const b = s.getBoundingClientRect();
    track.scrollBy({ left: b.left + b.width / 2 - (r.left + r.width / 2), behavior: "smooth" });
  };

  return (
    <div className="-mx-4">
      <div ref={trackRef} className="fm-track no-scrollbar" data-no-swipe>
        {items.map((it, i) => {
          const premium = premiumMode && it.company.supports_premium !== false;
          return (
            <div
              key={it.company.id}
              data-slide
              data-index={i}
              className={`fm-slide ${i === active ? "is-active" : ""}`}
              style={toneVars(frameTone(it.company, premium))}
            >
              <Badge label={it.label} />
              <div className="fm-card">{cards[i]}</div>
            </div>
          );
        })}
      </div>

      {items.length > 1 && (
        <div className="flex items-center justify-center gap-1">
          {items.map((it, i) => (
            <button
              key={it.company.id}
              type="button"
              onClick={() => scrollToSlide(i)}
              aria-label={t("featured.goTo", { name: it.company.name })}
              aria-current={i === active || undefined}
              className="grid h-7 place-items-center px-1"
            >
              <span
                className="block h-2 rounded-full"
                style={{
                  width: i === active ? 22 : 8,
                  background: i === active ? frameTone(it.company, premiumMode && it.company.supports_premium !== false).color : "rgba(255,255,255,0.22)",
                }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
