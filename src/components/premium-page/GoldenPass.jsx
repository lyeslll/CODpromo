import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Crown, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import LifetimePrice from "../pricing/LifetimePrice.jsx";
import SeatsMeter from "../pricing/SeatsMeter.jsx";
import "./premium-page.css";

const GOLD_SOFT = "#ffe486";
const GOLD = "#f0c63c";
const GOLD_DEEP = "#cf9a1e";
const TICKET_VARS = {
  "--r": "14px",
  "--edge-base": "rgba(240,198,60,0.5)",
  "--edge-strong": "rgba(240,198,60,0.75)",
  "--perf": "rgba(240,198,60,0.6)",
};
// أقصى ميلان (درجات) عند حافة منطقة التتبّع
const MAX_TILT = 11;

/**
 * البطاقة الذهبية في أعلى /premium: "بطاقة Premium" بشكل تذاكر الكوبون.
 *  - logos: لوغوهات حقيقية (شركات بكود Premium)، companiesText: "23 شركة" (من القاعدة).
 *  - fx: الكمبيوتر برك (CSS 3D + لمعة + طفو). trackRef = المنطقة اللي يتتبّع فيها الماوس (الـ Hero).
 *  - member: Premium مفعّل → ختم "مفعّل" بلاصة السعر.
 */
export default function GoldenPass({ pricing, logos = [], companiesText, holder, member = false, fx = false, trackRef }) {
  const { t } = useTranslation();
  const stageRef = useRef(null);

  // الماوس فوق الـ Hero → ميلان + لمعة (متغيّرات CSS، بلا إعادة رسم React)
  useEffect(() => {
    if (!fx) return;
    const area = trackRef?.current;
    const stage = stageRef.current;
    if (!area || !stage) return;
    let raf = 0;
    let px = 0;
    let py = 0;
    const apply = () => {
      raf = 0;
      const r = stage.getBoundingClientRect();
      const nx = Math.max(-1, Math.min(1, (px - (r.left + r.width / 2)) / (r.width * 1.1)));
      const ny = Math.max(-1, Math.min(1, (py - (r.top + r.height / 2)) / (r.height * 0.9)));
      stage.style.setProperty("--ry", `${(nx * MAX_TILT).toFixed(2)}deg`);
      stage.style.setProperty("--rx", `${(-ny * MAX_TILT * 0.8).toFixed(2)}deg`);
      stage.style.setProperty("--mx", `${(50 + nx * 45).toFixed(1)}%`);
      stage.style.setProperty("--my", `${(35 + ny * 40).toFixed(1)}%`);
    };
    const onMove = (e) => {
      px = e.clientX;
      py = e.clientY;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const onEnter = () => {
      stage.classList.add("is-tracking");
      stage.style.setProperty("--sheen", "1");
    };
    // خروج الماوس: نرجعو لميلان الراحة (المعرّف في CSS)
    const onLeave = () => {
      stage.classList.remove("is-tracking");
      for (const v of ["--rx", "--ry", "--mx", "--my"]) stage.style.removeProperty(v);
      stage.style.setProperty("--sheen", "0");
    };
    area.addEventListener("pointermove", onMove);
    area.addEventListener("pointerenter", onEnter);
    area.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      area.removeEventListener("pointermove", onMove);
      area.removeEventListener("pointerenter", onEnter);
      area.removeEventListener("pointerleave", onLeave);
    };
  }, [fx, trackRef]);

  // لحظة "الإصدار" (مرة وحدة): الكمبيوتر تطلع من تحت بزاوية، الهاتف ظهور بسيط
  const enter = fx
    ? { initial: { opacity: 0, y: 70, rotateX: 38 }, animate: { opacity: 1, y: 0, rotateX: 0 }, transition: { type: "spring", stiffness: 70, damping: 16, delay: 0.15 } }
    : { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.4 } };

  return (
    <div ref={stageRef} className={`gpass-stage ${fx ? "gpass-fx" : ""}`} role="img" aria-label={t("premiumPage.pass.label")}>
      <div aria-hidden className="gpass-glow" />
      <div className="gpass-float">
        <motion.div {...enter} style={{ transformStyle: "preserve-3d" }}>
        <div className="gpass-tilt relative">
          {fx && (
            <div
              aria-hidden
              className="gpass-plate pointer-events-none absolute inset-0 rounded-[var(--radius-card)]"
              style={{ background: "linear-gradient(160deg, rgba(240,198,60,0.16), rgba(207,154,30,0.04))", border: "1px solid rgba(240,198,60,0.16)" }}
            />
          )}

          <div className="ticket ticket-premium relative" style={TICKET_VARS} aria-hidden>
            <div
              className="ticket-top relative px-6 pb-6 pt-5"
              style={{ background: "radial-gradient(120% 80% at 100% 0%, rgba(240,198,60,0.2), transparent 55%), linear-gradient(170deg, #1a1710, var(--color-ink-card) 70%)" }}
            >
              {fx && <span className="gpass-sheen" />}
              {/* اللوغو + Premium في البداية، والختم الذهبي يطفو في الركن الآخر */}
              <div className="relative flex items-center gap-2.5">
                <img src="/logo-dark.png" alt="" width={1917} height={459} className="h-[22px] w-auto" decoding="async" />
                <span className="h-4 w-px bg-[rgba(240,198,60,0.35)]" />
                <span className="text-[13px] font-black" style={{ color: GOLD_SOFT }}>
                  {t("premiumToggle.premium")}
                </span>
              </div>

              <p className="gpass-gold-text relative mt-7 text-[42px] font-black leading-none tracking-tight">{t("premiumPage.pass.lifetime")}</p>

              {companiesText && (
                <div className="relative mt-5 flex items-center gap-3">
                  {logos.length > 0 && (
                    <span className="flex shrink-0 -space-x-2 rtl:space-x-reverse">
                      {logos.slice(0, 5).map((l) => (
                        <img
                          key={l.id}
                          src={l.logo}
                          alt=""
                          width={30}
                          height={30}
                          loading="lazy"
                          decoding="async"
                          className="h-[30px] w-[30px] rounded-full border-2 object-cover"
                          style={{ borderColor: "#1a1710", background: "#1c1c20" }}
                        />
                      ))}
                    </span>
                  )}
                  <span className="text-[13px] font-bold leading-snug text-[var(--text-softer)]">
                    {companiesText} {t("premiumPage.pass.reach")}
                  </span>
                </div>
              )}

              <div className="relative mt-5 flex items-baseline justify-between gap-3 border-t border-dashed pt-3" style={{ borderColor: "rgba(240,198,60,0.22)" }}>
                <span className="text-[11.5px] font-bold text-[var(--color-mute)]">{t("premiumPage.pass.holder")}</span>
                <bdi className="min-w-0 truncate text-[14px] font-extrabold text-[var(--text)]">{holder || t("premiumPage.pass.holderGuest")}</bdi>
              </div>
            </div>

            <div className="ticket-stub relative px-6 pb-5 pt-4" style={{ background: "rgba(240,198,60,0.07)" }}>
              <span className="ticket-ring ticket-ring-l" />
              <span className="ticket-ring ticket-ring-r" />
              <span className="ticket-perf" />
              {member ? (
                <div className="flex items-center justify-between gap-3 py-1">
                  <span className="text-[13px] font-extrabold" style={{ color: GOLD_SOFT }}>
                    {t("premiumPage.pass.lifetime")}
                  </span>
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-[13px] font-black"
                    style={{ borderColor: GOLD, color: GOLD_SOFT, transform: "rotate(-4deg)" }}
                  >
                    <Check size={14} strokeWidth={3} /> {t("premiumPage.pass.active")}
                  </span>
                </div>
              ) : pricing ? (
                <>
                  <div className="flex items-end justify-between gap-3">
                    <LifetimePrice pricing={pricing} size="md" />
                    <span className="mb-1 shrink-0 text-[11.5px] font-extrabold" style={{ color: GOLD }}>
                      {t("premiumPage.pass.oneTime")}
                    </span>
                  </div>
                  <SeatsMeter pricing={pricing} className="mt-3" />
                </>
              ) : (
                <div className="h-[46px] w-2/3 animate-pulse rounded-xl bg-[var(--fill-strong)]" />
              )}
            </div>
          </div>

          {/* ختم التاج: يطفو قدّام البطاقة في الكمبيوتر */}
          <motion.span
            aria-hidden
            className="gpass-seal absolute -top-5 end-6 grid h-14 w-14 place-items-center rounded-full text-[#1d1403]"
            style={{ background: `linear-gradient(135deg, ${GOLD_SOFT}, ${GOLD} 55%, ${GOLD_DEEP})`, boxShadow: "0 10px 26px -10px rgba(240,198,60,0.8), inset 0 0 0 2px rgba(255,255,255,0.35)" }}
            initial={fx ? { scale: 0, rotate: -30 } : false}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.7 }}
          >
            <Crown size={24} />
          </motion.span>
        </div>
        </motion.div>
      </div>
    </div>
  );
}
