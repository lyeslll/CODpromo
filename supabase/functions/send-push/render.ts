// ============================================================
//  CODpromo — نص رسالة push حسب لغة الجهاز (ar / en / fr).
//  نفس القاعدة تاع الجرس في الواجهة (src/lib/notifications.js): نص الأدمين إذا كاين، وإلا القالب حسب النوع
//  + اسم الشركة والعرض بلغة الجهاز (fallback للعربية). عدّة إشعارات = ملخّص واحد نحو /new.
// ============================================================
import ar from "./locales/ar.json" with { type: "json" };
import en from "./locales/en.json" with { type: "json" };
import fr from "./locales/fr.json" with { type: "json" };

type Lang = "ar" | "en" | "fr";
type Dict = typeof ar;
const LOCALES: Record<Lang, Dict> = { ar, en, fr };

export interface NotifData {
  id: number;
  kind: "company" | "code" | "premium_code" | "deal" | "feature" | "announcement";
  url: string;
  title: string | null;
  title_en: string | null;
  title_fr: string | null;
  body: string | null;
  body_en: string | null;
  body_fr: string | null;
  company: null | Record<string, string | null>;
  deal: null | Record<string, string | null>;
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
  icon: string;
  badge: string;
  lang: Lang;
  dir: "rtl" | "ltr";
}

const SITE = "https://codpromo.com";
const ICON = `${SITE}/pwa-192.png`;
const BADGE = `${SITE}/push-badge.png`;
const STORAGE_PUBLIC = "/storage/v1/object/public/";
const STORAGE_RENDER = "/storage/v1/render/image/public/";

const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? ""));
const pick = (row: Record<string, string | null> | null, field: string, lang: Lang) =>
  (lang !== "ar" && row?.[`${field}_${lang}`]?.trim()) || row?.[field]?.trim() || "";

/** نفس قاعدة الواجهة (localizePath): الصفحات العامة ببادئة /en و /fr. */
export function localizePath(path: string, lang: Lang): string {
  if (lang === "ar" || !path.startsWith("/")) return path;
  if (path === "/") return `/${lang}`;
  return /^\/(?:(?:store|category)\/[^/?#]|(?:categories|offers|partners|premium|new|favorites)(?:[/?#]|$))/.test(path) ? `/${lang}${path}` : path;
}

/** لوغو الشركة بحجم الأيقونة (Supabase render/image)، وإلا أيقونة الموقع. */
function iconOf(url: string | null | undefined): string {
  if (typeof url !== "string" || !url.startsWith("https://") || /\.svg(\?|$)/i.test(url)) return ICON;
  if (!url.includes(STORAGE_PUBLIC)) return url;
  return `${url.replace(STORAGE_PUBLIC, STORAGE_RENDER)}?width=192&height=192&resize=contain&quality=80`;
}

function withParam(path: string, key: string, value: string | number): string {
  const [base, hash = ""] = path.split("#");
  return `${base}${base.includes("?") ? "&" : "?"}${key}=${value}${hash ? `#${hash}` : ""}`;
}

/** العنوان والنص لإشعار واحد بلغة معيّنة. */
export function notifText(n: NotifData, lang: Lang): { title: string; body: string } {
  const L = LOCALES[lang];
  const ownTitle = (lang !== "ar" && (n as unknown as Record<string, string | null>)[`title_${lang}`]?.trim()) || n.title?.trim() || "";
  const ownBody = (lang !== "ar" && (n as unknown as Record<string, string | null>)[`body_${lang}`]?.trim()) || n.body?.trim() || "";
  if (n.kind === "feature" || n.kind === "announcement") return { title: ownTitle, body: ownBody };

  const row = n.kind === "deal" ? n.deal : n.company;
  const name = row?.name?.trim() || "";
  const offer = n.kind === "deal" ? pick(row, "reward", lang) : n.kind === "premium_code" ? pick(row, "premium_discount", lang) : pick(row, "discount", lang);
  const t = L[n.kind];
  return {
    title: ownTitle || fill(t.title, { name }),
    body: ownBody || (offer ? fill(t.body, { offer }) : t.bodyNoOffer),
  };
}

function plural(lang: Lang, count: number): "zero" | "one" | "two" | "few" | "many" | "other" {
  if (count === 0) return "zero";
  return new Intl.PluralRules(lang).select(count) as "one" | "two" | "few" | "many" | "other";
}

/** رسالة جهاز واحد: إشعار واحد (نحو صفحتو) ولا ملخّص (نحو /new). */
export function buildPayload(list: NotifData[], lang: Lang): PushPayload | null {
  if (!list.length) return null;
  const L = LOCALES[lang];
  const dir = lang === "ar" ? "rtl" : "ltr";
  if (list.length === 1) {
    const n = list[0];
    const { title, body } = notifText(n, lang);
    if (!title) return null;
    const logo = n.kind === "deal" ? n.deal?.logo : n.company?.logo;
    return {
      title,
      body,
      url: withParam(localizePath(n.url || "/new", lang), "n", n.id),
      tag: `codpromo-${n.id}`,
      icon: iconOf(logo),
      badge: BADGE,
      lang,
      dir,
    };
  }
  const names = list
    .map((n) => (n.kind === "deal" ? n.deal?.name : n.company?.name) || notifText(n, lang).title)
    .filter(Boolean)
    .slice(0, 3) as string[];
  const key = `title_${plural(lang, list.length)}` as keyof Dict["digest"];
  const joined = names.join(L.sep);
  return {
    title: fill(L.digest[key], { count: list.length }),
    body: list.length > names.length ? fill(L.digest.more, { names: joined }) : joined,
    url: localizePath("/new", lang),
    tag: "codpromo-digest",
    icon: ICON,
    badge: BADGE,
    lang,
    dir,
  };
}

export function testPayload(lang: Lang): PushPayload {
  const L = LOCALES[lang];
  return {
    title: L.test.title,
    body: L.test.body,
    url: localizePath("/new", lang),
    tag: "codpromo-test",
    icon: ICON,
    badge: BADGE,
    lang,
    dir: lang === "ar" ? "rtl" : "ltr",
  };
}
