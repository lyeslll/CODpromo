import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useInView, useMotionValue } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import CompanyCard from "../CompanyCard.jsx";
import FeaturedFrame, { frameTone } from "./FeaturedFrame.jsx";
import FeaturedCarousel from "./FeaturedCarousel.jsx";
import FeaturedParticles from "./FeaturedParticles.jsx";
import { canUseFx } from "../../lib/fxCapability.js";
import { clamp, useElementWidth } from "./hooks.js";

// المسرح ثلاثي الأبعاد يحتاج هذا العرض على الأقل؛ أقل منه = شرائح بالسحب
const STAGE_MIN = 940;
const SLOT_W = 360;
const POSE_SPRING = { type: "spring", stiffness: 210, damping: 30, mass: 0.9 };
const EASE = [0.16, 1, 0.3, 1];

/** وضعية كل بطاقة حسب بعدها عن النشطة (s = الجهة المرئية: +1 يمين، -1 يسار). */
function poseFor(off, rtl, step) {
  const a = Math.abs(off);
  const s = Math.sign(off) * (rtl ? -1 : 1);
  if (a === 0) return { x: 0, z: 0, rotateY: 0, scale: 1, opacity: 1 };
  // الجانبان: إلى الخلف وحافتهما الخارجية نحو الزائر (واجهة عرض مقعّرة)
  if (a === 1) return { x: s * step, z: -170, rotateY: -s * 26, scale: 0.86, opacity: 1 };
  return { x: s * step * 1.5, z: -320, rotateY: -s * 34, scale: 0.72, opacity: 0 };
}

/**
 * عرض القسم المميّز (يُحمَّل lazy عند الوصول للقسم):
 *  - حاسوب (عرض ≥ 940): مسرح 3D بـ CSS — مصباح ومخروط ضوء وغبار، البطاقة في
 *    الوسط أكبر والجانبان بزاوية في العمق، ميلان مع الماوس، أسهم ونقاط ولوحة المفاتيح.
 *  - أقل: شرائح بالسحب، البطاقة في الوسط تكبر وتضيء، وميلان الهاتف.
 *  - fx = false (تقليل الحركة / جهاز ضعيف / توفير البيانات): نفس البطاقات بلا 3D ولا جزيئات.
 *  - preview (معاينة الأدمن): البطاقات غير تفاعلية (لا نسخ يُسجَّل).
 */
export default function FeaturedShowcase({
  items,
  premiumMode = false,
  favorites = [],
  onToggleFav,
  onCopy,
  unlocked = false,
  onUnlock,
  preview = false,
}) {
  const { i18n } = useTranslation();
  const rtl = i18n.dir(i18n.language) === "rtl";
  const wrapRef = useRef(null);
  const width = useElementWidth(wrapRef);
  const fx = useMemo(() => canUseFx(), []);

  const tones = useMemo(
    () => items.map((it) => frameTone(it.company, premiumMode && it.company.supports_premium !== false)),
    [items, premiumMode]
  );

  const renderCard = (it, i) => {
    const card = (
      <CompanyCard
        company={it.company}
        index={i}
        isFavorite={favorites.includes(it.company.id)}
        onToggleFav={onToggleFav || (() => {})}
        onCopy={onCopy || (() => {})}
        premium={premiumMode && it.company.supports_premium !== false}
        unlocked={unlocked}
        onUnlock={onUnlock}
        copySource="featured"
      />
    );
    return preview ? (
      <div inert="" className="grid grid-cols-1">
        {card}
      </div>
    ) : (
      card
    );
  };

  let body = null;
  if (width > 0) {
    if (width < STAGE_MIN) {
      body = <FeaturedCarousel items={items} tones={tones} fx={fx} renderCard={renderCard} width={width} gyro={fx && !preview} bleed={!preview} />;
    } else if (fx) {
      body = <Stage items={items} tones={tones} renderCard={renderCard} rtl={rtl} width={width} />;
    } else {
      body = <LiteRow items={items} tones={tones} renderCard={renderCard} />;
    }
  }

  return <div ref={wrapRef}>{body}</div>;
}

/* ===================== المسرح (حاسوب) ===================== */
function Stage({ items, tones, renderCard, rtl, width }) {
  const { t } = useTranslation();
  const n = items.length;
  const [active, setActive] = useState(0);
  const [settled, setSettled] = useState(false);
  const stageRef = useRef(null);
  const inView = useInView(stageRef, { once: true, amount: 0.35 });
  const nx = useMotionValue(0);
  const ny = useMotionValue(0);
  const step = Math.round(Math.max(270, Math.min(345, width * 0.29)));

  // بعد مشهد الافتتاح: الانتقالات تصير نوابض سريعة
  useEffect(() => {
    if (!inView) return;
    const id = setTimeout(() => setSettled(true), 1500);
    return () => clearTimeout(id);
  }, [inView]);

  useEffect(() => {
    if (active >= n) setActive(0);
  }, [active, n]);

  const go = useCallback((i) => setActive(((i % n) + n) % n), [n]);
  // الأسهم في لوحة المفاتيح: نحو البطاقة الظاهرة في تلك الجهة
  const goSide = (dir) => go(active + dir * (rtl ? -1 : 1));
  const onKeyDown = (e) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      goSide(-1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      goSide(1);
    }
  };

  const onPointerMove = (e) => {
    if (e.pointerType !== "mouse") return;
    const r = stageRef.current.getBoundingClientRect();
    nx.set(clamp((e.clientX - (r.left + r.width / 2)) / (r.width * 0.32)));
    ny.set(clamp((e.clientY - (r.top + r.height / 2)) / (r.height * 0.5)));
  };
  const onPointerLeave = () => {
    nx.set(0);
    ny.set(0);
  };

  const tone = tones[active] || tones[0];

  return (
    <div>
      <div
        ref={stageRef}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        className="fx-stage relative mt-6 grid justify-items-center pb-16 pt-16"
      >
        {/* الضوء: يشتعل المصباح مرة واحدة عند الوصول، ثم يبقى ثابتاً */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: [0, 1, 0.35, 1] } : { opacity: 0 }}
          transition={{ duration: 0.9, times: [0, 0.35, 0.55, 1], ease: "easeOut" }}
        >
          <span className="fx-cone" />
          <FeaturedParticles color={tone.color} count={40} />
          {items.map((it, i) => (
            <span
              key={it.company.id}
              className="fx-floor"
              style={{ "--fx-glow": tones[i].glow, opacity: i === active ? 0.55 : 0, transition: "opacity 0.5s ease" }}
            />
          ))}
          <span className="fx-lamp" style={{ "--fx-glow": tone.glow }} />
        </motion.div>

        {items.map((it, i) => {
          let off = i - active;
          if (off > n / 2) off -= n;
          if (off < -n / 2) off += n;
          const a = Math.abs(off);
          const pose = poseFor(off, rtl, step);
          const delay = 0.25 + a * 0.14;
          return (
            <motion.div
              key={it.company.id}
              className="relative [grid-area:1/1]"
              style={{ width: SLOT_W, zIndex: 10 - a, pointerEvents: a > 1 ? "none" : undefined }}
              initial={{ ...pose, opacity: 0, y: 48 }}
              animate={inView ? { ...pose, y: 0 } : { ...pose, opacity: 0, y: 48 }}
              transition={
                settled
                  ? POSE_SPRING
                  : { default: POSE_SPRING, y: { duration: 0.9, delay, ease: EASE }, opacity: { duration: 0.7, delay, ease: "easeOut" } }
              }
              aria-hidden={a > 0 || undefined}
            >
              <div inert={a > 0 ? "" : undefined}>
                <FeaturedFrame tone={tones[i]} label={it.label} lit={a === 0} fx tilt={a === 0} nx={nx} ny={ny}>
                  {renderCard(it, i)}
                </FeaturedFrame>
              </div>
              {/* الجانبان: معتمان، والنقر عليهما يجلبهما للوسط */}
              <button
                type="button"
                tabIndex={-1}
                aria-hidden
                onClick={() => go(i)}
                className="absolute inset-0 z-10 cursor-pointer rounded-[30px]"
                style={{
                  background: "rgba(10,10,10,0.5)",
                  opacity: a === 0 ? 0 : 1,
                  pointerEvents: a === 1 ? "auto" : "none",
                  transition: "opacity 0.45s ease",
                }}
              />
            </motion.div>
          );
        })}
      </div>

      {n > 1 && (
        <div className="flex items-center justify-center gap-3" onKeyDown={onKeyDown}>
          <NavButton label={t("featured.prev")} onClick={() => go(active - 1)}>
            <ChevronRight size={18} className="ltr:rotate-180" />
          </NavButton>
          <div className="flex items-center gap-1">
            {items.map((it, i) => (
              <button
                key={it.company.id}
                type="button"
                onClick={() => go(i)}
                aria-label={t("featured.goTo", { name: it.company.name })}
                aria-current={i === active || undefined}
                className="grid h-8 place-items-center px-1"
              >
                <span
                  className="block h-2 rounded-full transition-[width,background-color] duration-300"
                  style={{ width: i === active ? 24 : 8, background: i === active ? tones[i].color : "rgba(255,255,255,0.22)" }}
                />
              </button>
            ))}
          </div>
          <NavButton label={t("featured.next")} onClick={() => go(active + 1)}>
            <ChevronLeft size={18} className="ltr:rotate-180" />
          </NavButton>
        </div>
      )}
    </div>
  );
}

function NavButton({ label, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-10 w-10 place-items-center rounded-full border border-[var(--color-ink-line)] bg-[var(--fill)] text-[var(--text-softer)] transition-colors hover:bg-[var(--fill-strong)] hover:text-[var(--text)]"
    >
      {children}
    </button>
  );
}

/* ===================== النسخة الخفيفة (حاسوب بلا مؤثرات) ===================== */
function LiteRow({ items, tones, renderCard }) {
  return (
    <div className="relative pt-14">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <span className="fx-cone" />
        <span className="fx-lamp" style={{ "--fx-glow": tones[0]?.glow }} />
      </div>
      <div className="relative flex flex-wrap justify-center gap-6 py-4">
        {items.map((it, i) => (
          <div key={it.company.id} style={{ width: 340 }}>
            <FeaturedFrame tone={tones[i]} label={it.label} lit fx={false}>
              {renderCard(it, i)}
            </FeaturedFrame>
          </div>
        ))}
      </div>
    </div>
  );
}
