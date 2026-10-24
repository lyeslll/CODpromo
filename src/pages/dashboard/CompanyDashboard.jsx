import { useCallback, useEffect, useMemo, useState } from "react";
import { Routes, Route, Link, Navigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Copy, ThumbsUp, Heart, Store, Clock, CheckCircle2, XCircle, PencilLine, ExternalLink, TrendingUp, Check, Inbox, MousePointerClick } from "lucide-react";
import { useTranslation } from "react-i18next";
import DashboardShell from "../../components/dashboard/DashboardShell.jsx";
import CompanyLogo from "../../components/CompanyLogo.jsx";
import { getTypeMeta } from "../../lib/types.js";
import { useAuth } from "../../lib/auth.jsx";
import { fetchMyRequests, fetchPartnerOverview } from "../../lib/requests.js";
import { storePath, partnersPath } from "../../lib/seo.js";
import { formatNumber } from "../../lib/values.js";
import PartnerOfferPage from "./PartnerOfferPage.jsx";
import SettingsPanel from "../../components/dashboard/customer/SettingsPanel.jsx";

const STATUS = {
  pending: { icon: Clock, color: "#fbbf24" },
  accepted: { icon: CheckCircle2, color: "#a6f000" },
  rejected: { icon: XCircle, color: "#f87171" },
};

/** داشبورد حساب الشركة: نظرة عامة + عروضي، وفورم الطلب في مساراته. */
export default function CompanyDashboard() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();
  const [requests, setRequests] = useState(null);
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(location.state?.sent ? t("partnerDash.sentToast") : "");

  const load = useCallback(() => {
    setError("");
    fetchMyRequests(user.id).then(setRequests).catch((e) => (setRequests([]), setError(e.message)));
    fetchPartnerOverview().then(setOverview).catch((e) => (setOverview({ items: [], series: [] }), setError(e.message)));
  }, [user.id]);

  useEffect(load, [load]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    if (location.state?.sent) {
      setToast(t("partnerDash.sentToast"));
      load();
    }
  }, [location.state, t, load]);

  return (
    <DashboardShell badge={t("dashboard.company.badge")} wide>
      <Routes>
        <Route index element={<PartnerHome requests={requests} overview={overview} error={error} />} />
        <Route path="offers/new" element={<PartnerOfferPage mode="new" pendingCount={(requests || []).filter((r) => r.status === "pending").length} />} />
        <Route path="offers/:companyId/edit" element={<PartnerOfferPage mode="edit" pendingCount={(requests || []).filter((r) => r.status === "pending").length} />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>

      <AnimatePresence>
        {toast && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2.5 rounded-2xl border border-[var(--color-ink-line)] bg-[var(--elev)]/95 px-4 py-3 shadow-2xl backdrop-blur-xl"
          >
            <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--color-lime)] text-[#0a0a0a]">
              <Check size={16} strokeWidth={3} />
            </span>
            <span className="text-[14px] font-semibold text-[var(--text)]">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardShell>
  );
}

function PartnerHome({ requests, overview, error }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { user, profile } = useAuth();
  const companyName = profile?.company_name || user?.user_metadata?.company_name || user?.user_metadata?.full_name || t("dashboard.company.company");
  const loading = requests == null || overview == null;
  const success = overview?.votes > 0 ? Math.round((100 * overview.votes_up) / overview.votes) : null;

  const pendingEdits = useMemo(() => new Set((requests || []).filter((r) => r.status === "pending" && r.request_type === "edit").map((r) => r.company_id)), [requests]);
  // الطلبات الظاهرة في "طلباتي": كل شيء ما عدا الطلبات المقبولة (العرض المنشور يظهر في قائمته)
  const openRequests = (requests || []).filter((r) => r.status !== "accepted");

  const kpis = [
    { key: "offers", icon: Store, value: overview?.offers, color: "#a6f000" },
    { key: "copies", icon: Copy, value: overview?.copies, color: "#38bdf8" },
    { key: "success", icon: ThumbsUp, value: success == null ? null : `${success}%`, color: "#a6f000", note: overview ? t("partnerDash.votesNote", { count: overview.votes }) : null },
    { key: "favorites", icon: Heart, value: overview?.favorites, color: "#f87171" },
  ];

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[24px] font-black tracking-tight sm:text-[30px]" dir="auto">
            {t("partnerDash.hello", { name: companyName })}
          </h1>
          <p className="mt-1 text-[14px] text-[var(--text-soft)]">{t("partnerDash.sub")}</p>
        </div>
        <Link to="/dashboard/offers/new" className="inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-[15px] font-extrabold text-[#0a0a0a] transition-transform hover:scale-[1.02]" style={{ background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" }}>
          <Plus size={18} /> {t("partnerDash.newOffer")}
        </Link>
      </div>

      {error && <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/[0.08] px-4 py-3 text-[13px] font-semibold text-red-300">{t("partnerDash.loadError")}</p>}

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.key} className="rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] p-4 sm:p-5">
            <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: `${k.color}1a`, color: k.color }}>
              <k.icon size={18} />
            </span>
            <dd className="mt-4 text-[28px] font-black leading-none tabular-nums text-[var(--text)]">
              {loading ? <span className="inline-block h-7 w-12 animate-pulse rounded-md bg-[var(--fill)]" /> : k.value == null ? "—" : typeof k.value === "string" ? k.value : formatNumber(k.value, lang)}
            </dd>
            <dt className="mt-1.5 text-[13px] font-bold text-[var(--text-soft)]">{t(`partnerDash.kpi.${k.key}`)}</dt>
            {k.note && <p className="mt-1 text-[12px] text-[var(--color-mute)]">{k.note}</p>}
          </div>
        ))}
      </dl>

      <CopiesChart series={overview?.series} total={overview?.copies_30d} loading={loading} />

      {/* عروضي المنشورة */}
      <section className="mt-8">
        <h2 className="mb-3 text-[19px] font-extrabold text-[var(--text)]">{t("partnerDash.published")}</h2>
        {loading ? (
          <div className="h-24 animate-pulse rounded-[var(--radius-card)] bg-[var(--color-ink-card)]" />
        ) : !overview.items?.length ? (
          <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-ink-line)] px-6 py-10 text-center">
            <Store size={26} className="mx-auto text-[var(--color-mute)]" />
            <p className="mt-3 text-[15px] font-extrabold text-[var(--text)]">{t("partnerDash.noPublished")}</p>
            <p className="mx-auto mt-1 max-w-md text-[13.5px] text-[var(--text-soft)]">{t("partnerDash.noPublishedDesc")}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Link to="/dashboard/offers/new" className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[14px] font-extrabold text-[#0a0a0a]" style={{ background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" }}>
                <Plus size={16} /> {t("partnerDash.newOffer")}
              </Link>
              <Link to={partnersPath(lang)} className="rounded-xl border border-[var(--color-ink-line)] px-4 py-2.5 text-[14px] font-bold text-[var(--text)]">
                {t("partnerDash.howItWorks")}
              </Link>
            </div>
          </div>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {overview.items.map((o) => (
              <PublishedOffer key={o.id} offer={o} editPending={pendingEdits.has(o.id)} />
            ))}
          </ul>
        )}
      </section>

      {/* طلباتي (قيد المراجعة / مرفوضة) */}
      <section className="mt-8">
        <h2 className="mb-3 text-[19px] font-extrabold text-[var(--text)]">{t("partnerDash.requests")}</h2>
        {loading ? (
          <div className="h-20 animate-pulse rounded-[var(--radius-card)] bg-[var(--color-ink-card)]" />
        ) : openRequests.length === 0 ? (
          <p className="flex items-center gap-2 rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] px-5 py-4 text-[14px] text-[var(--text-soft)]">
            <Inbox size={17} className="text-[var(--color-mute)]" /> {t("partnerDash.noRequests")}
          </p>
        ) : (
          <ul className="divide-y divide-[var(--color-ink-line)] rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)]">
            {openRequests.map((r) => (
              <RequestRow key={r.id} r={r} />
            ))}
          </ul>
        )}
      </section>

      {/* الإعدادات (نفس لوحة الزبون): الاسم، كلمة المرور، اللغة، الخروج، حذف الحساب — ما كانتش في حساب الشركة */}
      <div className="mt-8">
        <SettingsPanel />
      </div>
    </>
  );
}

function PublishedOffer({ offer, editPending }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const meta = getTypeMeta(offer.type);
  const success = offer.votes > 0 ? Math.round((100 * offer.votes_up) / offer.votes) : null;
  const cells = [
    { icon: Copy, label: t("partnerDash.kpi.copies"), value: formatNumber(offer.copies, lang) },
    { icon: MousePointerClick, label: t("partnerDash.clicks"), value: formatNumber(offer.clicks || 0, lang) },
    { icon: ThumbsUp, label: t("partnerDash.kpi.success"), value: success == null ? "—" : `${success}%` },
    { icon: Heart, label: t("partnerDash.kpi.favorites"), value: formatNumber(offer.favorites, lang) },
  ];
  return (
    <li className="rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <CompanyLogo logo={offer.logo} name={offer.name} size={46} accent={meta.color} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[15.5px] font-extrabold text-[var(--text)]">{offer.name}</span>
            <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-extrabold" style={{ background: "#a6f0001a", color: "#a6f000" }}>
              {t("partnerDash.status.accepted")}
            </span>
          </div>
          <div className="mt-0.5 text-[13px] font-bold" style={{ color: meta.color }}>
            {offer.discount}
          </div>
        </div>
        {offer.slug && (
          <Link to={storePath(offer.slug, lang)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[var(--color-ink-line)] text-[var(--text-softer)] hover:text-[var(--text)]" aria-label={t("partnerDash.viewOnSite")} title={t("partnerDash.viewOnSite")}>
            <ExternalLink size={15} />
          </Link>
        )}
      </div>
      <dl className="mt-4 grid grid-cols-4 gap-2 border-t border-dashed border-[var(--color-ink-line)] pt-4 text-center">
        {cells.map((c) => (
          <div key={c.label}>
            <dd className="text-[17px] font-black tabular-nums text-[var(--text)]">{c.value}</dd>
            <dt className="mt-0.5 flex items-center justify-center gap-1 text-[11.5px] text-[var(--color-mute)]">
              <c.icon size={11} /> {c.label}
            </dt>
          </div>
        ))}
      </dl>
      <div className="mt-4">
        {editPending ? (
          <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-[#fbbf24]">
            <Clock size={14} /> {t("partnerDash.editPending")}
          </p>
        ) : (
          <Link to={`/dashboard/offers/${offer.id}/edit`} className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-ink-line)] px-3.5 py-2 text-[13px] font-bold text-[var(--text)] transition-colors hover:bg-[var(--fill)]">
            <PencilLine size={14} /> {t("partnerDash.requestEdit")}
          </Link>
        )}
      </div>
    </li>
  );
}

function RequestRow({ r }) {
  const { t, i18n } = useTranslation();
  const st = STATUS[r.status] || STATUS.pending;
  const meta = getTypeMeta(r.type);
  return (
    <li className="flex flex-wrap items-start gap-3 p-4">
      <CompanyLogo logo={r.logo} name={r.company_name || r.title} size={40} accent={meta.color} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-extrabold text-[var(--text)]">{r.company_name || r.title}</span>
          {r.request_type === "edit" && <span className="rounded-full border border-[var(--color-ink-line)] px-2 py-0.5 text-[11px] font-bold text-[var(--color-mute)]">{t("partnerDash.editRequest")}</span>}
        </div>
        <div className="mt-0.5 text-[12.5px] text-[var(--color-mute)]">
          {r.discount || r.title} <span className="mx-1.5 inline-block h-3 w-px translate-y-0.5 bg-[var(--color-ink-line)]" aria-hidden /> {new Date(r.created_at).toLocaleDateString(i18n.language)}
        </div>
        {r.status === "rejected" && r.rejection_reason && (
          <p className="mt-2 rounded-lg border border-red-500/25 bg-red-500/[0.06] px-3 py-2 text-[13px] leading-relaxed text-red-200">
            <b className="font-extrabold">{t("partnerDash.reason")}</b> {r.rejection_reason}
          </p>
        )}
      </div>
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-extrabold" style={{ background: `${st.color}1a`, color: st.color }}>
        <st.icon size={13} /> {t(`partnerDash.status.${r.status in STATUS ? r.status : "pending"}`)}
      </span>
    </li>
  );
}

/** منحنى النسخ اليومي (30 يوماً) — بيانات partner_overview. */
function CopiesChart({ series, total, loading }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [hover, setHover] = useState(null);
  const pts = series || [];
  const W = 600;
  const H = 150;
  const P = { t: 10, r: 6, b: 22, l: 6 };
  const vals = pts.map((p) => Number(p.copies) || 0);
  const max = Math.max(1, ...vals);
  const x = (i) => P.l + (pts.length <= 1 ? (W - P.l - P.r) / 2 : (i * (W - P.l - P.r)) / (pts.length - 1));
  const y = (v) => P.t + (H - P.t - P.b) * (1 - v / max);
  const line = pts.length ? `M${vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" L")}` : "";
  const area = pts.length ? `${line} L${x(vals.length - 1)},${H - P.b} L${x(0)},${H - P.b} Z` : "";
  const day = (s) => new Date(`${s}T00:00:00`).toLocaleDateString(lang, { day: "numeric", month: "short" });

  return (
    <section className="mt-5 rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] p-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[15.5px] font-extrabold text-[var(--text)]">
          <TrendingUp size={16} className="text-[#38bdf8]" /> {t("partnerDash.chart")}
        </h2>
        {!loading && <span className="text-[12.5px] text-[var(--color-mute)]">{t("partnerDash.chartTotal", { value: formatNumber(total || 0, lang) })}</span>}
      </div>
      {loading ? (
        <div className="h-[150px] animate-pulse rounded-xl bg-[var(--fill)]" />
      ) : (
        <div className="relative" dir="ltr">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="h-[150px] w-full touch-pan-y"
            role="img"
            aria-label={`${t("partnerDash.chart")}: ${total || 0}`}
            onPointerMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const px = ((e.clientX - r.left) / r.width) * W;
              let best = 0;
              for (let i = 1; i < pts.length; i++) if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
              setHover(best);
            }}
            onPointerLeave={() => setHover(null)}
          >
            <defs>
              <linearGradient id="pd-g" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#38bdf8" stopOpacity="0.3" />
                <stop offset="1" stopColor="#38bdf8" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={area} fill="url(#pd-g)" />
            <path d={line} fill="none" stroke="#38bdf8" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            {hover != null && <circle cx={x(hover)} cy={y(vals[hover])} r="4" fill="#0a0a0a" stroke="#38bdf8" strokeWidth="2" vectorEffect="non-scaling-stroke" />}
          </svg>
          {pts.length > 0 && (
            <div className="relative h-4 text-[11px] text-[var(--color-mute)]">
              <span className="absolute left-0">{day(pts[0].t)}</span>
              <span className="absolute right-0">{day(pts[pts.length - 1].t)}</span>
            </div>
          )}
          {hover != null && (
            <div className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-lg border border-[var(--color-ink-line)] bg-[var(--elev)] px-2.5 py-1 text-center text-[12px]" style={{ left: `${Math.min(88, Math.max(12, (x(hover) / W) * 100))}%` }}>
              <b className="font-black tabular-nums text-[var(--text)]">{formatNumber(vals[hover], lang)}</b>
              <div className="text-[11px] text-[var(--color-mute)]">{day(pts[hover].t)}</div>
            </div>
          )}
          {!vals.some(Boolean) && <p className="absolute inset-x-0 top-[56px] text-center text-[13px] text-[var(--color-mute)]">{t("partnerDash.chartEmpty")}</p>}
        </div>
      )}
    </section>
  );
}
