import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { LogIn, UserPlus, Menu, X, Search, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import Logo from "./Logo.jsx";
import LanguageSwitcher from "./LanguageSwitcher.jsx";
import { useGoPremium } from "../lib/goPremium.js";
import PremiumNavButton from "./header/PremiumNavButton.jsx";
import CategoriesMega from "./header/CategoriesMega.jsx";
import QuickSearch from "./header/QuickSearch.jsx";
import MobileMenu from "./header/MobileMenu.jsx";
import AccountMenu from "./header/AccountMenu.jsx";
import KeysCounter from "./keys/KeysCounter.jsx";
import { loadHeaderOffers, useHeaderOffers, useHoverMenu, useOffersCount, userDisplay } from "./header/headerData.js";
import { useAuth } from "../lib/auth.jsx";
import { useCategories } from "../lib/categories.jsx";
import { useScrollVisibility } from "../lib/scrollVisibility.jsx";
import { activeCategories, countByCategory } from "../lib/offerFilters.js";
import { homePath, offersPath } from "../lib/seo.js";
import { formatNumber } from "../lib/values.js";
import NotificationBell from "./notifications/NotificationBell.jsx";

// الحاسوب (lg+): العروض (مع العدد) + الفئات (ميغا مينيو) + كيف يعمل. الهاتف واللوحي: Premium صغير + قائمة بكامل الشاشة.
const MEGA_ID = "nav-categories-mega";
const MENU_ID = "nav-mobile-menu";
const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** الرابط النشط من المسار الحالي (بلا بادئة اللغة) — مكان الخط الليموني. */
function activeKeyOf({ pathname, hash }) {
  const path = pathname.replace(/^\/(en|fr)(?=\/|$)/, "") || "/";
  if (path.startsWith("/offers")) return "offers";
  if (path.startsWith("/categor")) return "categories";
  if (path === "/" && hash === "#how") return "how";
  return null;
}

/** شكل روابط الحاسوب (نص أفتح للرابط النشط). */
const linkCls = (active) =>
  `relative flex items-center whitespace-nowrap rounded-lg px-2 py-2 text-[13.5px] font-semibold outline-none transition-colors hover:text-[var(--text)] focus-visible:ring-1 focus-visible:ring-[var(--color-lime)]/50 xl:px-3.5 xl:text-[14px] ${active ? "text-[var(--text)]" : "text-[var(--text-softer)]"}`;

/** الخط الليموني تحت الرابط المفتوح — ينزلق بين الروابط مع المرور (layoutId). */
function Underline() {
  return (
    <motion.span
      layoutId="nav-underline"
      aria-hidden
      className="pointer-events-none absolute inset-x-2 -bottom-0.5 h-[2px] rounded-full bg-[var(--color-lime)] shadow-[0_0_12px_rgba(166,240,0,0.55)] xl:inset-x-3.5"
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
    />
  );
}

export default function Navbar() {
  const [open, setOpen] = useState(false); // قائمة الهاتف
  const [searchOpen, setSearchOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false); // نافذة الإشعارات (الكمبيوتر): الهيدر يبقى ظاهر
  const goPremium = useGoPremium();
  const [hoverKey, setHoverKey] = useState(null);
  const [megaFocus, setMegaFocus] = useState(false);
  const mega = useHoverMenu();
  const megaBtnRef = useRef(null);
  const menuBtnRef = useRef(null);
  const pointerRef = useRef("mouse");
  // إخفاء/إظهار الهيدر حسب اتجاه التمرير (مشترك مع شريط التنقّل السفلي ليتزامنا) — كما هو.
  const { scrolled, hidden } = useScrollVisibility();
  const { user, signOut } = useAuth();
  const { categories } = useCategories();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const navigate = useNavigate();
  const location = useLocation();
  const offersCount = useOffersCount();
  const offers = useHeaderOffers(mega.open);
  const cats = activeCategories(categories);
  const counts = offers.length ? countByCategory(offers, cats) : null;
  const activeKey = activeKeyOf(location);
  const lineKey = hoverKey ?? (mega.open ? "categories" : activeKey);

  // أي تنقّل يغلق القوائم المفتوحة
  useEffect(() => {
    setOpen(false);
    setSearchOpen(false);
    mega.close();
  }, [location.pathname, location.search, location.hash]);

  // Ctrl+K / ⌘K يفتح البحث السريع من أي صفحة (KeyK: يعمل حتى بلوحة مفاتيح عربية)
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.code === "KeyK" || e.key?.toLowerCase() === "k")) {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // نقرة خارج زر "الفئات" وقائمتها تغلقها
  useEffect(() => {
    if (!mega.open) return;
    const onDown = (e) => !e.target.closest?.("[data-mega]") && mega.close();
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [mega.open]);

  // زر "الفئات": المرور يفتح (فأرة)، النقر يفتح للفأرة ويبدّل للمس، ولوحة المفاتيح تنقل التركيز للقائمة
  const onMegaClick = (e) => {
    const keyboard = e.detail === 0;
    loadHeaderOffers();
    setMegaFocus(keyboard);
    if (pointerRef.current === "mouse" && !keyboard) mega.show();
    else mega.toggle();
  };
  const onMegaKey = (e) => {
    if (e.key !== "ArrowDown") return;
    e.preventDefault();
    if (mega.open) return document.getElementById(MEGA_ID)?.querySelector("a")?.focus();
    loadHeaderOffers();
    setMegaFocus(true);
    mega.show();
  };
  const closeMega = (returnFocus) => {
    mega.close();
    setMegaFocus(false);
    if (returnFocus) megaBtnRef.current?.focus();
  };

  const logout = async () => {
    await signOut();
    setOpen(false);
    navigate("/");
  };

  // زر Premium (الهيدر وقائمة الهاتف) → صفحة البيع /premium
  const openPremium = () => {
    setOpen(false);
    goPremium();
  };

  const { name, initial } = userDisplay(user, t("nav.account"));
  const kbd = IS_MAC ? "⌘K" : `${t("header.keyCtrl")} K`;

  return (
    <motion.header
      id="top"
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      // الغلاف شفاف ويمتدّ بعرض الشاشة: ما يلتقطش الضغط (pointer-events-none)، الكبسولة والميغا مينيو برك.
      // مخبّي → بلا ضغط و visibility: hidden بعد ما تكمل الحركة (transition على visibility).
      className="pointer-events-none fixed inset-x-0 top-0 z-50"
    >
      <div
        className={`nav-inner mx-auto max-w-6xl px-4 pt-3 transition-[transform,visibility] duration-300 will-change-transform sm:pt-4 ${
          hidden && !open && !mega.open && !searchOpen && !bellOpen ? "invisible -translate-y-[150%]" : "visible translate-y-0 [&>*]:pointer-events-auto"
        }`}
      >
        {/* ===== الكبسولة (الهيدر) — لمسة تعريف خفيفة في الأعلى، زجاجية وأصغر قليلاً عند النزول ===== */}
        <div
          className={`nav-capsule relative flex items-center justify-between rounded-2xl border px-3.5 transition-all duration-300 sm:px-5 lg:px-4 xl:px-5 ${
            open
              ? `border-[var(--color-ink-line)] bg-[var(--elev)] shadow-[0_10px_40px_-14px_rgba(0,0,0,0.65)] ${scrolled ? "py-1.5" : "py-2.5"}`
              : scrolled
              ? "border-[var(--color-ink-line)] bg-[var(--elev)]/65 py-1.5 shadow-[0_10px_40px_-14px_rgba(0,0,0,0.65)] backdrop-blur-2xl backdrop-saturate-150"
              : "border-[var(--color-ink-line)]/40 bg-[var(--elev)]/25 py-2.5 shadow-[0_4px_24px_-18px_rgba(0,0,0,0.5)] backdrop-blur-md"
          }`}
        >
          {/* شعرة ضوء ليموني علوية — تعطي شخصية للهيدر حتى في الأعلى */}
          <span
            aria-hidden
            className={`pointer-events-none absolute inset-x-6 top-0 h-px transition-opacity duration-300 ${scrolled ? "opacity-80" : "opacity-40"}`}
            style={{ background: "linear-gradient(90deg, transparent, rgba(166,240,0,0.55), transparent)" }}
          />

          {/* الشعار كما هو — يصغر قليلاً مع الهيدر عند النزول (الحاسوب) */}
          <div className={`transition-transform duration-300 ltr:origin-left rtl:origin-right ${scrolled ? "lg:scale-[0.9]" : ""}`}>
            <Logo />
          </div>

          {/* ===== روابط الحاسوب: العروض (مع العدد) + الفئات (ميغا مينيو) + كيف يعمل ===== */}
          <div className="hidden items-center gap-0.5 lg:flex" onPointerLeave={() => setHoverKey(null)}>
            <Link
              to={offersPath(lang)}
              onPointerEnter={() => setHoverKey("offers")}
              onFocus={() => setHoverKey("offers")}
              onBlur={() => setHoverKey(null)}
              className={`group ${linkCls(activeKey === "offers")}`}
            >
              {t("nav.offers")}
              {offersCount != null && (
                <span
                  title={t("header.offersBadge", { count: offersCount })}
                  className="ms-1.5 rounded-full bg-[var(--color-lime)]/10 px-1.5 text-[11px] font-extrabold leading-[18px] tabular-nums text-[var(--accent-text)] ring-1 ring-[var(--color-lime)]/25 transition-colors [font-family:Inter,sans-serif] group-hover:bg-[var(--color-lime)]/20"
                >
                  <span aria-hidden>{formatNumber(offersCount, lang)}</span>
                  <span className="sr-only">{t("header.offersBadge", { count: offersCount })}</span>
                </span>
              )}
              {lineKey === "offers" && <Underline />}
            </Link>

            <button
              ref={megaBtnRef}
              type="button"
              data-mega
              aria-expanded={mega.open}
              aria-controls={MEGA_ID}
              onPointerDown={(e) => (pointerRef.current = e.pointerType)}
              onPointerEnter={(e) => {
                setHoverKey("categories");
                if (e.pointerType !== "mouse") return;
                loadHeaderOffers();
                mega.enter();
              }}
              onPointerLeave={(e) => e.pointerType === "mouse" && mega.leave()}
              onFocus={() => setHoverKey("categories")}
              onBlur={() => setHoverKey(null)}
              onClick={onMegaClick}
              onKeyDown={onMegaKey}
              className={linkCls(activeKey === "categories" || mega.open)}
            >
              {t("nav.categories")}
              <ChevronDown size={15} className={`ms-1 transition-transform duration-200 ${mega.open ? "rotate-180" : ""}`} />
              {lineKey === "categories" && <Underline />}
            </button>

            <Link
              to={{ pathname: homePath(lang), hash: "#how" }}
              onPointerEnter={() => setHoverKey("how")}
              onFocus={() => setHoverKey("how")}
              onBlur={() => setHoverKey(null)}
              className={linkCls(activeKey === "how")}
            >
              {t("nav.how")}
              {lineKey === "how" && <Underline />}
            </Link>
          </div>

          {/* ===== مجموعة الحاسوب: بحث + لغة + Premium + حساب (بين 1024 و1280: الدخول/الخروج بالأيقونة فقط) ===== */}
          <div className="hidden items-center gap-1 lg:flex xl:gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              onPointerEnter={() => loadHeaderOffers()}
              aria-label={t("header.search")}
              aria-keyshortcuts="Control+K Meta+K"
              title={`${t("header.search")} (${kbd})`}
              className="group flex h-9 items-center gap-2 rounded-xl border border-[var(--color-ink-line)] bg-[var(--fill)] px-2.5 text-[var(--text-softer)] transition-colors hover:border-[var(--color-lime)]/35 hover:text-[var(--text)]"
            >
              <Search size={16} className="transition-transform duration-200 group-hover:scale-110" />
              <kbd dir="ltr" className="hidden rounded-md border border-[var(--color-ink-line)] px-1.5 font-sans text-[10.5px] font-bold leading-[18px] text-[var(--color-mute)] xl:inline">
                {kbd}
              </kbd>
            </button>
            {/* جرس الإشعارات: نفس ارتفاع الأزرار (h-9)، نافذة تحت الجرس */}
            <NotificationBell onOpenChange={setBellOpen} />

            <LanguageSwitcher />
            {/* عدّاد المفاتيح (الذهبي + الماسي) — نفس ارتفاع الأزرار، يحلّ لوحة الرصيد. بين 1024 و1280: المربّع
                الصغير (بلاه، بالفرنسية، سطر الشعار يتقسم والهيدر يكبر) */}
            <span className="hidden xl:contents">
              <KeysCounter />
            </span>
            <span className="contents xl:hidden">
              <KeysCounter compact />
            </span>
            <PremiumNavButton onOpen={openPremium} />

            {user ? (
              // قائمة الحساب (حسابي، المفضّلة، لوحة التحكم، الخروج) بلاصة زر "خروج" وحدو جنب الاسم
              <AccountMenu name={name} initial={initial} onLogout={logout} />
            ) : (
              <>
                <Link
                  to="/login"
                  aria-label={t("nav.login")}
                  title={t("nav.login")}
                  className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-[14px] font-semibold text-[var(--text-softer)] transition-colors hover:text-[var(--text)] xl:px-3"
                >
                  <LogIn size={16} /> <span className="hidden xl:inline">{t("nav.login")}</span>
                </Link>
                {/* إنشاء حساب: إطار رقيق هادئ — زر Premium الذهبي يبقى الوحيد البارز */}
                <Link
                  to="/signup"
                  className="flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-[var(--color-ink-line)] px-3 py-2 text-[13.5px] font-semibold text-[var(--text-softer)] transition-colors hover:border-[var(--color-lime)]/35 hover:text-[var(--text)] xl:px-3.5 xl:text-[14px]"
                >
                  <UserPlus size={16} className="hidden xl:block" />
                  {t("nav.signup")}
                </Link>
              </>
            )}
          </div>

          {/* ===== الهاتف: اللوغو + الجرس + القائمة برك (زر القائمة يبقى ابناً مباشراً للكبسولة لقواعد وضع التطبيق).
              Premium = الزر الكبير في الشريط السفلي، والمفاتيح = بطاقة "مفاتيحك" في أول القائمة (KeysMenuCard). ===== */}
          <div className="me-2 ms-auto lg:hidden">
            <NotificationBell sheet />
          </div>
          <button
            ref={menuBtnRef}
            type="button"
            onPointerDown={() => loadHeaderOffers()}
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? t("header.menuClose") : t("nav.menu")}
            aria-expanded={open}
            aria-controls={MENU_ID}
            className="relative grid h-10 w-10 place-items-center rounded-xl border border-[var(--color-ink-line)] bg-[var(--fill)] text-[var(--text)] transition-colors hover:bg-[var(--fill-strong)] lg:hidden"
          >
            <AnimatePresence mode="wait" initial={false}>
              {open ? (
                <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
                  <X size={19} />
                </motion.span>
              ) : (
                <motion.span key="menu" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}>
                  <Menu size={19} />
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>

        {/* ===== ميغا مينيو الفئات (الحاسوب) ===== */}
        <CategoriesMega
          id={MEGA_ID}
          open={mega.open}
          categories={cats}
          counts={counts}
          focusFirst={megaFocus}
          onEnter={mega.enter}
          onLeave={mega.leave}
          onClose={closeMega}
        />
      </div>

      {/* القوائم العائمة — كلها عبر portal إلى body (خارج تحويلات الهيدر) */}
      <MobileMenu
        id={MENU_ID}
        open={open}
        onClose={() => setOpen(false)}
        onPremium={openPremium}
        onLogout={logout}
        onSearch={() => {
          setOpen(false);
          setSearchOpen(true);
        }}
        originRef={menuBtnRef}
        offersCount={offersCount}
      />
      <QuickSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </motion.header>
  );
}
