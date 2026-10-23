import { motion, useReducedMotion } from "framer-motion";
import { Crown } from "lucide-react";
import "./gift.css";

const EASE = [0.16, 1, 0.3, 1];
const BEAMS = [-34, -17, 0, 17, 34];

/**
 * العلبة الذهبية تاع صفحة الهدية.
 * state: closed (تنزل مرة وحدة والبطاقة تتأرجح) | opening (تهتزّ وقت التفعيل) | open (الغطاء يطير
 * والتاج يطلع مع أشعّة) | dim (هدية غير متاحة: رمادية بلا حركة).
 * tagMain / tagSub: نص البطاقة الورقية (المدة + Premium). prefers-reduced-motion → بلا حركة، تبدّل برك.
 */
export default function GiftBox({ state = "closed", tagMain, tagSub }) {
  const reduce = useReducedMotion();
  const open = state === "open";
  const dim = state === "dim";

  const lid = open
    ? reduce
      ? { opacity: 0 }
      : { y: "-62%", x: "6%", rotate: -16, opacity: 0, transition: { duration: 0.75, ease: EASE } }
    : { y: 0, x: 0, rotate: 0, opacity: 1 };

  const shake =
    state === "opening" && !reduce
      ? { rotate: [0, -2.5, 2.5, -1.5, 1.5, 0], transition: { duration: 0.6, repeat: Infinity, repeatDelay: 0.25 } }
      : { rotate: 0 };

  return (
    <motion.div
      className={`gbox ${dim ? "gbox-dim" : ""}`}
      initial={reduce || dim ? false : { y: -36, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 170, damping: 15, mass: 0.9 }}
      aria-hidden
    >
      <span className="gbox-glow" />
      <span className="gbox-ground" />

      <motion.div className="absolute inset-0" animate={shake}>
        {/* ما يخرج كي تتفتح: أشعّة + تاج Premium */}
        <div className="gbox-reveal">
          {BEAMS.map((deg, i) => (
            <motion.span
              key={deg}
              className="gbox-beam"
              style={{ rotate: deg, transformOrigin: "50% 100%" }}
              initial={false}
              animate={open ? { scaleY: 1, opacity: reduce ? 0.55 : [0, 0.9, 0.55] } : { scaleY: 0, opacity: 0 }}
              transition={{ duration: reduce ? 0.2 : 0.9, delay: reduce ? 0 : 0.18 + Math.abs(i - 2) * 0.06, ease: EASE }}
            />
          ))}
          <motion.span
            className="gbox-crown"
            initial={false}
            animate={open ? { y: "-24%", scale: 1, opacity: 1 } : { y: "40%", scale: 0.5, opacity: 0 }}
            transition={reduce ? { duration: 0.2 } : { type: "spring", stiffness: 210, damping: 14, delay: 0.32 }}
          >
            <Crown strokeWidth={2.2} style={{ width: "52%", height: "52%" }} />
          </motion.span>
        </div>

        <div className="gbox-base">
          <span className="gbox-ribbon" />
        </div>

        <motion.div className="gbox-lid-group" initial={false} animate={lid}>
          <span className="gbox-string" />
          <div className="gbox-lid">
            <span className="gbox-ribbon" />
          </div>
          <svg className="gbox-bow" viewBox="0 0 120 62" fill="none">
            <defs>
              <linearGradient id="gbox-satin" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#34343b" />
                <stop offset="1" stopColor="#0b0b0d" />
              </linearGradient>
            </defs>
            <path d="M60 46 C 42 6, 6 2, 11 30 C 15 48, 43 50, 60 46 Z" fill="url(#gbox-satin)" stroke="rgba(255,228,134,0.5)" strokeWidth="1.6" />
            <path d="M60 46 C 78 6, 114 2, 109 30 C 105 48, 77 50, 60 46 Z" fill="url(#gbox-satin)" stroke="rgba(255,228,134,0.5)" strokeWidth="1.6" />
            <path d="M24 28 C 30 16, 44 18, 52 38" stroke="rgba(255,228,134,0.28)" strokeWidth="1.4" strokeLinecap="round" />
            <path d="M96 28 C 90 16, 76 18, 68 38" stroke="rgba(255,228,134,0.28)" strokeWidth="1.4" strokeLinecap="round" />
            <rect x="50" y="35" width="20" height="20" rx="6" fill="url(#gbox-satin)" stroke="rgba(255,228,134,0.55)" strokeWidth="1.6" />
          </svg>
          {tagMain && (
            <motion.div
              className="gbox-tag"
              initial={reduce || dim ? false : { rotate: 16 }}
              animate={{ rotate: -4 }}
              transition={{ type: "spring", stiffness: 60, damping: 5, delay: 0.25 }}
            >
              <div className="gbox-tag-paper">
                <span className="gbox-tag-hole" />
                <span className="gbox-tag-main">{tagMain}</span>
                {tagSub && (
                  <span className="gbox-tag-sub">
                    <Crown strokeWidth={2.6} style={{ width: "1.05em", height: "1.05em" }} /> {tagSub}
                  </span>
                )}
              </div>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
