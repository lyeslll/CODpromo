import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BellPlus, BellRing, Check, Loader2, Smartphone, Sparkles, Users, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useComingSoon } from "../../lib/comingSoonStore.js";
import { useAuth } from "../../lib/auth.jsx";
import { usePushState } from "../../lib/push.js";
import { formatNumber } from "../../lib/values.js";
import { SOON, SOON_BG, SOON_INK, SOON_SOFT } from "./tone.js";

/**
 * "أعلمني عند التفعيل" + العدّاد الحقيقي تحت الزر (البطاقة القريبة وصفحة الشركة).
 * زر واحد يبدّل (aria-pressed): أعلمني ⇄ سنُعلمك (الضغط من جديد = إلغاء). الزائر → الدخول ويرجع للبطاقة.
 * العدّاد: "N تاجراً ينتظرون هذا العرض" من 3، وإلا "كن من الأوائل" (رقم حقيقي برك، من القاعدة).
 * بعد "أعلمني": تذكير صغير يتحلّ مرة (portal) باش يفعّل إشعارات الهاتف إذا ماهيش مشعولة.
 * live = false: معاينة (فورم الأدمين) — بلا أي نداء.
 */
export default function ComingSoonNotify({ companyId, live = true, size = "card" }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const s = useComingSoon(companyId, live);
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const [pushAsk, setPushAsk] = useState(false);
  const closeNudge = useCallback(() => setPushAsk(false), []);
  const wasWaiting = useRef(s.waiting);

  // رجع من الدخول (?notify=<id>): البطاقة تجي قدامو
  useEffect(() => {
    if (!s.auto) return;
    const el = ref.current?.closest("[data-soon-anchor]") || ref.current;
    el?.scrollIntoView({ behavior: reduce ? "instant" : "smooth", block: "center" });
  }, [s.auto, reduce]);

  // سجّل "أعلمني" دروك → نقترحو إشعارات الهاتف (مرة)
  useEffect(() => {
    if (s.waiting && !wasWaiting.current && s.signedIn) setPushAsk(true);
    wasWaiting.current = s.waiting;
  }, [s.waiting, s.signedIn]);

  const big = size === "hero";
  const label = s.notified ? t("comingSoon.notifiedBefore") : s.waiting ? t("comingSoon.notifyOn") : t("comingSoon.notify");
  const Icon = s.busy ? Loader2 : s.notified ? Check : s.waiting ? BellRing : BellPlus;
  const count = s.count;
  const status = s.status && s.status !== "ok" ? t(`comingSoon.status.${s.status}`, { defaultValue: t("comingSoon.status.error") }) : null;

  return (
    <div ref={ref}>
      <button
        type="button"
        data-notify=""
        onClick={s.toggle}
        disabled={!live || s.busy || s.notified}
        aria-pressed={s.waiting}
        title={s.waiting ? t("comingSoon.cancelHint") : undefined}
        className={`group/notify relative flex w-full items-center justify-center gap-2 rounded-xl border px-3 font-extrabold outline-none transition-[background-color,border-color,transform] focus-visible:ring-2 focus-visible:ring-[#ffc2dc]/70 active:scale-[0.99] disabled:cursor-default ${
          big ? "min-h-[52px] text-[15px]" : "min-h-[38px] text-[13px]"
        }`}
        style={
          s.waiting || s.notified
            ? { borderColor: `${SOON}73`, background: `${SOON}14`, color: SOON_SOFT }
            : { borderColor: "transparent", background: SOON_BG, color: SOON_INK, boxShadow: `0 10px 26px -14px ${SOON}` }
        }
      >
        <Icon size={big ? 18 : 15} className={`shrink-0 ${s.busy ? "animate-spin" : ""}`} />
        <span className="line-clamp-2 text-center leading-tight">{label}</span>
        {s.waiting && !s.busy && (
          <span className="ms-1 shrink-0 rounded-md px-1.5 py-0.5 text-[11.5px] font-bold text-[var(--text-softer)] underline-offset-2 group-hover/notify:underline">{t("comingSoon.cancel")}</span>
        )}
      </button>

      {/* العدّاد (المكان محجوز قبل ما يوصل الرقم: بلا قفزة) */}
      <p
        className={`${big ? "mt-2.5" : "mt-2"} flex min-h-[18px] items-center gap-1.5 font-bold ${big ? "text-[13px]" : "text-[11.5px]"} ${status ? "text-[#fbbf24]" : "text-[var(--color-mute)]"}`}
        aria-live="polite"
      >
        {status ? (
          status
        ) : !s.ready ? (
          <span className="invisible">{t("comingSoon.first")}</span>
        ) : count ? (
          <>
            <Users size={13} className="shrink-0" style={{ color: SOON }} />
            <span>{t("comingSoon.waiting", { count, n: formatNumber(count, lang) })}</span>
          </>
        ) : (
          <>
            <Sparkles size={13} className="shrink-0" style={{ color: SOON }} />
            <span>{t("comingSoon.first")}</span>
          </>
        )}
      </p>

      {pushAsk && <PushNudge onClose={closeNudge} />}
    </div>
  );
}

/* ===== تذكير صغير بعد "أعلمني": إشعارات الهاتف (الإذن بضغطة على الزر برك) ===== */
function PushNudge({ onClose }) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const push = usePushState({ lang: i18n.language, userId: user?.id || null });
  const show = push.support === "supported" && push.state === "off";

  useEffect(() => {
    if (push.state === "checking") return;
    if (!show) {
      onClose();
      return;
    }
    const id = setTimeout(onClose, 9000);
    return () => clearTimeout(id);
  }, [show, push.state, onClose]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {show && (
        <motion.div
          key="soon-push"
          role="status"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.22 }}
          className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+84px)] z-[70] mx-auto max-w-md md:bottom-6"
        >
          <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-ink-line)] bg-[var(--elev)]/95 p-3 shadow-[0_18px_44px_-14px_rgba(0,0,0,0.8)] backdrop-blur-xl">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: `${SOON}1f`, color: SOON }}>
              <Smartphone size={17} />
            </span>
            <p className="min-w-0 flex-1 text-[12.5px] font-bold leading-snug text-[var(--text-soft)]">{t("comingSoon.pushHint")}</p>
            <button
              type="button"
              onClick={async () => {
                const r = await push.enable({ title: t("notify.push.enabledTitle"), body: t("notify.push.enabledBody") });
                if (r === "ok") onClose();
              }}
              disabled={push.busy}
              className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl px-3 text-[12.5px] font-extrabold disabled:opacity-60"
              style={{ background: SOON_BG, color: SOON_INK }}
            >
              {push.busy ? <Loader2 size={14} className="animate-spin" /> : <BellRing size={14} />}
              {t("comingSoon.pushCta")}
            </button>
            <button type="button" onClick={onClose} aria-label={t("header.close")} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[var(--color-mute)] hover:bg-[var(--fill-strong)]">
              <X size={15} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
