import { useEffect, useSyncExternalStore } from "react";
import { useAuth } from "./auth.jsx";
import { fetchFeed, markAllReadRemote, markReadRemote, readLocal, writeLocal, UNREAD_DAYS } from "./notifications.js";

// ============================================================
//  مخزن الإشعارات المشترك (الجرس، رسالة الرجوع، صفحة /new) — طلب واحد للصفحة كاملة.
//  key = معرّف الحساب ولا "anon". المسجّل: "مقروء" من القاعدة (+ تفاؤلي في الحين)،
//  الزائر: من localStorage. يتعاود يتجاب كي يرجع للتبويب (أكثر من 3 دقائق).
// ============================================================

const DAY = 86400000;
const STALE_MS = 3 * 60 * 1000;

let state = {
  key: null,
  status: "idle", // idle | loading | ready | error
  items: [],
  readAllBefore: null,
  scope: "all",
  loadedAt: 0,
  local: readLocal(),
  seen: new Set(), // مقروء تفاؤلي (قبل ما يرجع الخادم)
};
let loadingKey = null;
const listeners = new Set();
const set = (patch) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const snapshot = () => state;

const syncedUsers = new Set();

/** الزائر قرا حاجات وبعدها دخل لحسابو: نكتبوهم مقروءين في القاعدة (مرة وحدة). */
function syncLocalReads(items) {
  const { before, ids } = readLocal();
  const b = before ? new Date(before).getTime() : 0;
  const list = items.filter((i) => !i.read && ((b && new Date(i.published_at).getTime() <= b) || ids.includes(i.id))).map((i) => i.id);
  if (!list.length) return;
  set({ seen: new Set([...state.seen, ...list]) });
  markReadRemote(list).catch(() => {});
}

function load(key, force = false) {
  if (!key) return;
  if (loadingKey === key) return;
  if (!force && state.key === key && state.status === "ready" && Date.now() - state.loadedAt < STALE_MS) return;
  const switched = state.key !== key;
  loadingKey = key;
  set(switched ? { key, status: "loading", items: [], readAllBefore: null, scope: "all", seen: new Set() } : { status: state.items.length ? "ready" : "loading" });
  fetchFeed({ limit: 30 })
    .then((r) => {
      if (state.key !== key) return;
      set({ status: "ready", items: r.items, readAllBefore: r.readAllBefore, scope: r.scope, loadedAt: Date.now() });
      if (key !== "anon" && !syncedUsers.has(key)) {
        syncedUsers.add(key);
        syncLocalReads(r.items);
      }
    })
    .catch(() => state.key === key && set({ status: state.items.length ? "ready" : "error", loadedAt: Date.now() }))
    .finally(() => {
      if (loadingKey === key) loadingKey = null;
    });
}

/** مقروء؟ (قديم أكثر من 14 يوم = مقروء: الزائر الجديد ما يلقاش 30 إشعار قديم) */
export function isReadIn(s, item) {
  if (!item) return true;
  if (s.seen.has(item.id)) return true;
  const pub = new Date(item.published_at).getTime();
  if (!Number.isFinite(pub) || Date.now() - pub > UNREAD_DAYS * DAY) return true;
  if (s.key === "anon") {
    const b = s.local.before ? new Date(s.local.before).getTime() : 0;
    return (b && pub <= b) || s.local.ids.includes(item.id);
  }
  if (item.read) return true;
  return !!(s.readAllBefore && pub <= new Date(s.readAllBefore).getTime());
}

export function markRead(ids) {
  const list = (Array.isArray(ids) ? ids : [ids]).filter(Number.isSafeInteger);
  if (!list.length || !state.key) return;
  set({ seen: new Set([...state.seen, ...list]) });
  if (state.key === "anon") {
    const local = readLocal();
    const next = { before: local.before, ids: [...new Set([...local.ids, ...list])] };
    writeLocal(next);
    set({ local: next });
  } else {
    markReadRemote(list).catch(() => {});
  }
}

export function markAllRead() {
  if (!state.key) return;
  const now = new Date().toISOString();
  set({ seen: new Set([...state.seen, ...state.items.map((i) => i.id)]) });
  if (state.key === "anon") {
    const next = { before: now, ids: [] };
    writeLocal(next);
    set({ local: next });
  } else {
    markAllReadRemote()
      .then((at) => set({ readAllBefore: at || now }))
      .catch(() => {});
  }
}

let visibilityHooked = false;
function hookVisibility() {
  if (visibilityHooked || typeof document === "undefined") return;
  visibilityHooked = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && state.key) load(state.key);
  });
}

let paramHandled = false;
/** فتح من push: ?n=<id> → مقروء، والـ param يتنحّى من الرابط (بلا ما يتبدّل تاريخ React Router). */
function handleOpenParam() {
  if (paramHandled || typeof window === "undefined") return;
  paramHandled = true;
  try {
    const url = new URL(window.location.href);
    const n = Number(url.searchParams.get("n"));
    if (!Number.isSafeInteger(n) || n <= 0) return;
    markRead([n]);
    url.searchParams.delete("n");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  } catch {
    /* تجاهل */
  }
}

/**
 * { ready, status, items, unreadIds, unreadCount, isRead, markRead, markAllRead, refresh }
 * enabled = false: ما يتجابش والو (مثلاً لوحة الأدمين).
 */
export function useNotifications({ enabled = true } = {}) {
  const { user, loading } = useAuth();
  const s = useSyncExternalStore(subscribe, snapshot, snapshot);
  const key = !enabled || loading ? null : user?.id || "anon";

  useEffect(() => {
    if (!key) return;
    hookVisibility();
    // بعد أول رسم (وقت الفراغ): الجرس ما يزاحمش تحميل الصفحة
    const run = () => {
      load(key);
      handleOpenParam();
    };
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(run, { timeout: 2500 });
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(run, 900);
    return () => clearTimeout(id);
  }, [key]);

  const items = s.key === key ? s.items : [];
  const unreadIds = items.filter((i) => !isReadIn(s, i)).map((i) => i.id);
  return {
    ready: s.key === key && s.status === "ready",
    status: s.key === key ? s.status : "idle",
    items,
    scope: s.scope,
    unreadIds,
    unreadCount: unreadIds.length,
    isRead: (item) => isReadIn(s, item),
    markRead,
    markAllRead,
    /** يعاود يجيب إذا فاتو أكثر من 3 دقائق (فتح الجرس). */
    ensureFresh: () => key && load(key),
    refresh: () => key && load(key, true),
  };
}
