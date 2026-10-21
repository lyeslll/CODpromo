import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import { AuthProvider } from "./lib/auth.jsx";
import { PremiumProvider } from "./lib/premium.jsx";
import { CategoriesProvider } from "./lib/categories.jsx";
import { VoteStatsProvider } from "./lib/voteStats.jsx";
import { ScrollVisibilityProvider } from "./lib/scrollVisibility.jsx";
import { useLocale } from "./lib/locale.jsx";
import { dirOf } from "./i18n/index.js";
import Home from "./pages/Home.jsx";
import RequireAuth from "./components/auth/RequireAuth.jsx";
import CursorGlow from "./components/CursorGlow.jsx";
import { reloadIfUpdatePending } from "./lib/swAutoReload.js";
import AppBanner from "./components/app/AppBanner.jsx";

// باقي الصفحات تُحمَّل عند زيارتها فقط (حزمة الصفحة الرئيسية أخفّ)
const StorePage = lazy(() => import("./pages/StorePage.jsx"));
const CategoryPage = lazy(() => import("./pages/CategoryPage.jsx"));
const CategoriesPage = lazy(() => import("./pages/CategoriesPage.jsx"));
const FavoritesPage = lazy(() => import("./pages/FavoritesPage.jsx"));
const OffersPage = lazy(() => import("./pages/OffersPage.jsx"));
const Admin = lazy(() => import("./pages/Admin.jsx"));
const Login = lazy(() => import("./pages/Login.jsx"));
const Signup = lazy(() => import("./pages/Signup.jsx"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword.jsx"));
const ResetPassword = lazy(() => import("./pages/ResetPassword.jsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess.jsx"));
const PaymentCancel = lazy(() => import("./pages/PaymentCancel.jsx"));
const PaymentReturn = lazy(() => import("./pages/PaymentReturn.jsx"));
const PaymentReturnPaypal = lazy(() => import("./pages/PaymentReturnPaypal.jsx"));
const Privacy = lazy(() => import("./pages/Privacy.jsx"));
const AccountDeletion = lazy(() => import("./pages/AccountDeletion.jsx"));

/** مؤشّر تحميل الصفحة (نفس حلقة شاشة البداية). */
function PageFallback() {
  return (
    <div className="grid min-h-screen place-items-center bg-[var(--color-ink)]">
      <div className="h-11 w-11 animate-spin rounded-full border-[3px] border-[var(--color-ink-line)] border-t-[var(--color-lime)]" />
    </div>
  );
}
import BottomNav from "./components/BottomNav.jsx";
import PremiumModal from "./components/PremiumModal.jsx";

/** اللغة المقصودة من المسار: بادئة /en أو /fr، صفحات /store و/category و/offers بلا بادئة عربية، وإلا تبقى لغة المستخدم. */
function langFromPath(pathname, current) {
  if (pathname === "/en" || pathname.startsWith("/en/")) return "en";
  if (pathname === "/fr" || pathname.startsWith("/fr/")) return "fr";
  if (
    pathname.startsWith("/store/") ||
    pathname.startsWith("/category/") ||
    pathname.startsWith("/categories") ||
    pathname.startsWith("/favorites") ||
    pathname.startsWith("/offers")
  )
    return "ar";
  return current;
}

/**
 * مصدر الحقيقة الوحيد لاتجاه/لغة <html>: يضبطهما عند كل تغيير مسار،
 * بما في ذلك زر الرجوع/التقدّم في المتصفح (popstate) — يصلح انعكاس RTL/LTR.
 */
function RouteLangSync() {
  const { pathname } = useLocation();
  const { lang, setLang } = useLocale();

  // نسخة جديدة من الموقع تنتظر؟ نحمّلها عند هذا التنقّل (لحظة آمنة — الصفحة تتبدّل أصلاً)
  const firstPath = useRef(true);
  useEffect(() => {
    if (firstPath.current) {
      firstPath.current = false;
      return;
    }
    reloadIfUpdatePending();
  }, [pathname]);

  useEffect(() => {
    const desired = langFromPath(pathname, lang);
    if (desired !== lang) setLang(desired); // يحدّث i18n + ترجمات الواجهة
    const root = document.documentElement;
    root.setAttribute("lang", desired);
    root.setAttribute("dir", dirOf(desired));
  }, [pathname, lang, setLang]);

  return null;
}

/**
 * شريط التنقّل السفلي العام (هاتف فقط) + نافذة Premium التي يفتحها زره المركزي.
 * مخفي على لوحة الأدمن. يضيف صنفاً للـ body ليحجز مسافة سفلية للمحتوى (index.css).
 */
function MobileBottomNav() {
  const { pathname } = useLocation();
  const [premiumOpen, setPremiumOpen] = useState(false);
  const enabled = !pathname.startsWith("/admin");

  useEffect(() => {
    document.body.classList.toggle("has-bottom-nav", enabled);
    return () => document.body.classList.remove("has-bottom-nav");
  }, [enabled]);

  if (!enabled) return null;
  return (
    <>
      <BottomNav onPremium={() => setPremiumOpen(true)} />
      <PremiumModal open={premiumOpen} onClose={() => setPremiumOpen(false)} />
    </>
  );
}

export default function App() {
  // كشف وضع التطبيق (Android TWA / standalone) مرّة واحدة عند التحميل:
  // نضيف صنف is-twa-app على <body> لتفعيل هيدر مدمج خاص بالتطبيق (CSS في index.css).
  // في المتصفح العادي/سطح المكتب لا يُضاف الصنف → صفر تغيير.
  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      window.navigator.standalone === true;
    if (standalone) document.body.classList.add("is-twa-app");
  }, []);

  return (
    // reducedMotion="user": مع prefers-reduced-motion تتوقف حركات التحويل/الإزاحة في كل الموقع
    <MotionConfig reducedMotion="user">
    <BrowserRouter>
      <AuthProvider>
        <PremiumProvider>
          <CategoriesProvider>
          <VoteStatsProvider>
          <ScrollVisibilityProvider>
          <RouteLangSync />
          <AppBanner />
          <Suspense fallback={<PageFallback />}>
          <Routes>
          <Route path="/" element={<Home />} />

          {/* كل العروض + الفلاتر (الفلاتر في الرابط: ?type=&category=&mode=&sort=&q=) */}
          <Route path="/offers" element={<OffersPage lang="ar" />} />
          <Route path="/en/offers" element={<OffersPage lang="en" />} />
          <Route path="/fr/offers" element={<OffersPage lang="fr" />} />

          {/* صفحات الشركات (SEO) — العربية افتراضية، en/fr ببادئة لغة */}
          <Route path="/store/:slug" element={<StorePage lang="ar" />} />
          <Route path="/en/store/:slug" element={<StorePage lang="en" />} />
          <Route path="/fr/store/:slug" element={<StorePage lang="fr" />} />

          {/* صفحات الفئات (SEO) */}
          <Route path="/category/:slug" element={<CategoryPage lang="ar" />} />
          <Route path="/en/category/:slug" element={<CategoryPage lang="en" />} />
          <Route path="/fr/category/:slug" element={<CategoryPage lang="fr" />} />

          {/* صفحة كل الفئات (SEO) */}
          <Route path="/categories" element={<CategoriesPage lang="ar" />} />
          <Route path="/en/categories" element={<CategoriesPage lang="en" />} />
          <Route path="/fr/categories" element={<CategoriesPage lang="fr" />} />

          {/* صفحة المفضّلة (خاصة بالمستخدم — noindex، تبديل لغة فقط) */}
          <Route path="/favorites" element={<FavoritesPage lang="ar" />} />
          <Route path="/en/favorites" element={<FavoritesPage lang="en" />} />
          <Route path="/fr/favorites" element={<FavoritesPage lang="fr" />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/payment-success" element={<PaymentSuccess />} />
          <Route path="/payment-cancel" element={<PaymentCancel />} />
          <Route path="/payment-return" element={<PaymentReturn />} />
          <Route path="/payment-return-paypal" element={<PaymentReturnPaypal />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/account-deletion" element={<AccountDeletion />} />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            }
          />
          {/* لوحة التحكم عربية RTL ثابتة (الموقع كله داكن) */}
          <Route
            path="/admin"
            element={
              <div dir="rtl" lang="ar">
                <Admin />
              </div>
            }
          />
          <Route path="*" element={<Home />} />
          </Routes>
          </Suspense>
          <MobileBottomNav />
          <CursorGlow />
          </ScrollVisibilityProvider>
          </VoteStatsProvider>
          </CategoriesProvider>
        </PremiumProvider>
      </AuthProvider>
    </BrowserRouter>
    </MotionConfig>
  );
}
