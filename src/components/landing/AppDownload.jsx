import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useAppTarget } from "../../lib/appInstall.js";

// القسم الثقيل (الهاتف + QR + الحركة) في حزمة منفصلة تُحمَّل عند الاقتراب منه فقط
const AppSection = lazy(() => import("./app/AppSection.jsx"));

/**
 * 5.11 — "حمّل التطبيق": يختفي كاملاً داخل التطبيق (TWA / iOS / معاينة الهاتف)،
 * ويحمّل القسم حين يصبح الزائر على بعد ~700px منه.
 */
export default function AppDownload() {
  const { inApp, platform } = useAppTarget();
  const ref = useRef(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    if (inApp || near) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "700px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [inApp, near]);

  if (inApp) return null;
  return (
    <div ref={ref} id="app" className="min-h-[640px]">
      {near && (
        <Suspense fallback={null}>
          <AppSection platform={platform} />
        </Suspense>
      )}
    </div>
  );
}
