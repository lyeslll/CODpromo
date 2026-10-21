import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import CompanyCard from "../CompanyCard.jsx";
import SectionHead from "./SectionHead.jsx";
import { offersPath } from "../../lib/seo.js";
import { TYPE_PARAMS, topOfType } from "../../lib/offerFilters.js";

/**
 * 5.11 — عيّنة من العروض المجانية: الأنجح من كل نوع (تخفيض، كوبون، كاش باك)
 * تُختار تلقائياً حسب التصويت، ببطاقات حقيقية كاملة الوظائف.
 * exclude: معرّفات لا تُعاد هنا (العروض المميّزة الظاهرة أعلى الصفحة).
 */
export default function SampleOffers({ companies, voteStats, favorites, onToggleFav, onCopy, unlocked, onUnlock, exclude }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const picks = useMemo(() => {
    const pool = exclude?.size ? companies.filter((c) => !exclude.has(c.id)) : companies;
    return Object.values(TYPE_PARAMS).map((db) => topOfType(pool, db, voteStats)).filter(Boolean);
  }, [companies, voteStats, exclude]);
  if (!picks.length) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 py-24 sm:py-28">
      <SectionHead title={t("samples.title")} sub={t("samples.sub")} />
      <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {picks.map((c, i) => (
          <CompanyCard
            key={c.id}
            company={c}
            index={i}
            isFavorite={favorites.includes(c.id)}
            onToggleFav={onToggleFav}
            onCopy={onCopy}
            premium={false}
            unlocked={unlocked}
            onUnlock={onUnlock}
          />
        ))}
      </div>
      <div className="mt-10 flex justify-center">
        <Link
          to={offersPath(lang)}
          className="group inline-flex items-center gap-2 rounded-2xl px-6 py-3.5 text-[15px] font-extrabold text-[#0a0a0a] transition-transform hover:scale-[1.02]"
          style={{ background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" }}
        >
          {t("samples.cta", { count: companies.length })}
          <ArrowLeft size={17} className="transition-transform group-hover:-translate-x-0.5 ltr:rotate-180 ltr:group-hover:translate-x-0.5" />
        </Link>
      </div>
    </section>
  );
}
