import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Building2, ChevronDown, Crown, Mail, Smartphone } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import Logo from "./Logo.jsx";
import PremiumModal from "./PremiumModal.jsx";
import IlyesSignature from "./IlyesSignature.jsx";
import GooglePlayBadge from "./app/GooglePlayBadge.jsx";
import FooterCta from "./footer/FooterCta.jsx";
import Newsletter from "./footer/Newsletter.jsx";
import Wordmark from "./footer/Wordmark.jsx";
import BackToTop from "./footer/BackToTop.jsx";
import { useHeaderOffers } from "./header/headerData.js";
import { useAppTarget } from "../lib/appInstall.js";
import { useCategories } from "../lib/categories.jsx";
import { activeCategories, countByCategory } from "../lib/offerFilters.js";
import { categoryName, categoryRecordSlug } from "../lib/slug.js";
import { categoriesPath, homePath, offersLink, offersPath } from "../lib/seo.js";

// رمز QR (ومكتبته) يُحمَّل فقط حين يقترب الفوتر وعلى الحاسوب — لا يثقل باقي الصفحات
const PlayQr = lazy(() => import("./app/PlayQr.jsx"));

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

export const SOCIALS = [
  { Icon: InstagramIcon, href: "https://www.instagram.com/codpromo.app", label: "Instagram" },
  { Icon: FacebookIcon, href: "https://www.facebook.com/profile.php?id=61590289486342", label: "Facebook" },
  { Icon: Mail, href: "mailto:contact@codpromo.com", label: "Email" },
];

const TYPE_LINKS = [
  { param: "discount", key: "typeDiscount", color: "#a6f000" },
  { param: "coupon", key: "typeCoupon", color: "#38bdf8" },
  { param: "cashback", key: "typeCashback", color: "#fbbf24" },
];

const linkCls = "inline-flex items-center gap-2.5 py-1.5 text-[14.5px] font-medium text-[var(--text-soft)] transition-colors hover:text-[var(--text)] focus-visible:text-[var(--text)]";

function useIsDesktop() {
  const [match, setMatch] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setMatch(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return match;
}

/** عمود روابط: عنوان + قائمة على الحاسوب، و accordion (ينفتح ويتسكّر) على الهاتف. */
function FooterCol({ id, title, desktop, children }) {
  const [open, setOpen] = useState(false);
  if (desktop) {
    return (
      <div>
        <h3 className="text-[13px] font-extrabold text-[var(--text)]">{title}</h3>
        <ul className="mt-4 flex flex-col gap-0.5">{children}</ul>
      </div>
    );
  }
  return (
    <div className="border-b border-dashed border-[var(--color-ink-line)]">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between py-4 text-[15.5px] font-extrabold text-[var(--text)]"
        >
          {title}
          <ChevronDown size={18} className={`text-[var(--color-mute)] transition-transform duration-300 ${open ? "rotate-180 text-[var(--accent-text)]" : ""}`} />
        </button>
      </h3>
      <div id={id} className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`} inert={open ? undefined : ""}>
        <ul className="flex min-h-0 flex-col overflow-hidden pb-1">{children}</ul>
      </div>
    </div>
  );
}

/**
 * الفوتر: الـ CTA الكوبون فوقه، ثم البراند + النشرة، أعمدة الروابط (accordion على الهاتف)،
 * التطبيق + تابعنا، كلمة CODpromo الضخمة، والسطر الأخير مع توقيع Ilyes Derradji.
 * onPremium: نافذة Premium الخاصة بالصفحة — وإلا يفتح الفوتر نسخته (نفس النافذة).
 */
export default function Footer({ onPremium }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const year = new Date().getFullYear();
  const desktop = useIsDesktop();
  const [premiumOpen, setPremiumOpen] = useState(false);
  const openPremium = onPremium || (() => setPremiumOpen(true));

  // أهم الفئات: العروض تُجلب فقط حين يقترب الزائر من الفوتر (نفس ذاكرة الهيدر)
  // وظهور الـ CTA أو الفوتر (على الهاتف يختفي زر الرجوع العائم حتى لا يغطّي أزرارهما)
  const ref = useRef(null);
  const ctaRef = useRef(null);
  const [near, setNear] = useState(false);
  const [inView, setInView] = useState({});
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: "500px 0px" });
    const seen = new IntersectionObserver((entries) =>
      setInView((v) => {
        const next = { ...v };
        for (const e of entries) next[e.target === el ? "footer" : "cta"] = e.isIntersecting;
        return next;
      })
    );
    io.observe(el);
    seen.observe(el);
    if (ctaRef.current) seen.observe(ctaRef.current);
    return () => {
      io.disconnect();
      seen.disconnect();
    };
  }, []);
  const visible = !!(inView.footer || inView.cta);
  const offers = useHeaderOffers(near);
  const { categories } = useCategories();
  const topCats = useMemo(() => {
    if (!offers.length) return [];
    const cats = activeCategories(categories);
    const counts = countByCategory(offers, cats);
    return cats
      .filter((c) => counts[c.id] > 0)
      .sort((a, b) => counts[b.id] - counts[a.id])
      .slice(0, 5)
      .map((c) => ({ cat: c, n: counts[c.id] }));
  }, [offers, categories]);

  return (
    <>
      <FooterCta onPremium={openPremium} innerRef={ctaRef} />

      <footer ref={ref} className="relative mt-14 overflow-hidden border-t border-[var(--color-ink-line)] pb-12 md:pb-0">
        <div aria-hidden className="pointer-events-none absolute -top-28 left-1/2 h-56 w-[760px] -translate-x-1/2 rounded-full blur-[110px]" style={{ background: "radial-gradient(circle, rgba(166,240,0,0.09), transparent 65%)" }} />

        <div className="relative mx-auto max-w-6xl px-4 pt-14">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
            {/* ===== البراند + النشرة ===== */}
            <div className="lg:col-span-4">
              <Logo />
              <p className="mt-5 max-w-sm text-[14.5px] leading-[1.75] text-[var(--text-soft)]">{t("footer.desc")}</p>
              <Newsletter />
            </div>

            {/* ===== الأعمدة ===== */}
            <div className="lg:col-span-8 lg:grid lg:grid-cols-4 lg:gap-8 lg:ps-6">
              <FooterCol id="f-discover" title={t("footer.discover")} desktop={desktop}>
                <li>
                  <Link to={offersPath(lang)} className={linkCls}>{t("nav.offers")}</Link>
                </li>
                <li>
                  <Link to={categoriesPath(lang)} className={linkCls}>{t("nav.categories")}</Link>
                </li>
                <li>
                  <Link to={{ pathname: homePath(lang), hash: "#how" }} className={linkCls}>{t("nav.how")}</Link>
                </li>
                <li>
                  <button type="button" onClick={openPremium} className={`${linkCls} text-[#ffe486]/85 hover:text-[#ffe486]`}>
                    <Crown size={14} aria-hidden /> {t("premiumToggle.premium")}
                  </button>
                </li>
              </FooterCol>

              <FooterCol id="f-types" title={t("footer.types")} desktop={desktop}>
                {TYPE_LINKS.map((ty) => (
                  <li key={ty.param}>
                    <Link to={offersLink(lang, { type: ty.param })} className={`group ${linkCls}`}>
                      <span aria-hidden className="h-2 w-2 rounded-full transition-transform duration-300 group-hover:scale-150" style={{ background: ty.color, boxShadow: `0 0 10px ${ty.color}88` }} />
                      {t(`footer.${ty.key}`)}
                    </Link>
                  </li>
                ))}
              </FooterCol>

              <FooterCol id="f-cats" title={t("footer.topCats")} desktop={desktop}>
                {topCats.map(({ cat, n }) => (
                  <li key={cat.id}>
                    <Link to={offersLink(lang, { category: categoryRecordSlug(cat) })} className={linkCls}>
                      <span className="truncate">{categoryName(cat, lang)}</span>
                      <span className="text-[11.5px] font-bold tabular-nums text-[var(--color-mute)] [font-family:Inter,sans-serif]">{n}</span>
                    </Link>
                  </li>
                ))}
                <li>
                  <Link to={categoriesPath(lang)} className={`${linkCls} text-[var(--accent-text)] hover:text-[var(--color-lime-soft)]`}>
                    {t("home.allCategories")}
                  </Link>
                </li>
              </FooterCol>

              <FooterCol id="f-biz" title={t("footer.business")} desktop={desktop}>
                <li>
                  <Link to="/signup?type=company" className={linkCls}>
                    <Building2 size={15} aria-hidden className="text-[var(--color-mute)]" /> {t("footer.addOffers")}
                  </Link>
                </li>
                <li>
                  <a href="mailto:contact@codpromo.com" className={linkCls}>
                    <Mail size={15} aria-hidden className="text-[var(--color-mute)]" /> {t("footer.contact")}
                  </a>
                </li>
              </FooterCol>
            </div>
          </div>

          {/* ===== التطبيق + تابعنا ===== */}
          <div className="mt-9 flex flex-col gap-9 sm:mt-12 sm:flex-row sm:items-end sm:justify-between sm:border-t sm:border-dashed sm:border-[var(--color-ink-line)] sm:pt-9">
            <FooterApp showQr={near && desktop} />
            <div>
              <span className="block text-[13px] font-extrabold text-[var(--text)]">{t("footer.follow")}</span>
              <div className="mt-3 flex items-center gap-2.5">
                {SOCIALS.map(({ Icon, href, label }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    title={label}
                    className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--color-ink-line)] bg-[var(--fill)] text-[var(--text-softer)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--color-lime)]/50 hover:bg-[var(--color-lime)]/10 hover:text-[var(--accent-text)] hover:shadow-[0_0_22px_-6px_rgba(166,240,0,0.6)]"
                  >
                    <Icon size={18} />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ===== CODpromo الضخمة ===== */}
        <Wordmark />

        {/* ===== السطر الأخير ===== */}
        <div className="relative mx-auto max-w-6xl px-4">
          <div className="flex flex-col items-center justify-between gap-4 border-t border-[var(--color-ink-line)] py-6 text-[12.5px] text-[var(--color-mute)] sm:flex-row">
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5">
              <span>© {year} CODpromo</span>
              <Link to="/privacy" className="font-medium transition-colors hover:text-[var(--accent-text)]">{t("footer.privacy")}</Link>
              <Link to="/account-deletion" className="font-medium transition-colors hover:text-[var(--accent-text)]">{t("footer.accountDeletion")}</Link>
            </div>
            <div className="flex items-center gap-5">
              <IlyesSignature label={t("footer.poweredBy")} glow="rgba(166,240,0,0.55)" />
              <BackToTop inline />
            </div>
          </div>
        </div>
      </footer>

      <BackToTop footerVisible={visible} />
      {!onPremium && createPortal(<PremiumModal open={premiumOpen} onClose={() => setPremiumOpen(false)} />, document.body)}
    </>
  );
}

/** التطبيق: شارة Google Play الرسمية + QR صغير على الحاسوب (أو "قريباً على iPhone") — يختفي داخل التطبيق. */
function FooterApp({ showQr }) {
  const { t } = useTranslation();
  const { inApp, platform } = useAppTarget();
  const [hot, setHot] = useState(false);
  if (inApp) return null;
  return (
    <div>
      <span className="block text-[13px] font-extrabold text-[var(--text)]">{t("app.getApp")}</span>
      {platform === "ios" ? (
        <p className="mt-3 flex items-center gap-1.5 text-[13.5px] font-semibold text-[var(--text-soft)]">
          <Smartphone size={15} aria-hidden /> {t("app.iosSoon")}
        </p>
      ) : (
        <div className="mt-3 flex items-center gap-5">
          <GooglePlayBadge
            height={62}
            glow
            flush
            onPointerEnter={() => setHot(true)}
            onPointerLeave={() => setHot(false)}
            onFocus={() => setHot(true)}
            onBlur={() => setHot(false)}
          />
          {showQr && (
            <div className="hidden items-center gap-3 lg:flex">
              <Suspense fallback={<span className="block h-[76px] w-[76px] rounded-2xl bg-[var(--fill)]" />}>
                <PlayQr size={76} hot={hot} />
              </Suspense>
              <span className="max-w-[120px] text-[12px] font-semibold leading-snug text-[var(--color-mute)]">{t("app.qrCaption")}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
