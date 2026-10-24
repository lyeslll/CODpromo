import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import SectionHead from "../landing/SectionHead.jsx";
import CompanyLogo from "../CompanyLogo.jsx";
import { storePath } from "../../lib/seo.js";

/** كل الشركات اللي عندها كود Premium، باللوغو الحقيقي (من القاعدة)، كل وحدة نحو صفحتها. */
export default function PartnerLogos({ companies, countText }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  if (!companies.length) return null;

  return (
    <section className="py-20 sm:py-24" aria-labelledby="pp-partners-title">
      <div className="mx-auto max-w-5xl px-4">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <SectionHead id="pp-partners-title" title={t("premiumPage.partners.title")} sub={t("premiumPage.partners.sub")} />
          {countText && (
            <p className="shrink-0 text-[38px] font-black leading-none text-[#ffe486] sm:text-[48px]">
              <bdi>{countText}</bdi>
            </p>
          )}
        </div>

        <ul className="mt-10 grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
          {companies.map((c) => (
            <li key={c.id}>
              <Link
                to={storePath(c.slug, lang)}
                className="flex h-full flex-col items-center gap-2.5 rounded-2xl border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] px-2 py-4 text-center transition-colors hover:border-[#f0c63c]/45"
              >
                <CompanyLogo logo={c.logo} bg={c.logo_bg} name={c.name} size={52} accent="#f0c63c" />
                <span dir="auto" className="line-clamp-2 w-full break-words text-center text-[12.5px] font-bold leading-snug text-[var(--text-softer)]">{c.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
