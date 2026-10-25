// ============================================================
//  CODpromo — مخزن "أعلمني عند التفعيل" (phase coming-soon): العدّاد (coming_soon_board) + حالة صاحب الحساب
//  (my_coming_soon_waits) + الضغطة (coming_soon_wait). مخزن واحد لكل البطاقات القريبة في الصفحة.
//  يتحمّل غير مع البطاقة القريبة (chunk ComingSoonTicket / ComingSoonHero) — ماشي في الحزمة الأولى.
// ============================================================
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "./supabaseClient.js";
import { useAuth } from "./auth.jsx";
import { setReturnTo } from "./returnTo.js";
import { fetchComingSoonBoard } from "./comingSoon.js";

const st = {
  board: null, // Map(id → waiting | null)
  uid: undefined, // صاحب "mine" (undefined = مازال)
  waiting: new Set(),
  notified: new Set(),
  busy: new Set(),
  status: new Map(), // id → آخر حالة ماشي ok (تتبيّن تحت الزر)
  handled: null, // location.key اللي تعالج فيه ?notify=<id> (بطاقة وحدة برك حتى إذا الشركة باينة مرّتين)
  autoId: null, // البطاقة اللي تسجّلت وحدها بعد الرجوع (تجي قدامو)
};
let version = 0;
const listeners = new Set();
const emit = () => {
  version += 1;
  for (const l of listeners) l();
};
const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const snapshot = () => version;

let boardPromise = null;
function loadComingSoonBoard(force = false) {
  if (boardPromise && !force) return boardPromise;
  boardPromise = fetchComingSoonBoard()
    .then((b) => {
      st.board = new Map((b?.items || []).map((i) => [Number(i.id), i.waiting ?? null]));
      emit();
      return b;
    })
    .catch(() => {
      boardPromise = null;
      return null;
    });
  return boardPromise;
}

let minePromise = null;
function loadMine(uid) {
  if (st.uid === uid && minePromise) return minePromise;
  st.uid = uid;
  if (!uid) {
    st.waiting = new Set();
    st.notified = new Set();
    minePromise = Promise.resolve(null);
    emit();
    return minePromise;
  }
  minePromise = supabase
    .rpc("my_coming_soon_waits")
    .then(({ data, error }) => {
      if (error || st.uid !== uid) return;
      st.waiting = new Set((data?.waiting || []).map(Number));
      st.notified = new Set((data?.notified || []).map(Number));
      emit();
    })
    .catch(() => {
      minePromise = null;
    });
  return minePromise;
}

async function setWait(id, on) {
  st.busy.add(id);
  st.status.delete(id);
  emit();
  try {
    const { data, error } = await supabase.rpc("coming_soon_wait", { p_company: id, p_on: on });
    if (error) throw error;
    const s = data?.status || "error";
    if ("waiting" in (data || {})) {
      if (data.waiting) st.waiting.add(id);
      else st.waiting.delete(id);
    }
    if (s === "notified") st.notified.add(id);
    if ("count" in (data || {})) {
      if (!st.board) st.board = new Map();
      st.board.set(id, data.count ?? null);
    }
    if (s !== "ok") st.status.set(id, s);
    return s;
  } catch {
    st.status.set(id, "error");
    return "error";
  } finally {
    st.busy.delete(id);
    emit();
  }
}

/** رابط الرجوع بعد الدخول: نفس الصفحة + ?notify=<id> (بلا الـ hash). */
function returnPath(id) {
  const url = new URL(window.location.href);
  url.searchParams.set("notify", String(id));
  url.hash = "";
  return `${url.pathname}${url.search}`;
}

/**
 * حالة بطاقة قريبة: count (null = "كن من الأوائل")، waiting، notified، busy، status (آخر رفض)،
 * toggle() (زائر → الدخول ويرجع)، auto (تسجّلت وحدها بعد الرجوع → البطاقة تجي قدامو).
 * enabled = false: معاينة (الأدمين) — بلا أي نداء.
 */
export function useComingSoon(companyId, enabled = true) {
  useSyncExternalStore(subscribe, snapshot, snapshot);
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const uid = user?.id || null;
  const id = Number(companyId);

  useEffect(() => {
    if (enabled) loadComingSoonBoard();
  }, [enabled]);
  useEffect(() => {
    if (enabled && !loading) loadMine(uid);
  }, [enabled, loading, uid]);

  // الرجوع بعد الدخول (?notify=<id>): الرابط يتنظّف (replace، الفلاتر تبقى) والتنبيه يتسجّل — بطاقة وحدة برك
  useEffect(() => {
    if (!enabled || loading) return;
    const params = new URLSearchParams(location.search);
    if (Number(params.get("notify")) !== id || st.handled === location.key) return;
    st.handled = location.key;
    params.delete("notify");
    const search = params.toString();
    navigate({ pathname: location.pathname, search: search ? `?${search}` : "", hash: location.hash }, { replace: true, state: location.state });
    if (!uid) return;
    st.autoId = id;
    loadMine(uid).then(() => {
      if (!st.waiting.has(id) && !st.notified.has(id)) setWait(id, true);
      else emit();
    });
  }, [enabled, loading, uid, id, location.search, location.key, location.pathname, location.hash, location.state, navigate]);

  const toggle = useCallback(() => {
    if (!enabled || st.busy.has(id)) return;
    if (!uid) {
      setReturnTo(returnPath(id));
      navigate("/login");
      return;
    }
    setWait(id, !st.waiting.has(id));
  }, [enabled, id, uid, navigate]);

  return {
    count: st.board ? st.board.get(id) ?? null : null,
    ready: !enabled || st.board !== null,
    waiting: st.waiting.has(id),
    notified: st.notified.has(id),
    busy: st.busy.has(id),
    status: st.status.get(id) || null,
    auto: st.autoId === id,
    signedIn: !!uid,
    toggle,
  };
}

