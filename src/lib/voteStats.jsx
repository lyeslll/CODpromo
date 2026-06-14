// ============================================================
//  CODpromo — سياق إحصائيات التصويت المشترك
//  يجلب خريطة إحصائيات الأكواد مرّة واحدة ويوفّرها لكل البطاقات
//  (الرئيسية/الفئة/الشركة/المفضّلة) بلا تمرير props عبر الصفحات.
//  آمن قبل تشغيل الهجرة: إن غاب الـ view تبقى الخريطة فارغة (لا تصويت يظهر).
// ============================================================

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { fetchVoteStats, topSuccessId } from "./votes.js";

const VoteStatsContext = createContext({
  stats: {},
  topId: null,
  loading: true,
  setCompanyCounts: () => {},
});

export function VoteStatsProvider({ children }) {
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchVoteStats()
      .then((m) => active && setStats(m || {}))
      .catch(() => active && setStats({}))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  // تحديث عدّادات شركة بعد تصويت (تفاؤلي ثم بقيمة الخادم الموثوقة).
  const setCompanyCounts = useCallback((companyId, up, down) => {
    setStats((prev) => {
      const upN = Number(up) || 0;
      const downN = Number(down) || 0;
      const total = upN + downN;
      const rate = total ? Math.round((100 * upN) / total) : 0;
      const prevRow = prev[companyId] || {};
      const grew = upN > (prevRow.up_count || 0);
      return {
        ...prev,
        [companyId]: {
          up_count: upN,
          down_count: downN,
          total_count: total,
          success_rate: rate,
          // آخر نجاح: نحدّثه عند ازدياد 👍، وإلا نبقي القيمة السابقة.
          last_up_at: grew ? new Date().toISOString() : prevRow.last_up_at || null,
        },
      };
    });
  }, []);

  const topId = useMemo(() => topSuccessId(stats, 3), [stats]);

  const value = useMemo(
    () => ({ stats, topId, loading, setCompanyCounts }),
    [stats, topId, loading, setCompanyCounts]
  );
  return <VoteStatsContext.Provider value={value}>{children}</VoteStatsContext.Provider>;
}

export function useVoteStats() {
  return useContext(VoteStatsContext);
}
