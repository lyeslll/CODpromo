import { formatNumber } from "../../lib/values.js";

/**
 * "2,300 دج" / "9$" / "8.50$" — نفس كتابة المبالغ في الموقع (pricing.dzd / purchase.usd).
 * minus: خصم "−2,300 دج" — الرقم بإشارتو معزول (LRI … PDI) باش الإشارة ما تقفزش في الجملة العربية.
 */
export function formatMoney(t, lang, amount, currency, { minus = false } = {}) {
  const n = Number(amount);
  if (amount == null || amount === "" || !Number.isFinite(n)) return "";
  const s = Number.isInteger(n)
    ? formatNumber(n, lang)
    : new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  const v = minus ? `\u2066\u2212${s}\u2069` : s;
  const cur = String(currency || "").toUpperCase();
  if (cur === "DZD") return t("pricing.dzd", { dzd: v });
  if (cur === "USD") return t("purchase.usd", { usd: v });
  return `${v} ${cur}`;
}
