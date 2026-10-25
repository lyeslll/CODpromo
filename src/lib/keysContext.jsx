import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./auth.jsx";
import { usePremium } from "./premium.jsx";
import { usePricing } from "./pricing.jsx";
import { useAndroidApp } from "./androidApp.js";
import { demoKeys, fetchDiamondCode, fetchMyKeys, keysDemoOn, KEYS_DEMO, spendDiamondKey, syncKeysOrders } from "./keys.js";

const KeysContext = createContext({
  status: "loading",
  demo: false,
  balance: 0,
  unlocked: new Set(),
  history: [],
  credit: null,
  locked: null,
  pending: 0,
  showCredit: false,
  isOwned: () => false,
  codeFor: () => null,
  loadCode: async () => null,
  spend: async () => ({ status: "auth" }),
  refresh: async () => null,
  panelOpen: false,
  openPanel: () => {},
  closePanel: () => {},
});

/**
 * المفاتيح الماسية للواجهة كلها (الخادم يتحقق من كلش في use_diamond_key / get_diamond_code):
 *  status: loading | guest | hidden (Premium حقيقي: مدفوع / Stork / أدمن — ما يشوفش المفاتيح) | ok
 *  balance: الرصيد · unlocked: الشركات المفتوحة بمفتاح ماسي (مفتوحة عندو للأبد)
 *  credit: الرصيد اللي ينقص من Premium (الموقع برك: showCredit = false داخل التطبيق وقت الفحص)
 *  spend(companyId, source): استعمال مفتاح → ok / yours / free_key يحفظو الكود (codeFor)
 *  panelOpen / openPanel: لوحة الرصيد والتاريخ (العدّاد في الهيدر والداشبورد)
 * مول الهدية المؤقتة يشوف المفاتيح (يقدر يثبّت أكواد للأبد). المعاينة (KEYS_DEMO): بيانات تجريبية.
 */
export function KeysProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const { isPremiumActive, premiumReady } = usePremium();
  const pricing = usePricing();
  const appMode = useAndroidApp();
  const uid = user?.id || null;
  const [demoFlag] = useState(keysDemoOn);
  // build الإنتاج: KEYS_DEMO = false → المعاينة كاملة تتنحّى من الحزمة
  const demo = KEYS_DEMO && demoFlag;

  const [mine, setMine] = useState(null);
  const [mineFor, setMineFor] = useState(null);
  const [codes, setCodes] = useState({});
  const [demoState, setDemoState] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const synced = useRef(null);

  const refresh = useCallback(async () => {
    if (!uid || demo) return null;
    let d = null;
    try {
      d = await fetchMyKeys();
    } catch {
      d = null;
    }
    setMine(d);
    setMineFor(uid);
    return d;
  }, [uid, demo]);

  useEffect(() => {
    setCodes({});
    if (!uid) {
      setMine(null);
      setMineFor(null);
      return;
    }
    refresh();
  }, [uid, refresh]);

  // المعاينة: البيانات التجريبية تتبنى على السعر الحالي (الرصيد ينقص منو)
  useEffect(() => {
    if (demo && !demoState && pricing) setDemoState(demoKeys(pricing));
  }, [demo, demoState, pricing]);

  // دفع مفاتيح كمل والمتصفّح تسكّر قبل الرجوع: نعاودو نتحققو مرة وحدة (الموقع)
  useEffect(() => {
    if (demo || !uid || mineFor !== uid || appMode !== "web" || !(mine?.pending > 0) || synced.current === uid) return;
    synced.current = uid;
    syncKeysOrders()
      .then((r) => r?.paid > 0 && refresh())
      .catch(() => {});
  }, [demo, uid, mineFor, mine, appMode, refresh]);

  const spend = useCallback(
    async (companyId, source) => {
      if (demo) {
        const st = demoState || demoKeys(pricing);
        if (st.unlocked.includes(companyId)) return { status: "yours", premium_code: null, demo: true };
        if (st.balance < 1) return { status: "no_keys" };
        const next = {
          ...st,
          balance: st.balance - 1,
          unlocked: [...st.unlocked, companyId],
          history: [{ id: -Date.now(), kind: "use", delta: -1, created_at: new Date().toISOString(), company: null }, ...st.history],
        };
        setDemoState(next);
        return { status: "ok", premium_code: null, demo: true, balance: next.balance };
      }
      const r = await spendDiamondKey(companyId, source);
      if (["ok", "yours", "free_key"].includes(r?.status)) {
        setCodes((c) => ({ ...c, [companyId]: { premium_code: r.premium_code ?? null, premium_url: r.premium_url ?? null } }));
        if (r.status !== "free_key") {
          setMine((m) =>
            m ? { ...m, balance: Number(r.balance ?? m.balance), unlocked: m.unlocked.includes(companyId) ? m.unlocked : [...m.unlocked, companyId] } : m
          );
        }
        refresh();
      } else if (["no_keys", "has_premium", "auth"].includes(r?.status)) {
        refresh();
      }
      return r;
    },
    [demo, demoState, pricing, refresh]
  );

  const loadCode = useCallback(
    async (companyId) => {
      if (codes[companyId]) return codes[companyId];
      // المعاينة: كود تجريبي (الحقيقي ما يتقراش بلا مفتاح في القاعدة)
      if (demo) return { premium_code: "DEMO-KEY", premium_url: null };
      let d = null;
      try {
        d = await fetchDiamondCode(companyId);
      } catch {
        d = null;
      }
      if (d) setCodes((c) => ({ ...c, [companyId]: d }));
      return d;
    },
    [codes, demo]
  );

  const data = demo ? demoState : mineFor === uid ? mine : null;
  let status = "loading";
  if (demo) status = demoState ? "ok" : "loading";
  else if (!authLoading && premiumReady) {
    if (!uid) status = "guest";
    else if (isPremiumActive || data?.blocked) status = "hidden";
    else if (data?.status === "ok") status = "ok";
    else if (mineFor === uid) status = "guest";
  }

  const unlockedIds = data?.unlocked;
  const unlocked = useMemo(() => new Set(unlockedIds || []), [unlockedIds]);
  const isOwned = useCallback((id) => status === "ok" && unlocked.has(id), [status, unlocked]);
  const codeFor = useCallback((id) => codes[id] || null, [codes]);
  const openPanel = useCallback(() => setPanelOpen(true), []);
  const closePanel = useCallback(() => setPanelOpen(false), []);

  const value = useMemo(
    () => ({
      status,
      demo,
      balance: status === "ok" ? Number(data?.balance) || 0 : 0,
      unlocked,
      history: status === "ok" ? data?.history || [] : [],
      credit: status === "ok" ? data?.credit || null : null,
      locked: data?.locked ?? null,
      pending: data?.pending || 0,
      // الرصيد في Premium: الموقع برك (داخل التطبيق Premium بسعرو الكامل عبر Google Play، بلا أي ذكر)
      showCredit: appMode === "web",
      isOwned,
      codeFor,
      loadCode,
      spend,
      refresh,
      panelOpen,
      openPanel,
      closePanel,
    }),
    [status, demo, data, unlocked, appMode, isOwned, codeFor, loadCode, spend, refresh, panelOpen, openPanel, closePanel]
  );

  return <KeysContext.Provider value={value}>{children}</KeysContext.Provider>;
}

export const useKeys = () => useContext(KeysContext);
