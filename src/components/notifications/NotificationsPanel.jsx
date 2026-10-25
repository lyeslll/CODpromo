import { Link } from "react-router-dom";
import { ArrowLeft, BellRing, CheckCheck, RotateCw, Settings2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../lib/auth.jsx";
import { localizePath } from "../../lib/notifications.js";
import NotificationRow from "./NotificationRow.jsx";
import PushToggle from "./PushToggle.jsx";

const PANEL_LIMIT = 15;

/**
 * محتوى قائمة الإشعارات (نفسو في نافذة الكمبيوتر وفي اللوحة من تحت في الهاتف).
 * unreadAtOpen = غير المقروءة لحظة الفتح: النقطة تبقى باينة حتى تتسكّر القائمة (تتعلّم مقروءة كي تتسكّر).
 */
export default function NotificationsPanel({ notif, unreadAtOpen, onClose, titleId, showClose = false }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { user, profile } = useAuth();
  const items = notif.items.slice(0, PANEL_LIMIT);
  const unread = new Set(unreadAtOpen);
  const count = items.filter((n) => unread.has(n.id)).length;
  const canTune = user && profile?.account_type !== "company";

  const open = (n) => {
    notif.markRead([n.id]);
    onClose();
  };

  return (
    <div className="flex max-h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--color-ink-line)] px-4 py-3">
        <h2 id={titleId} className="flex items-center gap-2 text-[15px] font-black text-[var(--text)]">
          {t("notify.panel.title")}
          {count > 0 && (
            <span className="rounded-full bg-[var(--color-lime)]/15 px-2 py-0.5 text-[11px] font-extrabold text-[var(--accent-text)]">
              {t("notify.panel.unread", { count })}
            </span>
          )}
        </h2>
        <div className="flex items-center gap-1">
          {count > 0 && (
            <button
              type="button"
              onClick={() => notif.markAllRead()}
              className="flex min-h-[36px] items-center gap-1.5 rounded-lg px-2 text-[12px] font-bold text-[var(--text-soft)] transition-colors hover:bg-[var(--fill)] hover:text-[var(--text)]"
            >
              <CheckCheck size={15} /> {t("notify.panel.markAll")}
            </button>
          )}
          {canTune && (
            <Link
              to="/dashboard#notifications"
              onClick={onClose}
              aria-label={t("notify.panel.settings")}
              title={t("notify.panel.settings")}
              className="grid h-9 w-9 place-items-center rounded-lg text-[var(--text-soft)] transition-colors hover:bg-[var(--fill)] hover:text-[var(--text)]"
            >
              <Settings2 size={16} />
            </Link>
          )}
          {showClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label={t("notify.panel.close")}
              className="grid h-9 w-9 place-items-center rounded-lg text-[var(--text-soft)] transition-colors hover:bg-[var(--fill)] hover:text-[var(--text)]"
            >
              <X size={17} />
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
        {notif.status === "loading" || notif.status === "idle" ? (
          <div className="space-y-1 p-1.5" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-3 px-1.5 py-2">
                <span className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-[var(--fill-strong)]" />
                <span className="flex-1 space-y-2 pt-1">
                  <span className="block h-3 w-3/4 animate-pulse rounded bg-[var(--fill-strong)]" />
                  <span className="block h-3 w-1/2 animate-pulse rounded bg-[var(--fill)]" />
                </span>
              </div>
            ))}
          </div>
        ) : notif.status === "error" && !items.length ? (
          <div className="px-4 py-8 text-center">
            <p className="text-[13px] text-[var(--text-soft)]">{t("notify.panel.error")}</p>
            <button
              type="button"
              onClick={notif.refresh}
              className="mx-auto mt-3 flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[var(--color-ink-line)] px-3 text-[12.5px] font-bold text-[var(--text)] hover:bg-[var(--fill)]"
            >
              <RotateCw size={14} /> {t("notify.panel.retry")}
            </button>
          </div>
        ) : !items.length ? (
          <div className="px-5 py-9 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[var(--fill)] text-[var(--color-mute)]">
              <BellRing size={22} />
            </span>
            <p className="mt-3 text-[14px] font-extrabold text-[var(--text)]">{t("notify.panel.empty")}</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-soft)]">{t("notify.panel.emptyHint")}</p>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {items.map((n) => (
              <li key={n.id}>
                <NotificationRow n={n} unread={unread.has(n.id)} onOpen={open} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2 border-t border-[var(--color-ink-line)] p-3">
        <PushToggle variant="row" />
        <Link
          to={localizePath("/new", lang)}
          onClick={onClose}
          className="group flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl text-[13px] font-extrabold text-[var(--text-softer)] transition-colors hover:bg-[var(--fill)] hover:text-[var(--text)]"
        >
          {t("notify.panel.all")}
          <ArrowLeft size={15} className="transition-transform ltr:rotate-180 rtl:group-hover:-translate-x-0.5 ltr:group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  );
}
