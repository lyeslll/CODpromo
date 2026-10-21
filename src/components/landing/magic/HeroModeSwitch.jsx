import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Crown } from "lucide-react";
import { useTranslation } from "react-i18next";
import GoldBurst from "../../GoldBurst.jsx";

/**
 * مقبض "عادي ⇄ Premium" تحت الكوبون السحري: يُسحب المقبض (ماوس أو لمس) أو يُضغط
 * على أحد الجانبين، ويعمل بلوحة المفاتيح (Space/Enter/الأسهم). role="switch".
 */
export default function HeroModeSwitch({ mode, onChange, onInteract, burst }) {
  const { t, i18n } = useTranslation();
  const rtl = i18n.language === "ar";
  const premium = mode === "premium";
  const trackRef = useRef(null);
  const drag = useRef(null);
  const [dragX, setDragX] = useState(null); // موضع المقبض أثناء السحب (px من اليسار)

  // في RTL "عادي" على اليمين؛ في LTR على اليسار
  const premiumOnRight = !rtl;
  const knobRight = premium === premiumOnRight;

  const width = () => trackRef.current?.offsetWidth || 260;
  const restX = () => (knobRight ? width() / 2 : 0);

  const pick = (wantPremium) => {
    onInteract?.();
    if (wantPremium !== premium) onChange(wantPremium ? "premium" : "normal");
  };

  const onPointerDown = (e) => {
    onInteract?.();
    drag.current = { x0: e.clientX, start: restX(), moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x0;
    if (Math.abs(dx) > 4) d.moved = true;
    if (d.moved) setDragX(Math.min(Math.max(d.start + dx, 0), width() / 2));
  };
  const onPointerUp = (e) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const r = trackRef.current.getBoundingClientRect();
    if (d.moved) {
      const x = (dragX ?? d.start) + width() / 4; // مركز المقبض
      const onRight = x > width() / 2;
      setDragX(null);
      pick(onRight === premiumOnRight);
    } else {
      const onRight = e.clientX > r.left + r.width / 2;
      pick(onRight === premiumOnRight);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      pick(!premium);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const right = e.key === "ArrowRight";
      pick(right === premiumOnRight);
    }
  };

  const x = dragX ?? restX();
  const knobBg = premium
    ? "linear-gradient(135deg, #ffe486, #cf9a1e)"
    : "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))";

  return (
    <div className="relative">
      <div
        ref={trackRef}
        role="switch"
        tabIndex={0}
        aria-checked={premium}
        aria-label={t("hero.magic.switchLabel")}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          drag.current = null;
          setDragX(null);
        }}
        dir="ltr"
        className="relative flex h-[52px] w-[260px] cursor-grab touch-none select-none items-center rounded-2xl border border-[var(--color-ink-line)] bg-[var(--elev)]/90 p-1 outline-none backdrop-blur focus-visible:ring-2 focus-visible:ring-[var(--color-lime)] active:cursor-grabbing"
      >
        <motion.span
          aria-hidden
          className="absolute inset-y-1 start-1 w-[calc(50%-4px)] rounded-xl"
          style={{ background: knobBg, boxShadow: premium ? "0 8px 24px -8px rgba(240,198,60,0.6)" : "0 8px 24px -10px rgba(166,240,0,0.55)" }}
          animate={{ x }}
          transition={dragX != null ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
        />
        {[
          { key: "left", isPremium: !premiumOnRight },
          { key: "right", isPremium: premiumOnRight },
        ].map((side) => {
          const active = side.isPremium === premium;
          return (
            <span
              key={side.key}
              dir={rtl ? "rtl" : "ltr"}
              className="relative z-10 flex h-full flex-1 items-center justify-center gap-1.5 text-[14px] font-extrabold transition-colors"
              style={{ color: active ? "#0a0a0a" : "var(--text-softer)" }}
            >
              {side.isPremium && <Crown size={15} />}
              {side.isPremium ? t("premiumToggle.premium") : t("premiumToggle.normal")}
            </span>
          );
        })}
      </div>
      <GoldBurst fire={burst} count={18} />
    </div>
  );
}
