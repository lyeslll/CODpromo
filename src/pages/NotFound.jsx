import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Search } from "lucide-react";
import Navbar from "../components/Navbar.jsx";
import Footer from "../components/Footer.jsx";
import Seo from "../components/Seo.jsx";
import { homePath, offersPath, categoriesPath } from "../lib/seo.js";

// ============================================================
//  404 — رابط ما يوجدش. قبل: أي رابط غالط كان يعرض الرئيسية بلا ما يفهم الزائر (و soft-404 لـ Google).
//  كوبون "منتهي الصلاحية" بنفس شكل تذاكر الموقع + الطريق للعروض. noindex.
// ============================================================
export default function NotFound() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  return (
    <div className="min-h-screen bg-[var(--color-ink)] text-[var(--text)]">
      <Seo lang={lang} title={`${t("notFound.title")} | CODpromo`} description={t("notFound.desc")} noindex />
      <Navbar />
      <main className="mx-auto grid min-h-[78vh] max-w-xl place-items-center px-4 pb-16 pt-[110px]">
        <div className="w-full">
          <div className="ticket relative" style={{ "--edge-base": "#71717a55", "--perf": "#71717a88" }}>
            <div className="ticket-top relative bg-[var(--color-ink-card)] px-6 pb-6 pt-7 text-center">
              <span aria-hidden className="ticket-ring ticket-ring-l" />
              <span aria-hidden className="ticket-ring ticket-ring-r" />
              <p className="text-[13px] font-bold text-[var(--color-mute)]">{t("notFound.kicker")}</p>
              <p dir="ltr" className="mt-2 text-[76px] font-black leading-none tracking-[-0.04em] text-[#71717a] line-through decoration-[#a6f000]/70 decoration-[6px] [font-family:Inter,sans-serif]">
                404
              </p>
            </div>
            <div className="ticket-stub relative bg-[var(--color-ink-card)] px-6 pb-7 pt-6 text-center">
              <span aria-hidden className="ticket-ring ticket-ring-l" />
              <span aria-hidden className="ticket-ring ticket-ring-r" />
              <span aria-hidden className="ticket-perf" />
              <h1 className="text-[22px] font-black leading-snug">{t("notFound.title")}</h1>
              <p className="mx-auto mt-2 max-w-[38ch] text-[14.5px] leading-relaxed text-[var(--text-soft)]">{t("notFound.desc")}</p>
              <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
                <Link
                  to={offersPath(lang)}
                  className="flex min-h-[50px] items-center justify-center gap-2 rounded-xl px-5 text-[15px] font-extrabold text-[#0a0a0a]"
                  style={{ background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" }}
                >
                  <Search size={17} /> {t("notFound.offers")}
                </Link>
                <Link to={homePath(lang)} className="flex min-h-[50px] items-center justify-center gap-2 rounded-xl border border-[var(--color-ink-line)] px-5 text-[14.5px] font-bold text-[var(--text)] hover:bg-[var(--fill)]">
                  {t("notFound.home")} <ArrowLeft size={16} className="ltr:rotate-180" />
                </Link>
              </div>
              <Link to={categoriesPath(lang)} className="mt-4 inline-flex min-h-[44px] items-center text-[13.5px] font-bold text-[var(--accent-text)] hover:underline">
                {t("notFound.categories")}
              </Link>
            </div>
          </div>
        </div>
      </main>
      <Footer showCta={false} />
    </div>
  );
}
