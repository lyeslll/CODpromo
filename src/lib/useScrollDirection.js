import { useEffect, useState, useRef } from "react";

// ============================================================
//  CODpromo — منطق إخفاء/إظهار حسب اتجاه التمرير (مشترك)
//  يستعمله الهيدر وشريط التنقّل السفلي معاً ليتزامنا:
//   - قرب الأعلى → ظاهر دائماً
//   - نزول → hidden=true
//   - صعود → hidden=false (فوراً)
//  عتبة 4px تمنع الاهتزاز. scrolled لاستعمالات الهيدر الزجاجية.
// ============================================================
export function useScrollDirection() {
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 12);
      if (y < 80) setHidden(false);
      else if (y > lastY.current + 4) setHidden(true);
      else if (y < lastY.current - 4) setHidden(false);
      lastY.current = y;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return { scrolled, hidden };
}
