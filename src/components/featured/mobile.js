import { useEffect, useState } from "react";

// ============================================================
//  الموبايل (أقل من 1024px أو أي جهاز لمس) = نسخة خفيفة بلا مؤثرات.
//  مكوّنات الـ 3D والمؤثرات (desktop.js) لا تُحمَّل إلا في الكمبيوتر.
// ============================================================

const QUERY = "(max-width: 1023px), (pointer: coarse)";

export const isMobileFx = () => typeof window !== "undefined" && window.matchMedia(QUERY).matches;

export function useMobileFx() {
  const [mobile, setMobile] = useState(isMobileFx);
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener?.("change", sync);
    return () => mq.removeEventListener?.("change", sync);
  }, []);
  return mobile;
}

let desktopMod = null;

/** وحدة مؤثرات الكمبيوتر (import ديناميكي، مرّة واحدة في الجلسة). null حتى تصل أو إذا enabled = false. */
export function useDesktopFx(enabled) {
  const [mod, setMod] = useState(desktopMod);
  useEffect(() => {
    if (!enabled || desktopMod) return;
    let active = true;
    import("./desktop.js").then((m) => {
      desktopMod = m;
      if (active) setMod(m);
    });
    return () => {
      active = false;
    };
  }, [enabled]);
  return enabled ? mod || desktopMod : null;
}
