import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabaseClient.js";

// ============================================================
//  CODpromo — إشعارات الهاتف (Web Push) من جهة المتصفّح.
//  الإذن يتطلب غير بضغطة على زر (enablePush) — حتى نافذة إذن ما تطلع وحدها.
//  الاشتراك يتسجّل عبر RPC push_subscribe (زائر ولا حساب)، والإرسال في الخادم برك (send-push).
//  المفتاح هنا هو العام (applicationServerKey)؛ الخاص في Supabase secrets برك.
//  في التطبيق Android (TWA): نفس الكود — الإشعار يخرج باسم التطبيق (notification delegation).
// ============================================================

export const VAPID_PUBLIC_KEY = "BCzWKlQSM_uJcrnqyxsaJ8c5BG0n5ESHQ3tfuoL9FINojAOfnPVUR67TUEq4GWDWi6bfbSLtZRzNyrhuV4Xdwhw";

const SYNC_KEY = "codpromo:push-sync:v1";
const CHANGE_EVENT = "codpromo:push-change";

function keyBytes(b64) {
  const s = b64.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(s + "=".repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

const isIos = () =>
  typeof navigator !== "undefined" &&
  (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true);

/** supported | ios-install (iPhone: لازم يزيد الموقع للشاشة الرئيسية) | unsupported (حتى تطبيق iOS) */
export function pushSupport() {
  if (typeof window === "undefined") return "unsupported";
  if (document.body.classList.contains("is-ios-app")) return "unsupported";
  const ok = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (ok) return "supported";
  return isIos() && !isStandalone() ? "ios-install" : "unsupported";
}

/** service worker الموقع (vite-plugin-pwa). null إذا ما كانش (npm run dev) بعد 6 ثواني. */
async function registration() {
  if (!("serviceWorker" in navigator)) return null;
  return Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(() => r(null), 6000))]);
}

async function currentSubscription() {
  const reg = await registration();
  return reg ? reg.pushManager.getSubscription() : null;
}

function sameKey(sub) {
  const k = sub?.options?.applicationServerKey;
  if (!k) return true;
  const a = new Uint8Array(k);
  const b = keyBytes(VAPID_PUBLIC_KEY);
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

async function save(sub, lang, userId) {
  const j = sub.toJSON();
  const { data, error } = await supabase.rpc("push_subscribe", {
    p_endpoint: j.endpoint,
    p_p256dh: j.keys?.p256dh,
    p_auth: j.keys?.auth,
    p_lang: lang,
  });
  if (error) throw new Error(error.message);
  if (data?.status === "ok") {
    try {
      localStorage.setItem(SYNC_KEY, JSON.stringify({ e: j.endpoint, l: lang, u: userId || null }));
    } catch {
      /* تجاهل */
    }
  }
  return data?.status || "error";
}

const announce = () => window.dispatchEvent(new Event(CHANGE_EVENT));

/**
 * يطلب الإذن (بضغطة المستخدم برك) ويشترك. status: ok | denied | dismissed | no_sw | invalid | rate_limited | error
 * welcome = { title, body } — إشعار محلي صغير يأكّد أن الجهاز يستقبل.
 */
export async function enablePush({ lang, userId, welcome } = {}) {
  if (pushSupport() !== "supported") return "unsupported";
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return perm === "denied" ? "denied" : "dismissed";
  const reg = await registration();
  if (!reg) return "no_sw";
  let sub = await reg.pushManager.getSubscription();
  if (sub && !sameKey(sub)) {
    await sub.unsubscribe().catch(() => {});
    sub = null;
  }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) });
  const status = await save(sub, lang, userId);
  if (status === "ok" && welcome?.title) {
    reg
      .showNotification(welcome.title, {
        body: welcome.body,
        icon: "/pwa-192.png",
        badge: "/push-badge.png",
        tag: "codpromo-welcome",
        lang,
        dir: lang === "ar" ? "rtl" : "ltr",
        data: { url: "/" },
      })
      .catch(() => {});
  }
  announce();
  return status;
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (sub) {
    const endpoint = sub.endpoint;
    await sub.unsubscribe().catch(() => {});
    try {
      await supabase.rpc("push_unsubscribe", { p_endpoint: endpoint });
    } catch {
      /* الجهاز توقّف محلياً؛ القاعدة توقّفو وحدها كي يرجع 410 */
    }
  }
  try {
    localStorage.removeItem(SYNC_KEY);
  } catch {
    /* تجاهل */
  }
  announce();
}

/** الجهاز مشترك؟ يعاود يبعث الاشتراك كي تتبدّل اللغة ولا الحساب (بلا إذن جديد). */
export async function syncPush(lang, userId) {
  if (pushSupport() !== "supported" || Notification.permission !== "granted") return false;
  const sub = await currentSubscription();
  if (!sub) return false;
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(SYNC_KEY) || "null");
  } catch {
    saved = null;
  }
  const same = saved && saved.e === sub.endpoint && saved.l === lang && (!userId || saved.u === userId);
  if (!same) await save(sub, lang, userId).catch(() => {});
  return true;
}

/**
 * حالة زر "إشعارات الهاتف": support، state = checking | off | on | denied، busy، و enable / disable.
 * كل الأزرار في الصفحة يتحدّثو مع بعض (حدث codpromo:push-change).
 */
export function usePushState({ lang, userId }) {
  const [support] = useState(pushSupport);
  const [state, setState] = useState("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const check = useCallback(async () => {
    if (support !== "supported") return setState("off");
    if (Notification.permission === "denied") return setState("denied");
    const on = Notification.permission === "granted" && !!(await currentSubscription());
    setState(on ? "on" : "off");
  }, [support]);

  useEffect(() => {
    check();
    window.addEventListener(CHANGE_EVENT, check);
    return () => window.removeEventListener(CHANGE_EVENT, check);
  }, [check]);

  const enable = useCallback(
    async (welcome) => {
      setBusy(true);
      setError(null);
      try {
        const r = await enablePush({ lang, userId, welcome });
        if (r !== "ok") setError(r);
        await check();
        return r;
      } catch {
        setError("error");
        return "error";
      } finally {
        setBusy(false);
      }
    },
    [lang, userId, check],
  );

  const disable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await disablePush();
      await check();
    } finally {
      setBusy(false);
    }
  }, [check]);

  return { support, state, busy, error, enable, disable };
}
