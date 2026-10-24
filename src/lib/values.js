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

// العربية: أرقام لاتينية بفاصلة للآلاف (300,000) — نفس كتابة الأسعار في كل الموقع.
const NUMBER_LOCALES = { ar: "en-US", en: "en-US", fr: "fr-FR" };

/**
 * مبلغ بالدولار كرقم بارز: "1,176$" (ar، كيما "39$" في الأسعار)، "$1,176" (en)، "1 176 $" (fr).
 * يتعرض داخل <bdi dir="ltr"> باش الرمز ما يقفزش للجهة الأخرى في الصفحة العربية.
 */
export function formatUsd(n, lang) {
  const v = formatNumber(n, lang);
  return lang === "en" ? `$${v}` : lang === "fr" ? `${v}\u00a0$` : `${v}$`;
}

// Intl.NumberFormat غالي في الإنشاء (كان يتصنع في كل نداء: ~40ms في تحميل /offers بـ CPU ×4) → واحد لكل لغة
const NUMBER_FORMATS = new Map();
/** تنسيق رقم كبير حسب لغة العرض (فواصل الآلاف). */
export function formatNumber(n, lang) {
  try {
    const locale = NUMBER_LOCALES[lang] || "en-US";
    let f = NUMBER_FORMATS.get(locale);
    if (!f) NUMBER_FORMATS.set(locale, (f = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })));
    return f.format(n);
  } catch {
    return String(Math.round(n));
  }
}
