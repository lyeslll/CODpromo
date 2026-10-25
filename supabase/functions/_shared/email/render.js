// ============================================================
//  CODpromo — قوالب الإيميلات (مصدر واحد):
//   - Edge Function send-email (Deno): الترحيب، تأكيد الشراء، سحب Premium بعد الاسترداد، تفعيل الهدية،
//     ومعاينات قوالب Auth للتجربة.
//   - scripts/build-email-templates.mjs (Node): يولّد قوالب Supabase Auth (Go templates) بنفس التصميم.
//  النصوص كلها في locales/{ar,en,fr}.json (نفس المفاتيح). هوية الموقع: داكن فقط، الليموني للحساب،
//  الذهبي لـ Premium. جداول + أنماط inline (Gmail / Outlook / الهاتف)، RTL للعربية.
//  JS بلا مكتبات، يخدم في Deno وفي Node.
// ============================================================
import ar from "./locales/ar.json" with { type: "json" };
import en from "./locales/en.json" with { type: "json" };
import fr from "./locales/fr.json" with { type: "json" };

const STRINGS = { ar, en, fr };
export const LANGS = ["ar", "en", "fr"];
export const normLang = (l) => (LANGS.includes(l) ? l : "ar");

const C = {
  bg: "#0a0a0a",
  card: "#131316",
  inset: "#0f0f10",
  line: "#232327",
  text: "#ffffff",
  softer: "#c9c9cf",
  soft: "#a1a1aa",
  mute: "#6b7280",
  lime: "#a6f000",
  gold: "#f0c63c",
  goldSoft: "#ffe486",
  goldDeep: "#cf9a1e",
  ink: "#1d1403",
};
const TONES = {
  lime: { bar: C.lime, barImg: "linear-gradient(90deg,#c4ff4d,#a6f000,#8bd000)", btn: C.lime, btnImg: "linear-gradient(135deg,#c4ff4d,#8bd000)", btnText: "#0a0a0a", icon: "mail" },
  gold: { bar: C.gold, barImg: "linear-gradient(90deg,#ffe486,#f0c63c,#cf9a1e)", btn: C.gold, btnImg: "linear-gradient(135deg,#ffe486,#f0c63c 55%,#cf9a1e)", btnText: C.ink, icon: "crown" },
  mute: { bar: "#3f3f46", barImg: "", btn: C.lime, btnImg: "linear-gradient(135deg,#c4ff4d,#8bd000)", btnText: "#0a0a0a", icon: "lock" },
  // المفاتيح الماسية (phase37): كريستال جليدي — ماشي لون نوع عرض ولا ذهبي Premium
  diamond: { bar: "#cfe8ff", barImg: "linear-gradient(90deg,#f4fbff,#9cc7ff,#c9b8ff)", btn: "#cfe8ff", btnImg: "linear-gradient(135deg,#f4fbff,#bcdcff 50%,#8fb2ff)", btnText: "#0b1430", icon: "diamond" },
};
const DIAMOND_SOFT = "#dbeeff";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
// بريد داخل النص: رابط بلون التصميم، من اليسار لليمين حتى في جملة عربية. بلاه Gmail يحوّلو وحدو
// لرابط أزرق ما يتقراش فوق الخلفية السوداء.
const mailLink = (address, color = C.lime) =>
  `<a href="mailto:${esc(address)}" dir="ltr" style="color:${color};text-decoration:none;font-weight:700;unicode-bidi:embed;">${esc(address)}</a>`;

/** "{{key}}" → قيمة (نفس صيغة i18next). vars بقيم HTML جاهزة. */
function fill(str, vars = {}) {
  return esc(str).replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? vars[k] : ""));
}
/** نفس الشي لنص عادي (عنوان الإيميل): بلا HTML. */
const fillText = (str, vars = {}) => String(str ?? "").replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? String(vars[k]) : ""));

const FONT = {
  ar: "Tajawal,'Segoe UI',Tahoma,Arial,sans-serif",
  en: "Inter,'Segoe UI',Helvetica,Arial,sans-serif",
  fr: "Inter,'Segoe UI',Helvetica,Arial,sans-serif",
};

function ctx(lang, opts) {
  const L = STRINGS[lang];
  const site = (opts.siteUrl || "https://codpromo.com").replace(/\/$/, "");
  const prefix = lang === "ar" ? "" : `/${lang}`;
  return {
    lang,
    L,
    rtl: lang === "ar",
    start: lang === "ar" ? "right" : "left",
    end: lang === "ar" ? "left" : "right",
    font: FONT[lang],
    site,
    assets: (opts.assetsUrl || `${site}/email`).replace(/\/$/, ""),
    contact: opts.contactEmail || "contact@codpromo.com",
    links: {
      home: `${site}${prefix}/`,
      offers: `${site}${prefix}/offers`,
      premiumOffers: `${site}${prefix}/offers?mode=premium`,
      premium: `${site}${prefix}/premium`,
      partnerNew: `${site}/dashboard/offers/new`,
      terms: `${site}/terms`,
    },
  };
}

// ===================== قطع التصميم =====================

const h1 = (x, text) =>
  `<h1 style="margin:0 0 14px;font-family:${x.font};font-size:28px;line-height:36px;font-weight:800;color:${C.text};" class="h1">${text}</h1>`;
const p = (x, html, color = C.softer, size = 16) =>
  `<p style="margin:0 0 16px;font-family:${x.font};font-size:${size}px;line-height:${Math.round(size * 1.7)}px;color:${color};">${html}</p>`;

function button(x, tone, label, url) {
  const t = TONES[tone];
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="${x.start}" style="margin:8px 0 20px;"><tr><td bgcolor="${t.btn}" style="border-radius:14px;background-color:${t.btn};${t.btnImg ? `background-image:${t.btnImg};` : ""}">` +
    `<a href="${esc(url)}" target="_blank" style="display:inline-block;padding:15px 30px;font-family:${x.font};font-size:16px;line-height:20px;font-weight:800;color:${t.btnText};text-decoration:none;border-radius:14px;">${label}</a>` +
    `</td></tr></table><div style="clear:both;line-height:0;font-size:0;">&nbsp;</div>`;
}

function fallback(x, url) {
  return p(x, `${esc(x.L.common.linkFallback)}<br><a href="${esc(url)}" style="color:${C.lime};word-break:break-all;" dir="ltr">${esc(url)}</a>`, C.mute, 13);
}

/** صفوف ملخّص (إيصال): [label, valueHtml, tagHtml?] — خط مثقّب فوق كيما كعب تذاكر الكوبون. */
function receipt(x, tone, title, rows) {
  const edge = tone === "gold" ? "rgba(240,198,60,0.45)" : tone === "diamond" ? "rgba(156,199,255,0.5)" : C.line;
  const body = rows
    .map(
      ([k, v], i) =>
        `<tr><td style="padding:11px 0;${i ? `border-top:1px dashed ${C.line};` : ""}font-family:${x.font};font-size:14px;line-height:20px;color:${C.soft};" align="${x.start}">${k}</td>` +
        `<td style="padding:11px 0;${i ? `border-top:1px dashed ${C.line};` : ""}font-family:${x.font};font-size:15px;line-height:20px;font-weight:800;color:${C.text};" align="${x.end}">${v}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 22px;border-top:2px dashed ${edge};"><tr><td style="padding-top:14px;">` +
    `<p style="margin:0 0 4px;font-family:${x.font};font-size:13px;line-height:18px;font-weight:800;color:${tone === "gold" ? C.goldSoft : tone === "diamond" ? DIAMOND_SOFT : C.softer};">${title}</p>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${body}</table></td></tr></table>`;
}

/** لوحة جانبية (المفتاح الذهبي، قاعدة الاسترداد…): أيقونة + عنوان + نص + زر اختياري. */
function panel(x, { icon, title, html, cta, url, tone = "gold" }) {
  const border = tone === "gold" ? "rgba(240,198,60,0.35)" : C.line;
  const bg = tone === "gold" ? "#18160f" : C.inset;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 22px;"><tr><td bgcolor="${bg}" style="background-color:${bg};border:1px solid ${border};border-radius:18px;padding:20px;">` +
    (icon ? `<img src="${x.assets}/${icon}.png" width="40" height="40" alt="" style="display:block;border:0;margin-bottom:12px;">` : "") +
    `<p style="margin:0 0 8px;font-family:${x.font};font-size:17px;line-height:24px;font-weight:800;color:${tone === "gold" ? C.goldSoft : C.text};">${title}</p>` +
    `<p style="margin:0;font-family:${x.font};font-size:14.5px;line-height:24px;color:${C.softer};">${html}</p>` +
    (cta ? `<div style="height:14px;line-height:14px;font-size:0;">&nbsp;</div>${button(x, tone === "gold" ? "gold" : "lime", cta, url).replace("margin:8px 0 20px;", "margin:0;")}` : "") +
    `</td></tr></table>`;
}

/** قائمة مرقّمة (خطوات متتالية). */
function steps(x, title, items) {
  const rows = items
    .map(
      (it, i) =>
        `<tr><td width="34" valign="top" style="padding:0 0 10px;"><div style="width:26px;height:26px;border:1px solid rgba(240,198,60,0.55);border-radius:13px;text-align:center;font-family:${x.font};font-size:13px;line-height:26px;font-weight:800;color:${C.goldSoft};">${i + 1}</div></td>` +
        `<td valign="top" style="padding:3px 0 10px;font-family:${x.font};font-size:15px;line-height:22px;color:${C.softer};" align="${x.start}">${it}</td></tr>`,
    )
    .join("");
  return `<p style="margin:4px 0 12px;font-family:${x.font};font-size:16px;line-height:22px;font-weight:800;color:${C.text};">${title}</p>` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;" dir="${x.rtl ? "rtl" : "ltr"}">${rows}</table>`;
}

/** قائمة بنقاط ليمونية. */
function bullets(x, title, items) {
  const rows = items
    .map(
      (it) =>
        `<tr><td width="20" valign="top" style="padding:9px 0 0;"><div style="width:7px;height:7px;border-radius:4px;background-color:${C.lime};"></div></td>` +
        `<td valign="top" style="padding:0 0 8px;font-family:${x.font};font-size:15px;line-height:24px;color:${C.softer};" align="${x.start}">${it}</td></tr>`,
    )
    .join("");
  return `<p style="margin:4px 0 10px;font-family:${x.font};font-size:16px;line-height:22px;font-weight:800;color:${C.text};">${title}</p>` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;" dir="${x.rtl ? "rtl" : "ltr"}">${rows}</table>`;
}

function codeBox(x, code) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="${x.start}" style="margin:4px 0 20px;"><tr><td bgcolor="${C.inset}" style="background-color:${C.inset};border:1px dashed ${C.lime};border-radius:14px;padding:14px 26px;">` +
    `<span dir="ltr" style="font-family:'Courier New',Consolas,monospace;font-size:30px;line-height:36px;font-weight:700;letter-spacing:8px;color:${C.lime};">${code}</span></td></tr></table><div style="clear:both;line-height:0;font-size:0;">&nbsp;</div>`;
}

/** الصفحة الكاملة: اللوغو، البطاقة بشريط لوني فوق، المحتوى، والتذييل. */
function doc(x, { tone, icon, subject, preheader, content, footer }) {
  const t = TONES[tone];
  const dir = x.rtl ? "rtl" : "ltr";
  return `<!doctype html><html lang="${x.lang}" dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><meta name="color-scheme" content="dark light"><meta name="supported-color-schemes" content="dark light"><meta name="format-detection" content="telephone=no,date=no,address=no,email=no,url=no"><title>${esc(subject)}</title>` +
    `<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;800&family=Tajawal:wght@400;700;800&display=swap" rel="stylesheet">` +
    `<style>body{margin:0;padding:0;background-color:${C.bg};-webkit-text-size-adjust:100%;}a{color:${C.lime};}a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important;font-size:inherit!important;font-family:inherit!important;font-weight:inherit!important;line-height:inherit!important;}img{border:0;}@media (max-width:600px){.px{padding-left:22px!important;padding-right:22px!important;}.h1{font-size:24px!important;line-height:32px!important;}}</style></head>` +
    `<body style="margin:0;padding:0;background-color:${C.bg};" bgcolor="${C.bg}" dir="${dir}">` +
    `<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${C.bg};">${esc(preheader)}${"&#8199;&#65279;&#847; ".repeat(40)}</div>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.bg}" style="background-color:${C.bg};" dir="${dir}"><tr><td align="center" style="padding:28px 12px 36px;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;" dir="${dir}">` +
    // اللوغو
    `<tr><td align="${x.start}" style="padding:0 6px 20px;"><a href="${x.links.home}" target="_blank" style="text-decoration:none;"><img src="${x.assets}/logo.png" width="140" alt="CODpromo" style="display:block;border:0;width:140px;height:auto;"></a>` +
    `<div style="font-family:${x.font};font-size:11px;line-height:16px;color:${C.mute};padding-top:4px;">${esc(x.L.common.tagline)}</div></td></tr>` +
    // البطاقة
    `<tr><td bgcolor="${C.card}" style="background-color:${C.card};border:1px solid ${C.line};border-radius:22px;overflow:hidden;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="4" bgcolor="${t.bar}" style="height:4px;line-height:4px;font-size:0;background-color:${t.bar};${t.barImg ? `background-image:${t.barImg};` : ""}border-radius:22px 22px 0 0;">&nbsp;</td></tr>` +
    `<tr><td class="px" style="padding:30px 34px 14px;" align="${x.start}" dir="${dir}">` +
    `<img src="${x.assets}/${icon || t.icon}.png" width="48" height="48" alt="" style="display:block;border:0;margin-bottom:18px;">` +
    content +
    `</td></tr></table></td></tr>` +
    // التذييل
    `<tr><td class="px" style="padding:22px 10px 0;" align="${x.start}" dir="${dir}">` +
    `<p style="margin:0 0 8px;font-family:${x.font};font-size:12.5px;line-height:20px;color:${C.mute};">${footer}</p>` +
    `<p style="margin:0 0 8px;font-family:${x.font};font-size:12.5px;line-height:20px;color:${C.mute};">${esc(x.L.common.contact)} <a href="mailto:${x.contact}" style="color:${C.soft};" dir="ltr">${x.contact}</a></p>` +
    `<p style="margin:0;font-family:${x.font};font-size:12.5px;line-height:20px;color:${C.mute};"><a href="${x.links.home}" style="color:${C.soft};text-decoration:none;" dir="ltr">codpromo.com</a> &nbsp;·&nbsp; <a href="${x.links.terms}" style="color:${C.soft};">${esc(x.L.common.terms)}</a></p>` +
    `</td></tr></table></td></tr></table></body></html>`;
}

// ===================== التنسيق =====================

function fmtDate(x, d) {
  if (!d) return "";
  const loc = x.lang === "ar" ? "ar-u-nu-latn" : x.lang === "fr" ? "fr-FR" : "en-GB";
  try {
    return new Intl.DateTimeFormat(loc, { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Algiers" }).format(new Date(d));
  } catch {
    return String(d).slice(0, 10);
  }
}

function fmtAmount(x, amount, currency) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "";
  const digits = Number.isInteger(n) ? 0 : 2;
  const s = new Intl.NumberFormat(x.lang === "fr" ? "fr-FR" : "en-US", { minimumFractionDigits: digits, maximumFractionDigits: 2 }).format(n);
  const cur = String(currency || "").toUpperCase();
  if (cur === "DZD") return x.lang === "ar" ? `${s} دج` : `${s} DZD`;
  if (cur === "USD") return x.lang === "en" ? `$${s}` : x.lang === "fr" ? `${s} $` : `${s}$`;
  return `${s} ${esc(cur)}`;
}

const greet = (x, name) => (name ? fill(x.L.common.hi, { name: esc(name) }) : esc(x.L.common.hiNoName));
const tag = (text) =>
  ` <span style="display:inline-block;padding:1px 8px;border:1px solid rgba(56,189,248,0.5);border-radius:10px;font-size:11px;line-height:16px;color:#7dd3fc;font-weight:800;">${esc(text)}</span>`;

// ===================== القوالب =====================

/** قوالب Auth: data.url / email / newEmail / token (قيم حقيقية للمعاينة، ولا متغيّرات Go للمولّد). */
function authTemplate(x, key, data) {
  const S = x.L[key];
  const v = { email: mailLink(data.email), newEmail: mailLink(data.newEmail) };
  let content = h1(x, esc(S.title)) + p(x, fill(S.body, v));
  if (key === "reauthentication") {
    content += codeBox(x, esc(data.token)) + p(x, esc(S.note), C.mute, 13);
  } else {
    content += button(x, "lime", esc(S.cta), data.url) + fallback(x, data.url) + p(x, esc(S.note || x.L.common.linkNote), C.mute, 13);
  }
  return { subject: S.subject, preheader: S.preheader, tone: "lime", content, footer: esc(x.L.common.footerAuth) };
}

const TEMPLATES = {
  auth_confirmation: (x, d) => authTemplate(x, "confirmation", d),
  auth_recovery: (x, d) => authTemplate(x, "recovery", d),
  auth_email_change: (x, d) => authTemplate(x, "email_change", d),
  auth_magic_link: (x, d) => authTemplate(x, "magic_link", d),
  auth_invite: (x, d) => authTemplate(x, "invite", d),
  auth_reauthentication: (x, d) => authTemplate(x, "reauthentication", d),

  // ترحيب بعد تأكيد الحساب (+ المفتاح الذهبي إذا متاح لهاد الحساب). حساب شركة → نص الشركاء.
  welcome: (x, d) => {
    const S = x.L.welcome;
    if (d.accountType === "company") {
      const content = p(x, greet(x, d.name), C.text) + h1(x, esc(S.companyTitle)) + p(x, esc(S.companyBody)) + button(x, "lime", esc(S.companyCta), x.links.partnerNew);
      return { subject: S.companySubject, preheader: S.companyPreheader, tone: "lime", content, footer: esc(x.L.common.footer) };
    }
    let content = p(x, greet(x, d.name), C.text) + h1(x, esc(S.title)) + p(x, esc(S.body));
    if (d.freeKey) content += panel(x, { icon: "key", title: esc(S.keyTitle), html: esc(S.keyBody), cta: esc(S.keyCta), url: x.links.premiumOffers });
    content += bullets(x, esc(S.nowTitle), [esc(S.now1), esc(S.now2), esc(S.now3)]) + button(x, "lime", esc(S.cta), x.links.offers);
    return { subject: S.subject, preheader: S.preheader, tone: "lime", content, footer: esc(x.L.common.footer) };
  },

  // تأكيد الشراء: الملخص (المبلغ، الطريقة، التاريخ) + كيفاش يكشف + قاعدة الاسترداد (7 أيام).
  purchase: (x, d) => {
    const S = x.L.purchase;
    const until = d.purchasedAt ? new Date(new Date(d.purchasedAt).getTime() + 7 * 864e5) : null;
    const rows = [
      [esc(S.plan), esc(S.planV)],
      [esc(S.amount), `${fmtAmount(x, d.amount, d.currency)}${d.tier === "test" ? tag(S.testTag) : ""}`],
      [esc(S.method), esc(x.L.methods[d.provider] || d.provider || "")],
      [esc(S.date), esc(fmtDate(x, d.purchasedAt))],
    ];
    const content =
      p(x, greet(x, d.name), C.text) +
      h1(x, esc(S.title)) +
      p(x, esc(S.body)) +
      receipt(x, "gold", esc(S.summary), rows) +
      steps(x, esc(S.howTitle), [esc(S.step1), esc(S.step2), esc(S.step3)]) +
      button(x, "gold", esc(S.cta), x.links.premiumOffers) +
      panel(x, { title: esc(S.refundTitle), html: fill(S.refundBody, { date: esc(fmtDate(x, until)), email: mailLink(x.contact, C.goldSoft) }), tone: "mute" });
    return { subject: S.subject, preheader: S.preheader, tone: "gold", content, footer: esc(x.L.common.footer) };
  },

  // Premium تسحب بعد استرداد (ما بقالو حتى شراء نشط).
  revoked: (x, d) => {
    const S = x.L.revoked;
    const rows = [
      [esc(S.amount), fmtAmount(x, d.amount, d.currency)],
      [esc(S.method), esc(x.L.methods[d.provider] || d.provider || "")],
      [esc(S.date), esc(fmtDate(x, d.refundedAt))],
    ];
    const content =
      p(x, greet(x, d.name), C.text) +
      h1(x, esc(S.title)) +
      p(x, esc(S.body)) +
      receipt(x, "mute", esc(S.summary), rows) +
      p(x, esc(S.note), C.soft, 14) +
      button(x, "lime", esc(S.cta), x.links.offers);
    return { subject: S.subject, preheader: S.preheader, tone: "mute", content, footer: esc(x.L.common.footer) };
  },

  // المفاتيح الماسية (phase37): تأكيد شراء باقة — الملخص، الرصيد، كيفاش يستعمل، الرصيد في Premium، والاسترداد.
  keys_purchase: (x, d) => {
    const S = x.L.keysPurchase;
    const K = x.L.keysCommon;
    const play = d.provider === "google_play";
    const rows = [
      [esc(S.pack), fill(K.packV, { keys: esc(String(d.keys ?? "")) })],
      [esc(S.amount), `${fmtAmount(x, d.amount, d.currency)}${d.tier === "test" ? tag(S.testTag) : ""}`],
      [esc(S.method), esc(x.L.methods[d.provider] || d.provider || "")],
      [esc(S.date), esc(fmtDate(x, d.paidAt))],
      [esc(K.balance), esc(String(d.balance ?? ""))],
    ];
    const content =
      p(x, greet(x, d.name), C.text) +
      h1(x, esc(S.title)) +
      p(x, esc(K.what)) +
      receipt(x, "diamond", esc(S.summary), rows) +
      steps(x, esc(K.howTitle), [esc(K.step1), esc(K.step2), esc(K.step3)]) +
      button(x, "diamond", esc(K.cta), x.links.premiumOffers) +
      // شراء من تطبيق Android (Google Play): بلا ذكر للخصم من Premium في الموقع (كيما شاشات التطبيق)
      (play ? "" : panel(x, { title: esc(S.creditTitle), html: esc(S.creditBody), cta: esc(S.creditCta), url: x.links.premium, tone: "gold" })) +
      panel(x, { title: esc(S.refundTitle), html: fill(play ? S.refundBodyPlain : S.refundBody, { date: esc(fmtDate(x, d.refundUntil)), email: mailLink(x.contact, DIAMOND_SOFT) }), tone: "mute" });
    return { subject: S.subject, preheader: S.preheader, tone: "diamond", content, footer: esc(x.L.common.footer) };
  },

  // مفاتيح ماسية هدية من CODpromo (الأدمن): العدد والرصيد (السبب للأدمن برك، ما يتبعثش).
  keys_gift: (x, d) => {
    const S = x.L.keysGift;
    const K = x.L.keysCommon;
    const content =
      p(x, greet(x, d.name), C.text) +
      h1(x, esc(S.title)) +
      p(x, esc(K.what)) +
      receipt(x, "diamond", "", [
        [esc(S.gifted), esc(String(d.keys ?? ""))],
        [esc(K.balance), esc(String(d.balance ?? ""))],
      ]).replace(/<p[^>]*><\/p>/, "") +
      steps(x, esc(K.howTitle), [esc(K.step1), esc(K.step2), esc(K.step3)]) +
      button(x, "diamond", esc(K.cta), x.links.premiumOffers) +
      p(x, esc(S.note), C.mute, 13);
    return { subject: S.subject, preheader: S.preheader, tone: "diamond", content, footer: esc(x.L.common.footer) };
  },

  // هدية Premium تفعّلت: تاريخ النهاية.
  gift: (x, d) => {
    const S = x.L.gift;
    const date = fmtDate(x, d.premiumUntil);
    const content =
      p(x, greet(x, d.name), C.text) +
      h1(x, esc(S.title)) +
      p(x, esc(S.body)) +
      receipt(x, "gold", "", [[esc(S.ends), esc(date)]]).replace(/<p[^>]*><\/p>/, "") +
      button(x, "gold", esc(S.cta), x.links.premiumOffers) +
      p(x, esc(S.note), C.mute, 13);
    return { subject: fillText(S.subject, { date }), preheader: S.preheader, tone: "gold", icon: "gift", content, footer: esc(x.L.common.footer) };
  },
};

export const TEMPLATE_NAMES = Object.keys(TEMPLATES);

/** نسخة نصية بسيطة (لعملاء البريد بلا HTML وللفلاتر). */
function toText(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<title>[\s\S]*?<\/title>/gi, "")
    .replace(/<div style="display:none[\s\S]*?<\/div>/i, "")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, label) => {
      const l = label.replace(/<[^>]+>/g, "").trim();
      return l && l !== href ? `${l}: ${href}` : href;
    })
    .replace(/<\/(p|h1|tr|table)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#8199;|&#65279;|&#847;/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

/** { subject, html, text } لقالب بلغة (ar/en/fr). opts: siteUrl, assetsUrl, contactEmail. */
export function renderEmail(template, lang, data = {}, opts = {}) {
  const fn = TEMPLATES[template];
  if (!fn) throw new Error(`unknown template: ${template}`);
  const x = ctx(normLang(lang), opts);
  const t = fn(x, data);
  const html = doc(x, t);
  const subject = fillText(t.subject);
  return { subject, html, text: toText(html) };
}
