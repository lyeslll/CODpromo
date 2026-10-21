import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useInView, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { Copy, Crown, RefreshCw, Smartphone } from "lucide-react";
import { useTranslation } from "react-i18next";
import GooglePlayBadge from "../../app/GooglePlayBadge.jsx";
import PlayQr from "../../app/PlayQr.jsx";
import { LiveScreen, MiniTicket, PhoneFrame, ScreenSlides } from "../../app/AppPhone.jsx";
import { offersPath } from "../../../lib/seo.js";

// مزايا حقيقية للتطبيق (TWA): نفس العروض + النسخ بلمسة، الاشتراك عبر Google Play Billing،
// والمحتوى يأتي من الموقع مباشرةً (لا تحديثات للتطبيق) بشاشة كاملة بلا شريط المتصفح.
const FEATURES = [
  { key: "f1", icon: Copy },
  { key: "f2", icon: Crown, gold: true },
  { key: "f3", icon: RefreshCw },
];

// كوبونات تطفو حول الهاتف بألوان الأنواع (موضع نسبةً لمركز الهاتف، z = العمق، blur للبعيدة)
const COUPONS = {
  desktop: [
    { x: -212, y: -205, z: -140, r: -16, w: 104, color: "#a6f000", to: "#8bd000", dur: 9, delay: 0, blur: 1.4 },
    { x: 205, y: -140, z: 80, r: 13, w: 84, color: "#38bdf8", to: "#0284c7", dur: 8, delay: -2.5 },
    { x: -220, y: 150, z: 95, r: 9, w: 92, color: "#fbbf24", to: "#d97706", dur: 10, delay: -4 },
    { x: 192, y: 232, z: -160, r: -10, w: 78, color: "#ffe486", to: "#cf9a1e", dur: 11, delay: -6, blur: 1.6 },
    { x: 128, y: -300, z: -240, r: 20, w: 58, color: "#a6f000", to: "#8bd000", dur: 12, delay: -3, blur: 2.2 },
  ],
  mobile: [
    { x: -148, y: -150, z: 0, r: -14, w: 62, color: "#a6f000", to: "#8bd000", dur: 9, delay: 0 },
    { x: 146, y: -30, z: 0, r: 12, w: 52, color: "#38bdf8", to: "#0284c7", dur: 8, delay: -2.5 },
    { x: -140, y: 170, z: 0, r: 9, w: 56, color: "#fbbf24", to: "#d97706", dur: 10, delay: -4 },
  ],
};

const STUB = 196; // عرض كعب التذكرة الذي يحمل رمز QR
const NOTCH = 12;

const clamp = (v) => Math.min(Math.max(v, -1), 1);

function useMedia(query) {
  const [match, setMatch] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return match;
}

/**
 * قسم "حمّل التطبيق" (الرئيسية، قبل الدعوة الأخيرة).
 * الحاسوب: هاتف CSS 3D يعرض صفحة /offers حيّة (iframe بعرض 390px، يُحمَّل عند الوصول فقط)،
 * يدخل مائلاً مع التمرير ثم يستقيم، يميل مع الفأرة ويطفو، وحوله كوبونات بألوان الأنواع.
 * بجانبه: العنوان + ثلاث مزايا + "تذكرة التثبيت": شارة Google Play الرسمية | خط مثقّب | QR.
 * الهاتف: نسخة أخف (هاتف مسطّح + صور حقيقية تتبدّل)، بلا QR؛ Android = زر Google Play كبير،
 * iPhone = "قريباً على iPhone". داخل التطبيق لا يظهر القسم أصلاً (AppDownload).
 */
export default function AppSection({ platform }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const rtl = lang === "ar";
  const reduced = useReducedMotion();
  const desktop = useMedia("(min-width: 1024px)");
  const finePointer = useMedia("(hover: hover) and (pointer: fine)");
  const [liveFailed, setLiveFailed] = useState(false);
  const onLiveFail = useCallback(() => setLiveFailed(true), []);
  const live = desktop && finePointer && !liveFailed;
  const ios = platform === "ios";
  const [hot, setHot] = useState(false);

  const stageRef = useRef(null);
  const inView = useInView(stageRef, { once: true, amount: 0.15 });

  // الدخول: مائل عند ظهور الهاتف، ويستقيم بالتدريج حتى يصل منتصف الشاشة (مرتبط بالتمرير)
  const { scrollYProgress } = useScroll({ target: stageRef, offset: ["start end", "center center"] });
  const enter = useSpring(scrollYProgress, { stiffness: 120, damping: 26, mass: 0.5 });
  const side = rtl ? 1 : -1;
  const enterRY = useTransform(enter, [0, 1], [side * 38, 0]);
  const enterRX = useTransform(enter, [0, 1], [26, 0]);
  const enterRZ = useTransform(enter, [0, 1], [side * -9, 0]);
  const enterY = useTransform(enter, [0, 1], [150, 0]);

  // الميلان مع الفأرة (نفس اتجاه ميلان الكوبون في الـ Hero) + انعكاس الزجاج
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const tiltRY = useSpring(useTransform(mx, [-1, 1], [-14, 14]), { stiffness: 110, damping: 16 });
  const tiltRX = useSpring(useTransform(my, [-1, 1], [11, -11]), { stiffness: 110, damping: 16 });
  const glare = useTransform(tiltRY, [-14, 14], ["12%", "88%"]);

  const onPointerMove = (e) => {
    if (e.pointerType !== "mouse" || reduced) return;
    const r = stageRef.current?.getBoundingClientRect();
    if (!r) return;
    mx.set(clamp((e.clientX - (r.left + r.width / 2)) / (r.width * 0.9)));
    my.set(clamp((e.clientY - (r.top + r.height / 2)) / (r.height * 0.7)));
  };
  const onPointerLeave = () => {
    mx.set(0);
    my.set(0);
  };

  const W = desktop ? 300 : 228;
  const H = desktop ? 620 : 472;
  const coupons = desktop ? COUPONS.desktop : COUPONS.mobile;
  const heat = {
    onPointerEnter: () => setHot(true),
    onPointerLeave: () => setHot(false),
    onPointerDown: () => setHot(true),
    onFocus: () => setHot(true),
    onBlur: () => setHot(false),
  };
  const notchX = rtl ? `${STUB}px` : `calc(100% - ${STUB}px)`;
  const ticketMask = `radial-gradient(circle at ${notchX} 0, transparent ${NOTCH}px, #000 ${NOTCH + 0.5}px) top / 100% 51% no-repeat, radial-gradient(circle at ${notchX} 100%, transparent ${NOTCH}px, #000 ${NOTCH + 0.5}px) bottom / 100% 51% no-repeat`;

  return (
    <section onPointerMove={onPointerMove} onPointerLeave={onPointerLeave} className="relative overflow-hidden py-14 sm:py-24 lg:py-28">
      <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-x-14 gap-y-10 px-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] lg:grid-rows-[auto_auto]">
        {/* ===== العنوان ===== */}
        <div className="lg:col-start-1 lg:row-start-1 lg:self-end">
          <h2 className="text-balance text-[clamp(34px,4.6vw,58px)] font-black leading-[1.06] tracking-tight text-[var(--text)]">{t("app.title")}</h2>
          <p className="mt-5 max-w-xl text-[16.5px] leading-[1.75] text-[var(--text-soft)] sm:text-[18px]">{t("app.sub")}</p>
        </div>

        {/* ===== الهاتف ===== */}
        <div
          ref={stageRef}
          role="img"
          aria-label={t("app.phoneLabel")}
          className="relative mx-auto w-full max-w-[560px] lg:col-start-2 lg:row-span-2 lg:row-start-1"
          style={{ height: desktop ? 700 : 540, perspective: 1500 }}
        >
          {/* ضوء ليموني خلف الهاتف */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[min(120%,600px)] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ background: "radial-gradient(closest-side, rgba(166,240,0,0.26), rgba(166,240,0,0.08) 55%, transparent)" }}
          />
          {/* ظل أرضي ناعم تحت الهاتف */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-[50%]"
            style={{ bottom: desktop ? 22 : 18, width: W * 0.9, height: 34, background: "radial-gradient(closest-side, rgba(0,0,0,0.75), transparent)", filter: "blur(6px)" }}
          />
          <motion.div className="absolute inset-0 [transform-style:preserve-3d]" style={reduced ? undefined : { rotateX: enterRX, rotateY: enterRY, rotateZ: enterRZ, y: enterY }}>
            <motion.div className="absolute inset-0 [transform-style:preserve-3d]" style={reduced ? undefined : { rotateX: tiltRX, rotateY: tiltRY }}>
              {coupons.map((c, i) => (
                <div
                  key={i}
                  aria-hidden
                  className="pointer-events-none absolute left-1/2 top-1/2"
                  style={{ transform: `translate3d(calc(-50% + ${c.x}px), calc(-50% + ${c.y}px), ${c.z}px) rotate(${c.r}deg)`, filter: c.blur ? `blur(${c.blur}px)` : undefined, opacity: c.blur ? 0.85 : 1 }}
                >
                  <div className="motion-safe:animate-[app-coupon_var(--d)_ease-in-out_infinite]" style={{ "--d": `${c.dur}s`, animationDelay: `${c.delay}s` }}>
                    <MiniTicket color={c.color} to={c.to} w={c.w} />
                  </div>
                </div>
              ))}
              <div className="absolute left-1/2 top-1/2 [transform-style:preserve-3d]" style={{ transform: "translate(-50%, -50%)" }}>
                <div className="[transform-style:preserve-3d] motion-safe:animate-[app-float_7s_ease-in-out_infinite]">
                  <PhoneFrame w={W} h={H} depth={desktop ? 12 : 0} glare={reduced ? undefined : glare}>
                    {live && inView ? <LiveScreen src={offersPath(lang)} lang={lang} onFail={onLiveFail} /> : <ScreenSlides lang={lang} reduced={!!reduced} />}
                  </PhoneFrame>
                </div>
              </div>
            </motion.div>
          </motion.div>
          {live && (
            <p className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 text-[12.5px] font-semibold text-[var(--color-mute)]">
              <span aria-hidden className="relative grid h-2 w-2 place-items-center">
                <span className="absolute inset-0 rounded-full bg-[var(--color-lime)] motion-safe:animate-ping" />
                <span className="relative h-2 w-2 rounded-full bg-[var(--color-lime)]" />
              </span>
              {t("app.live")}
            </p>
          )}
        </div>

        {/* ===== المزايا + التثبيت ===== */}
        <div className="lg:col-start-1 lg:row-start-2 lg:self-start">
          <ul className="max-w-xl">
            {FEATURES.map(({ key, icon: Icon, gold }, i) => (
              <li key={key} className={`flex items-start gap-4 py-4 ${i ? "border-t border-dashed border-[var(--color-ink-line)]" : ""}`}>
                <span
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
                  style={gold ? { background: "rgba(240,198,60,0.12)", color: "#ffe486" } : { background: "rgba(166,240,0,0.1)", color: "var(--accent-text)" }}
                >
                  <Icon size={19} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[16.5px] font-extrabold text-[var(--text)]">{t(`app.${key}Title`)}</span>
                  <span className="mt-1 block text-[14.5px] leading-relaxed text-[var(--text-soft)]">{t(`app.${key}Desc`)}</span>
                </span>
              </li>
            ))}
          </ul>

          {ios ? (
            <IosSoon className="mt-7" />
          ) : desktop ? (
            /* تذكرة التثبيت: الشارة | خط مثقّب بين نصفي دائرة | QR على ورق فاتح */
            <div
              className="relative mt-8 inline-flex max-w-full items-stretch overflow-hidden rounded-[22px] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)]"
              style={{ WebkitMask: ticketMask, mask: ticketMask }}
            >
              <div className="flex min-w-0 flex-col items-start justify-center gap-4 px-8 py-7">
                <GooglePlayBadge height={78} glow flush {...heat} />
                <IosSoon />
              </div>
              <div className="flex shrink-0 flex-col items-center justify-center gap-3 px-5 py-6" style={{ width: STUB }}>
                <PlayQr size={128} hot={hot} />
                <span className="max-w-[150px] text-center text-[12px] font-semibold leading-snug text-[var(--color-mute)]">{t("app.qrCaption")}</span>
              </div>
              {/* الخط المثقّب + حافتا نصفي الدائرة (داخل القناع فتظهر قوساً فقط) */}
              <span aria-hidden className="pointer-events-none absolute bottom-[18px] top-[18px] border-s-2 border-dashed border-[var(--color-lime)]/35" style={{ insetInlineEnd: STUB - 1 }} />
              <span aria-hidden className="pointer-events-none absolute rounded-full border border-[var(--color-ink-line)]" style={{ width: NOTCH * 2 + 2, height: NOTCH * 2 + 2, top: -NOTCH - 2, insetInlineEnd: STUB - NOTCH - 2 }} />
              <span aria-hidden className="pointer-events-none absolute rounded-full border border-[var(--color-ink-line)]" style={{ width: NOTCH * 2 + 2, height: NOTCH * 2 + 2, bottom: -NOTCH - 2, insetInlineEnd: STUB - NOTCH - 2 }} />
            </div>
          ) : (
            <div className="mt-7">
              <GooglePlayBadge height={platform === "android" ? 88 : 72} glow flush />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** "قريباً على iPhone" — هادئ، بلا شارة App Store ولا شعار Apple. */
function IosSoon({ className = "" }) {
  const { t } = useTranslation();
  return (
    <p className={`flex items-center gap-2 text-[13.5px] font-semibold text-[var(--color-mute)] ${className}`}>
      <Smartphone size={15} aria-hidden />
      {t("app.iosSoon")}
    </p>
  );
}
