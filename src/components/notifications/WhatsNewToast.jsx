import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Sparkles, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNotifications } from "../../lib/useNotifications.js";
import { localizePath, OFFER_KINDS, RETURN_AFTER_HOURS } from "../../lib/notifications.js";

const LAST_KEY = "codpromo:last-visit:v1"; // localStorage: آخر مرة كان هنا
const SINCE_KEY = "codpromo:visit-since"; // sessionStorage: آخر زيارة قبل هاد الجلسة (ثابتة طول الجلسة)
const DONE_KEY = "codpromo:whatsnew-done"; // sessionStorage: الرسالة بانت (مرة وحدة في الجلسة)
const SHOW_MS = 12000;

// صفحات بلا رسالة: الأدمين، التحويل، الهدية، الدفع، الحساب، و /new نفسها
const QUIET = /^\/(?:(?:en|fr)\/)?(?:admin|go\/|gift\/|payment|login|signup|forgot-password|reset-password|keys\/|new(?:\/|$))/;

function readStorage(store, key) {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}
function writeStorage(store, key, value) {
  try {
    store.setItem(key, value);
  } catch {
    /* تصفّح خاص… */
  }
}

/** آخر زيارة قبل هاد الجلسة (ms) — null أول مرة. ويسجّل "دروك" كآخر زيارة. */
function visitSince() {
  let since = readStorage(sessionStorage, SINCE_KEY);
  if (since === null) {
    since = readStorage(localStorage, LAST_KEY) || "";
    writeStorage(sessionStorage, SINCE_KEY, since);
  }
  writeStorage(localStorage, LAST_KEY, String(Date.now()));
  const n = Number(since);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * الزائر يرجع بعد غياب (6 ساعات وأكثر): رسالة صغيرة "X عروض جديدة منذ آخر زيارة" → /new?since=…
 * مرة وحدة في الجلسة، تختفي وحدها بعد 12 ثانية، فوق شريط التنقّل في الهاتف. بلا نافذة ولا إذن.
 */
export default function WhatsNewToast() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const quiet = QUIET.test(pathname);
  const notif = useNotifications({ enabled: !quiet });
  const [since] = useState(visitSince);
  const [show, setShow] = useState(false);
  const [count, setCount] = useState(0);

  // آخر زيارة تتحدّث كي يخرج (باش الغياب يتحسب من آخر مرة شاف الصفحة)
  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && writeStorage(localStorage, LAST_KEY, String(Date.now()));
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []);

  useEffect(() => {
    if (!since || !notif.ready || readStorage(sessionStorage, DONE_KEY)) return;
    if (Date.now() - since < RETURN_AFTER_HOURS * 3600000 || quiet) return;
    const n = notif.items.filter((i) => OFFER_KINDS.includes(i.kind) && new Date(i.published_at).getTime() > since).length;
    if (!n) return;
    const id = setTimeout(() => {
      writeStorage(sessionStorage, DONE_KEY, "1");
      setCount(n);
      setShow(true);
    }, 2200);
    return () => clearTimeout(id);
  }, [since, notif.ready, notif.items, quiet]);

  useEffect(() => {
    if (!show) return;
    const id = setTimeout(() => setShow(false), SHOW_MS);
    return () => clearTimeout(id);
  }, [show]);

  const open = () => {
    setShow(false);
    navigate(`${localizePath("/new", lang)}?since=${since}`);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          className="fixed inset-x-3 bottom-[calc(80px+env(safe-area-inset-bottom))] z-[45] mx-auto flex max-w-sm items-center gap-2 rounded-2xl border border-[var(--color-lime)]/30 bg-[var(--elev)]/95 p-2 shadow-[0_18px_50px_-14px_rgba(0,0,0,0.75)] backdrop-blur-xl md:inset-x-auto md:bottom-6 md:start-6 md:mx-0"
        >
          <button type="button" onClick={open} className="group flex min-h-[44px] min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2 text-start">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--color-lime)]/15 text-[var(--accent-text)]">
              <Sparkles size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-extrabold leading-snug text-[var(--text)]">{t("notify.toast.title", { count })}</span>
              <span className="mt-0.5 flex items-center gap-1 text-[12px] font-bold text-[var(--accent-text)]">
                {t("notify.toast.cta")}
                <ArrowLeft size={13} className="transition-transform ltr:rotate-180 rtl:group-hover:-translate-x-0.5 ltr:group-hover:translate-x-0.5" />
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setShow(false)}
            aria-label={t("notify.toast.close")}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[var(--color-mute)] transition-colors hover:bg-[var(--fill)] hover:text-[var(--text)]"
          >
            <X size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
