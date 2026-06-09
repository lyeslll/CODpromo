// باقات الدفع الجزائري (SlickPay) — للعرض فقط. المبالغ والمدد الموثوقة
// محسوبة في Edge Function على الخادم ولا يُوثق بأي قيمة من المتصفّح.
export const DZ_PLANS = [
  { key: "month", label: "شهر", months: 1, price: 2500, days: 30 },
  { key: "quarter", label: "3 أشهر", months: 3, price: 6500, days: 90, badge: "الأكثر شيوعاً" },
  { key: "year", label: "سنة", months: 12, price: 24000, days: 365, badge: "الأكثر توفيراً", best: true },
];

// تنسيق المبلغ بالدينار الجزائري
export const fmtDZ = (n) => `${new Intl.NumberFormat("ar-DZ").format(n)} دج`;

// باقات الدفع الدولي (PayPal) بالدولار — للعرض فقط. المبالغ الموثوقة في الخادم.
export const USD_PLANS = [
  { key: "month", label: "شهر", months: 1, price: 10, days: 30 },
  { key: "quarter", label: "3 أشهر", months: 3, price: 25, days: 90, badge: "الأكثر شيوعاً" },
  { key: "year", label: "سنة", months: 12, price: 90, days: 365, badge: "الأكثر توفيراً", best: true },
];

// تنسيق المبلغ بالدولار
export const fmtUSD = (n) => `$${n}`;
