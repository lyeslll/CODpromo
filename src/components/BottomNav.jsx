import { Link, useLocation } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Home, TicketPercent, Heart, Crown, User, LogIn } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../lib/auth.jsx";
import { usePremium } from "../lib/premium.jsx";
import { useScrollVisibility } from "../lib/scrollVisibility.jsx";
import { offersPath, premiumPath } from "../lib/seo.js";

// ============================================================
//  CODpromo — شريط التنقّل السفلي (الهاتف فقط، md:hidden): خمسة أزرار
//  الرئيسية · العروض · Premium (في الوسط، ذهبي ومرفوع) · المفضّلة · حسابي.
//  - الزر المختار: لون ليموني + مؤشّر صغير ينزلق بين الأزرار (layoutId)، بلا حركة مع reduced-motion.
//  - يتخبّى كي تهبط ويرجع كي تطلع: نفس حالة الهيدر (useScrollVisibility) → مزامنة تامة.
//  - safe area تاع الآيفون وأزرار أندرويد (env + حدّ أدنى 6px داخل التطبيق).
//  Premium: صفحة البيع /premium؛ اللي عندو Premium (مدفوع / هدية / أدمن) → عروض Premium.
// ============================================================
export default function BottomNav({ onPremium }) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { hasPremium } = usePremium();
  const { hidden } = useScrollVisibility();
  const { pathname, search } = useLocation();
  const reduce = useReducedMotion();

  const lang = i18n.language;
  const L = lang && lang !== "ar" ? `/${lang}` : "";

  const base = pathname.replace(/^\/(en|fr)(?=\/|$)/, "") || "/";
  const premiumOffers = base.startsWith("/offers") && /(^|[?&])mode=premium(&|$)/.test(search);
  const active = base === "/"
    ? "home"
    : base.startsWith("/premium") || base.startsWith("/payment-") || premiumOffers
    ? "premium"
    : base.startsWith("/offers") || base.startsWith("/categor") || base.startsWith("/store/")
    ? "offers"
    : base.startsWith("/favorites")
    ? "fav"
    : base.startsWith("/dashboard") || ["/login", "/signup", "/forgot-password", "/reset-password"].includes(base)
    ? "account"
    : null;

  const items = [
    { key: "home", to: `${L}/` || "/", icon: Home, label: t("bottomNav.home") },
    { key: "offers", to: offersPath(lang), icon: TicketPercent, label: t("bottomNav.offers") },
    { key: "premium" },
    { key: "fav", to: `${L}/favorites`, icon: Heart, label: t("bottomNav.favorites") },
    { key: "account", to: user ? "/dashboard" : "/login", icon: user ? User : LogIn, label: user ? t("bottomNav.account") : t("bottomNav.login") },
  ];

  return (
    <nav
      aria-label={t("bottomNav.label")}
      className={`bottom-nav fixed inset-x-0 bottom-0 z-40 transition-transform duration-300 ease-out md:hidden ${hidden ? "translate-y-[135%]" : "translate-y-0"}`}
    >
      <div
        className="relative mx-auto flex max-w-[560px] items-stretch justify-around rounded-t-[22px] border-t border-[var(--color-ink-line)] bg-[var(--elev)]/95 px-1 pt-1.5 shadow-[0_-12px_36px_-14px_rgba(0,0,0,0.8)] backdrop-blur-xl"
        style={{ paddingBottom: "max(6px, env(safe-area-inset-bottom))" }}
      >
        {/* شعرة ضوء علوية — نفس شخصية الهيدر */}
        <span aria-hidden className="pointer-events-none absolute inset-x-14 top-0 h-px opacity-70" style={{ background: "linear-gradient(90deg, transparent, rgba(166,240,0,0.55), transparent)" }} />
        {items.map((it) =>
          it.key === "premium" ? (
            <PremiumItem key="premium" active={active === "premium"} member={hasPremium} lang={lang} onPremium={onPremium} label={t("bottomNav.premium")} reduce={reduce} />
          ) : (
            <NavItem key={it.key} {...it} active={active === it.key} reduce={reduce} />
          )
        )}
      </div>
    </nav>
  );
}

function NavItem({ to, icon: Icon, label, active, reduce }) {
  return (
    <Link
      to={to}
      aria-current={active ? "page" : undefined}
      className="relative flex min-h-[54px] w-[20%] flex-col items-center justify-center gap-1 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-lime)]/60"
    >
      {active && (
        <motion.span
          layoutId={reduce ? undefined : "bn-pill"}
          aria-hidden
          className="absolute top-0 h-[3px] w-7 rounded-full bg-[var(--color-lime)] shadow-[0_0_12px_rgba(166,240,0,0.7)]"
          transition={{ type: "spring", stiffness: 520, damping: 38 }}
        />
      )}
      <motion.span whileTap={{ scale: 0.86 }} className="grid place-items-center">
        <Icon size={22} strokeWidth={active ? 2.4 : 1.9} className={`transition-colors duration-200 ${active ? "text-[var(--color-lime)]" : "text-[var(--text-soft)]"}`} />
      </motion.span>
      <span className={`max-w-full truncate px-0.5 text-[11px] leading-none transition-colors duration-200 ${active ? "font-extrabold text-[var(--text)]" : "font-semibold text-[var(--color-mute)]"}`}>
        {label}
      </span>
    </Link>
  );
}

/** الزر الذهبي في الوسط: مرفوع شوية، ويرجع للحجم العادي مع reduced-motion. */
function PremiumItem({ active, member, lang, onPremium, label }) {
  const content = (
    <>
      <span
        className={`bn-gold relative -mt-6 grid h-[54px] w-[54px] place-items-center rounded-full text-[#0a0a0a] transition-transform duration-200 active:scale-[0.92] ${active ? "bn-gold-on" : ""}`}
        style={{
          background: "linear-gradient(140deg, #ffe486, #f0c63c 52%, #cf9a1e)",
          boxShadow: "0 12px 26px -10px rgba(240,198,60,0.75), 0 0 0 5px var(--elev)",
        }}
      >
        <Crown size={24} strokeWidth={2.3} />
      </span>
      <span className={`text-[11px] leading-none ${active ? "font-extrabold text-[#ffe486]" : "font-bold text-[#e3c46a]"}`}>{label}</span>
    </>
  );
  const cls = "relative flex w-[20%] flex-col items-center justify-start gap-1 rounded-xl pb-1 outline-none focus-visible:ring-2 focus-visible:ring-[#f0c63c]/60";
  // عضو Premium → عروض Premium (رابط حقيقي)، وإلا صفحة البيع عبر onPremium (نفس useGoPremium)
  if (member) {
    return (
      <Link to={`${offersPath(lang)}?mode=premium`} aria-current={active ? "page" : undefined} aria-label={label} className={cls}>
        {content}
      </Link>
    );
  }
  return (
    <Link
      to={premiumPath(lang)}
      onClick={(e) => {
        if (!onPremium) return;
        e.preventDefault();
        onPremium();
      }}
      aria-current={active ? "page" : undefined}
      aria-label={label}
      className={cls}
    >
      {content}
    </Link>
  );
}
