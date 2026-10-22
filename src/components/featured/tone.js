import { getTypeMeta } from "../../lib/types.js";

const GOLD = { color: "#f0c63c", glow: "rgba(240,198,60,0.4)" };

/** لون الإطار = لون البطاقة نفسها: نوع العرض، أو الذهبي في وضع Premium. */
export function frameTone(company, premium) {
  if (premium) return GOLD;
  const m = getTypeMeta(company?.type);
  return { color: m.color, glow: m.glow };
}
