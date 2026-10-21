// ============================================================
//  CODpromo — أرقام الصفحة الرئيسية (جدول site_stats + view site_stats_public)
//  القراءة عامة عبر الـ view: كل خانة فارغة تُحسب خادمياً بعدّ دقيق
//  (عدد الأكواد/الشركاء)، والقيمتان الماليتان تبقيان null إن لم تُضبطا فتُخفى.
//  الكتابة للأدمن فقط (RLS عبر public.is_admin()) بجلسة المستخدم.
// ============================================================

import { supabase } from "./supabaseClient.js";
import { USD_PLANS } from "./plans.js";

export const SITE_STAT_FIELDS = [
  "total_savings_dzd",
  "total_codes",
  "partners_count",
  "premium_unlock_value_usd",
  "users_count",
  "audience_followers",
];

const num = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** الأرقام كما تُعرض في الموقع (القيمة اليدوية، وإلا العدّ التلقائي). null عند التعذّر. */
export async function fetchSiteStats() {
  const { data, error } = await supabase.from("site_stats_public").select("*").maybeSingle();
  if (error || !data) return null;
  return {
    totalSavingsDzd: num(data.total_savings_dzd),
    totalCodes: num(data.total_codes),
    partnersCount: num(data.partners_count),
    premiumUnlockValueUsd: num(data.premium_unlock_value_usd),
    usersCount: num(data.users_count),
    audienceFollowers: num(data.audience_followers),
  };
}

/** للأدمن: القيم اليدوية الخام + قيم العدّ التلقائي (تلميح بجانب كل خانة). */
export async function fetchSiteStatsAdmin() {
  const [raw, pub] = await Promise.all([
    supabase.from("site_stats").select("*").eq("id", 1).maybeSingle(),
    supabase.from("site_stats_public").select("total_codes_auto,partners_count_auto,users_count_auto").maybeSingle(),
  ]);
  if (raw.error) throw new Error(raw.error.message);
  return { values: raw.data || {}, auto: pub.data || {} };
}

/**
 * للأدمن: يحفظ الأرقام (خانة فارغة = null = تلقائي أو مخفي).
 * يرمي Error("not-allowed") إن رفضت RLS التعديل (الحساب ليس أدمن).
 */
export async function updateSiteStats(values) {
  const patch = {};
  for (const k of SITE_STAT_FIELDS) patch[k] = num(values[k]);
  const { data, error } = await supabase.from("site_stats").update(patch).eq("id", 1).select();
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("not-allowed");
  return data[0];
}

/** سعر الاشتراك الشهري بالدولار — من باقات الدفع الموجودة (plans.js)، لا يُكتب يدوياً. */
export const monthlyUsdPrice = () => USD_PLANS.find((p) => p.key === "month")?.price ?? null;

/** مضاعف Premium = قيمة الخصومات التي يفتحها ÷ سعر الشهر. null إن نقصت قيمة. */
export function premiumMultiplier(unlockValueUsd, price = monthlyUsdPrice()) {
  if (!unlockValueUsd || !price) return null;
  const x = Math.floor(unlockValueUsd / price);
  return x >= 1 ? x : null;
}
