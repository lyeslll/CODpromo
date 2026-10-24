import { Link } from "react-router-dom";
import { ChevronDown, Check, ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import BidiText from "../BidiText.jsx";
import CompanyLogo from "../CompanyLogo.jsx";
import { getTypeMeta } from "../../lib/types.js";
import { locText, textLines, RATING_MIN_AVG } from "../../lib/storeContent.js";
import { storePath } from "../../lib/seo.js";

/** عنوان قسم موحّد (بلا وسوم فوقه — العنوان وحدو يكفي). */
export function SectionTitle({ id, children, aside }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <h2 id={id} className="text-[21px] font-black leading-tight tracking-tight sm:text-[24px]">
        {children}
      </h2>
      {aside}
    </div>
  );
}

/* ===================== كيف تستعمل الكود (تسلسل حقيقي → أرقام) ===================== */
export function StoreSteps({ company, steps, custom, lang }) {
  const { t } = useTranslation();
  const rtl = lang === "ar";
  return (
    <section aria-labelledby="store-steps-title" className="mt-14">
      <SectionTitle id="store-steps-title">{t("storePage.stepsTitle", { name: company.name })}</SectionTitle>
      <ol className={`store-steps grid gap-3 md:gap-4 ${steps.length === 3 ? "md:grid-cols-3" : steps.length === 2 ? "md:grid-cols-2" : steps.length >= 4 ? "md:grid-cols-2 lg:grid-cols-4" : ""}`}>
        {steps.map((s, i) => (
          <li key={i} className="store-step flex gap-3.5 md:flex-col md:gap-3">
            <span aria-hidden className="store-step-num grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[16px] font-black text-[#0a0a0a]">
              {i + 1}
            </span>
            <div className="min-w-0 pb-2 pt-1 md:pt-0">
              {s.title && <h3 className="text-[15.5px] font-extrabold leading-snug text-[var(--text)]"><BidiText text={s.title} rtl={rtl} /></h3>}
              <p className={`${s.title ? "mt-1" : ""} text-[14px] leading-[1.7] text-[var(--text-soft)]`}>
                <BidiText text={s.desc} rtl={rtl} />
              </p>
            </div>
          </li>
        ))}
      </ol>
      {custom && <p className="mt-2 text-[12px] font-semibold text-[var(--color-mute)]">{t("storePage.steps.customNote", { name: company.name })}</p>}
    </section>
  );
}

/* ===================== عن الشركة (من الأدمن برك — بلا محتوى = ما يبانش) ===================== */
export function StoreAbout({ company, lang }) {
  const { t } = useTranslation();
  const rtl = lang === "ar";
  const about = locText(company, "about", lang);
  const features = textLines(locText(company, "features", lang));
  if (!about && features.length === 0) return null;
  return (
    <section aria-labelledby="store-about-title" className="mt-14 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-10">
      {about && (
        <div>
          <SectionTitle id="store-about-title">{t("storePage.aboutTitle", { name: company.name })}</SectionTitle>
          {textLines(about).map((p, i) => (
            <p key={i} className="mt-3 max-w-[66ch] text-[15px] leading-[1.85] text-[var(--text-soft)] first:mt-0">
              <BidiText text={p} rtl={rtl} />
            </p>
          ))}
        </div>
      )}
      {features.length > 0 && (
        <div>
          <h3 className={`${about ? "" : "sr-only"} mb-3 text-[16px] font-extrabold text-[var(--text)]`}>
            {t("storePage.featuresTitle", { name: company.name })}
          </h3>
          {!about && <SectionTitle id="store-about-title">{t("storePage.featuresTitle", { name: company.name })}</SectionTitle>}
          <ul className="grid gap-2">
            {features.map((f, i) => (
              <li key={i} className="flex gap-2.5 rounded-xl border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] px-3.5 py-3 text-[14px] leading-[1.6] text-[var(--text-softer)]">
                <Check size={16} className="mt-0.5 shrink-0" style={{ color: "var(--sa)" }} />
                <span>
                  <BidiText text={f} rtl={rtl} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/* ===================== الأسئلة (details: كل الأجوبة في الصفحة) ===================== */
export function StoreFaq({ company, items, lang }) {
  const { t } = useTranslation();
  const rtl = lang === "ar";
  if (!items.length) return null;
  return (
    <section aria-labelledby="store-faq-title" className="mt-14">
      <SectionTitle id="store-faq-title">{t("storePage.faq.title", { name: company.name })}</SectionTitle>
      <div className="grid gap-2.5">
        {items.map((f, i) => (
          <details key={i} className="store-faq group overflow-hidden rounded-2xl border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] open:border-[var(--sa-line)]" open={i === 0}>
            <summary className="flex min-h-[56px] items-center justify-between gap-3 px-4 py-3.5 text-start sm:px-5">
              <span className="text-[15px] font-bold leading-snug text-[var(--text)]">
                <BidiText text={f.q} rtl={rtl} />
              </span>
              <ChevronDown size={18} className="faq-chevron shrink-0 text-[var(--color-mute)] transition-transform" />
            </summary>
            <p className="px-4 pb-4 text-[14px] leading-[1.8] text-[var(--text-soft)] sm:px-5">
              <BidiText text={f.a} rtl={rtl} />
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

/* ===================== شركات مشابهة: شريط سحب (هاتف) / شبكة بلا فراغات ===================== */
export function SimilarStores({ items, lang, ratings, catLabel, catTo }) {
  const { t } = useTranslation();
  if (!items.length) return null;
  // الشبكة: مضاعف 4 في الحاسوب و 2 في اللوحي — ما يبقاش فراغ في آخر سطر
  const grid = items.length >= 8 ? items.slice(0, 8) : items.length >= 4 ? items.slice(0, 4) : items;
  return (
    <section aria-labelledby="store-similar-title" className="mt-14">
      <SectionTitle
        id="store-similar-title"
        aside={
          catLabel && catTo ? (
            <Link to={catTo} className="hidden min-h-[44px] shrink-0 items-center gap-1 text-[13.5px] font-bold text-[var(--accent-text)] hover:underline sm:inline-flex">
              {t("storePage.similarAll", { category: catLabel })}
              <ArrowLeft size={15} className="ltr:rotate-180" />
            </Link>
          ) : null
        }
      >
        {t("storePage.similarTitle")}
      </SectionTitle>
      {/* الهاتف: سحب أفقي */}
      <div className="similar-row -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:hidden">
        {items.map((c) => (
          <SimilarCard key={c.id} company={c} lang={lang} rating={ratings?.[c.id]} className="w-[44%] shrink-0" />
        ))}
      </div>
      {catLabel && catTo && (
        <Link to={catTo} className="mt-2 inline-flex min-h-[44px] items-center gap-1 text-[13.5px] font-bold text-[var(--accent-text)] sm:hidden">
          {t("storePage.similarAll", { category: catLabel })}
          <ArrowLeft size={15} className="ltr:rotate-180" />
        </Link>
      )}
      {/* اللوحي والحاسوب: شبكة كاملة */}
      <div className={`hidden gap-3 sm:grid ${grid.length >= 4 ? "sm:grid-cols-2 lg:grid-cols-4" : grid.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {grid.map((c) => (
          <SimilarCard key={c.id} company={c} lang={lang} rating={ratings?.[c.id]} />
        ))}
      </div>
    </section>
  );
}

function SimilarCard({ company, lang, rating, className = "" }) {
  const meta = getTypeMeta(company.type);
  const value = locText(company, "discount", lang);
  const showRating = rating && rating.count >= RATING_MIN_AVG;
  return (
    <Link
      to={storePath(company.slug, lang)}
      className={`group flex min-h-[148px] flex-col items-center justify-center gap-2 rounded-2xl border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] p-4 text-center transition-colors hover:border-[var(--color-lime)]/40 ${className}`}
    >
      <CompanyLogo logo={company.logo} bg={company.logo_bg} name={company.name} size={52} accent={meta.color} />
      <span className="line-clamp-1 text-[14px] font-extrabold text-[var(--text)]">
        <bdi>{company.name}</bdi>
      </span>
      {value && (
        <span className="text-[14px] font-black [font-family:Inter,sans-serif]" style={{ color: meta.color }}>
          <bdi>{value}</bdi>
        </span>
      )}
      {showRating && (
        <span className="text-[11.5px] font-bold text-[var(--color-mute)]">
          <span className="text-[#fbbf24]">★</span> <span className="[font-family:Inter,sans-serif]">{rating.avg}</span>
        </span>
      )}
    </Link>
  );
}
