import { useEffect, useRef } from "react";

// ============================================================
//  زر الرجوع (Android / التطبيق / المتصفح) يسكّر النافذة المحلولة بلاصة ما يخرج من الصفحة.
//  كي تتحلّ: نزيدو سطر في التاريخ (نفس الرابط). الرجوع يحيّدو → نسكّرو. كي تتسكّر بزرّ (ماشي بالرجوع)
//  ومازال سطرنا هو الأخير: نحيّدوه (history.back) باش ما يبقاش رجوع "فارغ".
//  إذا تبدّلت الصفحة وهي محلولة (رابط داخل القائمة) ما نمسّوش التاريخ.
// ============================================================
export function useBackToClose(open, onClose) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const id = `ov-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const href = window.location.href;
    try {
      window.history.pushState({ ...(window.history.state || {}), __overlay: id }, "", href);
    } catch {
      return;
    }
    let popped = false;
    const onPop = () => {
      popped = true;
      closeRef.current?.();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (!popped && window.history.state?.__overlay === id && window.location.href === href) window.history.back();
    };
  }, [open]);
}
