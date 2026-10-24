import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "./auth.jsx";
import { redeemStork } from "./stork.js";
import { fetchMyGift, isGiftActive } from "./gifts.js";

const KEY = "codpromo:premium-unlock";
const read = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};
const write = (v) => {
  try {
    if (v) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    /* تجاهل آمن */
  }
};

// اشتراك Premium نشط حسب الملف الشخصي (مصدر الحقيقة الخادمي): is_premium=true
// و premium_until في المستقبل (أو غير محدّد). يُستعمل لمنع الدفع المزدوج.
export const isPremiumProfile = (p) =>
  !!(p?.is_premium && (!p.premium_until || new Date(p.premium_until) > new Date()));

// Premium مدى الحياة (نفس قاعدة الخادم has_premium_access): الأدمن، أو اللي شرى بالدفعة الوحدة
// (plan_type = 'lifetime' بلا تاريخ نهاية — الحقلين محميين من العميل بـ protect_premium_columns).
export const isAdminProfile = (p) => p?.is_admin === true;
export const isLifetimeProfile = (p) =>
  isAdminProfile(p) || (p?.is_premium === true && p?.plan_type === "lifetime" && !p?.premium_until);

// أقصى مهلة لـ setTimeout (~24 يوماً)
const MAX_TIMEOUT = 2147483647;

const PremiumContext = createContext({
  unlocked: false,
  hasPremium: false,
  isPremiumActive: false,
  isLifetime: false,
  isGift: false,
  gift: null,
  premiumReady: true,
  refreshGift: async () => null,
  redeem: async () => ({ ok: false }),
});

/**
 * مصدر Premium الموحّد للواجهة (نفس قاعدة الخادم has_premium_access):
 *  - hasPremium: Premium مدفوع ساري، أو أدمن، أو هدية نشطة → كل بلاصة تشيك Premium تستعمله
 *    (البطاقات، الخدش، /go، الهيدر، الداشبورد…).
 *  - isPremiumActive: اشتراك من الملف (مدفوع / Stork) أو أدمن برك — لحارس الدفع المزدوج في PremiumModal
 *    (مول الهدية يقدر يشترك).
 *  - isGift: Premium جاي من هدية (بلا اشتراك)، و gift = { premium_until, duration_days, revoked, active }.
 *  - premiumReady: انتهى جلب الملف والهدية (قبل الحكم على الوصول، مثلاً في /go).
 */
export function PremiumProvider({ children }) {
  const { user, profile, profileLoaded, refreshProfile } = useAuth();
  const [localUnlock, setLocalUnlock] = useState(read);
  const [gift, setGift] = useState(null);
  const [giftFor, setGiftFor] = useState(null); // الحساب اللي تجابت هديته
  const [, setTick] = useState(0);
  const uid = user?.id || null;
  const lastFetch = useRef(0);

  const refreshGift = useCallback(async () => {
    if (!uid) return null;
    lastFetch.current = Date.now();
    let g = null;
    try {
      g = (await fetchMyGift()) || null;
    } catch {
      g = null;
    }
    setGift(g);
    setGiftFor(uid);
    return g;
  }, [uid]);

  useEffect(() => {
    if (!uid) {
      setGift(null);
      setGiftFor(null);
      return;
    }
    refreshGift();
  }, [uid, refreshGift]);

  // الرجوع للتبويب: نعاود نجيب الهدية (سحب من الأدمن يبان بلا إعادة تحميل)، مرة في الدقيقة كأقصى
  useEffect(() => {
    if (!uid) return;
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastFetch.current > 60000) refreshGift();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [uid, refreshGift]);

  const giftActive = giftFor === uid && isGiftActive(gift);

  // كي تكمل مدّة الهدية الواجهة ترجع عادي وحدها (بلا إعادة تحميل)
  useEffect(() => {
    if (!giftActive) return;
    const ms = new Date(gift.premium_until) - Date.now();
    const id = setTimeout(() => setTick((n) => n + 1), Math.min(Math.max(ms, 0) + 500, MAX_TIMEOUT));
    return () => clearTimeout(id);
  }, [giftActive, gift]);

  // مفتوح إن كان الحساب Premium ساري المفعول (أو أدمن، أو هدية نشطة)، أو فُعّل كود في هذا المتصفّح
  const isLifetime = isLifetimeProfile(profile);
  const profileUnlock = isLifetime || isPremiumProfile(profile);
  const hasPremium = profileUnlock || giftActive;
  const unlocked = hasPremium || localUnlock;
  const premiumReady = !user || (profileLoaded && giftFor === uid);

  const redeem = useCallback(
    async (code) => {
      const res = await redeemStork(code, user?.id);
      if (res.ok) {
        setLocalUnlock(true);
        write(true);
        if (user) refreshProfile?.();
      }
      return res;
    },
    [user, refreshProfile]
  );

  return (
    <PremiumContext.Provider
      value={{
        unlocked,
        hasPremium,
        isPremiumActive: profileUnlock,
        isLifetime,
        isGift: giftActive && !profileUnlock,
        gift: giftFor === uid ? gift : null,
        premiumReady,
        refreshGift,
        redeem,
      }}
    >
      {children}
    </PremiumContext.Provider>
  );
}

export const usePremium = () => useContext(PremiumContext);
