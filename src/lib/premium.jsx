import { createContext, useContext, useState, useCallback } from "react";
import { useAuth } from "./auth.jsx";
import { redeemStork } from "./stork.js";

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

const PremiumContext = createContext({
  unlocked: false,
  isPremiumActive: false,
  redeem: async () => ({ ok: false }),
});

export function PremiumProvider({ children }) {
  const { user, profile, refreshProfile } = useAuth();
  const [localUnlock, setLocalUnlock] = useState(read);

  // مفتوح إن كان الحساب Premium ساري المفعول، أو فُعّل كود في هذا المتصفّح
  const profileUnlock = isPremiumProfile(profile);
  const unlocked = profileUnlock || localUnlock;

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
    <PremiumContext.Provider value={{ unlocked, isPremiumActive: profileUnlock, redeem }}>
      {children}
    </PremiumContext.Provider>
  );
}

export const usePremium = () => useContext(PremiumContext);
