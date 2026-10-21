// ============================================================
//  CODpromo — قراءة قيم العروض النصية ("20%" / "10$" / "$5 gift" / "500 دج")
//  إلى { prefix, num, suffix } لعدّاد الأرقام المتحرّك، بلا تغيير النص الأصلي.
// ============================================================

/** "20%" → { prefix: "", num: 20, suffix: "%" } · نص بلا رقم → null. */
export function parseVal(v) {
  const m = String(v ?? "").match(/^(\D*)([\d.,]+)(.*)$/s);
  if (!m) return null;
  const num = parseFloat(m[2].replace(/,/g, ""));
  if (Number.isNaN(num)) return null;
  return { prefix: m[1], num, suffix: m[3] };
}

/** يعيد بناء القيمة بنفس البادئة واللاحقة مع رقم جديد (للعدّ التصاعدي). */
export function withNum(parsed, n) {
  if (!parsed) return "";
  return `${parsed.prefix}${Math.round(n)}${parsed.suffix}`;
}

/** تنسيق رقم كبير حسب لغة العرض (فواصل الآلاف). */
export function formatNumber(n, lang) {
  try {
    return new Intl.NumberFormat(lang === "ar" ? "ar-DZ" : lang, { maximumFractionDigits: 0 }).format(n);
  } catch {
    return String(Math.round(n));
  }
}
