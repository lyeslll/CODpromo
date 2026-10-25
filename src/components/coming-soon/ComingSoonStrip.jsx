import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Hourglass } from "lucide-react";
import { useTranslation } from "react-i18next";
import CompanyLogo from "../CompanyLogo.jsx";
import { fetchComingSoon } from "../../lib/comingSoon.js";
import { offersLink } from "../../lib/seo.js";
import { formatNumber } from "../../lib/values.js";
import { SOON, SOON_BG, SOON_INK } from "./tone.js";

const MAX_LOGOS = 5;

/**
 * سطر صغير في الرئيسية: "قريباً على CODpromo" + لوغوهات البطاقات القريبة + العدد الحقيقي ← /offers?soon=1.
 * بلا بطاقات قريبة = ما يبانش. العدد يتحسب وحدو (ماشي مع العروض اللي تخدم).
 */
export default function ComingSoonStrip() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [list, setList] = useState(null);

  useEffect(() => {
    let active = true;
    fetchComingSoon()
      .then((d) => active && setList(Array.isArray(d) ? d : []))
      .catch(() => active && setList([]));
    return () => {
      active = false;
    };
  }, []);

  if (!list?.length) return null;
  const n = list.length;
  const shown = list.slice(0, MAX_LOGOS);

  return (
    <section aria-labelledby="soon-strip-title" className="mx-auto max-w-6xl px-4 pb-6">
      <div
        className="relative flex flex-col gap-4 overflow-hidden rounded-[var(--radius-card)] border p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5"
        style={{ borderColor: `${SOON}3d`, background: `linear-gradient(120deg, ${SOON}14, transparent 55%), var(--color-ink-card)` }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3.5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl" style={{ background: `${SOON}1f`, color: SOON }}>
            <Hourglass size={20} />
          </span>
          <div className="min-w-0">
            <h2 id="soon-strip-title" className="text-[16px] font-black leading-tight text-[var(--text)] sm:text-[17px]">
              {t("comingSoon.homeTitle")}
            </h2>
            <p className="mt-0.5 text-[12.5px] leading-snug text-[var(--text-soft)] sm:text-[13px]">
              {t("comingSoon.homeSub", { offers: t("comingSoon.offers", { count: n, n: formatNumber(n, lang) }) })}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 sm:justify-end">
          <ul className="flex items-center ps-2" aria-label={t("comingSoon.homeLogos")}>
            {shown.map((c) => (
              <li key={c.id} className="-ms-2 rounded-[14px] ring-2 ring-[var(--color-ink-card)]" title={c.name}>
                <CompanyLogo logo={c.logo} bg={c.logo_bg} name={c.name} size={36} accent={SOON} className="!rounded-[12px]" />
              </li>
            ))}
            {n > MAX_LOGOS && (
              <li className="-ms-2 grid h-9 min-w-9 place-items-center rounded-[12px] px-1.5 text-[11.5px] font-black ring-2 ring-[var(--color-ink-card)]" style={{ background: `${SOON}26`, color: SOON }}>
                +{formatNumber(n - MAX_LOGOS, lang)}
              </li>
            )}
          </ul>
          <Link
            to={offersLink(lang, { soon: "1" })}
            className="group inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl px-4 text-[13.5px] font-extrabold transition-transform hover:scale-[1.02]"
            style={{ background: SOON_BG, color: SOON_INK }}
          >
            {t("comingSoon.homeCta")}
            <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-0.5 ltr:rotate-180 ltr:group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
