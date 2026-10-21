import { useEffect, useState } from "react";
import { animate } from "framer-motion";
import { Crown, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { parseVal, withNum } from "../../../lib/values.js";
import { getTypeMeta, TYPE_META } from "../../../lib/types.js";
import { isImageUrl } from "../../CompanyLogo.jsx";
import { GlowSpot, useCardGlow } from "../../CardGlow.jsx";

const GOLD_SOFT = "#ffe486";
const GOLD = "#f0c63c";
const GOLD_DEEP = "#cf9a1e";
const INK = "#1d1403";

const TYPE_DB = { discount: "تخفيض", coupon: "كوبون", cashback: "كاش باك" };

/** عدّاد القيمة على الوجه الذهبي: من القيمة العادية إلى قيمة Premium. */
function CountUp({ from, to, run, reduced }) {
  const [text, setText] = useState(to);
  useEffect(() => {
    const a = parseVal(from);
    const b = parseVal(to);
    if (!run || reduced || !a || !b) {
      setText(to);
      return;
    }
    setText(from);
    const c = animate(a.num, b.num, {
      duration: 0.9,
      delay: 0.25,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setText(withNum(b, v)),
    });
    return () => c.stop();
  }, [from, to, run, reduced]);
  return <>{text}</>;
}

function Logo({ src, name, color }) {
  const [err, setErr] = useState(false);
  const img = isImageUrl(src) && !err;
  return (
    <span className="grid aspect-square w-[12cqw] shrink-0 place-items-center overflow-hidden rounded-[2.6cqw]" style={{ background: img ? "#fff" : "#18181c" }}>
      {img ? (
        <img src={src} alt="" onError={() => setErr(true)} className="h-full w-full object-cover" />
      ) : (
        <span className="text-[5.5cqw] font-black" style={{ color }}>
          {(name || "C").trim().charAt(0)}
        </span>
      )}
    </span>
  );
}

/** وجه واحد (عادي أو ذهبي) بنفس تخطيط الوجه المرسوم في نسخة الـ 3D. */
function Face({ f, premium, labels, valueNode }) {
  const color = premium ? INK : f.color;
  const Icon = (TYPE_META[TYPE_DB[f.typeKey]] || getTypeMeta()).icon;
  const top = premium
    ? { background: `linear-gradient(135deg, #fff1b8, ${GOLD_SOFT} 35%, ${GOLD} 70%, ${GOLD_DEEP})` }
    : { background: `radial-gradient(90% 70% at 85% -10%, ${f.color}38, transparent 60%), linear-gradient(180deg, #1c1c22, #141418)` };
  const stub = premium
    ? { background: `linear-gradient(135deg, ${GOLD} , ${GOLD_DEEP})` }
    : { background: `linear-gradient(180deg, #151519, #111114)` };
  const edge = premium ? "rgba(255,228,134,0.9)" : `${f.color}66`;
  // ضوء المؤشر بلون النوع (أو ذهبي في Premium) — نفس ضوء بطاقات العروض
  const glow = premium ? "rgba(240,198,60,0.4)" : (TYPE_META[TYPE_DB[f.typeKey]] || getTypeMeta()).glow;
  return (
    <div className="ticket absolute inset-0 flex flex-col" style={{ "--r": "4.2cqw", "--edge-base": edge, "--perf": premium ? "rgba(29,20,3,0.45)" : `${f.color}99` }}>
      <div className="ticket-top relative flex flex-1 flex-col justify-between p-[5.5cqw] pb-[3.5cqw]" style={top}>
        <GlowSpot color={glow} />
        <span aria-hidden className="ticket-ring ticket-ring-l" />
        <span aria-hidden className="ticket-ring ticket-ring-r" />
        <div className="relative flex items-start justify-between gap-[3cqw]">
          <div className="flex min-w-0 items-center gap-[3cqw]">
            {premium ? (
              <span className="flex items-center gap-[1.4cqw] rounded-full px-[3cqw] py-[1.2cqw] text-[3.1cqw] font-black" style={{ background: INK, color: GOLD_SOFT }}>
                <Crown className="h-[3.4cqw] w-[3.4cqw]" /> {labels.premiumBadge}
              </span>
            ) : (
              <Logo src={f.logo} name={f.name} color={f.color} />
            )}
            <div className="min-w-0">
              <div className="truncate text-[5cqw] font-extrabold leading-tight" style={{ color: premium ? INK : "#fff" }}>
                {f.name}
              </div>
              {!premium && <div className="truncate text-[3cqw] font-medium text-[#8d8d97]">{f.category}</div>}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-[1.2cqw]">
            {premium ? (
              [f.delta, f.extraBadge].filter(Boolean).map((txt) => (
                <span key={txt} className="rounded-full px-[2.8cqw] py-[1cqw] text-[2.8cqw] font-extrabold" style={{ background: "rgba(29,20,3,0.86)", color: GOLD_SOFT }}>
                  {txt}
                </span>
              ))
            ) : (
              <span className="flex items-center gap-[1cqw] rounded-full border px-[2.8cqw] py-[1cqw] text-[2.8cqw] font-extrabold" style={{ color: f.color, borderColor: `${f.color}66`, background: `${f.color}1f` }}>
                <Icon className="h-[3cqw] w-[3cqw]" /> {labels.type}
              </span>
            )}
          </div>
        </div>
        <div className="relative">
          <div className="text-[3cqw] font-semibold" style={{ color: premium ? "rgba(29,20,3,0.72)" : "#8d8d97" }}>
            {premium ? labels.premiumDiscount : labels.offerValue}
          </div>
          <div
            className="font-black leading-[0.95] tracking-tight [font-family:Inter,sans-serif]"
            style={{ color, fontSize: "15cqw", textShadow: premium ? "0 2px 0 rgba(255,255,255,0.5)" : `0 0 6cqw ${f.color}88` }}
          >
            {valueNode}
          </div>
        </div>
      </div>
      <div className="ticket-stub relative px-[5.5cqw] pb-[4.5cqw] pt-[4.2cqw]" style={stub}>
        <span aria-hidden className="ticket-ring ticket-ring-l" />
        <span aria-hidden className="ticket-ring ticket-ring-r" />
        <GlowSpot color={glow} />
        <span aria-hidden className="ticket-perf" />
        <div
          className="relative flex items-center justify-between rounded-[2.6cqw] border border-dashed px-[3.4cqw] py-[2.2cqw]"
          style={{ borderColor: premium ? "rgba(29,20,3,0.4)" : `${f.color}73`, background: premium ? "rgba(29,20,3,0.08)" : `${f.color}0f` }}
        >
          <span className="text-[2.8cqw] font-bold" style={{ color: premium ? "rgba(29,20,3,0.75)" : "#8d8d97" }}>
            {premium ? labels.premiumCode : labels.code}
          </span>
          {premium ? (
            <span className="flex items-center gap-[2cqw] font-black" style={{ color: INK }}>
              <span dir="ltr" className="text-[4.4cqw] tracking-[0.3em]">••••••</span>
              <Lock className="h-[4cqw] w-[4cqw]" />
            </span>
          ) : (
            <span dir="ltr" className="font-mono text-[5cqw] font-extrabold tracking-[0.12em] text-white">
              {f.code}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * الكوبون السحري بنسخة 2D خفيفة (هواتف ضعيفة / prefers-reduced-motion / قبل تحميل الـ 3D).
 * الانقلاب عبر CSS 3D (rotateY) — ومع تقليل الحركة: تبديل ناعم بالشفافية فقط.
 * angleDeg: زاوية الانقلاب الحالية (flipIndex×180 + السحب الحيّ).
 */
export default function MagicCoupon2D({ faces, labels, mode, angleDeg, dragging, reduced, hidden }) {
  const { i18n } = useTranslation();
  const premium = mode === "premium";
  const glow = useCardGlow();

  if (!faces) {
    return (
      <div className="absolute inset-0 animate-pulse rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)]" />
    );
  }

  const valueBack = <CountUp key={`${faces.normal}-${faces.premium}-${i18n.language}`} from={faces.normal} to={faces.premium} run={premium} reduced={reduced} />;

  return (
    <div
      ref={glow.ref}
      {...glow.handlers}
      aria-hidden
      className="group absolute inset-0 transition-opacity duration-500"
      style={{ opacity: hidden ? 0 : 1, perspective: "1400px" }}
    >
      {reduced ? (
        <>
          <div className="absolute inset-0 transition-opacity duration-300" style={{ opacity: premium ? 0 : 1 }}>
            <Face f={faces} labels={labels} valueNode={faces.normal} />
          </div>
          <div className="absolute inset-0 transition-opacity duration-300" style={{ opacity: premium ? 1 : 0 }}>
            <Face f={faces} premium labels={labels} valueNode={valueBack} />
          </div>
        </>
      ) : (
        <div
          className="absolute inset-0"
          style={{
            transformStyle: "preserve-3d",
            transform: `rotateY(${angleDeg}deg)`,
            transition: dragging ? "none" : "transform 0.85s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <div className="absolute inset-0" style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}>
            <Face f={faces} labels={labels} valueNode={faces.normal} />
          </div>
          <div
            className="absolute inset-0"
            style={{ transform: "rotateY(180deg)", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
          >
            <Face f={faces} premium labels={labels} valueNode={valueBack} />
          </div>
        </div>
      )}
    </div>
  );
}
