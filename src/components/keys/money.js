import { formatNumber } from "../../lib/values.js";

/** "2,300 دج" / "9$" / "8.50$" — نفس كتابة المبالغ في الموقع (pricing.dzd / purchase.usd). */
export function formatMoney(t, lang, amount, currency) {
  const n = Number(amount);
  if (amount == null || amount === "" || !Number.isFinite(n)) return "";
  const s = Number.isInteger(n)
    ? formatNumber(n, lang)
    : new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  const cur = String(currency || "").toUpperCase();
  if (cur === "DZD") return t("pricing.dzd", { dzd: s });
  if (cur === "USD") return t("purchase.usd", { usd: s });
  return `${s} ${cur}`;
}
