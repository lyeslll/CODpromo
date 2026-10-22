import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Reorder, useDragControls } from "framer-motion";
import { GripVertical, ChevronUp, ChevronDown, Trash2, Plus, Gift, Pencil, Loader2, Crown, AlertCircle, Save } from "lucide-react";
import CompanyLogo from "../../CompanyLogo.jsx";
import { fetchAllDeals, fetchDealStats, saveDealOrder, deleteDeal, setDealActive } from "../../../lib/nocode.js";
import { useAdminT, Glass, PageHeader, Skeleton, EmptyState, fmt, LIME_BG } from "./ui.jsx";

const VIOLET = "#b794ff";

const dealStatus = (d, now = Date.now()) => {
  if (!d.is_active) return "off";
  if (d.starts_at && new Date(d.starts_at).getTime() > now) return "scheduled";
  if (d.ends_at && new Date(d.ends_at).getTime() <= now) return "expired";
  return "live";
};
const STATUS_STYLE = {
  live: { color: "#a6f000", bg: "rgba(166,240,0,0.12)" },
  scheduled: { color: "#38bdf8", bg: "rgba(56,189,248,0.12)" },
  expired: { color: "#a1a1aa", bg: "rgba(255,255,255,0.06)" },
  off: { color: "#6b7280", bg: "rgba(255,255,255,0.04)" },
};

/**
 * /admin/nocode — عروض بلا كود: القائمة بالحالة (نشط، مجدول، منتهٍ، موقوف)، الترتيب بالسحب
 * (أو بالسهمين)، تشغيل/إيقاف سريع، والضغطات لكل عرض في 7 و30 يوماً، عادي و Premium
 * (RPC admin_nocode_stats — زائر واحد = ضغطة واحدة في اليوم). الإضافة والتعديل في NocodeEditor.
 */
export default function NocodePage({ notify }) {
  const t = useAdminT();
  const [deals, setDeals] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [orderDirty, setOrderDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    setError("");
    try {
      setDeals(await fetchAllDeals());
      setOrderDirty(false);
    } catch {
      setError(t("nocode.loadError"));
      setDeals([]);
    }
    fetchDealStats()
      .then(setStats)
      .catch(() => setStats(new Map()));
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const keys = useMemo(() => (deals || []).map((d) => String(d.id)), [deals]);
  const onReorder = (next) => {
    const map = new Map((deals || []).map((d) => [String(d.id), d]));
    setDeals(next.map((k) => map.get(k)).filter(Boolean));
    setOrderDirty(true);
  };
  const move = (i, dir) => {
    setDeals((prev) => {
      const j = i + dir;
      if (!prev || j < 0 || j >= prev.length) return prev;
      const next = prev.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setOrderDirty(true);
  };
  const saveOrder = async () => {
    setSaving(true);
    try {
      await saveDealOrder(deals.map((d) => d.id));
      notify("success", t("nocode.orderSaved"));
      setOrderDirty(false);
    } catch (e) {
      notify("error", e.message);
    } finally {
      setSaving(false);
    }
  };
  const toggle = async (d) => {
    setBusy(d.id);
    try {
      await setDealActive(d.id, !d.is_active);
      setDeals((prev) => prev.map((x) => (x.id === d.id ? { ...x, is_active: !d.is_active } : x)));
    } catch (e) {
      notify("error", e.message);
    } finally {
      setBusy(null);
    }
  };
  const remove = async (d) => {
    if (!window.confirm(t("nocode.confirmDelete", { name: d.name }))) return;
    setBusy(d.id);
    try {
      await deleteDeal(d.id);
      setDeals((prev) => prev.filter((x) => x.id !== d.id));
      notify("success", t("nocode.deleted"));
    } catch (e) {
      notify("error", e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader
        title={t("nav.nocode")}
        sub={t("nocode.sub")}
        actions={
          <>
            {orderDirty && (
              <button
                type="button"
                onClick={saveOrder}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl border border-white/[0.1] px-4 py-2.5 text-[13.5px] font-extrabold text-white transition-colors hover:bg-white/[0.05] disabled:opacity-50"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {t("nocode.saveOrder")}
              </button>
            )}
            <Link to="/admin/nocode/new" className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13.5px] font-extrabold text-[#0a0a0a]" style={LIME_BG}>
              <Plus size={16} /> {t("nocode.add")}
            </Link>
          </>
        }
      />

      {error && (
        <p role="alert" className="mb-5 flex items-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/[0.08] px-4 py-3 text-[13.5px] font-semibold text-red-300">
          <AlertCircle size={17} /> {error}
        </p>
      )}

      <Glass className="p-4 sm:p-5">
        <div className="mb-4">
          <h2 className="text-[16px] font-extrabold text-white">{t("nocode.listTitle")}</h2>
          <p className="mt-0.5 text-[12.5px] text-[var(--color-mute)]">{t("nocode.listHint")}</p>
        </div>

        {deals === null ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-[112px] rounded-2xl" />
            ))}
          </div>
        ) : deals.length === 0 ? (
          <EmptyState
            icon={Gift}
            title={t("nocode.emptyTitle")}
            desc={t("nocode.empty")}
            action={
              <Link to="/admin/nocode/new" className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13.5px] font-extrabold text-[#0a0a0a]" style={LIME_BG}>
                <Plus size={16} /> {t("nocode.add")}
              </Link>
            }
          />
        ) : (
          <Reorder.Group axis="y" values={keys} onReorder={onReorder} className="space-y-3">
            {deals.map((d, i) => (
              <DealRow
                key={d.id}
                deal={d}
                index={i}
                count={deals.length}
                stat={stats?.get(d.id)}
                statsLoading={!stats}
                busy={busy === d.id}
                onMove={(dir) => move(i, dir)}
                onToggle={() => toggle(d)}
                onRemove={() => remove(d)}
              />
            ))}
          </Reorder.Group>
        )}
        <p className="mt-4 text-[12px] leading-relaxed text-[var(--color-mute)]">{t("nocode.statsNote")}</p>
      </Glass>
    </>
  );
}

function DealRow({ deal, index, count, stat, statsLoading, busy, onMove, onToggle, onRemove }) {
  const t = useAdminT();
  const controls = useDragControls();
  const status = dealStatus(deal);
  const st = STATUS_STYLE[status];

  return (
    <Reorder.Item
      value={String(deal.id)}
      dragListener={false}
      dragControls={controls}
      className="relative rounded-2xl border border-white/[0.07] bg-[#0f0f12] p-3.5 sm:p-4"
      whileDrag={{ scale: 1.01, boxShadow: "0 20px 40px -20px rgba(0,0,0,0.9)" }}
    >
      <div className="flex items-start gap-2.5 sm:gap-3">
        <button
          type="button"
          onPointerDown={(e) => controls.start(e)}
          aria-label={t("nocode.drag")}
          title={t("nocode.drag")}
          className="mt-1.5 grid h-8 w-6 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-[#6b7280] hover:text-white active:cursor-grabbing"
        >
          <GripVertical size={18} />
        </button>
        <span className="mt-2.5 w-4 shrink-0 text-center text-[13px] font-black tabular-nums text-[#6b7280]">{index + 1}</span>
        <CompanyLogo logo={deal.logo_url} name={deal.name} size={44} accent={VIOLET} />
        <div className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-extrabold text-white">{deal.name}</span>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="max-w-full truncate rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ color: VIOLET, background: "rgba(183,148,255,0.12)" }}>
              {deal.reward}
            </span>
            <span className="whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ color: st.color, background: st.bg }}>
              {t(`featured.status.${status}`)}
            </span>
            {deal.has_premium && (
              <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-[#f0c63c]/[0.12] px-2 py-0.5 text-[11px] font-bold text-[#f0c63c]">
                <Crown size={11} /> Premium
              </span>
            )}
          </div>
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 pt-1.5" title={t("nocode.active")}>
          <input type="checkbox" className="peer sr-only" checked={!!deal.is_active} disabled={busy} onChange={onToggle} aria-label={t("nocode.active")} />
          <span className="relative h-6 w-11 shrink-0 rounded-full bg-white/[0.12] transition-colors after:absolute after:start-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-[var(--color-lime)] peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-lime)]/60 rtl:peer-checked:after:-translate-x-5" />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <ClickPill label={t("nocode.clicks7")} normal={stat?.n7} premium={stat?.p7} loading={statsLoading} />
          <ClickPill label={t("nocode.clicks30")} normal={stat?.n30} premium={stat?.p30} loading={statsLoading} />
        </div>
        <div className="flex items-center gap-1">
          <IconBtn label={t("featured.moveUp")} onClick={() => onMove(-1)} disabled={index === 0}>
            <ChevronUp size={16} />
          </IconBtn>
          <IconBtn label={t("featured.moveDown")} onClick={() => onMove(1)} disabled={index === count - 1}>
            <ChevronDown size={16} />
          </IconBtn>
          <Link
            to={`/admin/nocode/${deal.id}`}
            aria-label={t("nocode.edit")}
            title={t("nocode.edit")}
            className="grid h-8 w-8 place-items-center rounded-lg border border-white/[0.07] text-[#a1a1aa] transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <Pencil size={15} />
          </Link>
          <IconBtn label={t("nocode.delete")} onClick={onRemove} disabled={busy} danger>
            <Trash2 size={15} />
          </IconBtn>
        </div>
      </div>
    </Reorder.Item>
  );
}

function ClickPill({ label, normal, premium, loading }) {
  const t = useAdminT();
  return (
    <span className="inline-flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-2.5 py-1.5">
      <span className="text-[11.5px] font-bold text-[#a1a1aa]">{label}</span>
      {loading ? (
        <Skeleton className="h-3.5 w-10" />
      ) : (
        <>
          <span className="text-[13px] font-black tabular-nums text-white [font-family:Inter,sans-serif]" title={t("nocode.normalClicks")}>
            {fmt(normal ?? 0)}
          </span>
          <span className="inline-flex items-center gap-1 text-[12px] font-black tabular-nums text-[#f0c63c] [font-family:Inter,sans-serif]" title={t("nocode.premiumClicks")}>
            <Crown size={11} /> {fmt(premium ?? 0)}
          </span>
        </>
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
