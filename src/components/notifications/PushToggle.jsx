import { BellOff, BellRing, Loader2, Smartphone } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../lib/auth.jsx";
import { usePushState } from "../../lib/push.js";

/**
 * زر "إشعارات الهاتف" — الإذن يتطلب غير كي يضغط الزائر (حتى نافذة تطلع وحدها).
 * variant: "card" (بطاقة بشرح، الجرس و /new والداشبورد) | "row" (سطر صغير: مفعّلة + إيقاف).
 * hideWhenOn: البطاقة تختفي كي تكون مفعّلة (في الجرس يبان سطر صغير تحت بلاصتها).
 */
export default function PushToggle({ variant = "card", className = "" }) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const lang = i18n.language;
  const push = usePushState({ lang, userId: user?.id || null });

  if (push.support === "unsupported") return null;

  if (push.support === "ios-install") {
    return (
      <p className={`flex items-start gap-2 rounded-xl border border-[var(--color-ink-line)] bg-[var(--fill)] p-3 text-[12.5px] leading-relaxed text-[var(--text-soft)] ${className}`}>
        <Smartphone size={16} className="mt-0.5 shrink-0 text-[var(--color-mute)]" />
        {t("notify.push.ios")}
      </p>
    );
  }

  const errorText = push.error
    ? t(push.error === "rate_limited" ? "notify.push.rateLimited" : push.error === "denied" ? "notify.push.denied" : push.error === "dismissed" ? "notify.push.dismissed" : "notify.push.error")
    : null;

  const enable = () => push.enable({ title: t("notify.push.enabledTitle"), body: t("notify.push.enabledBody") });

  if (push.state === "on") {
    return (
      <div className={`flex items-center justify-between gap-3 rounded-xl border border-[var(--color-lime)]/25 bg-[var(--color-lime)]/[0.06] px-3 py-2.5 ${className}`}>
        <span className="flex min-w-0 items-center gap-2 text-[12.5px] font-bold text-[var(--accent-text)]">
          <BellRing size={15} className="shrink-0" />
          <span className="min-w-0">{t("notify.push.on")}</span>
        </span>
        <button
          type="button"
          onClick={push.disable}
          disabled={push.busy}
          className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-bold text-[var(--text-soft)] transition-colors hover:bg-[var(--fill-strong)] hover:text-[var(--text)] disabled:opacity-60"
        >
          {push.busy ? <Loader2 size={14} className="animate-spin" /> : <BellOff size={14} />}
          {t("notify.push.off")}
        </button>
      </div>
    );
  }

  if (push.state === "denied") {
    return (
      <p className={`flex items-start gap-2 rounded-xl border border-[var(--color-ink-line)] bg-[var(--fill)] p-3 text-[12.5px] leading-relaxed text-[var(--text-soft)] ${className}`}>
        <BellOff size={16} className="mt-0.5 shrink-0 text-[var(--color-mute)]" />
        {t("notify.push.denied")}
      </p>
    );
  }

  if (variant === "row") {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={enable}
          disabled={push.busy || push.state === "checking"}
          className="flex min-h-[40px] w-full items-center justify-center gap-2 rounded-xl border border-[var(--color-lime)]/35 bg-[var(--color-lime)]/[0.08] px-3 text-[13px] font-extrabold text-[var(--accent-text)] transition-colors hover:bg-[var(--color-lime)]/15 disabled:opacity-60"
        >
          {push.busy ? <Loader2 size={15} className="animate-spin" /> : <BellRing size={15} />}
          {push.busy ? t("notify.push.working") : t("notify.push.cta")}
        </button>
        {errorText && <p className="mt-1.5 text-[12px] text-red-400">{errorText}</p>}
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border border-[var(--color-lime)]/25 bg-[linear-gradient(135deg,rgba(166,240,0,0.08),rgba(166,240,0,0.02))] p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--color-lime)]/15 text-[var(--accent-text)]">
          <BellRing size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-extrabold text-[var(--text)]">{t("notify.push.title")}</p>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--text-soft)]">{t("notify.push.pitch")}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={enable}
        disabled={push.busy || push.state === "checking"}
        className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl px-4 text-[13.5px] font-extrabold text-[#0a0a0a] transition-transform hover:-translate-y-px disabled:opacity-60"
        style={{ background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" }}
      >
        {push.busy ? <Loader2 size={16} className="animate-spin" /> : <BellRing size={16} />}
        {push.busy ? t("notify.push.working") : t("notify.push.cta")}
      </button>
      {errorText && <p className="mt-2 text-[12px] text-red-400">{errorText}</p>}
    </div>
  );
}
