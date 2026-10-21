import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { subscribeEmail } from "../../lib/subscribers.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * النشرة البريدية في الفوتر: تسجّل في email_subscribers (source = "footer") عبر نفس دالة النافذة.
 * الضغط على الزر = موافقة (مذكورة تحته مع رابط سياسة الخصوصية). التكرار لا يُسجَّل مرتين.
 */
export default function Newsletter() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [state, setState] = useState("idle"); // idle | sending | done | duplicate
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) return setError(t("emailPopup.errEmail"));
    setError("");
    setState("sending");
    try {
      const { duplicate } = await subscribeEmail(email, true, "footer");
      setState(duplicate ? "duplicate" : "done");
    } catch {
      setState("idle");
      setError(t("emailPopup.errGeneric"));
    }
  };

  if (state === "done" || state === "duplicate") {
    return (
      <p role="status" className="mt-7 flex items-start gap-2.5 rounded-xl border border-[var(--color-lime)]/30 bg-[var(--color-lime)]/[0.07] px-4 py-3.5 text-[14px] font-semibold text-[var(--text)]">
        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--color-lime)] text-[#0a0a0a]">
          <Check size={13} strokeWidth={3} />
        </span>
        {state === "done" ? t("footer.newsDone") : t("footer.newsDup")}
      </p>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="mt-7">
      <label htmlFor="footer-news" className="block text-[15px] font-extrabold text-[var(--text)]">
        {t("footer.newsTitle")}
      </label>
      <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-[var(--color-ink-line)] bg-[var(--fill)] p-1.5 transition-colors focus-within:border-[var(--color-lime)]/45 sm:flex-row">
        <input
          id="footer-news"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("footer.newsPlaceholder")}
          aria-invalid={!!error}
          aria-describedby="footer-news-note"
          dir="ltr"
          className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-[14.5px] text-[var(--text)] outline-none placeholder:text-[var(--color-mute)] rtl:text-right"
        />
        <button
          type="submit"
          disabled={state === "sending"}
          className="flex shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[14px] font-extrabold text-[#0a0a0a] transition-opacity disabled:opacity-70"
          style={{ background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" }}
        >
          {state === "sending" && <Loader2 size={15} className="animate-spin" />}
          {t("footer.newsCta")}
        </button>
      </div>
      <p id="footer-news-note" aria-live="polite" className={`mt-2.5 text-[12px] leading-relaxed ${error ? "font-semibold text-red-400" : "text-[var(--color-mute)]"}`}>
        {error || (
          <>
            {t("footer.newsConsent")}{" "}
            <Link to="/privacy" className="underline decoration-dotted underline-offset-2 transition-colors hover:text-[var(--accent-text)]">
              {t("footer.privacy")}
            </Link>
            .
          </>
        )}
      </p>
    </form>
  );
}
