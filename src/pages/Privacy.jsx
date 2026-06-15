import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Mail } from "lucide-react";

import { useLocale } from "../lib/locale.jsx";
import { SITE_URL } from "../lib/seo.js";

import Navbar from "../components/Navbar.jsx";
import Footer from "../components/Footer.jsx";
import Seo from "../components/Seo.jsx";

// ============================================================
//  صفحة /privacy — سياسة الخصوصية (عربي/إنجليزي/فرنسي)
//  رابط واحد بلا بادئة لغة؛ المحتوى يتبدّل حسب اللغة المختارة.
//  تعيد استخدام نفس Navbar/Footer وألوان الهوية.
// ============================================================
const CONTACT_EMAIL = "support@codpromo.com";

export default function Privacy() {
  const { t } = useTranslation();
  const { lang } = useLocale();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // تاريخ آخر تحديث — يُعرض بصيغة اللغة النشطة
  const updated = new Date("2026-06-15").toLocaleDateString(
    lang === "ar" ? "ar" : lang === "fr" ? "fr-FR" : "en-US",
    { year: "numeric", month: "long", day: "numeric" }
  );

  // الأقسام ذات قوائم نقطية (تُقرأ كمصفوفات من ملفات الترجمة)
  const sections = [
    { title: "privacy.s1Title", desc: "privacy.s1Desc", items: "privacy.s1Items" },
    { title: "privacy.s2Title", desc: "privacy.s2Desc" },
    { title: "privacy.s3Title", desc: "privacy.s3Desc", items: "privacy.s3Items" },
    { title: "privacy.s4Title", desc: "privacy.s4Desc" },
    { title: "privacy.s5Title", desc: "privacy.s5Desc" },
    { title: "privacy.s6Title", desc: "privacy.s6Desc", items: "privacy.s6Items" },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-ink)] text-[var(--text)]">
      <Seo
        lang={lang}
        title={`${t("privacy.title")} — CODpromo`}
        description={t("privacy.intro")}
        canonical={`${SITE_URL}/privacy`}
      />
      <Navbar />

      <main className="mx-auto max-w-3xl px-4 pb-16 pt-[96px] sm:pt-[104px]">
        <header className="mb-8">
          <h1 className="text-[28px] font-black tracking-tight sm:text-[34px]">
            {t("privacy.title")}
          </h1>
          <p className="mt-2 text-[13px] text-[var(--color-mute)]">
            {t("privacy.lastUpdated", { date: updated })}
          </p>
        </header>

        <p className="mb-10 text-[15px] leading-relaxed text-[var(--text-soft)]">
          {t("privacy.intro")}
        </p>

        <div className="flex flex-col gap-9">
          {sections.map(({ title, desc, items }) => {
            const list = items ? t(items, { returnObjects: true }) : null;
            return (
              <section key={title}>
                <h2 className="mb-3 text-[19px] font-black tracking-tight text-[var(--text)]">
                  <span className="me-2 text-[var(--accent-text)]">#</span>
                  {t(title)}
                </h2>
                <p className="text-[15px] leading-relaxed text-[var(--text-soft)]">
                  {t(desc)}
                </p>
                {Array.isArray(list) && (
                  <ul className="mt-3 flex flex-col gap-2">
                    {list.map((item, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2.5 text-[14.5px] leading-relaxed text-[var(--text-soft)]"
                      >
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-lime)]" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}

          {/* قسم التواصل — إيميل الدعم */}
          <section>
            <h2 className="mb-3 text-[19px] font-black tracking-tight text-[var(--text)]">
              <span className="me-2 text-[var(--accent-text)]">#</span>
              {t("privacy.s7Title")}
            </h2>
            <p className="text-[15px] leading-relaxed text-[var(--text-soft)]">
              {t("privacy.s7Desc")}
            </p>
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
