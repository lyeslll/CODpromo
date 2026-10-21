import { useCallback, useEffect, useMemo, useState } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { GripVertical, ChevronUp, ChevronDown, Trash2, Plus, Search, Sparkles, Loader2, RotateCcw, AlertCircle, Eye } from "lucide-react";
import CompanyLogo from "../../CompanyLogo.jsx";
import FeaturedShowcase from "../../featured/FeaturedShowcase.jsx";
import { getTypeMeta } from "../../../lib/types.js";
import { fetchAllFeatured, fetchFeaturedStats, saveFeatured, isLive } from "../../../lib/featured.js";
import { useAdminT, Glass, PageHeader, Segmented, Skeleton, EmptyState, fmt, inputCls, LIME_BG } from "./ui.jsx";

// datetime-local ⇄ ISO (التوقيت المحلي للأدمن)
const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);

const rowStatus = (r, now = Date.now()) => {
  if (!r.is_active) return "off";
  if (r.starts_at && new Date(r.starts_at).getTime() > now) return "scheduled";
  if (r.ends_at && new Date(r.ends_at).getTime() <= now) return "expired";
  return "live";
};
const STATUS_STYLE = {
  live: { color: "#a6f000", bg: "rgba(166,240,0,0.12)" },
  scheduled: { color: "#38bdf8", bg: "rgba(56,189,248,0.12)" },
  expired: { color: "#a1a1aa", bg: "rgba(255,255,255,0.06)" },
  off: { color: "#6b7280", bg: "rgba(255,255,255,0.04)" },
};
const datesInvalid = (r) => r.ends_at && r.starts_at && new Date(r.ends_at) <= new Date(r.starts_at);

let keySeq = 0;
const withKey = (r) => ({ ...r, key: r.id ? `id-${r.id}` : `new-${++keySeq}` });

/**
 * /admin/featured — العروض المميّزة: إضافة شركة بالبحث، الترتيب بالسحب (أو بالسهمين)،
 * الوسم (مميّز / مُموَّل)، البداية والنهاية، التشغيل والإيقاف، ومعاينة حيّة لقسم الرئيسية.
 * نسخ كل عرض من القسم المميّز في 7 و30 يوماً عبر RPC admin_featured_stats (عدّ دقيق).
 */
export default function FeaturedPage({ companies, loading: loadingCompanies, notify }) {
  const t = useAdminT();
  const [rows, setRows] = useState([]);
  const [removed, setRemoved] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [stats, setStats] = useState(null);
  const [query, setQuery] = useState("");
  const [previewMode, setPreviewMode] = useState("normal");

  const byId = useMemo(() => new Map(companies.map((c) => [c.id, c])), [companies]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const data = await fetchAllFeatured();
      setRows(data.map(withKey));
      setRemoved([]);
      setDirty(false);
    } catch {
      setLoadError(t("featured.loadError"));
    } finally {
      setLoading(false);
    }
    fetchFeaturedStats()
      .then(setStats)
      .catch(() => setStats(new Map()));
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const edit = (key, patch) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    setDirty(true);
  };
  const move = (index, dir) => {
    setRows((prev) => {
      const j = index + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = prev.slice();
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
    setDirty(true);
  };
  const remove = (row) => {
    setRows((prev) => prev.filter((r) => r.key !== row.key));
    if (row.id) setRemoved((prev) => [...prev, row.id]);
    setDirty(true);
  };
  const add = (company) => {
    setRows((prev) => [
      ...prev,
      withKey({ company_id: company.id, label: "featured", starts_at: new Date().toISOString(), ends_at: null, is_active: true }),
    ]);
    setQuery("");
    setDirty(true);
  };
  const onReorder = (keys) => {
    setRows((prev) => {
      const map = new Map(prev.map((r) => [r.key, r]));
      return keys.map((k) => map.get(k)).filter(Boolean);
    });
    setDirty(true);
  };

  const invalid = rows.some(datesInvalid);
  const save = async () => {
    if (invalid || saving) return;
    setSaving(true);
    try {
      await saveFeatured(rows, removed);
      notify("success", t("featured.saved"));
      await load();
    } catch (e) {
      notify("error", e.message || t("featured.loadError"));
    } finally {
      setSaving(false);
    }
  };

  // البحث للإضافة: الشركات غير المضافة بعد
  const listed = useMemo(() => new Set(rows.map((r) => r.company_id)), [rows]);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return companies.filter((c) => !listed.has(c.id) && (c.name || "").toLowerCase().includes(q)).slice(0, 6);
  }, [query, companies, listed]);

  // المعاينة = ما يظهر الآن في الرئيسية بالترتيب الحالي (حتى قبل الحفظ)
  const previewItems = useMemo(
    () =>
      rows
        .filter((r) => isLive(r))
        .map((r) => ({ company: byId.get(r.company_id), label: r.label }))
        .filter((x) => x.company),
    [rows, byId]
  );

  return (
    <>
      <PageHeader
        title={t("nav.featured")}
        sub={t("featured.sub")}
        actions={
          <>
            {dirty && (
              <button
                type="button"
                onClick={load}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] px-3.5 py-2.5 text-[13px] font-bold text-[#a1a1aa] transition-colors hover:text-white disabled:opacity-50"
              >
                <RotateCcw size={15} /> {t("featured.discard")}
              </button>
            )}
            <button
              type="button"
              onClick={save}
              disabled={!dirty || invalid || saving}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13.5px] font-extrabold text-[#0a0a0a] transition-opacity disabled:opacity-40"
              style={LIME_BG}
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {saving ? t("featured.saving") : t("featured.save")}
            </button>
          </>
        }
      />

      {loadError && (
        <p role="alert" className="mb-5 flex items-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/[0.08] px-4 py-3 text-[13.5px] font-semibold text-red-300">
          <AlertCircle size={17} /> {loadError}
        </p>
      )}

      {/* إضافة عرض */}
      <Glass className="mb-5 p-4">
        <label htmlFor="featured-search" className="mb-2 block text-[13px] font-extrabold text-white">
          {t("featured.add")}
        </label>
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-[#6b7280]" />
          <input
            id="featured-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("featured.searchPh")}
            className={`${inputCls} ps-10`}
            autoComplete="off"
          />
        </div>
        {query.trim() && (
          <ul className="mt-2 space-y-1">
            {results.length ? (
              results.map((c) => {
                const meta = getTypeMeta(c.type);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => add(c)}
                      className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-start transition-colors hover:bg-white/[0.05]"
                    >
                      <CompanyLogo logo={c.logo} name={c.name} size={34} accent={meta.color} />
                      <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-white">{c.name}</span>
                      <span className="text-[12px] font-bold" style={{ color: meta.color }}>
                        {c.discount}
                      </span>
                      <Plus size={16} className="shrink-0 text-[var(--color-lime)]" />
                    </button>
                  </li>
                );
              })
            ) : (
              <li className="px-2.5 py-2 text-[13px] text-[var(--color-mute)]">{t("featured.noResults")}</li>
            )}
          </ul>
        )}
      </Glass>

      {/* القائمة المرتّبة */}
      <Glass className="mb-6 p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-[16px] font-extrabold text-white">{t("featured.listTitle")}</h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--color-mute)]">{t("featured.listHint")}</p>
          </div>
          {dirty && <span className="rounded-full bg-[#fbbf24]/15 px-2.5 py-1 text-[11.5px] font-bold text-[#fbbf24]">{t("featured.unsaved")}</span>}
        </div>

        {loading || loadingCompanies ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[118px] rounded-2xl" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon={Sparkles} title={t("featured.emptyTitle")} desc={t("featured.empty")} />
        ) : (
          <Reorder.Group axis="y" values={rows.map((r) => r.key)} onReorder={onReorder} className="space-y-3">
            {rows.map((r, i) => (
              <FeaturedRowItem
                key={r.key}
                row={r}
                index={i}
                count={rows.length}
                company={byId.get(r.company_id)}
                stat={stats?.get(r.company_id)}
                statsLoading={!stats}
                onEdit={(patch) => edit(r.key, patch)}
                onMove={(dir) => move(i, dir)}
                onRemove={() => remove(r)}
              />
            ))}
          </Reorder.Group>
        )}
        <p className="mt-4 text-[12px] leading-relaxed text-[var(--color-mute)]">{t("featured.statsNote")}</p>
      </Glass>

      {/* المعاينة الحية */}
      <Glass className="p-4 sm:p-5">
        <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-[16px] font-extrabold text-white">
              <Eye size={17} className="text-[var(--color-lime)]" /> {t("featured.preview")}
            </h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--color-mute)]">{t("featured.previewSub")}</p>
          </div>
          <Segmented
            size="sm"
            value={previewMode}
            onChange={setPreviewMode}
            label={t("featured.preview")}
            options={[
              { value: "normal", label: t("featured.modeNormal") },
              { value: "premium", label: t("featured.modePremium"), color: "#f0c63c" },
            ]}
          />
        </div>
        {previewItems.length ? (
          <FeaturedShowcase items={previewItems} premiumMode={previewMode === "premium"} preview />
        ) : (
          <EmptyState icon={Eye} title={t("featured.previewEmpty")} />
        )}
      </Glass>
    </>
  );
}

function FeaturedRowItem({ row, index, count, company, stat, statsLoading, onEdit, onMove, onRemove }) {
  const t = useAdminT();
  const controls = useDragControls();
  const meta = getTypeMeta(company?.type);
  const status = rowStatus(row);
  const st = STATUS_STYLE[status];
  const bad = datesInvalid(row);

  return (
    <Reorder.Item
      value={row.key}
      dragListener={false}
      dragControls={controls}
      className="relative rounded-2xl border border-white/[0.07] bg-[#0f0f12] p-3.5 sm:p-4"
      whileDrag={{ scale: 1.01, boxShadow: "0 20px 40px -20px rgba(0,0,0,0.9)" }}
    >
      {/* الرأس: المقبض، الترتيب، الشعار، الاسم والحالة، وأزرار الترتيب والحذف */}
      <div className="flex items-start gap-2.5 sm:gap-3">
        <button
          type="button"
          onPointerDown={(e) => controls.start(e)}
          aria-label={t("featured.drag")}
          title={t("featured.drag")}
          className="mt-1.5 grid h-8 w-6 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-[#6b7280] hover:text-white active:cursor-grabbing"
        >
          <GripVertical size={18} />
        </button>
        <span className="mt-2.5 w-4 shrink-0 text-center text-[13px] font-black tabular-nums text-[#6b7280]">{index + 1}</span>
        <CompanyLogo logo={company?.logo} name={company?.name} size={44} accent={meta.color} />
        <div className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-extrabold text-white">{company?.name || `#${row.company_id}`}</span>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ color: meta.color, background: `${meta.color}1a` }}>
              {company?.discount || "—"}
            </span>
            <span className="whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ color: st.color, background: st.bg }}>
              {t(`featured.status.${status}`)}
            </span>
          </div>
        </div>
      </div>

      {/* الحقول بعرض البطاقة كاملاً (عمود واحد في الهاتف، صف واحد في الشاشات الكبيرة) */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto] xl:items-end">
        <div>
          <span className="mb-1 block text-[11.5px] font-bold text-[#a1a1aa]">{t("featured.label")}</span>
          <Segmented
            size="sm"
            value={row.label}
            onChange={(v) => onEdit({ label: v })}
            label={t("featured.label")}
            options={[
              { value: "featured", label: t("featured.labelFeatured") },
              { value: "sponsored", label: t("featured.labelSponsored") },
            ]}
          />
        </div>
        <label className="block min-w-0">
          <span className="mb-1 block text-[11.5px] font-bold text-[#a1a1aa]">{t("featured.startsAt")}</span>
          <input
            type="datetime-local"
            value={toLocalInput(row.starts_at)}
            onChange={(e) => onEdit({ starts_at: fromLocalInput(e.target.value) || new Date().toISOString() })}
            className={`${inputCls} min-w-0 py-2 text-[13px] [color-scheme:dark]`}
          />
        </label>
        <label className="block min-w-0">
          <span className="mb-1 block text-[11.5px] font-bold text-[#a1a1aa]">{t("featured.endsAt")}</span>
          <input
            type="datetime-local"
            value={toLocalInput(row.ends_at)}
            onChange={(e) => onEdit({ ends_at: fromLocalInput(e.target.value) })}
            aria-invalid={bad || undefined}
            className={`${inputCls} min-w-0 py-2 text-[13px] [color-scheme:dark] ${bad ? "border-red-500/60" : ""}`}
          />
        </label>
        <label className="flex cursor-pointer items-center gap-2.5 pb-1.5">
          <input type="checkbox" className="peer sr-only" checked={!!row.is_active} onChange={(e) => onEdit({ is_active: e.target.checked })} />
          <span className="relative h-6 w-11 shrink-0 rounded-full bg-white/[0.12] transition-colors after:absolute after:start-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-[var(--color-lime)] peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-lime)]/60 rtl:peer-checked:after:-translate-x-5" />
          <span className="text-[13px] font-bold text-white">{t("featured.active")}</span>
        </label>
      </div>
      {bad && (
        <p className="mt-2 flex items-center gap-1.5 text-[12.5px] font-semibold text-red-300">
          <AlertCircle size={14} /> {t("featured.datesError")}
        </p>
      )}

      {/* الإحصائيات + الترتيب بالسهمين (بديل السحب بلوحة المفاتيح) + الحذف */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatPill label={t("featured.copies7")} value={stat?.d7} loading={statsLoading} unsaved={!row.id} />
          <StatPill label={t("featured.copies30")} value={stat?.d30} loading={statsLoading} unsaved={!row.id} />
        </div>
        <div className="flex items-center gap-1">
          <IconBtn label={t("featured.moveUp")} onClick={() => onMove(-1)} disabled={index === 0}>
            <ChevronUp size={16} />
          </IconBtn>
          <IconBtn label={t("featured.moveDown")} onClick={() => onMove(1)} disabled={index === count - 1}>
            <ChevronDown size={16} />
          </IconBtn>
          <IconBtn label={t("featured.remove")} onClick={onRemove} danger>
            <Trash2 size={15} />
          </IconBtn>
        </div>
      </div>
    </Reorder.Item>
  );
}

function StatPill({ label, value, loading, unsaved }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-2.5 py-1.5">
      <span className="text-[11.5px] font-bold text-[#a1a1aa]">{label}</span>
      {loading ? (
        <Skeleton className="h-3.5 w-6" />
      ) : (
        <span className="text-[13px] font-black tabular-nums text-white [font-family:Inter,sans-serif]">{unsaved ? "—" : fmt(value ?? 0)}</span>
      )}
    </span>
  );
}

function IconBtn({ label, onClick, disabled, danger, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`grid h-8 w-8 place-items-center rounded-lg border border-white/[0.07] text-[#a1a1aa] transition-colors disabled:opacity-30 ${
        danger ? "hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400" : "hover:bg-white/[0.06] hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}
