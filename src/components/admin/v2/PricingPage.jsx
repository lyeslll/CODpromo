import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, RefreshCw, Save, Tag, Armchair, CalendarClock, Sparkles } from "lucide-react";
import { fetchAdminPricing, saveAdminPricing } from "../../../lib/sales.js";
import { usePricingRefresh } from "../../../lib/pricing.jsx";
import LifetimePrice from "../../pricing/LifetimePrice.jsx";
import SeatsMeter from "../../pricing/SeatsMeter.jsx";
import TestPriceCard from "./TestPriceCard.jsx";
import { useAdminT, Glass, PageHeader, Skeleton, EmptyState, fmt, fmtDate, inputCls, GOLD_BG } from "./ui.jsx";

const GOLD = "#f0c63c";
const FIELDS = [
  { key: "launch_price_dzd", step: "1", min: 1 },
  { key: "launch_price_usd", step: "0.01", min: 0.01 },
  { key: "regular_price_dzd", step: "1", min: 1 },
  { key: "regular_price_usd", step: "0.01", min: 0.01 },
  { key: "launch_seats", step: "1", min: 0 },
];

/**
 * /admin/pricing — سعر الدفعة الوحدة (pricing_settings، سطر واحد): سعر الإطلاق والسعر العادي (دج / $)
 * وعدد مقاعد الإطلاق. المقاعد المباعة = مشتريات launch غير مستردّة. كي يكمّلو، السعر يطلع وحدو للعادي.
 * القراءة والتعديل عبر admin_pricing / admin_update_pricing (أدمن برك). معاينة حيّة كيما في الموقع.
 */
export default function PricingPage({ notify }) {
  const t = useAdminT();
  const refreshPublic = usePricingRefresh();
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [tick, setTick] = useState(0);

  const fill = (d) => {
    setData(d);
    setForm(Object.fromEntries(FIELDS.map((f) => [f.key, d?.[f.key] ?? ""])));
  };

  const load = useCallback(async () => {
    setError("");
    setData(null);
    try {
      fill(await fetchAdminPricing());
    } catch (e) {
      setError(e.message || t("common.loadFailed"));
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load, tick]);

  const invalid = form ? FIELDS.some((f) => form[f.key] === "" || !(Number(form[f.key]) >= f.min)) : true;
  const dirty = form && data ? FIELDS.some((f) => Number(form[f.key]) !== Number(data[f.key])) : false;

  const save = async (e) => {
    e.preventDefault();
    if (invalid || saving) return;
    setSaving(true);
    try {
      fill(await saveAdminPricing(form));
      refreshPublic();
      notify("success", t("pricing.saved"));
    } catch (err) {
      notify("error", err.message);
    } finally {
      setSaving(false);
    }
  };

  // المعاينة: نفس العرض في الموقع، بالقيم اللي راك تكتب فيها
  const preview = useMemo(() => {
    if (!form || !data) return null;
    const seats = Math.max(0, Math.round(Number(form.launch_seats) || 0));
    const sold = Number(data.seats_sold) || 0;
    const isLaunch = sold < seats;
    const n = (k) => Number(form[k]) || null;
    return {
      tier: isLaunch ? "launch" : "regular",
      isLaunch,
      usd: isLaunch ? n("launch_price_usd") : n("regular_price_usd"),
      dzd: isLaunch ? n("launch_price_dzd") : n("regular_price_dzd"),
      launchUsd: n("launch_price_usd"),
      launchDzd: n("launch_price_dzd"),
      regularUsd: n("regular_price_usd"),
      regularDzd: n("regular_price_dzd"),
      seatsTotal: seats,
      seatsLeft: Math.max(seats - sold, 0),
    };
  }, [form, data]);

  if (error) {
    return (
      <>
        <PageHeader title={t("nav.pricing")} sub={t("pages.pricingSub")} />
        <Glass>
          <EmptyState
            icon={AlertCircle}
            title={t("common.loadFailed")}
            desc={error}
            action={
              <button type="button" onClick={() => setTick((x) => x + 1)} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-[13px] font-bold text-white">
                <RefreshCw size={14} /> {t("common.retry")}
              </button>
            }
          />
        </Glass>
      </>
    );
  }

  const kpis = [
    { id: "tier", icon: Sparkles, value: data ? t(`pricing.tier.${data.tier}`) : null },
    { id: "sold", icon: Tag, value: data ? `${fmt(data.seats_sold)} / ${fmt(data.launch_seats)}` : null },
    { id: "left", icon: Armchair, value: data ? fmt(data.seats_left) : null },
    { id: "closed", icon: CalendarClock, value: data ? (data.launch_closed_at ? fmtDate(data.launch_closed_at, true) : t("pricing.stillOpen")) : null },
  ];

  return (
    <>
      <PageHeader title={t("nav.pricing")} sub={t("pages.pricingSub")} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map((k) => (
          <Glass key={k.id} glow={`${GOLD}2e`} className="h-full p-4 sm:p-5">
            <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: `${GOLD}1a`, color: GOLD }}>
              <k.icon size={18} />
            </span>
            {k.value != null ? (
              <div className="mt-4 text-[20px] font-black leading-tight tabular-nums text-white sm:text-[24px]">{k.value}</div>
            ) : (
              <Skeleton className="mt-4 h-7 w-20" />
            )}
            <div className="mt-1.5 text-[13px] font-bold text-[#c9c9cf]">{t(`pricing.kpi.${k.id}`)}</div>
          </Glass>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
        <Glass as="form" onSubmit={save} className="p-5">
          <h2 className="text-[16px] font-extrabold text-white">{t("pricing.formTitle")}</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-mute)]">{t("pricing.formHint")}</p>
          {form ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {FIELDS.map((f) => (
                <label key={f.key} className={f.key === "launch_seats" ? "sm:col-span-2" : ""}>
                  <span className="mb-1.5 block text-[13px] font-bold text-[#c9c9cf]">{t(`pricing.fields.${f.key}`)}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={f.min}
                    step={f.step}
                    dir="ltr"
                    value={form[f.key]}
                    onChange={(e) => setForm((v) => ({ ...v, [f.key]: e.target.value }))}
                    className={`${inputCls} tabular-nums`}
                    required
                  />
                </label>
              ))}
            </div>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {FIELDS.map((f) => (
                <Skeleton key={f.key} className="h-[66px] rounded-xl" />
              ))}
            </div>
          )}
          {invalid && form && <p className="mt-3 text-[12.5px] font-semibold text-[#f87171]">{t("pricing.invalid")}</p>}
          <ul className="mt-4 space-y-1.5 text-[12px] leading-relaxed text-[var(--color-mute)]">
            <li>{t("pricing.noteStripe")}</li>
            <li>{t("pricing.notePlay")}</li>
          </ul>
          <button
            type="submit"
            disabled={!form || invalid || !dirty || saving}
            className="mt-5 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13.5px] font-extrabold text-[#1d1403] disabled:opacity-50"
            style={GOLD_BG}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {t("pricing.save")}
          </button>
          {data?.updated_at && <p className="mt-2 text-[11.5px] text-[#6b7280]">{t("pricing.updatedAt", { date: fmtDate(data.updated_at, true) })}</p>}
        </Glass>

        <Glass className="p-5">
          <h2 className="text-[16px] font-extrabold text-white">{t("pricing.previewTitle")}</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-mute)]">{t("pricing.previewHint")}</p>
          <div className="mt-5 rounded-2xl border border-[#f0c63c]/35 bg-[linear-gradient(160deg,rgba(240,198,60,0.12),rgba(240,198,60,0.02))] p-5">
            {preview ? (
              <>
                <LifetimePrice pricing={preview} size="lg" />
                <SeatsMeter pricing={preview} className="mt-4" />
              </>
            ) : (
              <Skeleton className="h-20 w-2/3" />
            )}
          </div>
        </Glass>
      </div>

      <TestPriceCard notify={notify} />
    </>
  );
}
