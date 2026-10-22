import { useEffect } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Sparkles, Megaphone } from "lucide-react";
import { useTranslation } from "react-i18next";
import { clamp } from "./hooks.js";
import { frameTone } from "./tone.js";
import "./featured.css";

export { frameTone };

// لمعة الهولوغرام: ثلاث درجات قريبة من لون البطاقة (اللون يبقى دالاً على النوع أو Premium)
const HOLO = {
  "#a6f000": ["rgba(233,255,154,0.3)", "rgba(166,240,0,0.26)", "rgba(110,255,210,0.2)"],
  "#38bdf8": ["rgba(165,243,252,0.3)", "rgba(56,189,248,0.26)", "rgba(196,181,253,0.2)"],
  "#fbbf24": ["rgba(253,230,138,0.3)", "rgba(251,191,36,0.26)", "rgba(252,165,165,0.2)"],
  "#f0c63c": ["rgba(255,247,214,0.32)", "rgba(240,198,60,0.28)", "rgba(255,228,134,0.22)"],
};

const SPRING = { stiffness: 170, damping: 20, mass: 0.5 };
const MAX_X = 5; // درجات
const MAX_Y = 7;

/**
 * إطار "واجهة العرض" حول بطاقة CompanyCard كما هي (بلا أي تعديل عليها):
 * حافة مضيئة بلون البطاقة يدور فيها قوس ضوء، هالة ثابتة، لمعة هولوغرام تتبع
 * المؤشر/ميلان الهاتف، ميلان خفيف، ووسم "مميّز" أو "مُموَّل".
 *  - variant: "stage" (الرئيسية) | "row" (صف /offers) | "soft" (شبكة /offers: ضوء خلفي فقط).
 *  - lit: البطاقة النشطة (الضوء الكامل). fx: المؤثرات المتحركة (false = نسخة ثابتة خفيفة).
 *  - nx/ny: MotionValues خارجية (-1..1) للميلان واللمعة؛ track: يتتبّع الماوس فوقه بنفسه.
 */
export default function FeaturedFrame({
  tone,
  label = "featured",
  variant = "stage",
  lit = true,
  fx = true,
  tilt = false,
  nx,
  ny,
  track = false,
  className = "",
  children,
}) {
  const { t } = useTranslation();
  const soft = variant === "soft";
  const ownX = useMotionValue(0);
  const ownY = useMotionValue(0);
  const inX = nx || ownX;
  const inY = ny || ownY;
  const rx = useSpring(0, SPRING);
  const ry = useSpring(0, SPRING);
  const hx = useSpring(0, SPRING);
  const hy = useSpring(0, SPRING);
  const live = fx && lit && !soft;

  useEffect(() => {
    if (!live) {
      rx.set(0);
      ry.set(0);
      hx.set(0);
      hy.set(0);
      return;
    }
    const apply = () => {
      const vx = inX.get();
      const vy = inY.get();
      hx.set(vx);
      hy.set(vy);
      ry.set(tilt ? vx * MAX_Y : 0);
      rx.set(tilt ? -vy * MAX_X : 0);
    };
    apply();
    const offX = inX.on("change", apply);
    const offY = inY.on("change", apply);
    return () => {
      offX();
      offY();
    };
  }, [live, tilt, inX, inY, rx, ry, hx, hy]);

  const sheenX = useTransform(hx, [-1, 1], ["-20%", "20%"]);
  const sheenY = useTransform(hy, [-1, 1], ["-12%", "12%"]);
  const specX = useTransform(hx, [-1, 1], ["-42%", "42%"]);
  const specY = useTransform(hy, [-1, 1], ["-36%", "36%"]);

  const holo = HOLO[tone.color] || HOLO["#a6f000"];
  const vars = {
    "--fx": tone.color,
    "--fx-glow": tone.glow,
    "--fx-soft": `${tone.color}3d`,
    "--fx-h1": holo[0],
    "--fx-h2": holo[1],
    "--fx-h3": holo[2],
  };

  // تتبّع الماوس فوق الإطار نفسه (صف /offers على الحاسوب)
  const handlers =
    track && live && !nx
      ? {
          onPointerMove: (e) => {
            if (e.pointerType !== "mouse") return;
            const r = e.currentTarget.getBoundingClientRect();
            ownX.set(clamp((e.clientX - (r.left + r.width / 2)) / (r.width / 2)));
            ownY.set(clamp((e.clientY - (r.top + r.height / 2)) / (r.height / 2)));
          },
          onPointerLeave: () => {
            ownX.set(0);
            ownY.set(0);
          },
        }
      : null;

  const Icon = label === "sponsored" ? Megaphone : Sparkles;

  return (
    <div
      className={`fx-frame ${soft ? "fx-soft" : ""} ${lit ? "is-lit" : ""} ${fx ? "is-fx" : ""} ${className}`}
      style={vars}
      {...handlers}
    >
      {soft ? (
        <span aria-hidden className="fx-backlight">
          <span className="fx-spin" />
        </span>
      ) : (
        <>
          <span aria-hidden className="fx-halo" />
          <span aria-hidden className="fx-bloom">
            <span className="fx-spin" />
          </span>
          <span aria-hidden className="fx-ring">
            <span className="fx-spin" />
          </span>
        </>
      )}

      <motion.div className="fx-body" style={fx && !soft ? { rotateX: rx, rotateY: ry, transformPerspective: 900 } : undefined}>
        {children}
        {fx && !soft && (
          <span aria-hidden className="fx-gloss">
            <motion.span className="fx-sheen" style={{ x: sheenX, y: sheenY }} />
            <motion.span className="fx-spec" style={{ x: specX, y: specY }} />
          </span>
        )}
      </motion.div>

      <span className={`fx-badge fx-badge-${label === "sponsored" ? "sponsored" : "featured"}`}>
        <Icon size={12} strokeWidth={2.6} aria-hidden />
        {t(`featured.badge.${label === "sponsored" ? "sponsored" : "featured"}`)}
      </span>
    </div>
  );
}
