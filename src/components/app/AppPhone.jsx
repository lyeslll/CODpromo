import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

// ============================================================
//  هاتف CODpromo (CSS 3D — أخف من WebGL ويسمح بـ iframe حيّ داخل الشاشة):
//  هاتف عام بتصميمنا (كاميرا ثقب في الوسط، لا يقلّد أي علامة تجارية)،
//  سُمك حقيقي من طبقات متتالية في العمق، انعكاس زجاج يتبع الميلان.
// ============================================================

const SITE_W = 390; // عرض الموقع داخل الشاشة (عرض هاتف)

/** إطار الهاتف. depth = عدد طبقات السُمك (0 = هاتف مسطّح للموبايل). glare = MotionValue لموضع الانعكاس. */
export function PhoneFrame({ w, h, depth = 0, glare, children }) {
  const R = Math.round(w * 0.16);
  const bezel = Math.max(7, Math.round(w * 0.032));
  const status = Math.round(h * 0.034);
  return (
    <div className="relative [transform-style:preserve-3d]" style={{ width: w, height: h }}>
      {/* السُمك: نسخ من الهيكل خلف الوجه، والأخيرة هي الظهر */}
      {Array.from({ length: depth }, (_, i) => (
        <div
          key={i}
          aria-hidden
          className="absolute inset-0"
          style={{
            borderRadius: R,
            transform: `translateZ(${-(i + 1) * 1.15}px)`,
            background: i === depth - 1 ? "#0c0d0f" : "linear-gradient(90deg, #34363d, #1b1c20 22%, #1b1c20 78%, #34363d)",
          }}
        />
      ))}
      {depth > 0 && (
        <>
          {/* أزرار جانبية (تشغيل + صوت) */}
          <span aria-hidden className="absolute right-[-3px] rounded-sm bg-[#30323a]" style={{ top: h * 0.19, width: 3, height: h * 0.085, transform: `translateZ(${-depth * 0.55}px)` }} />
          <span aria-hidden className="absolute right-[-3px] rounded-sm bg-[#30323a]" style={{ top: h * 0.31, width: 3, height: h * 0.14, transform: `translateZ(${-depth * 0.55}px)` }} />
        </>
      )}

      {/* الوجه: إطار معدني رقيق ثم حافة سوداء ثم الشاشة */}
      <div
        className="absolute inset-0"
        style={{
          borderRadius: R,
          padding: 3,
          background: "linear-gradient(150deg, #50535c, #1e1f23 34%, #121316 64%, #42454d)",
          boxShadow: depth ? "0 50px 90px -40px rgba(0,0,0,0.95)" : "0 30px 60px -30px rgba(0,0,0,0.9)",
        }}
      >
        <div className="relative h-full w-full" style={{ borderRadius: R - 3, background: "#050506", padding: bezel }}>
          <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#0a0a0a]" style={{ borderRadius: R - 3 - bezel * 0.55 }}>
            {/* شريط الحالة: كاميرا ثقب في الوسط + بطارية/شبكة (أشكال فقط) */}
            <div aria-hidden className="relative flex shrink-0 items-center justify-end gap-1 bg-[#0a0a0a] pe-[7%]" style={{ height: status }}>
              <span className="absolute left-1/2 top-1/2 aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full bg-black ring-1 ring-white/15" style={{ height: status * 0.52 }} />
              <StatusIcons size={status * 0.42} />
            </div>
            <div className="relative min-h-0 flex-1 overflow-hidden">{children}</div>
            {/* انعكاس الزجاج */}
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-0 z-10"
              style={{
                backgroundImage: "linear-gradient(112deg, transparent 34%, rgba(255,255,255,0.075) 45%, rgba(255,255,255,0.02) 52%, transparent 60%)",
                backgroundSize: "260% 100%",
                backgroundPositionX: glare ?? "40%",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusIcons({ size }) {
  return (
    <svg viewBox="0 0 30 10" style={{ height: size, width: size * 3 }} fill="rgba(255,255,255,0.75)">
      <path d="M1 9h2V7H1zm3.5 0h2V5h-2zM8 9h2V3H8z" />
      <rect x="14" y="1.5" width="12" height="7" rx="1.6" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="1" />
      <rect x="15.5" y="3" width="7.5" height="4" rx="0.8" />
      <rect x="26.6" y="3.7" width="1.4" height="2.6" rx="0.5" />
    </svg>
  );
}

/** صور حقيقية من الموقع بعرض 390px تتبدّل وحدها (ثابتة مع تقليل الحركة). */
export function ScreenSlides({ lang, reduced, interval = 3200 }) {
  const shots = [1, 2, 3].map((n) => `/app-shots/${["ar", "en", "fr"].includes(lang) ? lang : "en"}-${n}.webp`);
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setI((v) => (v + 1) % shots.length), interval);
    return () => clearInterval(id);
  }, [reduced, interval, shots.length]);
  return (
    <div className="absolute inset-0 bg-[#0a0a0a]">
      {/* كل الصور محمّلة مسبقاً (لا وميض عند التبديل)، والظاهرة تنزلق وتتلاشى فوق السابقة */}
      {shots.map((src, k) => (
        <motion.img
          key={src}
          src={src}
          alt=""
          draggable={false}
          className="absolute inset-x-0 top-0 h-auto w-full select-none"
          initial={false}
          animate={{ opacity: k === i ? 1 : 0, y: k === i ? 0 : 14 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        />
      ))}
    </div>
  );
}

/**
 * الموقع الحقيقي حيّ داخل الشاشة: iframe لصفحة /offers بعرض هاتف (390px) مصغّر.
 * طبقة شفافة فوقه تلتقط عجلة الفأرة وتمرّرها لداخله (بلا نقر: لا دفع ولا نوافذ داخل الهاتف)،
 * وحين يصل لأوله/آخره تكمل الصفحة نفسها التمرير. تظهر الصورة الأولى حتى تجهز البيانات،
 * وإن لم يعمل الـ iframe خلال 10 ثوانٍ → onFail (نرجع لسلسلة الصور).
 */
export function LiveScreen({ src, lang, onFail }) {
  const wrapRef = useRef(null);
  const frameRef = useRef(null);
  const overlayRef = useRef(null);
  const [box, setBox] = useState(null);
  const [ready, setReady] = useState(false);

  // المقاس: عرض الشاشة ÷ 390 = معامل التصغير
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const scale = box ? box.w / SITE_W : 1;

  // مهلة: إن لم تظهر بطاقات العروض داخل الـ iframe → نرجع للصور
  useEffect(() => {
    if (ready) return;
    const id = setTimeout(() => onFail?.(), 10000);
    return () => clearTimeout(id);
  }, [ready, onFail]);

  const onLoad = () => {
    const win = frameRef.current?.contentWindow;
    const doc = frameRef.current?.contentDocument;
    if (!win || !doc) return onFail?.();
    // "وضع التطبيق": نفس هيدر تطبيق Android المدمج، بلا شريط تمرير، بلا نافذة النشرة البريدية
    doc.body.classList.add("is-twa-app");
    const style = doc.createElement("style");
    style.textContent =
      "html{scrollbar-width:none;scroll-behavior:auto!important}html::-webkit-scrollbar{display:none}.fixed.inset-0.z-\\[100\\]{display:none!important}";
    doc.head.appendChild(style);
    let tries = 0;
    const check = () => {
      if (doc.querySelector("article.ticket")) setReady(true);
      else if (++tries < 40) setTimeout(check, 250);
    };
    check();
  };

  // عجلة الفأرة → تمرير داخل الهاتف (مستمع أصلي غير passive حتى نوقف تمرير الصفحة)
  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const onWheel = (e) => {
      const win = frameRef.current?.contentWindow;
      if (!win || !ready) return;
      const se = win.document.scrollingElement || win.document.documentElement;
      const max = se.scrollHeight - win.innerHeight;
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? win.innerHeight : 1);
      const y = win.scrollY;
      if ((dy > 0 && y < max - 1) || (dy < 0 && y > 0)) {
        e.preventDefault();
        win.scrollBy({ top: dy, behavior: "instant" });
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [ready]);

  return (
    <div ref={wrapRef} className="absolute inset-0 bg-[#0a0a0a]">
      {box && (
        <iframe
          ref={frameRef}
          src={src}
          title=""
          aria-hidden="true"
          tabIndex={-1}
          onLoad={onLoad}
          className="absolute left-0 top-0 origin-top-left border-0 transition-opacity duration-700"
          style={{ width: SITE_W, height: box.h / scale, transform: `scale(${scale})`, opacity: ready ? 1 : 0 }}
        />
      )}
      <AnimatePresence>
        {!ready && (
          <motion.img
            key="poster"
            src={`/app-shots/${["ar", "en", "fr"].includes(lang) ? lang : "en"}-1.webp`}
            alt=""
            draggable={false}
            className="absolute inset-x-0 top-0 w-full select-none"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          />
        )}
      </AnimatePresence>
      <div ref={overlayRef} className="absolute inset-0" />
    </div>
  );
}

const TICKET_PATH =
  "M8 0H92A8 8 0 0 1 100 8V34A6 6 0 0 0 100 46V54A8 8 0 0 1 92 62H8A8 8 0 0 1 0 54V46A6 6 0 0 0 0 34V8A8 8 0 0 1 8 0Z";

/** كوبون صغير بلون نوع (نفس روح الكوبونات الطافية في الـ Hero). */
export function MiniTicket({ color, to, w }) {
  const id = `tk-${useId().replace(/:/g, "")}`;
  return (
    <svg viewBox="0 0 100 62" width={w} height={w * 0.62} aria-hidden style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={color} />
          <stop offset="1" stopColor={to || color} stopOpacity={to ? 1 : 0.72} />
        </linearGradient>
      </defs>
      <path d={TICKET_PATH} fill={`url(#${id})`} />
      <line x1="11" y1="40" x2="89" y2="40" stroke="rgba(10,10,10,0.42)" strokeWidth="1.8" strokeDasharray="4.5 3.5" />
      <rect x="12" y="11" width="34" height="6" rx="3" fill="rgba(10,10,10,0.38)" />
      <rect x="12" y="22" width="22" height="5" rx="2.5" fill="rgba(10,10,10,0.24)" />
      <circle cx="80" cy="19" r="8" fill="rgba(10,10,10,0.3)" />
      <rect x="12" y="48" width="44" height="5" rx="2.5" fill="rgba(10,10,10,0.3)" />
    </svg>
  );
}
