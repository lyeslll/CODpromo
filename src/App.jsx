import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./lib/auth.jsx";
import { PremiumProvider } from "./lib/premium.jsx";
import Home from "./pages/Home.jsx";
import StorePage from "./pages/StorePage.jsx";
import CategoryPage from "./pages/CategoryPage.jsx";
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
import RequireAuth from "./components/auth/RequireAuth.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PremiumProvider>
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
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/payment-success" element={<PaymentSuccess />} />
          <Route path="/payment-cancel" element={<PaymentCancel />} />
          <Route path="/payment-return" element={<PaymentReturn />} />
          <Route path="/payment-return-paypal" element={<PaymentReturnPaypal />} />
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
        </PremiumProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
