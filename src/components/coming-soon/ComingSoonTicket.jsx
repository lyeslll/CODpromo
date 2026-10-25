import { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Crown, ExternalLink, Heart, Hourglass, Stamp } from "lucide-react";
import { useTranslation } from "react-i18next";
import BidiText from "../BidiText.jsx";
import { GlowSpot, useCardGlow } from "../CardGlow.jsx";
import { canUseFx } from "../../lib/fxCapability.js";
import ComingSoonNotify from "./ComingSoonNotify.jsx";
import { SOON, SOON_GLOW } from "./tone.js";
import "./coming-soon.css";

const GOLD_SOFT = "#ffe486";
const GOLD_DEEP = "#cf9a1e";
const GOLD_GLOW = "rgba(240,198,60,0.4)";

/**
 * بطاقة "العرض قريباً" (phase coming-soon) — نفس تذكرة الكوبون (نفس الأجزاء data-part ونفس الارتفاع تقريباً):
 * اللوغو، الاسم، الفئة، الوصف، صفحة الشركة، المفضّلة، و"زيارة الموقع" برابط الإحالة اللي يخدم من دروك.
 * في بلاصة القيمة والكود: "قريباً، ترقّبوا" بالوردي (لون خاص بالقريبة)، ختم شمع فوق الخط المثقّب، ولمعة خفيفة
 * على "قريباً". في بلاصة التصويت: "أعلمني عند التفعيل" + العدّاد الحقيقي. premium = عرض Premium قريب (شارة PREMIUM).
 * live = false: معاينة (فورم الأدمين) — بلا نداءات.
 */
export default function ComingSoonTicket({ company, index = 0, isFavorite, onToggleFav, linkToStore = true, storeHref, category, desc, premium = false, logo, live = true }) {
  const { t, i18n } = useTranslation();
  const glow = useCardGlow();
  const fx = useMemo(() => canUseFx(), []);
  const rtl = i18n.language === "ar";

  const vars = {
    "--edge-base": `${SOON}40`,
    "--edge-strong": `${SOON}a6`,
    "--perf": `${SOON}66`,
    "--stub": `${SOON}0b`,
  };

  const head = (
    <>
      {logo}
      <div className="min-w-0">
        <h3 className={`truncate text-[17px] font-extrabold text-[var(--text)] ${linkToStore ? "transition-colors group-hover/link:text-[#ffc2dc]" : ""}`}>{company.name}</h3>
        <p className={`mt-0.5 truncate text-[12.5px] font-medium text-[var(--color-mute)] ${premium ? "pe-11" : ""}`}>{category}</p>
      </div>
    </>
  );

  return (
    <motion.article
      ref={glow.ref}
      {...glow.handlers}
      data-wave-id={`c${company.id}`}
      data-soon=""
      data-soon-anchor=""
      initial={{ opacity: 0, y: 26 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10, scale: 0.97 }}
      transition={{ duration: 0.45, delay: Math.min(index * 0.05, 0.35), ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -4 }}
      className={`ticket ticket-soon group relative flex flex-col ${fx ? "soon-fx" : ""}`}
      style={vars}
    >
      {/* ===== الجزء العلوي: الشركة + الوصف + "قريباً" ===== */}
      <div className="ticket-top relative bg-[var(--color-ink-card)] p-5 pb-4">
        <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(120% 70% at 50% 0%, ${SOON}1a, transparent 62%)` }} />
        <GlowSpot color={SOON_GLOW} />
        <span aria-hidden className="ticket-ring ticket-ring-l" />
        <span aria-hidden className="ticket-ring ticket-ring-r" />

        {premium && (
          <span
            data-part="premium-badge"
            className="pointer-events-none absolute end-5 top-14 z-20 flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black text-[#0a0a0a]"
            style={{ background: `linear-gradient(135deg, ${GOLD_SOFT}, ${GOLD_DEEP})`, boxShadow: `0 4px 14px -5px ${GOLD_GLOW}` }}
          >
            <Crown size={11} /> {t("card.premiumBadge")}
          </span>
        )}

        <div className="relative flex items-start justify-between gap-2">
          {linkToStore ? (
            <Link to={storeHref} className="group/link flex min-w-0 items-center gap-3">
              {head}
            </Link>
          ) : (
            <div className="flex min-w-0 items-center gap-3">{head}</div>
          )}
          <button
            data-part="fav"
            type="button"
            onClick={() => onToggleFav?.(company.id)}
            aria-label={t("card.addFav")}
            aria-pressed={!!isFavorite}
            className="relative grid h-8 w-8 shrink-0 place-items-center self-start rounded-full border border-[var(--color-ink-line)] bg-[var(--fill)] transition-colors before:absolute before:-inset-1.5 before:content-[''] hover:bg-[var(--fill-strong)]"
          >
            <Heart size={15} className={isFavorite ? "fill-red-500 text-red-500" : "text-[var(--color-mute)]"} />
          </button>
        </div>

        <p className="relative mt-4 line-clamp-3 h-[60px] overflow-hidden text-[13.5px] leading-[1.48] text-[var(--text-soft)]">
          <BidiText text={desc} rtl={rtl} />
        </p>

        <div className="relative mt-4 flex items-end justify-between gap-2">
          <div data-part="value" className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5 text-[11.5px] font-semibold text-[var(--color-mute)]">
              {premium && <Crown size={12} style={{ color: "#f0c63c" }} />}
              {premium ? t("card.premiumDiscount") : t("card.offerValue")}
            </div>
            <div className="truncate text-[30px] font-black leading-none">
              <span className="soon-shine">{t("comingSoon.value")}</span>
            </div>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold" style={{ background: `${SOON}1a`, color: SOON }}>
            <Hourglass size={13} />
            {t("comingSoon.stay")}
          </span>
        </div>
      </div>

      {/* ختم الشمع فوق الخط المثقّب (خارج الأجزاء المقصوصة: باش يبان كامل) */}
      <div aria-hidden className="relative h-0">
        <span className="soon-seal" title={t("comingSoon.sealed")}>
          <Stamp size={15} strokeWidth={2.2} />
        </span>
      </div>

      {/* ===== الكعب: الكود المختوم + الزيارة + "أعلمني" (نفس طول كعب البطاقة العادية: 229.5px) ===== */}
      <div className="ticket-stub relative flex-1 bg-[var(--color-ink-card)] px-5 pb-5 pt-[17px]">
        <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "var(--stub)" }} />
        <GlowSpot color={SOON_GLOW} />
        <span aria-hidden className="ticket-ring ticket-ring-l" />
        <span aria-hidden className="ticket-ring ticket-ring-r" />
        <span aria-hidden className="ticket-perf" />

        <div data-part="code" className="soon-code relative flex min-h-[44.5px] items-center justify-between gap-3 rounded-xl px-3.5 py-2.5">
          <span className="shrink-0 text-[10.5px] font-semibold text-[var(--color-mute)]">{premium ? t("card.premiumCode") : t("card.code")}</span>
          <span className="truncate text-[13.5px] font-extrabold" style={{ color: SOON }}>
            {t("comingSoon.codeSoon")}
          </span>
        </div>

        {company.link ? (
          <motion.a
            data-part="visit"
            href={company.link}
            target="_blank"
            rel="noopener noreferrer sponsored"
            whileTap={{ scale: 0.98 }}
            className="relative mt-2.5 flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-[13.5px] font-bold text-[var(--text)] transition-colors"
            style={{ borderColor: `${SOON}44`, background: `${SOON}0d` }}
          >
            <ExternalLink size={15} style={{ color: SOON }} />
            {t("card.visit")}
          </motion.a>
        ) : (
          <div
            data-part="visit"
            aria-disabled="true"
            className="relative mt-2.5 flex cursor-not-allowed select-none items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-[13.5px] font-bold text-[var(--color-mute)] opacity-60"
            style={{ borderColor: `${SOON}33`, background: `${SOON}08` }}
          >
            <ExternalLink size={15} style={{ color: SOON }} />
            {t("card.visit")}
          </div>
        )}

        <div data-part="vote" className="relative mt-4 border-t border-[var(--color-ink-line)] pt-3.5">
          <ComingSoonNotify companyId={company.id} live={live} />
        </div>
      </div>
    </motion.article>
  );
}
