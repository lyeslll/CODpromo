// ============================================================
//  CODpromo — سياق الفئات المشترك (المصدر الحقيقي: جدول categories)
//  يجلب الفئات مرّة واحدة ويوفّرها لكل واجهة المتجر (البطاقات/صفحة الشركة/
//  صفحة الفئة) لربط الشركات بفئاتها عبر category_id، مع fallback للنص الحر
//  القديم إن لم تُربَط بعد. آمن قبل تشغيل الهجرة: إن غاب الجدول تبقى القائمة فارغة.
// ============================================================

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { fetchCategories } from "./supabase.js";

const CategoriesContext = createContext({ categories: [], byId: {}, loading: true });

export function CategoriesProvider({ children }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchCategories()
      .then((d) => active && setCategories(Array.isArray(d) ? d : []))
      .catch(() => active && setCategories([])) // الجدول غير موجود بعد → نعتمد النص الحر
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const byId = useMemo(() => {
    const m = {};
    for (const c of categories) m[c.id] = c;
    return m;
  }, [categories]);

  const value = useMemo(() => ({ categories, byId, loading }), [categories, byId, loading]);
  return <CategoriesContext.Provider value={value}>{children}</CategoriesContext.Provider>;
}

export function useCategories() {
  return useContext(CategoriesContext);
}
