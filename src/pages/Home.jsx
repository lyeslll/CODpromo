import { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { fetchCompanies } from "../lib/supabase.js";
import { offersPath } from "../lib/seo.js";
import Navbar from "../components/Navbar.jsx";
import PremiumModal from "../components/PremiumModal.jsx";
import Hero from "../components/Hero.jsx";
import CategoryBrowse from "../components/CategoryBrowse.jsx";
import HowItWorks from "../components/HowItWorks.jsx";
import Footer from "../components/Footer.jsx";
import EmailPopup from "../components/EmailPopup.jsx";

export default function Home() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [premiumModal, setPremiumModal] = useState(false);
  const [companies, setCompanies] = useState([]);

  // الروابط القديمة لقسم العروض في الرئيسية (/#stores) تتحوّل لصفحة /offers
  useEffect(() => {
    if (location.hash === "#stores") navigate(offersPath(i18n.language), { replace: true });
  }, [location.hash, navigate, i18n.language]);

  useEffect(() => {
    fetchCompanies()
      .then((data) => setCompanies(Array.isArray(data) ? data : []))
      .catch(() => setCompanies([]));
  }, []);

  const stats = useMemo(
    () => ({ codes: companies.length || 0, stores: companies.length || 0, rating: "4.9" }),
    [companies]
  );

  return (
    <div className="min-h-screen bg-[var(--color-ink)] text-[var(--text)]">
      <Navbar onPremium={() => setPremiumModal(true)} />
      <Hero stats={stats} onExplore={() => navigate(offersPath(i18n.language))} />
      <CategoryBrowse companies={companies} />
      <HowItWorks />
      <Footer onPremium={() => setPremiumModal(true)} />
      <PremiumModal open={premiumModal} onClose={() => setPremiumModal(false)} />
      <EmailPopup />
    </div>
  );
}
