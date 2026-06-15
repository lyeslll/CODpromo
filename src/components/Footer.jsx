import { Mail, Crown, ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import Logo from "./Logo.jsx";

/* أيقونات العلامات الحقيقية (Instagram/Facebook) — مكتبة lucide الحالية حذفت أيقونات
   العلامات، فنستعمل مسارات SVG الرسمية (currentColor) كي ترث ألوان الهوية. */
function InstagramIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

function FacebookIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z" />
    </svg>
  );
}

const SOCIALS = [
  { Icon: InstagramIcon, href: "https://www.instagram.com/codpromo.app", label: "Instagram" },
  { Icon: FacebookIcon, href: "https://www.facebook.com/profile.php?id=61590289486342", label: "Facebook" },
  { Icon: Mail, href: "mailto:contact@codpromo.com", label: "Email" },
];

export default function Footer({ onPremium }) {
  const { t } = useTranslation();
  const year = new Date().getFullYear();
  return (
    <footer className="relative mt-10 overflow-hidden border-t border-[var(--color-ink-line)]">
      <div
        className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[700px] -translate-x-1/2 rounded-full blur-[110px]"
        style={{ background: "radial-gradient(circle, rgba(166,240,0,0.10), transparent 65%)" }}
      />
      <div className="relative mx-auto max-w-6xl px-4 py-12">
        {/* CTA بارز — فتح Premium (أهم زر: يفتح أكواد برومو أقوى) */}
        <div
          className="mb-10 flex flex-col items-center gap-5 overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-lime)]/30 bg-[var(--color-lime)]/[0.06] p-6 text-center sm:flex-row sm:justify-between sm:text-start"
        >
          <div className="flex items-center gap-3.5">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--color-lime)]/15 text-[var(--color-lime)]">
              <Crown size={24} />
            </span>
            <div>
              <h3 className="text-[18px] font-black tracking-tight text-[var(--text)]">{t("footer.ctaTitle")}</h3>
              <p className="mt-0.5 text-[13.5px] leading-relaxed text-[var(--text-soft)]">{t("footer.ctaDesc")}</p>
            </div>
          </div>
          <button
            onClick={onPremium}
            className="group flex shrink-0 items-center gap-2 rounded-xl px-6 py-3 text-[15px] font-extrabold text-[#0a0a0a] transition-transform hover:scale-[1.02]"
            style={{ background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" }}
          >
            {t("footer.ctaBtn")}
            <ArrowLeft size={18} className="transition-transform group-hover:-translate-x-1 ltr:rotate-180" />
          </button>
        </div>

        {/* اللوغو + الوصف + التواصل */}
        <div className="flex flex-col items-start justify-between gap-8 sm:flex-row sm:items-start">
          <div className="max-w-sm">
            <Logo />
            <p className="mt-4 text-[14px] leading-relaxed text-[var(--text-soft)]">
              {t("footer.tagline")}
            </p>
          </div>

          <div className="flex flex-col items-start gap-2.5 sm:items-end">
            <span className="text-[12.5px] font-semibold text-[var(--color-mute)]">{t("footer.follow")}</span>
            <div className="flex items-center gap-2.5">
              {SOCIALS.map(({ Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  title={label}
                  className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--color-ink-line)] bg-[var(--fill)] text-[var(--text-softer)] transition-colors hover:border-[var(--color-lime)]/40 hover:text-[var(--accent-text)]"
                >
                  <Icon size={18} />
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* الشريط السفلي */}
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-[var(--color-ink-line)] pt-6 text-[12.5px] text-[var(--color-mute)] sm:flex-row">
          <div className="flex flex-col items-center gap-1.5 sm:flex-row sm:gap-4">
            <span>© {year} CODpromo</span>
            <Link
              to="/privacy"
              className="font-medium transition-colors hover:text-[var(--accent-text)]"
            >
              {t("footer.privacy")}
            </Link>
          </div>
          <a
            href="https://ilyesderradji.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium transition-colors hover:text-[var(--accent-text)]"
          >
            {t("footer.poweredBy")} <span className="font-bold text-[var(--text-softer)]">Ilyes Derradji</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
