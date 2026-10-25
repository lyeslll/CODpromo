import { Link } from "react-router-dom";
import { Crown, Gift, Megaphone, Sparkles, Store, TicketPercent } from "lucide-react";
import { useTranslation } from "react-i18next";
import CompanyLogo from "../CompanyLogo.jsx";
import BidiText from "../BidiText.jsx";
import { getTypeMeta } from "../../lib/types.js";
import { notificationHref, renderNotification, timeAgo } from "../../lib/notifications.js";

const GOLD = "#f0c63c";
const LIME = "#a6f000";
// = NOCODE_COLOR في NocodeCard.jsx (ما نستوردوش البطاقة كاملة وحدها في حزمة الجرس)
const NOCODE_COLOR = "#b794ff";

/** لون وأيقونة النوع — اللون يعني النوع برك: نوع عرض الشركة، الذهبي = Premium، البنفسجي = بلا كود. */
export function kindLook(n) {
  switch (n.kind) {
    case "company":
      return { Icon: Store, color: getTypeMeta(n.company?.type).color };
    case "code":
      return { Icon: TicketPercent, color: getTypeMeta(n.company?.type).color };
    case "premium_code":
      return { Icon: Crown, color: GOLD };
    case "deal":
      return { Icon: Gift, color: NOCODE_COLOR };
    case "announcement":
      return { Icon: Megaphone, color: LIME };
    default:
      return { Icon: Sparkles, color: LIME };
  }
}

/**
 * سطر إشعار: اللوغو (ولا أيقونة النوع) + العنوان + النص + الوقت + نقطة "غير مقروء".
 * size = "sm" (الجرس) | "lg" (صفحة /new). onOpen يتنادى قبل التنقّل (مقروء + سكّر القائمة).
 */
export default function NotificationRow({ n, unread = false, highlight = false, size = "sm", onOpen }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const r = renderNotification(n, t, lang);
  const { Icon, color } = kindLook(n);
  const big = size === "lg";
  const logoSize = big ? 48 : 40;

  return (
    <Link
      to={notificationHref(n, lang)}
      onClick={() => onOpen?.(n)}
      className={`group relative flex items-start gap-3 rounded-2xl outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-lime)]/60 ${
        big ? "border p-4 sm:p-5" : "px-3 py-3"
      } ${
        big
          ? highlight
            ? "border-[var(--color-lime)]/45 bg-[var(--color-lime)]/[0.05] hover:bg-[var(--color-lime)]/[0.08]"
            : "border-[var(--color-ink-line)] bg-[var(--color-ink-card)] hover:border-white/15"
          : unread
          ? "bg-[var(--color-lime)]/[0.05] hover:bg-[var(--fill-strong)]"
          : "hover:bg-[var(--fill)]"
      }`}
    >
      <span className="relative shrink-0">
        {r.logo ? (
          <CompanyLogo logo={r.logo} name={r.name} size={logoSize} bg={r.logoBg} accent={color} />
        ) : (
          <span
            className="grid place-items-center rounded-xl border border-[var(--color-ink-line)]"
            style={{ width: logoSize, height: logoSize, background: `${color}14`, color }}
          >
            <Icon size={big ? 22 : 18} />
          </span>
        )}
        {r.logo && (
          <span
            aria-hidden
            className="absolute -bottom-1 -end-1 grid h-[18px] w-[18px] place-items-center rounded-full text-[#0a0a0a] ring-2 ring-[var(--elev)]"
            style={{ background: color }}
          >
            <Icon size={10} strokeWidth={2.6} />
          </span>
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className={`block font-extrabold leading-snug text-[var(--text)] ${big ? "text-[15.5px] sm:text-[16.5px]" : "line-clamp-2 text-[13.5px]"}`}>
          <BidiText text={r.title} rtl={lang === "ar"} />
        </span>
        {r.body && (
          <span className={`mt-0.5 block text-[var(--text-soft)] ${big ? "text-[13.5px] leading-relaxed" : "line-clamp-1 text-[12.5px]"}`}>
            <BidiText text={r.body} rtl={lang === "ar"} />
          </span>
        )}
        <span className="mt-1.5 flex items-center gap-2 text-[11.5px] text-[var(--color-mute)]">
          <time dateTime={n.published_at}>{timeAgo(n.published_at, lang)}</time>
          {highlight && (
            <span className="rounded-full bg-[var(--color-lime)]/12 px-2 py-0.5 text-[10.5px] font-extrabold text-[var(--accent-text)]">
              {t("notify.page.sinceVisit")}
            </span>
          )}
        </span>
      </span>

      {unread && (
        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--color-lime)] shadow-[0_0_8px_rgba(166,240,0,0.7)]">
          <span className="sr-only">{t("notify.panel.unreadOne")}</span>
        </span>
      )}
    </Link>
  );
}
