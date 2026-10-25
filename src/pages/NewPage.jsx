import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2, RotateCw, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import Navbar from "../components/Navbar.jsx";
import Footer from "../components/Footer.jsx";
import Seo from "../components/Seo.jsx";
import Breadcrumbs from "../components/seo/Breadcrumbs.jsx";
import NotificationRow from "../components/notifications/NotificationRow.jsx";
import PushToggle from "../components/notifications/PushToggle.jsx";
import { fetchFeed, localizePath, renderNotification } from "../lib/notifications.js";
import { useNotifications } from "../lib/useNotifications.js";
import { absUrl, breadcrumbLd, buildAlternates, homeUrl, newUrl, offersPath } from "../lib/seo.js";

const PAGE = 20;

/** "اليوم" / "أمس" / التاريخ — حسب توقيت الزائر. */
function dayLabel(date, lang, t) {
  const d = new Date(date);
  const start = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(new Date()) - start(d)) / 86400000);
  if (diff === 0) return t("notify.page.today");
  if (diff === 1) return t("notify.page.yesterday");
  return new Intl.DateTimeFormat(lang, { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(d);
}

/**
 * /new (+ /en/new، /fr/new) — "جديد CODpromo": كل الشركات والأكواد والعروض والميزات الجديدة بالتاريخ.
 * عامة (حتى الزائر)، ?since=<ms> (من رسالة الرجوع) يعلّم الجديد منذ آخر زيارة. SEO: CollectionPage + ItemList،
 * ونفس الشي خادمياً في api/prerender.js (type=new) + الـ sitemap.
 */
export default function NewPage({ lang = "ar" }) {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const since = Number(params.get("since")) || null;
  const notif = useNotifications();
  const [items, setItems] = useState(null);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const load = (before = null) => {
    setBusy(true);
    setError(false);
    fetchFeed({ all: true, limit: PAGE, before })
      .then((r) => {
        setItems((prev) => (before && prev ? [...prev, ...r.items] : r.items));
        setMore(r.items.length === PAGE);
      })
      .catch(() => {
        setError(true);
        setItems((prev) => prev || []);
      })
      .finally(() => setBusy(false));
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // شاف الصفحة = شاف الجديد: الجرس يرجع للصفر
  useEffect(() => {
    if (!items?.length || !notif.ready || !notif.unreadCount) return;
    const id = setTimeout(() => notif.markAllRead(), 1500);
    return () => clearTimeout(id);
  }, [items, notif.ready, notif.unreadCount]); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => {
    const out = [];
    for (const n of items || []) {
      const label = dayLabel(n.published_at, lang, t);
      if (!out.length || out[out.length - 1].label !== label) out.push({ label, items: [] });
      out[out.length - 1].items.push(n);
    }
    return out;
  }, [items, lang, t]);

  const fresh = since ? (items || []).filter((n) => new Date(n.published_at).getTime() > since).length : 0;
  const canonical = newUrl(lang);
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: t("notify.page.title"),
      description: t("notify.page.seoDesc"),
      url: canonical,
      inLanguage: lang,
      mainEntity: {
        "@type": "ItemList",
        itemListElement: (items || []).slice(0, PAGE).map((n, i) => {
          const r = renderNotification(n, t, lang);
          return { "@type": "ListItem", position: i + 1, name: r.title, url: absUrl(localizePath(n.url || "/new", lang)) };
        }),
      },
    },
    breadcrumbLd([
      { name: t("store.breadcrumbHome"), url: homeUrl(lang) },
      { name: t("notify.page.title"), url: canonical },
    ]),
  ];

  return (
    <div className="min-h-screen bg-[var(--color-ink)] text-[var(--text)]">
      <Seo
        lang={lang}
        title={t("notify.page.seoTitle")}
        description={t("notify.page.seoDesc")}
        canonical={canonical}
        alternates={buildAlternates("new")}
        jsonLd={jsonLd}
      />
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-[96px] sm:pt-[104px]">
        <Breadcrumbs
          items={[
            { name: t("store.breadcrumbHome"), to: lang === "ar" ? "/" : `/${lang}` },
            { name: t("notify.page.title") },
          ]}
        />

        <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section aria-labelledby="new-title">
            <header className="mb-6">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-lime)]/10 px-3 py-1 text-[12px] font-extrabold text-[var(--accent-text)] ring-1 ring-[var(--color-lime)]/25">
                <Sparkles size={13} /> {t("notify.page.eyebrow")}
              </span>
              <h1 id="new-title" className="mt-3 text-[28px] font-black tracking-tight sm:text-[36px]">
                {t("notify.page.title")}
              </h1>
              <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-[var(--text-soft)]">{t("notify.page.lead")}</p>
              {fresh > 0 && (
                <p className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[var(--color-lime)]/30 bg-[var(--color-lime)]/[0.06] px-3 py-2 text-[13px] font-bold text-[var(--accent-text)]">
                  <Sparkles size={15} /> {t("notify.page.freshCount", { count: fresh })}
                </p>
              )}
            </header>

            {/* الهاتف: زر الإشعارات قبل القائمة */}
            <div className="mb-6 lg:hidden">
              <PushToggle />
            </div>

            {items === null ? (
              <div className="space-y-3" aria-busy="true">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-[92px] animate-pulse rounded-2xl border border-[var(--color-ink-line)] bg-[var(--color-ink-card)]" />
                ))}
              </div>
            ) : !items.length ? (
              <div className="rounded-2xl border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] p-8 text-center">
                <p className="text-[15px] font-extrabold">{error ? t("notify.panel.error") : t("notify.panel.empty")}</p>
                {error ? (
                  <button type="button" onClick={() => load()} className="mx-auto mt-4 flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--color-ink-line)] px-4 text-[13px] font-bold hover:bg-[var(--fill)]">
                    <RotateCw size={15} /> {t("notify.panel.retry")}
                  </button>
                ) : (
                  <p className="mt-1 text-[13px] text-[var(--text-soft)]">{t("notify.panel.emptyHint")}</p>
                )}
              </div>
            ) : (
              <div className="space-y-8">
                {groups.map((g) => (
                  <section key={g.label} aria-label={g.label}>
                    <h2 className="mb-3 flex items-center gap-3 text-[13px] font-extrabold text-[var(--text-softer)]">
                      {g.label}
                      <span aria-hidden className="h-px flex-1 bg-[var(--color-ink-line)]" />
                    </h2>
                    <ul className="space-y-3">
                      {g.items.map((n) => (
                        <li key={n.id}>
                          <NotificationRow n={n} size="lg" highlight={!!since && new Date(n.published_at).getTime() > since} />
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
                {more && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => load(items[items.length - 1]?.published_at)}
                    className="mx-auto flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--color-ink-line)] px-5 text-[13.5px] font-extrabold text-[var(--text)] transition-colors hover:bg-[var(--fill)] disabled:opacity-60"
                  >
                    {busy && <Loader2 size={15} className="animate-spin" />}
                    {t("notify.page.more")}
                  </button>
                )}
              </div>
            )}
          </section>

          <aside className="hidden lg:block">
            <div className="sticky top-28 space-y-4">
              <PushToggle />
              <Link
                to={offersPath(lang)}
                className="group flex min-h-[48px] items-center justify-between rounded-2xl border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] px-4 text-[13.5px] font-extrabold transition-colors hover:border-white/15"
              >
                {t("notify.page.allOffers")}
                <ArrowLeft size={16} className="transition-transform ltr:rotate-180 rtl:group-hover:-translate-x-0.5 ltr:group-hover:translate-x-0.5" />
              </Link>
            </div>
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  );
}
