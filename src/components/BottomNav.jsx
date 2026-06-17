import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Home, LayoutGrid, Heart, Crown, User, LogIn } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../lib/auth.jsx";
import { useScrollVisibility } from "../lib/scrollVisibility.jsx";

// ============================================================
//  CODpromo — شريط التنقّل السفلي (Bottom Navigation) — للهاتف فقط (md:hidden).
//  بهوية الموقع (أسود + أخضر Lime + Tajawal)، زر مركزي بارز مرفوع (Premium).
//  مرآة للهيدر: يقرأ نفس حالة الظهور/الاختفاء من المصدر المشترك
//  (useScrollVisibility) بلا أي منطق تمرير خاص به → مزامنة تامة مع الهيدر.
// ============================================================
export default function BottomNav({ onPremium }) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { hidden } = useScrollVisibility();
  const { pathname } = useLocation();

  const lang = i18n.language;
  const L = lang && lang !== "ar" ? `/${lang}` : "";

  // الروابط (الرئيسية/الفئات تحترم بادئة اللغة؛ لوحة المستخدم وتسجيل الدخول بلا بادئة)
  const homeTo = `${L}/` || "/";
  const catsTo = `${L}/categories`;
  const favTo = `${L}/favorites`; // صفحة المفضّلة المخصّصة
  const accountTo = user ? "/dashboard" : "/login";

  // الحالة النشطة (نتجاهل بادئة اللغة)
  const base = pathname.replace(/^\/(en|fr)(?=\/|$)/, "") || "/";
  const isHome = base === "/";
  const isCats = base.startsWith("/categories");
  const isFav = base.startsWith("/favorites");
  const isDash = base.startsWith("/dashboard");

  return (
    <nav
      aria-label={t("bottomNav.label")}
      className={`fixed inset-x-0 bottom-0 z-40 transition-transform duration-300 will-change-transform md:hidden ${
        hidden ? "translate-y-[130%]" : "translate-y-0"
      }`}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="relative flex items-end justify-around rounded-t-2xl border-t border-[var(--color-ink-line)] bg-[var(--elev)]/95 px-1.5 pb-1.5 pt-2 shadow-[0_-10px_34px_-12px_rgba(0,0,0,0.65)] backdrop-blur-xl">
        {/* شعرة/توهّج أخضر علوي — نفس شخصية الهيدر */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-12 top-0 h-px opacity-80"
          style={{ background: "linear-gradient(90deg, transparent, rgba(166,240,0,0.6), transparent)" }}
        />

        <NavItem to={homeTo} icon={Home} label={t("bottomNav.home")} active={isHome} />
        <NavItem to={catsTo} icon={LayoutGrid} label={t("bottomNav.categories")} active={isCats} />

        {/* الزر المركزي البارز — Premium (هوية Lime، ليست الذهبية) */}
        <div className="flex w-[20%] shrink-0 justify-center">
          <motion.button
            type="button"
            onClick={onPremium}
            whileTap={{ scale: 0.9 }}
            aria-label={t("bottomNav.premium")}
            className="-mt-8 grid h-14 w-14 place-items-center rounded-full text-[#0a0a0a]"
            style={{
              background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))",
              boxShadow:
                "0 10px 26px -8px rgba(166,240,0,0.7), 0 0 0 6px var(--elev)",
            }}
          >
            <Crown size={24} strokeWidth={2.4} />
          </motion.button>
        </div>

        <NavItem to={favTo} icon={Heart} label={t("bottomNav.favorites")} active={isFav} />
        <NavItem
          to={accountTo}
          icon={user ? User : LogIn}
          label={user ? t("bottomNav.account") : t("bottomNav.login")}
          active={isDash}
        />
      </div>
    </nav>
  );
}

function NavItem({ to, icon: Icon, label, active }) {
  const color = active ? "text-[var(--color-lime)]" : "text-[var(--color-mute)]";
  return (
    <Link to={to} className="flex w-[20%] shrink-0 flex-col items-center gap-1 py-1">
      <motion.span whileTap={{ scale: 0.82 }} className="grid place-items-center">
        <Icon size={22} strokeWidth={active ? 2.5 : 2} className={`transition-colors ${color}`} />
      </motion.span>
      <span className={`text-[10.5px] font-bold leading-none transition-colors ${color}`}>
        {label}
      </span>
    </Link>
  );
}
