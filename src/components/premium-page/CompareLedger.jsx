import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Crown, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import SectionHead from "../landing/SectionHead.jsx";
import CompanyLogo from "../CompanyLogo.jsx";
import { getTypeMeta, getTypeKey } from "../../lib/types.js";
import { hasPremiumOffer } from "../../lib/premiumOffer.js";
import { parseVal } from "../../lib/values.js";
import { loc, storePath } from "../../lib/seo.js";

const GOLD_SOFT = "#ffe486";
const FIRST = 6;

/** كم مرة الكود الأقوى أكبر (نفس الوحدة: 15% → 20% = 1.33). بلا رقم مقارن → 1. */
function gainOf(free, premium) {
  const a = parseVal(free);
  const b = parseVal(premium);
  if (!a || !b || a.num <= 0) return 1;
  if (a.suffix.trim() !== b.suffix.trim() || a.prefix.trim() !== b.prefix.trim()) return 1;
  return b.num / a.num;
}

/** الشركات اللي عندها عرض Premium وقيمة Premium مكتوبة، الأكبر فرقاً أولاً (الترتيب يتبدّل غير بالفرق). */
export function premiumRows(companies, lang) {
  return companies
    .filter((c) => hasPremiumOffer(c) && loc(c, "premium_discount", lang))
    .map((c) => ({ c, free: loc(c, "discount", lang), premium: loc(c, "premium_discount", lang), gain: gainOf(c.discount, c.premium_discount) }))
    .sort((x, y) => y.gain - x.gain || new Date(y.c.created_at) - new Date(x.c.created_at));
}

/** عادي مقابل Premium بعروض حقيقية من القاعدة: نفس الشركة، كودين. */
export default function CompareLedger({ companies, loading }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [all, setAll] = useState(false);
  const rows = useMemo(() => premiumRows(companies, lang), [companies, lang]);
  const frozen = useMemo(() => companies.filter((c) => !hasPremiumOffer(c)).length, [companies]);
  const shown = all ? rows : rows.slice(0, FIRST);

  return (
    <section id="compare" className="scroll-mt-28 py-20 sm:py-24" aria-labelledby="pp-compare-title">
      <div className="mx-auto max-w-5xl px-4">
        <SectionHead id="pp-compare-title" title={t("premiumPage.compare.title")} sub={t("premiumPage.compare.sub")} />

        <div className="mt-10 overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)]">
          {/* رؤوس الأعمدة (الكمبيوتر) */}
          <div className="hidden grid-cols-[1fr_150px_170px] items-center gap-4 border-b border-[var(--color-ink-line)] px-6 py-3 text-[12.5px] font-extrabold text-[var(--color-mute)] sm:grid">
            <span>{t("premiumPage.compare.colCompany")}</span>
            <span>{t("premiumPage.compare.colFree")}</span>
            <span className="flex items-center gap-1.5" style={{ color: GOLD_SOFT }}>
              <Crown size={13} /> {t("premiumPage.compare.colPremium")}
            </span>
          </div>

          {loading && !rows.length ? (
            <ul aria-hidden>
              {Array.from({ length: 4 }, (_, i) => (
                <li key={i} className="flex items-center gap-3 border-b border-dashed border-[var(--color-ink-line)] px-4 py-4 last:border-b-0 sm:px-6">
                  <span className="h-11 w-11 animate-pulse rounded-xl bg-[var(--fill-strong)]" />
                  <span className="h-4 w-1/3 animate-pulse rounded bg-[var(--fill-strong)]" />
                </li>
              ))}
            </ul>
          ) : (
            <ul>
              {shown.map(({ c, free, premium }) => {
                const meta = getTypeMeta(c.type);
                return (
                  <li key={c.id} className="border-b border-dashed border-[var(--color-ink-line)] last:border-b-0">
                    <Link
                      to={storePath(c.slug, lang)}
                      className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-4 transition-colors hover:bg-[var(--fill)] sm:grid-cols-[1fr_150px_170px] sm:px-6"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <CompanyLogo logo={c.logo} bg={c.logo_bg} name={c.name} size={44} accent={meta.color} />
                        <span className="min-w-0">
                          <span className="block truncate text-[15px] font-extrabold text-[var(--text)]">{c.name}</span>
                          <span className="mt-0.5 inline-flex items-center gap-1.5 text-[12px] font-bold" style={{ color: meta.color }}>
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
                            {t(`types.${getTypeKey(c.type)}`)}
                          </span>
                        </span>
                      </span>

                      {/* الهاتف: القيمتان فوق بعض في الجهة الأخرى */}
                      <span className="flex flex-col items-end gap-0.5 sm:contents">
                        <span className="flex items-baseline gap-1.5 sm:block">
                          <span className="text-[11px] font-bold text-[var(--color-mute)] sm:hidden">{t("premiumPage.compare.colFree")}</span>
                          <bdi className="text-[15px] font-extrabold sm:text-[17px]" style={{ color: meta.color }}>
                            {free}
                          </bdi>
                        </span>
                        <span className="flex items-baseline gap-1.5 sm:block">
                          <span className="text-[11px] font-bold sm:hidden" style={{ color: GOLD_SOFT }}>
                            {t("premiumPage.compare.colPremium")}
                          </span>
                          <bdi className="text-[19px] font-black sm:text-[22px]" style={{ color: GOLD_SOFT }}>
                            {premium}
                          </bdi>
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          {rows.length > FIRST && (
            <button
              type="button"
              onClick={() => setAll((v) => !v)}
              aria-expanded={all}
              className="flex w-full items-center justify-center gap-2 border-t border-[var(--color-ink-line)] px-4 py-3.5 text-[14px] font-extrabold text-[var(--text-softer)] transition-colors hover:bg-[var(--fill)] hover:text-[var(--text)]"
            >
              {all ? t("premiumPage.compare.less") : t("premiumPage.compare.more", { n: rows.length })}
              <ChevronDown size={16} className={`transition-transform ${all ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>

        {frozen > 0 && (
          <p className="mt-4 flex items-start gap-2 text-[13px] leading-relaxed text-[var(--color-mute)]">
            <Lock size={14} className="mt-[3px] shrink-0" />
            {t("premiumPage.compare.frozen", { count: frozen, n: frozen })}
          </p>
        )}
      </div>
    </section>
  );
}
