// ============================================================
//  CODpromo — سعر الدفعة الوحدة (Premium مدى الحياة) — للعرض فقط
//  المصدر: RPC pricing_public() (جدول pricing_settings + المقاعد المباعة بسعر الإطلاق).
//  المبلغ الموثوق يتقرّر في الخادم (Edge Functions) عند إنشاء الدفع، أبداً هنا.
//  كي يكمّلو مقاعد الإطلاق، tier = "regular" والسعر العادي يبان وحدو في كل بلاصة.
// ============================================================
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "./supabaseClient.js";
import { formatNumber } from "./values.js";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** { tier, isLaunch, usd, dzd, launchUsd, launchDzd, regularUsd, regularDzd, seatsTotal, seatsLeft } أو null. */
export async function fetchPricing() {
  const { data, error } = await supabase.rpc("pricing_public");
  if (error || !data) return null;
  const isLaunch = data.tier === "launch";
  return {
    tier: isLaunch ? "launch" : "regular",
    isLaunch,
    usd: num(data.price_usd),
    dzd: num(data.price_dzd),
    launchUsd: num(data.launch_usd),
    launchDzd: num(data.launch_dzd),
    regularUsd: num(data.regular_usd),
    regularDzd: num(data.regular_dzd),
    seatsTotal: num(data.seats_total) ?? 0,
    seatsLeft: num(data.seats_left) ?? 0,
  };
}

/** "9,900 دج (39$)" — نفس الكتابة في كل الموقع (المفتاح pricing.format). */
export function formatPrice(t, lang, dzd, usd) {
  if (dzd == null || usd == null) return "";
  return t("pricing.format", { dzd: formatNumber(dzd, lang), usd: formatNumber(usd, lang) });
}

const PricingContext = createContext({ pricing: null, ready: false, refresh: async () => null });

/** يجيب السعر مرة عند التحميل، ويعاود كي يرجع الزائر للتبويب (مرة في الدقيقة كأقصى) باش العدّاد يبقى حقيقي. */
export function PricingProvider({ children }) {
  const [pricing, setPricing] = useState(null);
  const [ready, setReady] = useState(false);
  const last = useRef(0);

  const refresh = useCallback(async () => {
    last.current = Date.now();
    const p = await fetchPricing().catch(() => null);
    if (p) setPricing(p);
    setReady(true);
    return p;
  }, []);

  useEffect(() => {
    refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - last.current > 60000) refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  return <PricingContext.Provider value={{ pricing, ready, refresh }}>{children}</PricingContext.Provider>;
}

/** السعر الحالي (null حتى يوصل من الخادم — الواجهة تخبّي السعر بلا رقم وهمي). */
export const usePricing = () => useContext(PricingContext).pricing;
export const usePricingRefresh = () => useContext(PricingContext).refresh;
