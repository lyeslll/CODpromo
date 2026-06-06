import { forwardRef } from "react";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import { useTheme } from "../../lib/theme.jsx";

// مفتاح الموقع من متغير البيئة. الافتراضي = مفتاح hCaptcha التجريبي (ينجح دائماً) للتطوير.
const SITE_KEY =
  import.meta.env.VITE_HCAPTCHA_SITE_KEY || "10000000-ffff-ffff-ffff-000000000001";

/** حماية hCaptcha — يعيد التوكن عبر onVerify، ويُفرّغه عند الانتهاء/الخطأ. */
const Captcha = forwardRef(function Captcha({ onVerify, onExpire }, ref) {
  const { theme } = useTheme();
  return (
    <div className="flex justify-center" key={theme}>
      <HCaptcha
        ref={ref}
        sitekey={SITE_KEY}
        theme={theme === "light" ? "light" : "dark"}
        onVerify={(token) => onVerify?.(token)}
        onExpire={() => onExpire?.()}
        onError={() => onExpire?.()}
      />
    </div>
  );
});

export default Captcha;
