import { forwardRef, useEffect, useRef, useState } from "react";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import { useTheme } from "../../lib/theme.jsx";

// مفتاح الموقع من متغير البيئة. الافتراضي = مفتاح hCaptcha التجريبي (ينجح دائماً) للتطوير.
const SITE_KEY =
  import.meta.env.VITE_HCAPTCHA_SITE_KEY || "10000000-ffff-ffff-ffff-000000000001";

// أبعاد ودجة hCaptcha (نمط checkbox) الثابتة
const BASE_W = 303;
const BASE_H = 78;

/** حماية hCaptcha — يعيد التوكن عبر onVerify، ويُفرّغه عند الانتهاء/الخطأ. */
const Captcha = forwardRef(function Captcha({ onVerify, onExpire }, ref) {
  const { theme } = useTheme();
  const wrapRef = useRef(null);
  const [scale, setScale] = useState(1);

  // قياس عرض الحاوية وتصغير الودجة بنسبة مناسبة كي تبقى داخل حدود البطاقة على الهواتف
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      setScale(w > 0 && w < BASE_W ? w / BASE_W : 1);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    // حاوية بعرض كامل تقيس المساحة المتاحة؛ الودجة تُصغَّر عبر transform لتلائم الشاشات الضيّقة دون قصّ أو تمرير أفقي
    <div
      ref={wrapRef}
      className="flex w-full min-w-0 justify-center overflow-hidden"
      style={scale < 1 ? { height: Math.ceil(BASE_H * scale) } : undefined}
      key={theme}
    >
      <div className="w-max" style={{ transform: `scale(${scale})`, transformOrigin: "top center" }}>
        <HCaptcha
          ref={ref}
          sitekey={SITE_KEY}
          theme={theme === "light" ? "light" : "dark"}
          onVerify={(token) => onVerify?.(token)}
          onExpire={() => onExpire?.()}
          onError={() => onExpire?.()}
        />
      </div>
    </div>
  );
});

export default Captcha;
