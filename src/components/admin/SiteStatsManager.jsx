import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Save, Wallet, KeyRound, Handshake, Crown, RotateCcw, Users, Megaphone } from "lucide-react";
import {
  fetchSiteStatsAdmin,
  updateSiteStats,
  premiumMultiplier,
  SITE_STAT_FIELDS,
} from "../../lib/siteStats.js";
import { usePricing } from "../../lib/pricing.jsx";

// الخانات: auto = مفتاح قيمة العدّ التلقائي في الـ view (إن وُجد)
const FIELDS = [
  { key: "total_savings_dzd", icon: Wallet, color: "#a6f000", step: "1", auto: null },
  { key: "total_codes", icon: KeyRound, color: "#38bdf8", step: "1", auto: "total_codes_auto" },
  { key: "partners_count", icon: Handshake, color: "#fbbf24", step: "1", auto: "partners_count_auto" },
  { key: "premium_unlock_value_usd", icon: Crown, color: "#f0c63c", step: "0.01", auto: null },
  { key: "users_count", icon: Users, color: "#a6f000", step: "1", auto: "users_count_auto" },
  { key: "audience_followers", icon: Megaphone, color: "#38bdf8", step: "1", auto: null },
];

const toInput = (v) => (v === null || v === undefined ? "" : String(v));

/**
 * تبويب "أرقام الصفحة الرئيسية" في لوحة الأدمن.
 * لوحة /admin عربية ثابتة: النصوص من ملفات الترجمة لكن بنسخة العربية دائماً (getFixedT).
 */
export default function SiteStatsManager({ notify }) {
  const { i18n } = useTranslation();
  const t = useMemo(() => i18n.getFixedT("ar"), [i18n]);
  const [form, setForm] = useState(() => Object.fromEntries(SITE_STAT_FIELDS.map((k) => [k, ""])));
  const [auto, setAuto] = useState({});
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetchSiteStatsAdmin()
      .then(({ values, auto: a }) => {
        if (!active) return;
        setForm(Object.fromEntries(SITE_STAT_FIELDS.map((k) => [k, toInput(values[k])])));
        setAuto(a);
        setUpdatedAt(values.updated_at || null);
      })
      .catch(() => active && setError(t("admin.siteStats.loadError")))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [t]);

  const price = usePricing()?.usd ?? null;
  const multiplier = premiumMultiplier(Number(form.premium_unlock_value_usd) || 0, price);

  const save = async (e) => {
    e.preventDefault();
    setError("");
    for (const f of FIELDS) {
      const v = form[f.key];
      if (v !== "" && !(Number(v) >= 0)) {
        setError(t("admin.siteStats.invalid"));
        return;
      }
    }
    setSaving(true);
    try {
      const row = await updateSiteStats(form);
      setUpdatedAt(row.updated_at || null);
      notify?.("success", t("admin.siteStats.saved"));
    } catch (err) {
      const msg = err.message === "not-allowed" ? t("admin.siteStats.notAllowed") : err.message;
      setError(msg);
      notify?.("error", msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-[var(--color-mute)]">
        <Loader2 size={18} className="animate-spin" /> {t("admin.siteStats.loading")}
      </div>
    );
  }

  return (
    <form onSubmit={save} className="rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] p-5">
      <div className="mb-5">
        <h2 className="text-[17px] font-extrabold text-white">{t("admin.siteStats.title")}</h2>
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-[var(--color-mute)]">{t("admin.siteStats.desc")}</p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/[0.08] px-3 py-2 text-[12.5px] font-semibold text-red-400">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => {
          const autoVal = f.auto ? auto[f.auto] : null;
          const empty = form[f.key] === "";
          return (
            <label key={f.key} className="flex flex-col gap-2 rounded-2xl border border-[var(--color-ink-line)] bg-[#0c0c0e] p-4">
              <span className="flex items-center gap-2 text-[13.5px] font-extrabold text-white">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: `${f.color}1a`, color: f.color }}>
                  <f.icon size={16} />
                </span>
                {t(`admin.siteStats.fields.${f.key}.label`)}
              </span>
              <div className="flex items-stretch gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step={f.step}
                  dir="ltr"
                  value={form[f.key]}
                  onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={autoVal != null ? String(autoVal) : "—"}
                  className="w-full rounded-xl border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] px-3.5 py-2.5 text-left text-[15px] font-bold text-white outline-none focus:border-[var(--color-lime)]"
                />
                {!empty && (
                  <button
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, [f.key]: "" }))}
                    title={t("admin.siteStats.clear")}
                    aria-label={t("admin.siteStats.clear")}
                    className="grid w-11 shrink-0 place-items-center rounded-xl border border-[var(--color-ink-line)] text-[var(--color-mute)] transition-colors hover:text-white"
                  >
                    <RotateCcw size={15} />
                  </button>
                )}
              </div>
              <span className="text-[12px] leading-relaxed text-[var(--color-mute)]">
                {f.auto
                  ? t("admin.siteStats.autoHint", { value: autoVal ?? "—" })
                  : t(`admin.siteStats.fields.${f.key}.hint`)}
              </span>
              {f.key === "premium_unlock_value_usd" && (
                <span className="text-[12px] font-bold text-[#f0c63c]">
                  {multiplier
                    ? t("admin.siteStats.multiplierPreview", { x: multiplier, price })
                    : t("admin.siteStats.multiplierHidden")}
                </span>
              )}
            </label>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <span className="text-[12px] text-[var(--color-mute)]">
          {updatedAt
            ? t("admin.siteStats.updatedAt", {
                date: new Intl.DateTimeFormat("ar", { dateStyle: "medium", timeStyle: "short" }).format(new Date(updatedAt)),
              })
            : null}
        </span>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-[14px] font-extrabold text-[#0a0a0a] transition-transform hover:scale-[1.02] disabled:opacity-60"
          style={{ background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" }}
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {t("admin.siteStats.save")}
        </button>
      </div>
    </form>
  );
}
