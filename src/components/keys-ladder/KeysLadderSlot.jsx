import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../lib/auth.jsx";
import { usePremium } from "../../lib/premium.jsx";
import { useKeys } from "../../lib/keysContext.jsx";
import { useFreeKey } from "../../lib/freeKeyContext.jsx";

// القسم كامل (رسم، CSS، الباقات) في chunk وحدو: يتحمّل غير كي يقرّب الزائر (ماشي مع أول الصفحة)
const KeysLadder = lazy(() => import("./KeysLadder.jsx"));

// طول القسم تقريباً (مقيس، px) حسب اللغة: باش المكان المحجوز يساوي القسم وروابط #categories و #how ما يتزحزحوش
const RESERVE = {
  wide: { ar: 1420, en: 1465, fr: 1525, twoTiers: -80 },
  narrow: { ar: 2260, en: 2345, fr: 2490, twoTiers: -500 },
};
const WIDE = "(min-width: 1024px)";

function reserveHeight(lang, golden) {
  const wide = typeof window !== "undefined" && window.matchMedia(WIDE).matches;
  const r = RESERVE[wide ? "wide" : "narrow"];
  return (r[lang] || r.ar) + (golden === false ? r.twoTiers : 0);
}

/**
 * بلاصة "سلّم المفاتيح" في الرئيسية: مكان محجوز بنفس الطول تقريباً حتى يقرّب الزائر (1200px)، ثم يتحمّل القسم.
 * Premium حقيقي (مدفوع / Stork / أدمن / شراء بالرصيد — نفس قاعدة /premium) → ما يتحمّل والو. المعاينة
 * (KEYS_DEMO) تبيّنو للكل، كيما قسم المفاتيح في /premium.
 */
export default function KeysLadderSlot() {
  const { i18n } = useTranslation();
  const { loading: authLoading } = useAuth();
  const { isPremiumActive, premiumReady } = usePremium();
  const keys = useKeys();
  const fk = useFreeKey();
  const ref = useRef(null);
  const [near, setNear] = useState(false);
  const member = !keys.demo && !authLoading && premiumReady && (isPremiumActive || keys.status === "hidden");
  const golden = fk.status === "loading" ? null : fk.enabled && ["guest", "available", "used"].includes(fk.status);

  useEffect(() => {
    if (member || near) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        setNear(true);
        io.disconnect();
      },
      { rootMargin: "1200px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [member, near]);

  if (member) return null;
  const reserve = reserveHeight(i18n.language, golden);
  const placeholder = <div ref={ref} aria-hidden style={{ minHeight: reserve }} />;
  if (!near) return placeholder;
  return (
    <Suspense fallback={placeholder}>
      <KeysLadder reserve={reserve} />
    </Suspense>
  );
}
