import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Mail } from "lucide-react";

import { useLocale } from "../lib/locale.jsx";
import { SITE_URL } from "../lib/seo.js";

import Navbar from "../components/Navbar.jsx";
import Footer from "../components/Footer.jsx";
import Seo from "../components/Seo.jsx";

// ============================================================
//  صفحة /account-deletion — حذف الحساب (عربي/إنجليزي/فرنسي)
//  عمومية بلا تسجيل دخول؛ رابط واحد بلا بادئة لغة؛ تطلبها Google Play.
//  تعيد استخدام نفس Navbar/Footer وألوان الهوية.
// ============================================================
const CONTACT_EMAIL = "support@codpromo.com";

export default function AccountDeletion() {
  const { t } = useTranslation();
  const { lang } = useLocale();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // الفقرات النصّية بعد إيميل التواصل
  const paragraphs = ["accountDeletion.p1", "accountDeletion.p2", "accountDeletion.p3", "accountDeletion.p4"];

  return (
    <div className="min-h-screen bg-[var(--color-ink)] text-[var(--text)]">
      <Seo
        lang={lang}
        title={`${t("accountDeletion.title")} — CODpromo`}
        description={t("accountDeletion.intro")}
        canonical={`${SITE_URL}/account-deletion`}
      />
      <Navbar />

      <main className="mx-auto max-w-3xl px-4 pb-16 pt-[96px] sm:pt-[104px]">
        <header className="mb-8">
          <h1 className="text-[28px] font-black tracking-tight sm:text-[34px]">
            {t("accountDeletion.title")}
          </h1>
        </header>

        <p className="text-[15px] leading-relaxed text-[var(--text-soft)]">
          {t("accountDeletion.intro")}
        </p>

        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="mt-4 inline-flex items-center gap-2.5 rounded-xl border border-[var(--color-lime)]/30 bg-[var(--color-lime)]/[0.06] px-4 py-3 text-[15px] font-extrabold text-[var(--accent-text)] transition-colors hover:border-[var(--color-lime)]/50"
        >
          <Mail size={18} />
          {CONTACT_EMAIL}
        </a>

        <div className="mt-8 flex flex-col gap-5">
          {paragraphs.map((key) => (
            <p key={key} className="text-[15px] leading-relaxed text-[var(--text-soft)]">
              {t(key)}
            </p>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
