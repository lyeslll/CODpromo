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

// اللون الرابع: "بلا كود" (بنفسجي) — والذهبي لـ Premium، والرمادي للمجمّدة.
// السطح أسود كتذاكر الكوبون؛ اللون للمسات فقط (الحافة، الشريط، الميزة، الوسم، الشرط، الزر).
// كل الأزواج نص/خلفية مقيسة ≥ 4.5:1 (WCAG AA).
export const NOCODE_COLOR = "#b794ff";
const TONES = {
  violet: {
    "--gc": NOCODE_COLOR,
    "--gc-deep": "#6d3fe0",
    "--gc-edge": "rgba(183,148,255,0.30)",
    "--gc-edge-strong": "rgba(183,148,255,0.65)",
    "--gc-tint": "rgba(183,148,255,0.12)",
    "--gc-tint-line": "rgba(183,148,255,0.28)",
    "--gc-chip-text": "#d9ccff",
    "--gc-btn": "linear-gradient(135deg, #7346ee, #5f36d4)",
    "--gc-btn-text": "#ffffff",
    "--gc-badge-bg": "linear-gradient(135deg, #7346ee, #5f36d4)",
    "--gc-badge-text": "#ffffff",
    "--gc-ring": "rgba(183,148,255,0.10)",
    glow: "rgba(183,148,255,0.22)",
  },
  gold: {
    "--gc": "#f0c63c",
    "--gc-deep": "#8f6a12",
    "--gc-edge": "rgba(240,198,60,0.30)",
    "--gc-edge-strong": "rgba(240,198,60,0.65)",
    "--gc-tint": "rgba(240,198,60,0.12)",
    "--gc-tint-line": "rgba(240,198,60,0.30)",
    "--gc-chip-text": "#ffe9a3",
    "--gc-btn": "linear-gradient(135deg, #ffe486, #cf9a1e)",
    "--gc-btn-text": "#0a0a0a",
    "--gc-badge-bg": "#f0c63c",
    "--gc-badge-text": "#0a0a0a",
    "--gc-ring": "rgba(240,198,60,0.10)",
    "--gc-shadow": "0 18px 34px -24px rgba(240,198,60,0.35)",
    glow: "rgba(240,198,60,0.30)",
  },
  frozen: {
    "--gc": "#71717a",
    "--gc-deep": "#3f3f46",
    "--gc-edge": "rgba(255,255,255,0.07)",
    "--gc-edge-strong": "rgba(255,255,255,0.12)",
    "--gc-tint": "rgba(255,255,255,0.03)",
    "--gc-tint-line": "rgba(255,255,255,0.08)",
    "--gc-chip-text": "#c9c9cf",
    "--gc-btn": "none",
    "--gc-btn-text": "#a1a1aa",
    "--gc-badge-bg": "#3f3f46",
    "--gc-badge-text": "#d4d4d8",
    "--gc-ring": "rgba(255,255,255,0.04)",
    glow: null,
  },
};

// "8$ رصيد مجاني" → ["8$", "رصيد مجاني"]: الرقم في البداية يُكتب أكبر من الكلمات
const REWARD_NUM = /^(\S*\d[\d.,]*\S*(?:\s(?:\$|€|%|دج|DZD))?)\s+(.+)$/su;
function splitReward(text) {
  const m = REWARD_NUM.exec(text || "");
  return m ? [m[1], m[2]] : [null, text];
}

/**
 * بطاقة عرض بلا كود (بطاقة هدية): اللوغو، الاسم، الفئة، وسم "بلا كود"، الميزة بخط كبير،
 * الشرط في شريحة تحتها، الوصف (إن وُجد)، وزر "احصل على العرض" نحو /go/<slug> (rel="sponsored nofollow").
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
  const toneName = frozen ? "frozen" : gold ? "gold" : "violet";
  const { glow: glowColor, ...vars } = TONES[toneName];

  const cat = deal.category_id ? byId?.[deal.category_id] : null;
  const category = cat ? categoryName(cat, lang) : "";
  const reward = gold ? dealText(deal, "premium_reward", lang) || dealText(deal, "reward", lang) : dealText(deal, "reward", lang);
  const condition = gold
    ? dealText(deal, "premium_condition", lang) || dealText(deal, "condition", lang)
    : dealText(deal, "condition", lang);
  const desc = dealText(deal, "description", lang);
  const ctaLabel = t("nocode.cta");
  const [rewardNum, rewardRest] = splitReward(reward);

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
    <article ref={glow.ref} {...glow.handlers} data-tone={toneName} className="gift group" style={vars}>
      {/* النسبة (حدّ أدنى) والمحتوى في نفس خانة الشبكة — شوف nocode.css */}
      <span aria-hidden className="gift-ratio" />
      <span aria-hidden className="gift-decor">
        {glowColor && <GlowSpot color={glowColor} />}
        <span className="gift-rings" />
        <span className="gift-ribbon" />
        <svg className="gift-bow" viewBox="0 0 28 20" fill="currentColor">
          <path d="M14 10C10.5 4 6.5 1.5 3.6 2.6 1 3.6 1.2 7.6 4 9.4 6.3 10.9 10 10.7 14 10Z" />
          <path d="M14 10C17.5 4 21.5 1.5 24.4 2.6 27 3.6 26.8 7.6 24 9.4 21.7 10.9 18 10.7 14 10Z" />
          <path d="M14 10 9.5 18.5 12 17.6 13.2 19.6 14 11.5 14.8 19.6 16 17.6 18.5 18.5Z" opacity="0.85" />
          <circle cx="14" cy="10" r="2.6" />
        </svg>
      </span>

      <div className="gift-inner">
        <header className="gift-head">
          <DealLogo logo={deal.logo_url} name={deal.name} />
          <div className="min-w-0">
            <h3 className="truncate text-[15.5px] font-extrabold text-[var(--text)]">{deal.name}</h3>
            {category && <p className="mt-0.5 truncate text-[12px] font-medium text-[var(--text-soft)]">{category}</p>}
          </div>
          <span className="gift-badge">
            {gold ? <Crown size={12} strokeWidth={2.6} aria-hidden /> : <Gift size={12} strokeWidth={2.6} aria-hidden />}
            {gold ? t("nocode.premiumTag") : t("nocode.tag")}
          </span>
        </header>

        {frozen ? (
          <>
            <p className="gift-reward" style={{ color: "#8e8e96" }}>
              —
            </p>
            {onShowNormal ? (
              <button
                type="button"
                onClick={onShowNormal}
                className="mt-2 inline-flex items-center gap-1.5 self-start text-[13px] font-bold text-[var(--text-softer)] underline-offset-4 hover:text-[var(--text)] hover:underline"
              >
                <Undo2 size={14} /> {t("card.showNormal")}
              </button>
            ) : null}
          </>
        ) : (
          <>
            <p className={`gift-reward ${reward.length > 18 ? "is-long" : ""}`}>
              {rewardNum ? (
                <>
                  <span className="gift-num">{rewardNum}</span> {rewardRest}
                </>
              ) : (
                reward
              )}
            </p>
            {condition && (
              <p className="gift-chip">
                <span>{condition}</span>
              </p>
            )}
            {desc && <p className="gift-desc">{desc}</p>}
          </>
        )}

        <div className="gift-spacer" />
        {cta}
      </div>
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
