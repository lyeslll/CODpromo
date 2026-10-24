import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Mail } from "lucide-react";

import { useLocale } from "../lib/locale.jsx";
import { SITE_URL } from "../lib/seo.js";
import { formatPrice, usePricing } from "../lib/pricing.jsx";
import { formatNumber } from "../lib/values.js";

import Navbar from "../components/Navbar.jsx";
import Footer from "../components/Footer.jsx";
import Seo from "../components/Seo.jsx";

// ============================================================
//  صفحة /terms — الشروط وسياسة الاسترداد (عربي/إنجليزي/فرنسي)
//  رابط واحد بلا بادئة لغة (كيما /privacy)؛ المحتوى يتبدّل حسب اللغة المختارة.
//  "مدى الحياة" = كل الأكواد الحالية والجديدة ما دامت المنصّة تعمل، بلا ضمان لكود ولا شركة معيّنة.
//  الاسترداد: خلال 7 أيام من الشراء إذا ما كشفش حتى كود Premium. السعر من pricing_settings.
// ============================================================
const CONTACT_EMAIL = "support@codpromo.com";

export default function Terms() {
  const { t } = useTranslation();
  const { lang } = useLocale();
  const pricing = usePricing();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const updated = new Date("2026-10-24").toLocaleDateString(lang === "ar" ? "ar" : lang === "fr" ? "fr-FR" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // السعر: من القاعدة (بلا أرقام في الكود). قبل ما يوصل → النص العام بلا أرقام.
  const priceDesc = pricing
    ? t(pricing.isLaunch ? "terms.s3DescLaunch" : "terms.s3DescRegular", {
        launch: formatPrice(t, lang, pricing.launchDzd, pricing.launchUsd),
        regular: formatPrice(t, lang, pricing.regularDzd, pricing.regularUsd),
        seats: formatNumber(pricing.seatsTotal, lang),
      })
    : t("terms.s3Desc");

  const sections = [
    { title: "terms.s1Title", desc: t("terms.s1Desc") },
    { title: "terms.s2Title", desc: t("terms.s2Desc") },
    { title: "terms.s3Title", desc: priceDesc },
    { title: "terms.s4Title", desc: t("terms.s4Desc"), items: "terms.s4Items" },
    { title: "terms.s5Title", desc: t("terms.s5Desc") },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-ink)] text-[var(--text)]">
      <Seo lang={lang} title={`${t("terms.title")} — CODpromo`} description={t("terms.intro")} canonical={`${SITE_URL}/terms`} />
      <Navbar />

      <main className="mx-auto max-w-3xl px-4 pb-16 pt-[96px] sm:pt-[104px]">
        <header className="mb-8">
          <h1 className="text-[28px] font-black tracking-tight sm:text-[34px]">{t("terms.title")}</h1>
          <p className="mt-2 text-[13px] text-[var(--color-mute)]">{t("privacy.lastUpdated", { date: updated })}</p>
        </header>

        <p className="mb-10 text-[15px] leading-relaxed text-[var(--text-soft)]">{t("terms.intro")}</p>

        <div className="flex flex-col gap-9">
          {sections.map(({ title, desc, items }) => {
            const list = items ? t(items, { returnObjects: true, email: CONTACT_EMAIL }) : null;
            return (
              <section key={title} id={title === "terms.s4Title" ? "refund" : undefined} className="scroll-mt-28">
                <h2 className="mb-3 text-[19px] font-black tracking-tight text-[var(--text)]">
                  <span className="me-2 text-[#f0c63c]">#</span>
                  {t(title)}
                </h2>
                <p className="text-[15px] leading-relaxed text-[var(--text-soft)]">{desc}</p>
                {Array.isArray(list) && (
                  <ul className="mt-3 flex flex-col gap-2">
                    {list.map((item, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-[14.5px] leading-relaxed text-[var(--text-soft)]">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#f0c63c]" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}

          <section>
            <h2 className="mb-3 text-[19px] font-black tracking-tight text-[var(--text)]">
              <span className="me-2 text-[#f0c63c]">#</span>
              {t("privacy.s7Title")}
            </h2>
            <p className="text-[15px] leading-relaxed text-[var(--text-soft)]">{t("terms.contactDesc")}</p>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="mt-4 inline-flex items-center gap-2.5 rounded-xl border border-[var(--color-lime)]/30 bg-[var(--color-lime)]/[0.06] px-4 py-3 text-[15px] font-extrabold text-[var(--accent-text)] transition-colors hover:border-[var(--color-lime)]/50"
            >
              <Mail size={18} />
              {CONTACT_EMAIL}
            </a>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
