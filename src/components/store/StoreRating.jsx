import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Star, Loader2, LogIn, Check, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../lib/auth.jsx";
import { fetchMyRating, rateCompany } from "../../lib/ratings.js";
import { ratingTagsFor, RATING_MIN_AVG } from "../../lib/storeContent.js";
import { setReturnTo } from "../../lib/returnTo.js";
import { SectionTitle } from "./StoreSections.jsx";

const STATUSES = ["auth", "unconfirmed", "disposable", "owner", "company_account", "inbox_used", "rate_limited", "unavailable", "invalid"];

/**
 * التقييم: الملخّص (المعدّل من 3 تقييمات حقيقية، التوزيع، العلامات) + تقييمي (نجوم + علامات سريعة).
 * الحفظ عبر rate_company برك (القاعدة تتحقق من كلش). بلا تعليقات مكتوبة.
 */
export default function StoreRating({ company, kind, summary, onSummary, lang }) {
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const name = company.name;
  const count = Number(summary?.count) || 0;
  const showAvg = count >= RATING_MIN_AVG && summary?.avg != null;
  const allowedTags = ratingTagsFor(kind);

  const [mine, setMine] = useState(undefined); // undefined = يتحمّل، null = ما قيّمش
  const [editing, setEditing] = useState(false);
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [tags, setTags] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let alive = true;
    setMine(undefined);
    setSaved(false);
    if (!user) {
      setMine(null);
      return;
    }
    fetchMyRating(company.id)
      .then((r) => alive && setMine(r || null))
      .catch(() => alive && setMine(null));
    return () => {
      alive = false;
    };
  }, [user?.id, company.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const startEdit = () => {
    setStars(mine?.stars || 0);
    setTags((mine?.tags || []).filter((x) => allowedTags.includes(x)));
    setErr("");
    setSaved(false);
    setEditing(true);
  };

  const toggleTag = (tag) =>
    setTags((cur) => (cur.includes(tag) ? cur.filter((x) => x !== tag) : cur.length >= 4 ? cur : [...cur, tag]));

  const submit = async (e) => {
    e.preventDefault();
    if (!stars) return setErr(t("storePage.rating.pickStars"));
    setBusy(true);
    setErr("");
    try {
      const r = await rateCompany(company.id, stars, tags);
      if (r?.status === "ok") {
        setMine(r.mine || { stars, tags });
        if (r.summary) onSummary?.(r.summary);
        setEditing(false);
        setSaved(true);
      } else {
        setErr(t(`storePage.rating.err.${STATUSES.includes(r?.status) ? r.status : "generic"}`));
      }
    } catch {
      setErr(t("storePage.rating.err.generic"));
    } finally {
      setBusy(false);
    }
  };

  const dist = useMemo(() => [5, 4, 3, 2, 1].map((s) => ({ s, n: Number(summary?.dist?.[s]) || 0 })), [summary]);
  const topTags = (summary?.tags || []).filter((x) => x.n > 0).slice(0, 5);

  return (
    <section id="ratings" aria-labelledby="store-rating-title" className="mt-14 scroll-mt-28">
      <SectionTitle id="store-rating-title">{t("storePage.rating.title", { name })}</SectionTitle>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* الملخّص */}
        <div className="rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] p-5 sm:p-6">
          {showAvg ? (
            <>
              <div className="flex items-center gap-4">
                <span className="[font-family:Inter,sans-serif] text-[52px] font-black leading-none text-[var(--text)]">{summary.avg}</span>
                <div>
                  <Stars value={Number(summary.avg)} size={20} />
                  <p className="mt-1.5 text-[13px] font-bold text-[var(--color-mute)]">
                    {t("storePage.rating.outOf")} · {t("storePage.rating.count", { count })}
                  </p>
                </div>
              </div>
              <ul className="mt-5 grid gap-1.5" aria-label={t("storePage.rating.title", { name })}>
                {dist.map(({ s, n }) => (
                  <li key={s} className="flex items-center gap-2.5 text-[12px] font-bold text-[var(--color-mute)]">
                    <span className="w-3 text-center [font-family:Inter,sans-serif]">{s}</span>
                    <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-[var(--fill-strong)]">
                      <span className="absolute inset-y-0 start-0 rounded-full bg-[#fbbf24]" style={{ width: `${count ? (100 * n) / count : 0}%` }} />
                    </span>
                    <span className="w-6 text-end [font-family:Inter,sans-serif] tabular-nums">{n}</span>
                  </li>
                ))}
              </ul>
              {topTags.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {topTags.map((x) => (
                    <span key={x.tag} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-ink-line)] bg-[var(--fill)] px-3 py-1.5 text-[12.5px] font-bold text-[var(--text-softer)]">
                      {t(`storePage.rating.tags.${x.tag}`)}
                      <span className="[font-family:Inter,sans-serif] text-[11.5px] text-[var(--color-mute)]">{x.n}</span>
                    </span>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex h-full flex-col justify-center gap-3">
              <Stars value={0} size={22} />
              <p className="text-[14.5px] leading-[1.7] text-[var(--text-soft)]">
                {count > 0 ? `${t("storePage.rating.count", { count })}. ${t("storePage.rating.few")}` : t("storePage.rating.empty", { name })}
              </p>
            </div>
          )}
          <p className="mt-5 border-t border-dashed border-[var(--color-ink-line)] pt-3 text-[12px] font-medium text-[var(--color-mute)]">{t("storePage.rating.note")}</p>
        </div>

        {/* تقييمي */}
        <div className="rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] p-5 sm:p-6">
          <h3 className="text-[16.5px] font-extrabold text-[var(--text)]">{t("storePage.rating.yourTitle", { name })}</h3>

          {authLoading || (user && mine === undefined) ? (
            <div className="grid h-32 place-items-center">
              <Loader2 size={22} className="animate-spin text-[var(--color-mute)]" />
            </div>
          ) : !user ? (
            <div className="mt-3">
              <p className="text-[14px] leading-[1.7] text-[var(--text-soft)]">{t("storePage.rating.loginHint")}</p>
              <Link
                to="/login"
                onClick={() => setReturnTo(`${location.pathname}#ratings`)}
                className="mt-4 inline-flex min-h-[48px] items-center gap-2 rounded-xl px-5 text-[14.5px] font-extrabold text-[#0a0a0a]"
                style={{ background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" }}
              >
                <LogIn size={17} /> {t("storePage.rating.loginCta", { name })}
              </Link>
            </div>
          ) : mine && !editing ? (
            <div className="mt-3">
              <div className="flex items-center gap-3">
                <Stars value={mine.stars} size={22} />
                <span className="text-[14px] font-bold text-[var(--text-softer)]">{t("storePage.rating.yours", { n: mine.stars })}</span>
              </div>
              {mine.tags?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {mine.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-[#fbbf24]/30 bg-[#fbbf24]/10 px-3 py-1.5 text-[12.5px] font-bold text-[#fcd34d]">
                      {t(`storePage.rating.tags.${tag}`)}
                    </span>
                  ))}
                </div>
              )}
              {mine.hidden && (
                <p className="mt-3 flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--color-mute)]">
                  <EyeOff size={14} /> {t("storePage.rating.hidden")}
                </p>
              )}
              {saved && (
                <p role="status" className="mt-3 flex items-center gap-1.5 text-[13px] font-bold text-[var(--accent-text)]">
                  <Check size={15} /> {t("storePage.rating.saved")}
                </p>
              )}
              <button type="button" onClick={startEdit} className="mt-4 inline-flex min-h-[44px] items-center rounded-xl border border-[var(--color-ink-line)] px-4 text-[13.5px] font-bold text-[var(--text-softer)] hover:border-[#fbbf24]/40">
                {t("storePage.rating.edit")}
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-3">
              <div role="radiogroup" aria-label={t("storePage.rating.yourTitle", { name })} className="flex items-center gap-1" onPointerLeave={() => setHover(0)}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={stars === n}
                    aria-label={t("storePage.rating.stars", { n })}
                    onClick={() => {
                      setStars(n);
                      setEditing(true);
                      setErr("");
                    }}
                    onPointerEnter={(e) => e.pointerType === "mouse" && setHover(n)}
                    className={`star-btn grid h-12 w-12 place-items-center rounded-xl ${(hover || stars) >= n ? "is-on" : ""}`}
                  >
                    <Star size={30} strokeWidth={1.7} className="text-[var(--color-ink-line)]" />
                  </button>
                ))}
              </div>

              <p className="mt-4 text-[13px] font-bold text-[var(--color-mute)]">{t("storePage.rating.tagsQ")}</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {allowedTags.map((tag) => {
                  const on = tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleTag(tag)}
                      disabled={!on && tags.length >= 4}
                      className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-bold transition-colors disabled:opacity-40 ${
                        on ? "border-[#fbbf24]/50 bg-[#fbbf24]/12 text-[#fcd34d]" : "border-[var(--color-ink-line)] bg-[var(--fill)] text-[var(--text-softer)]"
                      }`}
                    >
                      {on && <Check size={13} strokeWidth={3} />}
                      {t(`storePage.rating.tags.${tag}`)}
                    </button>
                  );
                })}
              </div>

              {err && (
                <p role="alert" className="mt-3 text-[13px] font-semibold text-red-400">
                  {err}
                </p>
              )}
              <div className="mt-5 flex flex-wrap items-center gap-2.5">
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex min-h-[48px] items-center gap-2 rounded-xl px-5 text-[14.5px] font-extrabold text-[#0a0a0a] disabled:opacity-70"
                  style={{ background: "linear-gradient(135deg, #fde68a, #fbbf24)" }}
                >
                  {busy && <Loader2 size={16} className="animate-spin" />}
                  {busy ? t("storePage.rating.saving") : mine ? t("storePage.rating.update") : t("storePage.rating.submit")}
                </button>
                {mine && (
                  <button type="button" onClick={() => setEditing(false)} className="inline-flex min-h-[48px] items-center rounded-xl px-4 text-[13.5px] font-bold text-[var(--color-mute)] hover:text-[var(--text)]">
                    {t("storePage.rating.cancel")}
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

/** نجوم للعرض (تعبئة جزئية للمعدّل). */
function Stars({ value = 0, size = 18 }) {
  return (
    <span className="relative inline-flex" aria-hidden>
      <span className="flex gap-0.5 text-[var(--color-ink-line)]">
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} size={size} strokeWidth={1.6} className="fill-current" />
        ))}
      </span>
      <span className="absolute inset-y-0 start-0 flex gap-0.5 overflow-hidden text-[#fbbf24]" style={{ width: `${Math.max(0, Math.min(5, value)) * 20}%` }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} size={size} strokeWidth={1.6} className="shrink-0 fill-current" />
        ))}
      </span>
    </span>
  );
}
