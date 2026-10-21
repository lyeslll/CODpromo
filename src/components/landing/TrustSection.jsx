import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck, ThumbsUp, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import SectionHead from "./SectionHead.jsx";
import { offersLink, storePath } from "../../lib/seo.js";
import { companySlug } from "../../lib/slug.js";
import { isImageUrl } from "../CompanyLogo.jsx";
import { formatNumber } from "../../lib/values.js";

/**
 * 5.10 — الثقة: مراجعة يدوية، تصويت التجّار (العدد الحقيقي من قاعدة البيانات)،
 * تحديث مستمر، وشريط شعارات الشركاء يتحرك (من جدول الشركات، كل شعار يفتح صفحته).
 */
export default function TrustSection({ companies, voteStats }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const totalVotes = useMemo(
    () => Object.values(voteStats || {}).reduce((sum, s) => sum + (Number(s?.total_count) || 0), 0),
    [voteStats]
  );
  const logos = useMemo(() => (companies || []).filter((c) => isImageUrl(c.logo)), [companies]);

  const points = [
    { key: "review", icon: ShieldCheck },
    { key: "votes", icon: ThumbsUp, extra: totalVotes > 0 ? t("trust.votesCount", { count: totalVotes, formatted: formatNumber(totalVotes, lang) }) : null },
    { key: "fresh", icon: RefreshCw },
  ];

  return (
    <section className="py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-4">
        <SectionHead title={t("trust.title")} sub={t("trust.sub")} />
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {points.map((p) => (
            <div key={p.key} className="border-t border-[var(--color-ink-line)] pt-6">
              <p.icon size={22} className="text-[var(--accent-text)]" />
              <h3 className="mt-4 text-[19px] font-black text-[var(--text)]">{t(`trust.${p.key}.title`)}</h3>
              <p className="mt-2 text-[15px] leading-[1.7] text-[var(--text-soft)]">{t(`trust.${p.key}.desc`)}</p>
              {p.extra && <p className="mt-3 text-[14px] font-extrabold text-[var(--accent-text)]">{p.extra}</p>}
            </div>
          ))}
        </div>
      </div>

      {logos.length > 0 && (
        <div className="mt-16">
          <p className="mx-auto max-w-6xl px-4 text-[14px] font-bold text-[var(--color-mute)]">{t("trust.partners")}</p>
          <div className="marquee-wrap marquee-pause no-scrollbar relative mt-5 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
            <div className="marquee-track flex w-max gap-4 px-4" style={{ "--marquee-duration": `${Math.max(logos.length * 2.6, 30)}s` }}>
              {[...logos, ...logos].map((c, i) => (
                <Link
                  key={`${c.id}-${i}`}
                  to={storePath(companySlug(c), lang)}
                  aria-hidden={i >= logos.length}
                  tabIndex={i >= logos.length ? -1 : 0}
                  title={c.name}
                  className="flex h-16 shrink-0 items-center gap-3 rounded-2xl border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] pe-5 ps-2 transition-colors hover:border-[var(--color-lime)]/40"
                >
                  <img src={c.logo} alt="" loading="lazy" className="h-12 w-12 rounded-xl object-cover" />
                  <span className="whitespace-nowrap text-[14px] font-extrabold text-[var(--text-softer)]">{c.name}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto mt-12 flex max-w-6xl justify-center px-4">
        <Link
          to={offersLink(lang, { sort: "success" })}
          className="group inline-flex items-center gap-2 rounded-2xl border border-[var(--color-lime)]/45 px-6 py-3 text-[15px] font-extrabold text-[var(--accent-text)] transition-colors hover:bg-[var(--color-lime)]/10"
        >
          {t("trust.cta")}
          <ArrowLeft size={17} className="transition-transform group-hover:-translate-x-0.5 ltr:rotate-180 ltr:group-hover:translate-x-0.5" />
        </Link>
      </div>
    </section>
  );
}
