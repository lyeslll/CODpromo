import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "framer-motion";

// ============================================================
//  التبديل عادي ⇄ Premium "يبان بالعين" وبلا ما يضيع الزائر بلاصتو:
//  - موجة: البطاقات الظاهرة تتبدّل وحدة بعد وحدة (من فوق لتحت، ومن بداية السطر)،
//    والبرا من الشاشة تتبدّل في الحين. القيمة تعدّ (~0.6 ثانية) في الظاهرة برك.
//  - تثبيت: البطاقة اللي في وسط الشاشة تبقى في نفس البلاصة (الترتيب ثابت بين الوضعين،
//    بصح طول البطاقة يقدر يتبدّل — مثلاً المجمّدة).
//  - المبدّل العائم (الكمبيوتر): يبان كي يخرج المبدّل الأصلي من الشاشة والقائمة قدامك.
//  البطاقات معلّمة بـ data-wave-id. prefers-reduced-motion → بلا موجة وبلا عدّاد.
// ============================================================

export const WAVE_ATTR = "data-wave-id";
const WAVE_STEP = 70; // ms بين بطاقة وبطاقة
const WAVE_SPAN = 480; // أقصى مدّة للموجة كاملة
const ROW_PX = 48; // بطاقات بنفس الـ top تقريباً = نفس السطر

/** { delays: Map<id, ms> } — يوفّره القسم/الصفحة، والبطاقات تقراه. بلاه = تبديل فوري. */
export const ModeWaveContext = createContext(null);

const inView = (r) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;

function cards(root) {
  if (!root) return [];
  return [...root.querySelectorAll(`[${WAVE_ATTR}]`)].map((el) => ({ el, id: el.getAttribute(WAVE_ATTR), r: el.getBoundingClientRect() }));
}

/** تأخير كل بطاقة ظاهرة في الموجة. reduce → خريطة فارغة (كلشي فوري). */
export function measureWave(root, reduce = false) {
  const delays = new Map();
  if (reduce) return delays;
  const rtl = document.documentElement.dir === "rtl";
  const shown = cards(root).filter((c) => inView(c.r));
  shown.sort(
    (a, b) => Math.round(a.r.top / ROW_PX) - Math.round(b.r.top / ROW_PX) || (rtl ? b.r.right - a.r.right : a.r.left - b.r.left)
  );
  const step = shown.length > 1 ? Math.min(WAVE_STEP, WAVE_SPAN / (shown.length - 1)) : 0;
  shown.forEach((c, i) => {
    if (!delays.has(c.id)) delays.set(c.id, Math.round(i * step));
  });
  return delays;
}

/**
 * القيمة اللي تعرضها البطاقة. بلا Provider → تتبدّل في الحين (كيما قبل).
 * مع Provider: تستنّى موجة هاد التبديل (wave.value === value، تتحسب بعد الترتيب الجديد والتثبيت)،
 * ثم تتبدّل بعد تأخيرها — والبرا من الشاشة (بلا تأخير) في الحين، قبل الرسم.
 */
export function useWaveValue(value, id) {
  const wave = useContext(ModeWaveContext);
  const [shown, setShown] = useState(value);
  useLayoutEffect(() => {
    if (shown === value) return;
    if (wave && wave.value !== value) return; // الموجة تاع هاد التبديل مازال ما تحسبتش
    const d = wave?.delays?.get(id);
    if (!d) {
      setShown(value);
      return;
    }
    // العدّ يبدا بعد ما يترسم التبديل الفوري تاع البطاقات البرا من الشاشة (عمل ثقيل في نفس اللحظة)
    let tm = 0;
    const raf = requestAnimationFrame(() => {
      tm = setTimeout(() => setShown(value), d);
    });
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(tm);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, wave]);
  return shown;
}

/**
 * للقسم/الصفحة اللي فيها المبدّل. value = الوضع الجديد (true = Premium).
 * rootRef: البطاقات اللي تمشي فيها الموجة. listRef: القائمة اللي نثبّتو فيها البطاقة.
 * يرجّع { wave (للـ Provider), beforeChange () — نناديوها قبل تبديل الوضع }.
 * كل تبديل (حتى من الرابط) يحسب موجة جديدة، فما تبقى حتى بطاقة على الوضع القديم.
 */
export function useWaveSwitch(value, rootRef, listRef = null) {
  const reduce = useReducedMotion();
  const [wave, setWave] = useState(null);
  const anchor = useRef(null);
  // البطاقة اللي الزائر يشوف فيها: تبقى هي المرساة من تبديل لتبديل ما دام ما حرّكش الصفحة
  // (ما تزلقش لجارتها في نفس السطر)
  const intended = useRef(null);
  const placed = useRef(null);
  const first = useRef(true);
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const a = anchor.current;
    anchor.current = null;
    let stop = () => {};
    // 1) نفس البطاقة في نفس البلاصة (البطاقات مازال بالشكل القديم؛ طولها يتبدّل مع الموجة)
    if (a && listRef?.current) {
      const r = restoreAnchor(listRef.current, a, reduce ? 160 : WAVE_SPAN + 650);
      stop = r.stop;
      placed.current = r.placed;
    }
    // 2) الموجة على البطاقات اللي راهي قدامك دروك
    setWave({ value, delays: measureWave(rootRef.current, reduce) });
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const beforeChange = () => {
    const list = listRef?.current;
    if (!list) return (anchor.current = null);
    let cands = captureAnchor(list);
    const p = placed.current;
    const pEl = p && list.querySelector(`[${WAVE_ATTR}="${p.id}"]`);
    const still = pEl && Math.abs(layoutTop(pEl) - p.top) < 3; // ما حرّكش الصفحة
    const it = still ? intended.current : null;
    if (it && list.querySelector(`[${WAVE_ATTR}="${it.id}"]`)) cands = [it, ...cands.filter((c) => c.id !== it.id)];
    intended.current = cands[0] || null;
    anchor.current = cands;
  };
  return { wave, beforeChange };
}

/* ===== العدّاد ===== */
export function parseCount(v) {
  const m = String(v ?? "").match(/^(\D*)([\d.,]+)(.*)$/s);
  if (!m) return null;
  const raw = m[2].replace(/,/g, "");
  const num = parseFloat(raw);
  if (Number.isNaN(num)) return null;
  return { prefix: m[1], num, suffix: m[3], decimals: (raw.split(".")[1] || "").length };
}

/** نص القيمة: يعدّ من القديمة للجديدة (~0.6 ثانية) إذا العنصر ظاهر، وإلا يتبدّل في الحين. */
export function useCountText(value, ref, duration = 0.6) {
  const reduce = useReducedMotion();
  const [text, setText] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const from = parseCount(prev.current);
    const to = parseCount(value);
    prev.current = value;
    const r = ref.current?.getBoundingClientRect();
    if (reduce || !from || !to || from.num === to.num || !r || !inView(r)) {
      setText(value);
      return;
    }
    const fmt = (v) => `${to.prefix}${to.decimals ? v.toFixed(to.decimals) : Math.round(v)}${to.suffix}`;
    const controls = animate(from.num, to.num, { duration, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => setText(fmt(v)) });
    return () => {
      controls.stop();
      setText(value);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduce]);
  return text;
}

/* ===== تثبيت البطاقة اللي قدّام الزائر ===== */

// موضع البطاقة في الصفحة بلا transform (البطاقة اللي تتجمّد/ترجع تعاود حركة دخولها y:26 → 0؛
// getBoundingClientRect يحسبها، فنغلطو في التثبيت). offsetTop = الـ layout الحقيقي.
function layoutTop(el) {
  let y = 0;
  for (let e = el; e; e = e.offsetParent) y += e.offsetTop;
  return y - window.scrollY;
}

/** قبل التبديل: البطاقات الظاهرة حسب قربها من وسط الشاشة (الأولى = المرساة). */
export function captureAnchor(root) {
  const mid = window.innerHeight / 2;
  const midX = window.innerWidth / 2;
  const shown = cards(root).filter((c) => inView(c.r));
  const dist = (r) => Math.round(Math.abs((r.top + r.bottom) / 2 - mid) / ROW_PX) * 1e4 + Math.abs((r.left + r.right) / 2 - midX);
  shown.sort((a, b) => dist(a.r) - dist(b.r));
  return shown.map((c) => ({ id: c.id, top: layoutTop(c.el) }));
}

/**
 * بعد التبديل: نرجّع الـ scroll باش المرساة تبقى في نفس البلاصة، ونثبّتها حتى تكمل الموجة
 * (holdMs) — نوقف كي يحرّك الزائر الصفحة بنفسو.
 */
export function restoreAnchor(root, candidates, holdMs = 0) {
  const none = { stop: () => {}, placed: null };
  if (!root || !candidates?.length) return none;
  const pick = candidates.find((c) => root.querySelector(`[${WAVE_ATTR}="${c.id}"]`));
  if (!pick) return none;
  const find = () => root.querySelector(`[${WAVE_ATTR}="${pick.id}"]`);
  // الـ scroll اللي حطّيناه. الزائر (عجلة/لمس/لوحة مفاتيح/ضغطة) يوقّف التثبيت عبر USER_SCROLL؛
  // قفزة كبيرة من برّا (scrollTo…) توقّفو هنا. القفزات الصغيرة = تثبيت المتصفح التلقائي → نكمّلو.
  let expected = null;
  const align = () => {
    const el = find();
    if (!el) return;
    const dy = layoutTop(el) - pick.top;
    const ds = expected == null ? 0 : window.scrollY - expected;
    if (Math.abs(ds) > JUMP_PX) return stop();
    if (Math.abs(dy) > 0.5) window.scrollBy(0, dy);
    expected = window.scrollY;
  };
  align();
  // البطاقات البرا من الشاشة تلحق الوضع في re-render متزامن بعد هاد الـ effect — نعاود قبل الرسم
  queueMicrotask(align);
  let raf = 0;
  const until = performance.now() + holdMs;
  let stopped = false;
  const tick = () => {
    align();
    raf = !stopped && performance.now() < until ? requestAnimationFrame(tick) : 0;
  };
  function stop() {
    stopped = true;
    cancelAnimationFrame(raf);
    raf = 0;
    for (const ev of USER_SCROLL) window.removeEventListener(ev, stop);
  }
  for (const ev of USER_SCROLL) window.addEventListener(ev, stop, { passive: true, once: true });
  raf = requestAnimationFrame(tick);
  setTimeout(stop, holdMs + 50);
  return { stop, placed: pick };
}
const USER_SCROLL = ["wheel", "touchstart", "keydown", "pointerdown"];
const JUMP_PX = 120;


/* ===== المبدّل العائم (الكمبيوتر) ===== */

const WIDE = "(min-width: 768px)";
const AREA_MIN = 160; // لازم يبان هاد القدر من البطاقات على الأقل (px)

/**
 * يبان كي: الشاشة عريضة، والمبدّل الأصلي برا الشاشة (ولا تحت الهيدر)، والبطاقات (area) قدامك.
 * كي يرجع المبدّل الأصلي يبان، يختفي — مبدّل واحد ظاهر. (/offers: مسافة تحت القائمة باش آخر بطاقة
 * تطلع كاملة فوقه.)
 */
export function useFloatingSwitch(toggleRef, areaRef, enabled = true) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!enabled) {
      setVisible(false);
      return;
    }
    const mq = window.matchMedia(WIDE);
    let raf = 0;
    let trail = 0;
    const check = () => {
      raf = 0;
      const tg = toggleRef.current;
      const area = areaRef.current;
      if (!mq.matches || !tg || !area) return setVisible(false);
      const H = window.innerHeight;
      const cap = document.querySelector("#top .nav-capsule")?.getBoundingClientRect();
      const headerBottom = cap ? Math.max(0, cap.bottom) : 0;
      const t = tg.getBoundingClientRect();
      const toggleShown = t.width > 0 && t.bottom > headerBottom + 4 && t.top < H;
      const a = area.getBoundingClientRect();
      const areaShown = a.top < H - AREA_MIN && a.bottom > headerBottom + AREA_MIN;
      setVisible(!toggleShown && areaShown);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(check);
      // الهيدر يكمل حركتو (300ms) بعد ما يوقف الـ scroll
      clearTimeout(trail);
      trail = setTimeout(check, 340);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    mq.addEventListener("change", schedule);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(trail);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      mq.removeEventListener("change", schedule);
    };
  }, [toggleRef, areaRef, enabled]);
  return visible;
}
