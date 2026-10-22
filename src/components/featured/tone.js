import { getTypeMeta } from "../../lib/types.js";
import { hasPremiumOffer } from "../../lib/premiumOffer.js";

const GOLD = { color: "#f0c63c", glow: "rgba(240,198,60,0.4)" };
const FROZEN = { color: "#71717a", glow: "rgba(113,113,122,0.22)" };

/** لون الإطار = لون البطاقة نفسها: نوع العرض، أو الذهبي في وضع Premium (والرمادي إن كانت مجمّدة). */
export function frameTone(company, premium) {
  if (premium) return hasPremiumOffer(company) ? GOLD : FROZEN;
  const m = getTypeMeta(company?.type);
  return { color: m.color, glow: m.glow };
}
