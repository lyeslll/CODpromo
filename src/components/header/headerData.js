import { useEffect, useRef, useState } from "react";
import { fetchCompanies, fetchOffersCount } from "../../lib/supabase.js";
import { fetchSiteStats } from "../../lib/siteStats.js";

// ============================================================
//  بيانات الهيدر المشتركة — تُجلب مرّة واحدة في الجلسة (ذاكرة على مستوى الوحدة):
//   - العروض (للبحث السريع وعدد العروض في كل فئة) — فقط عند فتح القائمة/البحث.
//   - عدد الشركات لشارة "العروض" (= عدد البطاقات في /offers) — عدّ الشركات الظاهرة (بلا المخفية).
// ============================================================

let offersCache = null;
let offersPromise = null;

export function loadHeaderOffers() {
  if (offersCache) return Promise.resolve(offersCache);
  if (!offersPromise) {
    offersPromise = fetchCompanies()
      .then((d) => (offersCache = Array.isArray(d) ? d : []))
      .catch(() => {
        offersPromise = null;
        return [];
      });
  }
  return offersPromise;
}

/** العروض لاستعمالات الهيدر — لا تُجلب إلا حين enabled (قائمة مفتوحة / بحث). */
export function useHeaderOffers(enabled) {
  const [list, setList] = useState(() => offersCache || []);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    loadHeaderOffers().then((d) => active && setList(d));
    return () => {
      active = false;
    };
  }, [enabled]);
  return list;
}

let statsPromise = null;
let countPromise = null;

/**
 * عدد العروض = عدد البطاقات في /offers (الشركات الظاهرة للزوار، بلا المخفية)، أو null.
 * قبل كان site_stats.partners_count (يحسب حتى المخفية: 28 في الهيدر و 27 في الصفحة).
 */
export function useOffersCount() {
  const [count, setCount] = useState(null);
  useEffect(() => {
    let active = true;
    if (!countPromise) {
      countPromise = fetchOffersCount().catch(() => {
        countPromise = null;
        return null;
      });
    }
    countPromise.then((n) => active && setCount(n));
    return () => {
      active = false;
    };
  }, []);
  return count;
}

/** أرقام site_stats كاملة (نفس الطلب المشترك المخزّن)، أو null. */
export function useSharedStats() {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    let active = true;
    if (!statsPromise) statsPromise = fetchSiteStats().catch(() => null);
    statsPromise.then((s) => active && setStats(s));
    return () => {
      active = false;
    };
  }, []);
  return stats;
}

/** فتح/إغلاق بالمرور (مع تأخير صغير يمنع الوميض) وبالنقر. */
export function useHoverMenu() {
  const [open, setOpen] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const later = (v, ms) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(v), ms);
  };
  const now = (v) => {
    clearTimeout(timer.current);
    setOpen(v);
  };
  return {
    open,
    enter: () => later(true, 90),
    leave: () => later(false, 180),
    show: () => now(true),
    toggle: () => now(!open),
    close: () => now(false),
  };
}

/** اسم العرض وأول حرف للمستخدم. */
export function userDisplay(user, fallback) {
  const name = user?.user_metadata?.full_name || user?.email || fallback;
  const initial = (name || "؟").trim().charAt(0).toUpperCase();
  return { name, initial };
}
