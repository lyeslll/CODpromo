import { useTranslation } from "react-i18next";
import { formatNumber } from "../../lib/values.js";
import { formatPrice } from "../../lib/pricing.jsx";

// ============================================================
//  سعر الدفعة الوحدة: وقت الإطلاق السعر العادي مشطوب فوق، وسعر الإطلاق تحتو بالكبير.
//  بعد مقاعد الإطلاق: السعر العادي برك، بلا شطب. الكتابة "9,900 دج (39$)" (pricing.*).
//  tone="ink" للخلفيات الذهبية (FooterCta)، وإلا ذهبي على الأسود.
// ============================================================
const SIZES = {
  xl: { main: "text-[40px] sm:text-[46px]", usd: "text-[17px]", was: "text-[14px]" },
  lg: { main: "text-[34px]", usd: "text-[15px]", was: "text-[13.5px]" },
  md: { main: "text-[26px]", usd: "text-[13.5px]", was: "text-[12.5px]" },
};

export default function LifetimePrice({ pricing, size = "lg", tone = "gold", className = "" }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  if (!pricing || pricing.dzd == null || pricing.usd == null) return null;
  const s = SIZES[size] || SIZES.lg;
  const ink = tone === "ink";
  const mainColor = ink ? "#1d1403" : "#ffe486";
  const softColor = ink ? "rgba(29,20,3,0.62)" : "var(--color-mute)";

  return (
    <div className={className}>
      {pricing.isLaunch && pricing.regularDzd != null && (
        <p className={`${s.was} font-bold`} style={{ color: softColor }}>
          <span className="sr-only">{t("pricing.regularWas")}: </span>
          <s className="decoration-[1.5px]">
            <bdi>{formatPrice(t, lang, pricing.regularDzd, pricing.regularUsd)}</bdi>
          </s>
        </p>
      )}
      <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 leading-none">
        {pricing.isLaunch && <span className="sr-only">{t("pricing.launchBadge")}: </span>}
        <bdi className={`${s.main} font-black tracking-tight [font-family:Inter,Tajawal,sans-serif]`} style={{ color: mainColor }}>
          {t("pricing.dzd", { dzd: formatNumber(pricing.dzd, lang) })}
        </bdi>
        <bdi className={`${s.usd} font-extrabold [font-family:Inter,Tajawal,sans-serif]`} style={{ color: ink ? "rgba(29,20,3,0.8)" : "var(--text-softer)" }}>
          {t("pricing.usd", { usd: formatNumber(pricing.usd, lang) })}
        </bdi>
      </p>
    </div>
  );
}
