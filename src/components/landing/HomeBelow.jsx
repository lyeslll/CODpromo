import { useEffect } from "react";
import NameStory from "./NameStory.jsx";
import Pillars from "./Pillars.jsx";
import CardAnatomy from "./CardAnatomy.jsx";
import PremiumCompare from "./PremiumCompare.jsx";
import GoldenKeySection from "../freekey/GoldenKeySection.jsx";
import KeysLadderSlot from "../keys-ladder/KeysLadderSlot.jsx";
import CategoryGrid from "./CategoryGrid.jsx";
import HowSteps from "./HowSteps.jsx";
import TrustSection from "./TrustSection.jsx";
import SampleOffers from "./SampleOffers.jsx";
import ComingSoonStrip from "../coming-soon/ComingSoonStrip.jsx";
import NocodeSection from "../nocode/NocodeSection.jsx";
import AppDownload from "./AppDownload.jsx";
import PremiumFaq from "./PremiumFaq.jsx";

// ============================================================
//  أقسام الرئيسية تحت أول شاشة (من NameStory حتى PremiumFaq).
//  chunk وحدو يتحمّل مباشرة بعد أول رسم (ماشي كي يقرب الزائر) → الحزمة الأولى أخف،
//  والأقسام تبقى في الصفحة لـ Google. onReady = باش روابط #how و #categories تلقى القسم.
// ============================================================
export default function HomeBelow({
  companies,
  voteStats,
  cats,
  counts,
  siteStats,
  anatomyCompany,
  compareCompany,
  featuredIds,
  favorites,
  toggleFav,
  handleCopy,
  unlocked,
  goPremium,
  hasPremium,
  pricing,
  onReady,
}) {
  useEffect(() => {
    onReady?.();
  }, [onReady]);

  return (
    <>
      <NameStory />
      <Pillars companies={companies} voteStats={voteStats} />
      <CardAnatomy
        company={anatomyCompany}
        isFavorite={anatomyCompany ? favorites.includes(anatomyCompany.id) : false}
        onToggleFav={toggleFav}
        onCopy={handleCopy}
        unlocked={unlocked}
        onUnlock={goPremium}
      />
      <PremiumCompare company={compareCompany} stats={siteStats} onOpenPremium={goPremium} isPremiumActive={hasPremium} />
      <GoldenKeySection companies={companies} preferred={compareCompany} onOpenPremium={goPremium} />
      <KeysLadderSlot />
      <CategoryGrid categories={cats} counts={counts} />
      <HowSteps />
      <TrustSection companies={companies} voteStats={voteStats} />
      <SampleOffers
        companies={companies}
        exclude={featuredIds}
        voteStats={voteStats}
        favorites={favorites}
        onToggleFav={toggleFav}
        onCopy={handleCopy}
        unlocked={unlocked}
        onUnlock={goPremium}
      />
      <ComingSoonStrip />
      <NocodeSection unlocked={unlocked} onUnlock={goPremium} />
      <AppDownload />
      <PremiumFaq pricing={pricing} />
    </>
  );
}
