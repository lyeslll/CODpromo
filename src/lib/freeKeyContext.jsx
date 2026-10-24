import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./auth.jsx";
import { usePremium } from "./premium.jsx";
import { fetchFreeKeyPublic, fetchMyFreeKey, claimFreeReveal, readFreeKeyParam, clearPendingFreeKey } from "./freeKey.js";

const FreeKeyContext = createContext({
  status: "loading",
  enabled: false,
  usedCompanyId: null,
  usedCompany: null,
  reveals: null,
  pendingId: null,
  claim: async () => ({ status: "auth" }),
  codeFor: () => null,
  takePending: () => false,
  refresh: async () => null,
});

/**
 * حالة المفتاح الذهبي للواجهة كلها (الخادم يتحقق من كلش في claim_free_reveal و get_premium_code):
 *  status: loading | off (الميزة موقوفة) | hidden (Premium مدفوع / هدية / أدمن: يشوف كلش)
 *          | guest | available | used
 *  usedCompanyId: الشركة اللي كشفها بمفتاحو — مكشوفة عندو ديما (حتى والميزة موقوفة).
 *  enabled: الميزة مفعّلة (الأزرار والقسم يبانو غير هكا).
 *  claim(companyId, source): استعمال المفتاح؛ ok / yours → الكود يتحفظ (codeFor) والحالة تولّي used.
 *  pendingId: شركة يرجع ليها الزائر بعد الدخول (?fk=<id> في الرابط)؛ البطاقة تاخذها بـ takePending(id).
 */
export function FreeKeyProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const { hasPremium, premiumReady } = usePremium();
  const location = useLocation();
  const navigate = useNavigate();
  const uid = user?.id || null;

  const [pub, setPub] = useState(null);
  const [mine, setMine] = useState(null);
  const [mineFor, setMineFor] = useState(null);
  const [codes, setCodes] = useState({});
  const [pendingId, setPendingId] = useState(null);
  const pendingRef = useRef(null);

  useEffect(() => {
    let active = true;
    fetchFreeKeyPublic()
      .then((d) => active && setPub(d || { enabled: false, reveals: null }))
      .catch(() => active && setPub({ enabled: false, reveals: null }));
    return () => {
      active = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!uid) return null;
    let d = null;
    try {
      d = (await fetchMyFreeKey()) || null;
    } catch {
      d = null;
    }
    setMine(d);
    setMineFor(uid);
    return d;
  }, [uid]);

  useEffect(() => {
    setCodes({});
    if (!uid) {
      setMine(null);
      setMineFor(null);
      return;
    }
    refresh();
  }, [uid, refresh]);

  // الرجوع بعد الدخول: ?fk=<id> → البطاقة تتعرّف وتفتح التأكيد، والرابط يتنظّف (refresh ما يعاودش)
  useEffect(() => {
    const id = readFreeKeyParam(location.search);
    if (!id) return;
    pendingRef.current = id;
    setPendingId(id);
    clearPendingFreeKey();
    const qs = new URLSearchParams(location.search);
    qs.delete("fk");
    const s = qs.toString();
    navigate(`${location.pathname}${s ? `?${s}` : ""}${location.hash}`, { replace: true });
  }, [location.search]); // eslint-disable-line react-hooks/exhaustive-deps

  const takePending = useCallback((id) => {
    if (!id || pendingRef.current !== id) return false;
    pendingRef.current = null;
    setPendingId(null);
    return true;
  }, []);

  const claim = useCallback(
    async (companyId, source) => {
      const r = await claimFreeReveal(companyId, source);
      if (r?.status === "ok" || r?.status === "yours") {
        setCodes((c) => ({ ...c, [companyId]: { premium_code: r.premium_code ?? null, premium_url: r.premium_url ?? null } }));
        setMine((m) => ({ ...(m || {}), status: "used", company_id: companyId, enabled: m?.enabled ?? true }));
        refresh();
      } else if (["used", "has_premium", "disabled", "auth"].includes(r?.status)) {
        refresh();
      }
      return r;
    },
    [refresh]
  );

  const codeFor = useCallback((companyId) => codes[companyId] || null, [codes]);

  const ready = !authLoading && pub !== null && (!uid || (mineFor === uid && premiumReady));
  const enabled = (uid && mineFor === uid && mine ? mine.enabled : pub?.enabled) === true;
  let status = "loading";
  if (ready) {
    if (!uid) status = enabled ? "guest" : "off";
    else if (hasPremium || mine?.status === "premium" || (mine?.status === "used" && mine.premium)) status = "hidden";
    else if (mine?.status === "used") status = "used";
    else if (enabled && mine?.status === "available") status = "available";
    else status = "off";
  }

  const value = useMemo(
    () => ({
      status,
      enabled,
      usedCompanyId: status === "used" ? mine?.company_id ?? null : null,
      usedCompany: status === "used" ? mine?.company ?? null : null,
      reveals: pub?.reveals ?? null,
      pendingId,
      claim,
      codeFor,
      takePending,
      refresh,
    }),
    [status, enabled, mine, pub, pendingId, claim, codeFor, takePending, refresh]
  );

  return <FreeKeyContext.Provider value={value}>{children}</FreeKeyContext.Provider>;
}

export const useFreeKey = () => useContext(FreeKeyContext);
