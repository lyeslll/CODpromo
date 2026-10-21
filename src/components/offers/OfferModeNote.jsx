import { Crown, Tag } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * بوكس معلومات الوضع (عادي / Premium).
 * كل الحالات الثلاث مكدّسة في نفس خلية الشبكة، فتأخذ الخلية ارتفاع أطول نص دائماً
 * → الأبعاد ثابتة تماماً في كل الأوضاع، والتبديل مجرّد تلاشٍ للون/النص/الأيقونة بلا أي layout shift.
 */
export default function OfferModeNote({ mode, unlocked, onSwitchPremium, onOpenPremium }) {
  const { t } = useTranslation();

  const GOLD_BOX = {
    borderColor: "rgba(207,154,30,0.45)",
    background: "linear-gradient(90deg, rgba(240,198,60,0.12), rgba(240,198,60,0.04))",
  };
  const GOLD_ICON = { background: "linear-gradient(135deg,#ffe486,#cf9a1e)" };
  const GREEN_BOX = {
    borderColor: "rgba(166,240,0,0.4)",
    background: "linear-gradient(90deg, rgba(166,240,0,0.12), rgba(166,240,0,0.04))",
  };
  const GREEN_ICON = { background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" };

  const variants = [
    {
      key: "normal",
      active: mode === "normal",
      box: GREEN_BOX,
      icon: GREEN_ICON,
      Icon: Tag,
      text: t("home.normalInfo"),
      cta: null,
      onClick: onSwitchPremium,
    },
    {
      key: "premium-locked",
      active: mode === "premium" && !unlocked,
      box: GOLD_BOX,
      icon: GOLD_ICON,
      Icon: Crown,
      text: t("home.premiumBanner"),
      cta: t("home.openPremium"),
      onClick: onOpenPremium,
    },
    {
      key: "premium-unlocked",
      active: mode === "premium" && unlocked,
      box: GOLD_BOX,
      icon: GOLD_ICON,
      Icon: Crown,
      text: t("home.premiumUnlocked"),
      cta: null,
      onClick: onOpenPremium,
    },
  ];

  return (
    <div className="mb-6 grid">
      {variants.map((v) => (
        <button
          key={v.key}
          type="button"
          onClick={v.onClick}
          aria-hidden={!v.active}
          tabIndex={v.active ? 0 : -1}
          className={`col-start-1 row-start-1 flex w-full items-center justify-between gap-3 rounded-2xl border px-5 py-3.5 text-start transition-opacity duration-300 ${
            v.active ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          style={v.box}
        >
          <span className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[#0a0a0a]" style={v.icon}>
              <v.Icon size={18} />
            </span>
            <span className="text-[13.5px] font-bold text-[var(--text)]">{v.text}</span>
          </span>
          {v.cta && (
            <span className="hidden shrink-0 rounded-xl px-4 py-2 text-[13px] font-extrabold text-[#0a0a0a] sm:block" style={GOLD_ICON}>
              {v.cta}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
