import { useState } from "react";
import { Gift, Crown, Lock, ExternalLink, Undo2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCategories } from "../../lib/categories.jsx";
import { categoryName } from "../../lib/slug.js";
import { dealText, goPath } from "../../lib/nocode.js";
import { dealHasPremium } from "../../lib/premiumOffer.js";
import { isImageUrl } from "../CompanyLogo.jsx";
import { GlowSpot, useCardGlow } from "../CardGlow.jsx";
import "./nocode.css";

// اللون الرابع: "بلا كود" (بنفسجي) — والذهبي لـ Premium، والرمادي للمجمّدة
export const NOCODE_COLOR = "#b794ff";
const TONES = {
  violet: {
    "--gc": NOCODE_COLOR,
    "--gc-deep": "#6d3fe0",
    "--gc-soft": "rgba(183,148,255,0.16)",
    "--gc-line": "rgba(183,148,255,0.32)",
    "--gc-surface": "#150f21",
    "--gc-btn": "linear-gradient(135deg, #d9c7ff, #9b6dff)",
    glow: "rgba(183,148,255,0.30)",
  },
  gold: {
    "--gc": "#f0c63c",
    "--gc-deep": "#8f6a12",
    "--gc-soft": "rgba(240,198,60,0.16)",
    "--gc-line": "rgba(240,198,60,0.36)",
    "--gc-surface": "#17130a",
    "--gc-btn": "linear-gradient(135deg, #ffe486, #cf9a1e)",
    glow: "rgba(240,198,60,0.32)",
  },
  frozen: {
    "--gc": "#71717a",
    "--gc-deep": "#3f3f46",
    "--gc-soft": "rgba(255,255,255,0.03)",
    "--gc-line": "rgba(255,255,255,0.08)",
    "--gc-surface": "#111113",
    "--gc-btn": "none",
    glow: null,
  },
};

/**
 * بطاقة عرض بلا كود (بطاقة هدية): اللوغو، الاسم، الفئة، وسم "بلا كود"، الميزة بخط كبير،
 * الشرط تحتها، الوصف (إن وُجد)، وزر "احصل على العرض" نحو /go/<slug> (rel="sponsored nofollow").
 *  - premium: الميزة الأقوى بالذهبي؛ غير المشترك → الزر يفتح نافذة Premium (onUnlock).
 *  - premium بلا رابط Premium → مجمّدة (رمادية، بلا زر) مع onShowNormal.
 *  - preview: معاينة الأدمن — بلا تنقّل ولا تسجيل.
 * بلا تصويت ولا مفضّلة في هذه النسخة.
 */
export default function NocodeCard({ deal, premium = false, unlocked = false, onUnlock, onShowNormal, preview = false }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { byId } = useCategories();
  const glow = useCardGlow();

  const frozen = premium && !dealHasPremium(deal);
  const gold = premium && !frozen;
  const tone = TONES[frozen ? "frozen" : gold ? "gold" : "violet"];
  const { glow: glowColor, ...vars } = tone;

  const cat = deal.category_id ? byId?.[deal.category_id] : null;
  const category = cat ? categoryName(cat, lang) : "";
  const reward = gold ? dealText(deal, "premium_reward", lang) || dealText(deal, "reward", lang) : dealText(deal, "reward", lang);
  const condition = gold
    ? dealText(deal, "premium_condition", lang) || dealText(deal, "condition", lang)
    : dealText(deal, "condition", lang);
  const desc = dealText(deal, "description", lang);
  const ctaLabel = t("nocode.cta");

  let cta;
  if (frozen) {
    cta = (
      <div className="gift-frozen-panel" role="note">
        <Lock size={15} className="shrink-0 text-[#71717a]" />
        {t("nocode.frozen")}
      </div>
    );
  } else if (preview) {
    cta = (
      <span className="gift-cta" aria-hidden>
        {gold && !unlocked ? <Lock size={16} /> : <ExternalLink size={16} />}
        {ctaLabel}
      </span>
    );
  } else if (gold && !unlocked) {
    // عرض Premium موجود والزائر غير مشترك: لا تحويل — نافذة Premium
    cta = (
      <button type="button" className="gift-cta" onClick={() => onUnlock?.()} aria-label={t("nocode.ctaLocked", { name: deal.name })}>
        <Lock size={16} />
        {ctaLabel}
      </button>
    );
  } else {
    cta = (
      <a
        href={goPath(deal, gold)}
        target="_blank"
        rel="sponsored nofollow noopener"
        className="gift-cta"
        aria-label={t("nocode.ctaAria", { name: deal.name })}
      >
        <ExternalLink size={16} />
        {ctaLabel}
      </a>
    );
  }

  return (
    <article ref={glow.ref} {...glow.handlers} data-tone={frozen ? "frozen" : gold ? "gold" : "violet"} className="gift group" style={vars}>
      <span aria-hidden className="gift-decor">
        {glowColor && <GlowSpot color={glowColor} />}
        <span className="gift-guilloche" />
        <span className="gift-ribbon" />
      </span>
      <span className="gift-tag">
        {gold ? <Crown size={12} strokeWidth={2.6} aria-hidden /> : <Gift size={12} strokeWidth={2.6} aria-hidden />}
        {gold ? t("nocode.premiumTag") : t("nocode.tag")}
      </span>

      <header className="gift-head">
        <DealLogo logo={deal.logo_url} name={deal.name} />
        <div className="min-w-0">
          <h3 className="truncate text-[15.5px] font-extrabold text-[var(--text)]">{deal.name}</h3>
          {category && <p className="mt-0.5 truncate text-[12px] font-medium text-[var(--color-mute)]">{category}</p>}
        </div>
      </header>

      <div className="relative">
        {frozen ? (
          <>
            <p className="gift-reward" style={{ color: "#52525b", textShadow: "none" }}>
              —
            </p>
            {onShowNormal ? (
              <button
                type="button"
                onClick={onShowNormal}
                className="mt-1.5 inline-flex items-center gap-1.5 text-[13px] font-bold text-[var(--text-softer)] underline-offset-4 hover:text-[var(--text)] hover:underline"
              >
                <Undo2 size={14} /> {t("card.showNormal")}
              </button>
            ) : null}
          </>
        ) : (
          <>
            <p className={`gift-reward ${reward.length > 18 ? "is-long" : ""}`}>{reward}</p>
            {condition && <p className="gift-condition">{condition}</p>}
            {desc && <p className="gift-desc">{desc}</p>}
          </>
        )}
      </div>

      <div className="gift-spacer" />
      {cta}
    </article>
  );
}

function DealLogo({ logo, name }) {
  const [errored, setErrored] = useState(false);
  const showImage = isImageUrl(logo) && !errored;
  const letter = (name || "؟").trim().charAt(0);
  return (
    <div className="gift-logo grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/[0.08] bg-[#1b1b20]">
      {showImage ? (
        <img src={logo} alt={name || "logo"} loading="lazy" onError={() => setErrored(true)} className="h-full w-full object-cover" />
      ) : (
        <span className="text-[20px] font-black text-[var(--gc)]">{letter}</span>
      )}
    </div>
  );
}
