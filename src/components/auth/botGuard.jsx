import { useRef } from "react";

const MIN_MS = 3000;

/**
 * حماية مخفية ضد الروبوتات (بدل hCaptcha) — الزائر لا يرى شيئاً:
 *  1. honeypot: حقل مخفي عن البشر؛ الروبوتات تملؤه → لا نرسل الطلب.
 *  2. فحص الوقت: إرسال النموذج قبل 3 ثوانٍ من فتح الصفحة → يُوقف.
 * الاستعمال: const guard = useBotGuard(); … {guard.trap} داخل النموذج، وفي submit:
 *   const verdict = guard.check(); if (verdict) return …  ("bot" | "fast" | null)
 */
export function useBotGuard() {
  const startedAt = useRef(Date.now());
  const trapRef = useRef(null);

  const check = () => {
    if (trapRef.current?.value) return "bot";
    if (Date.now() - startedAt.current < MIN_MS) return "fast";
    return null;
  };

  // حقل بلا تسمية مرئية، خارج الشاشة، لا يصله Tab ولا قارئ الشاشة ولا الإكمال التلقائي
  const trap = (
    <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", top: "auto", width: 1, height: 1, overflow: "hidden" }}>
      <label>
        Fax
        <input ref={trapRef} type="text" name="cp_fax_number" tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
    </div>
  );

  return { check, trap };
}
