import { useCallback, useEffect, useState } from "react";
import { Gem, Loader2, Save, Wand2 } from "lucide-react";
import { fetchAdminKeyPacks, saveKeyPack } from "../../../lib/keysAdmin.js";
import { useAdminT, Glass, Skeleton, fmt, fmtDate, inputCls } from "./ui.jsx";

const ICE = "#a9cdff";
const ICE_BG = { background: "linear-gradient(135deg, #f4fbff, #bcdcff 50%, #8fb2ff)", color: "#0b1430" };

/**
 * /admin/pricing — باقات المفاتيح الماسية (key_packs): عدد المفاتيح (2 وفوق، ما كاينش مفتاح وحدو)، السعر بالدينار
 * والدولار، التشغيل. "حسب نسبة Premium" يحسب الدولار بنفس نسبة سعر Premium الحالي، مقرّب لدولار كامل.
 * منتوج Google Play ثابت لكل باقة: سعرو يتبدّل في Play Console.
 */
export default function KeyPacksCard({ notify }) {
  const t = useAdminT();
  const [data, setData] = useState(null);
  const [forms, setForms] = useState({});
  const [saving, setSaving] = useState(null);

  const fill = (d) => {
    setData(d);
    setForms(Object.fromEntries((d?.packs || []).map((p) => [p.id, { ...p }])));
  };

  const load = useCallback(async () => {
    try {
      fill(await fetchAdminKeyPacks());
    } catch (e) {
      notify("error", e.message);
    }
  }, [notify]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ratio = data?.pricing ? Number(data.pricing.price_dzd) / Number(data.pricing.price_usd) : null;
  const set = (id, k, v) => setForms((f) => ({ ...f, [id]: { ...f[id], [k]: v } }));
  const valid = (f) => Number(f.keys) >= 2 && Number(f.keys) <= 50 && Number(f.price_dzd) >= 50 && Number(f.price_usd) >= 0.5;
  const dirty = (f) => {
    const o = data?.packs?.find((p) => p.id === f.id);
    return o && ["keys", "price_dzd", "price_usd", "is_active"].some((k) => String(o[k]) !== String(f[k]));
  };

  const save = async (id) => {
    const f = forms[id];
    if (!valid(f) || saving) return;
    setSaving(id);
    try {
      fill(await saveKeyPack(f));
      notify("success", t("keys.packSaved"));
    } catch (e) {
      notify("error", e.message);
    } finally {
      setSaving(null);
    }
  };

  return (
    <Glass className="mt-5 p-5">
      <h2 className="flex items-center gap-2 text-[16px] font-extrabold text-white">
        <Gem size={17} style={{ color: ICE }} /> {t("keys.packsTitle")}
      </h2>
      <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-mute)]">{t("keys.packsHint")}</p>
      {!data ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Skeleton className="h-[220px] rounded-xl" />
          <Skeleton className="h-[220px] rounded-xl" />
        </div>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {data.packs.map((p) => {
            const f = forms[p.id] || p;
            const suggested = ratio ? Math.max(1, Math.round(Number(f.price_dzd) / ratio)) : null;
            return (
              <div key={p.id} className="rounded-2xl border border-white/[0.08] bg-black/25 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[14px] font-extrabold text-white">{t("keys.packName", { n: fmt(f.keys) })}</span>
                  <label className="flex items-center gap-2 text-[12.5px] font-bold text-[#c9c9cf]">
                    <input type="checkbox" checked={!!f.is_active} onChange={(e) => set(p.id, "is_active", e.target.checked)} className="h-4 w-4 accent-[#a9cdff]" />
                    {t("keys.packActive")}
                  </label>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2.5">
                  {[
                    ["keys", "1", 2],
                    ["price_dzd", "1", 50],
                    ["price_usd", "0.01", 0.5],
                  ].map(([k, step, min]) => (
                    <label key={k}>
                      <span className="mb-1 block text-[12px] font-bold text-[#c9c9cf]">{t(`keys.packFields.${k}`)}</span>
                      <input type="number" inputMode="decimal" min={min} step={step} dir="ltr" value={f[k]} onChange={(e) => set(p.id, k, e.target.value)} className={`${inputCls} tabular-nums`} />
                    </label>
                  ))}
                </div>
                {suggested != null && Number(f.price_usd) !== suggested && (
                  <button type="button" onClick={() => set(p.id, "price_usd", suggested)} className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-bold text-[#a9cdff] underline decoration-dotted underline-offset-4">
                    <Wand2 size={13} /> {t("keys.packRatio", { usd: fmt(suggested) })}
                  </button>
                )}
                <p className="mt-2 text-[11.5px] leading-relaxed text-[var(--color-mute)]">
                  {t("keys.packPlay", { id: p.play_product_id })}
                </p>
                {!valid(f) && <p className="mt-1 text-[12px] font-semibold text-[#f87171]">{t("keys.packInvalid")}</p>}
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-[#6b7280]">{t("pricing.updatedAt", { date: fmtDate(p.updated_at, true) })}</span>
                  <button type="button" onClick={() => save(p.id)} disabled={!valid(f) || !dirty(f) || saving === p.id} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-extrabold disabled:opacity-50" style={ICE_BG}>
                    {saving === p.id ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} {t("keys.packSave")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <ul className="mt-4 space-y-1.5 text-[12px] leading-relaxed text-[var(--color-mute)]">
        <li>{t("keys.packNoteTest")}</li>
        <li>{t("keys.packNoteLimit")}</li>
      </ul>
    </Glass>
  );
}
