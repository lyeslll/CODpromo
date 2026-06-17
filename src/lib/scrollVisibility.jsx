import { createContext, useContext } from "react";
import { useScrollDirection } from "./useScrollDirection.js";

// ============================================================
//  CODpromo — مصدر الحقيقة الوحيد لحالة ظهور/اختفاء الهيدر.
//  يحسب الحالة مرّة واحدة (قاعدة بوكس البحث + قفل التحميل في التطبيق)
//  ويوفّرها للهيدر والقائمة السفلية معاً → مزامنة تامة بنفس التوقيت.
//  الهيدر هو المعيار؛ القائمة السفلية مجرّد مرآة تقرأ نفس الحالة.
// ============================================================
const ScrollVisibilityContext = createContext({ scrolled: false, hidden: false });

export function ScrollVisibilityProvider({ children }) {
  const value = useScrollDirection({ anchorSelector: "#search-anchor" });
  return (
    <ScrollVisibilityContext.Provider value={value}>
      {children}
    </ScrollVisibilityContext.Provider>
  );
}

export const useScrollVisibility = () => useContext(ScrollVisibilityContext);
