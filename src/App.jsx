import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "./lib/auth.jsx";
import { PremiumProvider } from "./lib/premium.jsx";
import { CategoriesProvider } from "./lib/categories.jsx";
import { VoteStatsProvider } from "./lib/voteStats.jsx";
import { useLocale } from "./lib/locale.jsx";
import { dirOf } from "./i18n/index.js";
import Home from "./pages/Home.jsx";
import StorePage from "./pages/StorePage.jsx";
import CategoryPage from "./pages/CategoryPage.jsx";
import CategoriesPage from "./pages/CategoriesPage.jsx";
import FavoritesPage from "./pages/FavoritesPage.jsx";
import Admin from "./pages/Admin.jsx";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import PaymentSuccess from "./pages/PaymentSuccess.jsx";
import PaymentCancel from "./pages/PaymentCancel.jsx";
import PaymentReturn from "./pages/PaymentReturn.jsx";
import PaymentReturnPaypal from "./pages/PaymentReturnPaypal.jsx";
import Privacy from "./pages/Privacy.jsx";
import AccountDeletion from "./pages/AccountDeletion.jsx";
import RequireAuth from "./components/auth/RequireAuth.jsx";
import BottomNav from "./components/BottomNav.jsx";
import PremiumModal from "./components/PremiumModal.jsx";

/** اللغة المقصودة من المسار: بادئة /en أو /fr، صفحات /store و/category بلا بادئة عربية، وإلا تبقى لغة المستخدم. */
function langFromPath(pathname, current) {
  if (pathname === "/en" || pathname.startsWith("/en/")) return "en";
  if (pathname === "/fr" || pathname.startsWith("/fr/")) return "fr";
  if (
    pathname.startsWith("/store/") ||
    pathname.startsWith("/category/") ||
    pathname.startsWith("/categories") ||
    pathname.startsWith("/favorites")
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
    <BrowserRouter>
      <AuthProvider>
        <PremiumProvider>
          <CategoriesProvider>
          <VoteStatsProvider>
          <RouteLangSync />
          <Routes>
          <Route path="/" element={<Home />} />

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
          {/* لوحة التحكم تبقى داكنة دائماً بغضّ النظر عن ثيم الموقع */}
          <Route
            path="/admin"
            element={
              <div className="dark" dir="rtl" lang="ar">
                <Admin />
              </div>
            }
          />
          <Route path="*" element={<Home />} />
          </Routes>
          <MobileBottomNav />
          </VoteStatsProvider>
          </CategoriesProvider>
        </PremiumProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
