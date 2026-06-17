import { useEffect, useState, useRef } from "react";

// ============================================================
//  CODpromo — منطق إخفاء/إظهار حسب اتجاه التمرير (مشترك)
//  يستعمله الهيدر وشريط التنقّل السفلي معاً ليتزامنا:
//   - قرب الأعلى → ظاهر دائماً
//   - نزول → hidden=true
//   - صعود → hidden=false (فوراً)
//  عتبة 4px تمنع الاهتزاز. scrolled لاستعمالات الهيدر الزجاجية.
//
//  خيار anchorSelector (يستعمله الهيدر فقط): مرساة = بوكس البحث في الهيرو.
//   - ما دمنا فوق المرساة (لسا تحت الهيدر) → ظاهر دائماً حتى عند النزول.
//   - من المرساة وتحت → السلوك العادي: نزول=اختفاء، صعود=ظهور.
//   إن لم توجد المرساة في الصفحة → نرجع للسلوك الافتراضي (لا نكسر شيئاً).
// ============================================================
export function useScrollDirection({ anchorSelector } = {}) {
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 12);

      const anchor = anchorSelector ? document.querySelector(anchorSelector) : null;
      if (anchor) {
        // قاعدة بوكس البحث
        const headerEl = document.getElementById("top");
        const headerH = headerEl ? headerEl.getBoundingClientRect().height : 72;
        const sbTop = anchor.getBoundingClientRect().top;
        if (sbTop > headerH) {
          // بوكس البحث لسا تحت الهيدر → احنا فوقو → ظاهر دائماً
          setHidden(false);
        } else if (y > lastY.current + 4) {
          setHidden(true); // نزول = اختفاء
        } else if (y < lastY.current - 4) {
          setHidden(false); // صعود = ظهور
        }
      } else {
        // السلوك الافتراضي (بلا تغيير) — صفحات بلا بوكس بحث
        if (y < 80) setHidden(false);
        else if (y > lastY.current + 4) setHidden(true);
        else if (y < lastY.current - 4) setHidden(false);
      }

      lastY.current = y;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [anchorSelector]);

  return { scrolled, hidden };
}
