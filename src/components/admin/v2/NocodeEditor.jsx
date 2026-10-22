import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Crown, Gift, Loader2, Save, Search, Upload, AlertTriangle, Link2, X, Eye, Clock } from "lucide-react";
import CompanyLogo, { isImageUrl } from "../../CompanyLogo.jsx";
import NocodeCard from "../../nocode/NocodeCard.jsx";
import { uploadLogo } from "../../../lib/supabase.js";
import { slugify } from "../../../lib/slug.js";
import { fetchAllDeals, fetchDealLinks, saveDeal } from "../../../lib/nocode.js";
import { useAdminT, Glass, PageHeader, Segmented, Skeleton, inputCls, LIME_BG } from "./ui.jsx";

const GOLD = "#f0c63c";
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const HTTP_RE = /^https?:\/\//i;

// datetime-local ⇄ ISO (التوقيت المحلي للأدمن)
const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);

const EMPTY = {
  source: "company",
  company_id: null,
  name: "",
  logo_url: "",
  category_id: "",
  reward: "",
  condition: "",
  description: "",
  url: "",
  premium_reward: "",
  premium_condition: "",
  premium_url: "",
  slug: "",
  slugTouched: false,
  starts_at: null,
  ends_at: null,
  is_active: true,
};

/**
 * /admin/nocode/new و /admin/nocode/:id — فورم عرض بلا كود.
 * ربط بشركة موجودة (يعمّر الاسم واللوغو والفئة) أو اسم ولوغو جديدان، الفئة، الميزة، الشرط،
 * الوصف، الرابط، وقسم Premium ذهبي اختياري. الـ slug يتولّد من الاسم ويتعدّل. المدة والتشغيل.
 * الحفظ يترجم الميزة/الشرط/الوصف تلقائياً (translate-company) ويضع رابط Premium في جدوله الخاص.
 */
export default function NocodeEditor({ companies = [], categories = [], notify }) {
  const t = useAdminT();
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const [form, setForm] = useState(isNew ? { ...EMPTY, starts_at: new Date().toISOString() } : null);
  const [loadErr, setLoadErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);
  const [saveErr, setSaveErr] = useState("");
  const [previewMode, setPreviewMode] = useState("normal");
  const [uploading, setUploading] = useState(false);
  const [query, setQuery] = useState("");
  const [nextPosition, setNextPosition] = useState(1);
  const fallbackSlug = useRef(`deal-${Math.random().toString(36).slice(2, 7)}`);

  useEffect(() => {
    let active = true;
    fetchAllDeals()
      .then(async (all) => {
        if (!active) return;
        setNextPosition(all.reduce((m, d) => Math.max(m, d.position || 0), 0) + 1);
        if (isNew) return;
        const deal = all.find((d) => String(d.id) === String(id));
        if (!deal) throw new Error("not found");
        const links = await fetchDealLinks(deal.id);
        if (!active) return;
        setForm({
          ...EMPTY,
          ...Object.fromEntries(Object.entries(deal).map(([k, v]) => [k, v ?? (k in EMPTY && typeof EMPTY[k] === "string" ? "" : v)])),
          source: deal.company_id ? "company" : "custom",
          url: links.url,
          premium_url: links.premium_url,
          slugTouched: true,
        });
      })
      .catch(() => active && !isNew && setLoadErr(t("nocode.loadError")));
    return () => {
      active = false;
    };
  }, [id, isNew, t]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const autoSlug = slugify(form?.name) || fallbackSlug.current;
  const slug = form?.slugTouched ? form.slug : autoSlug;
  const company = form?.company_id ? companies.find((c) => c.id === form.company_id) : null;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return companies.filter((c) => (c.name || "").toLowerCase().includes(q)).slice(0, 6);
  }, [query, companies]);

  const pickCompany = (c) => {
    setForm((f) => ({
      ...f,
      company_id: c.id,
      name: c.name || f.name,
      logo_url: isImageUrl(c.logo) ? c.logo : f.logo_url,
      category_id: f.category_id || c.category_id || "",
    }));
    setQuery("");
  };

  if (!form) {
    return (
      <>
        <PageHeader title={t("nocode.editTitle")} />
        {loadErr ? (
          <p role="alert" className="rounded-2xl border border-red-500/30 bg-red-500/[0.08] px-4 py-3 text-[13.5px] font-semibold text-red-300">{loadErr}</p>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
            <Skeleton className="h-[520px] rounded-[20px]" />
            <Skeleton className="h-[300px] rounded-[20px]" />
          </div>
        )}
      </>
    );
  }

  // ===== التحقق =====
  const errors = {
    name: !form.name.trim() ? t("nocode.required") : "",
    reward: !form.reward.trim() ? t("nocode.required") : "",
    url: !form.url.trim() ? t("nocode.required") : !HTTP_RE.test(form.url.trim()) ? t("nocode.httpsOnly") : "",
    premium_url: form.premium_url.trim() && !HTTP_RE.test(form.premium_url.trim()) ? t("nocode.httpsOnly") : "",
    logo_url: form.logo_url.trim() && !HTTP_RE.test(form.logo_url.trim()) ? t("nocode.httpsOnly") : "",
    slug: !SLUG_RE.test(slug) ? t("nocode.slugInvalid") : "",
    dates: form.ends_at && form.starts_at && new Date(form.ends_at) <= new Date(form.starts_at) ? t("featured.datesError") : "",
  };
  const valid = !Object.values(errors).some(Boolean);
  const show = (k) => (touched ? errors[k] : "");

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/^image\//.test(file.type)) return notify("error", t("nocode.imageOnly"));
    setUploading(true);
    try {
      const url = await uploadLogo(file);
      setForm((f) => ({ ...f, logo_url: url }));
    } catch (err) {
      notify("error", err.message);
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setTouched(true);
    setSaveErr("");
    if (!valid || saving) return;
    setSaving(true);
    try {
      const payload = {
        slug,
        name: form.name,
        logo_url: form.logo_url,
        category_id: form.category_id || null,
        company_id: form.source === "company" ? form.company_id : null,
        reward: form.reward,
        condition: form.condition,
        description: form.description,
        url: form.url,
        premium_reward: form.premium_reward,
        premium_condition: form.premium_condition,
        premium_url: form.premium_url,
        starts_at: form.starts_at || new Date().toISOString(),
        ends_at: form.ends_at || null,
        is_active: !!form.is_active,
        ...(isNew ? { position: nextPosition } : {}),
      };
      const { translated } = await saveDeal(payload, isNew ? null : Number(id));
      notify(translated ? "success" : "error", translated ? t("nocode.saved") : t("nocode.savedNoTranslation"));
      navigate("/admin/nocode");
    } catch (err) {
      setSaveErr(err.message === "slug_taken" ? t("nocode.slugTaken") : err.message);
    } finally {
      setSaving(false);
    }
  };

  // عرض المعاينة (النص العربي المكتوب الآن)
  const previewDeal = {
    id: 0,
    slug,
    name: form.name || t("nocode.namePh"),
    logo_url: form.logo_url,
    category_id: form.category_id || null,
    reward: form.reward || t("nocode.rewardPh"),
    condition: form.condition,
    description: form.description,
    premium_reward: form.premium_reward,
    premium_condition: form.premium_condition,
    has_premium: !!form.premium_url.trim(),
  };

  const back = (
    <Link to="/admin/nocode" className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] px-3.5 py-2 text-[13px] font-bold text-[#c9c9cf] hover:text-white">
      <ArrowRight size={15} /> {t("nocode.back")}
    </Link>
  );

  return (
    <>
      <PageHeader title={isNew ? t("nocode.newTitle") : t("nocode.editTitle")} sub={t("nocode.formSub")} actions={back} />

      <form onSubmit={submit} noValidate className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-5">
          {/* 1) الهوية: شركة موجودة أو اسم ولوغو جديدان */}
          <Glass className="p-5 sm:p-6">
            <SectionTitle icon={Gift} title={t("nocode.s.identity")} sub={t("nocode.s.identitySub")} />
            <Segmented
              value={form.source}
              onChange={(v) => setForm((f) => ({ ...f, source: v, company_id: v === "custom" ? null : f.company_id }))}
              label={t("nocode.s.identity")}
              options={[
                { value: "company", label: t("nocode.fromCompany") },
                { value: "custom", label: t("nocode.custom") },
              ]}
            />

            {form.source === "company" && (
              <div className="mt-4">
                {company ? (
                  <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2.5">
                    <CompanyLogo logo={company.logo} name={company.name} size={36} />
                    <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-white">{company.name}</span>
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, company_id: null }))}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12.5px] font-bold text-[#a1a1aa] hover:text-white"
                    >
                      <X size={14} /> {t("nocode.unlink")}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search size={16} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-[#6b7280]" />
                      <input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={t("nocode.searchCompany")}
                        aria-label={t("nocode.searchCompany")}
                        className={`${inputCls} ps-10`}
                        autoComplete="off"
                      />
                    </div>
                    {query.trim() && (
                      <ul className="mt-2 space-y-1">
                        {results.length ? (
                          results.map((c) => (
                            <li key={c.id}>
                              <button
                                type="button"
                                onClick={() => pickCompany(c)}
                                className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-start transition-colors hover:bg-white/[0.05]"
                              >
                                <CompanyLogo logo={c.logo} name={c.name} size={32} />
                                <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-white">{c.name}</span>
                                <Link2 size={15} className="shrink-0 text-[var(--color-lime)]" />
                              </button>
                            </li>
                          ))
                        ) : (
                          <li className="px-2.5 py-2 text-[13px] text-[var(--color-mute)]">{t("nocode.noCompany")}</li>
                        )}
                      </ul>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label={t("nocode.f.name")} required error={show("name")}>
                {(p) => <input {...p} value={form.name} onChange={set("name")} className={inputCls} dir="auto" />}
              </Field>
              <Field label={t("nocode.f.category")}>
                {(p) => (
                  <select {...p} value={form.category_id || ""} onChange={set("category_id")} className={`${inputCls} [color-scheme:dark]`}>
                    <option value="">{t("nocode.noCategory")}</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name_ar}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label={t("nocode.f.logo")} hint={t("nocode.h.logo")} error={show("logo_url")} className="sm:col-span-2">
                {(p) => (
                  <div className="flex items-center gap-2">
                    <CompanyLogo logo={form.logo_url} name={form.name} size={42} accent="#b794ff" />
                    <input {...p} value={form.logo_url} onChange={set("logo_url")} placeholder="https://" className={inputCls} dir="ltr" inputMode="url" />
                    <label className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-white/[0.08] px-3 py-2.5 text-[13px] font-bold text-[#c9c9cf] transition-colors hover:bg-white/[0.04]">
                      {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                      {t("nocode.upload")}
                      <input type="file" accept="image/*" className="sr-only" onChange={onUpload} disabled={uploading} />
                    </label>
                  </div>
                )}
              </Field>
            </div>
          </Glass>

          {/* 2) العرض */}
          <Glass className="p-5 sm:p-6">
            <SectionTitle icon={Gift} title={t("nocode.s.offer")} sub={t("nocode.s.offerSub")} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("nocode.f.reward")} hint={t("nocode.h.reward")} required error={show("reward")}>
                {(p) => <input {...p} value={form.reward} onChange={set("reward")} className={inputCls} dir="auto" />}
              </Field>
              <Field label={t("nocode.f.condition")} hint={t("nocode.h.condition")}>
                {(p) => <input {...p} value={form.condition} onChange={set("condition")} className={inputCls} dir="auto" />}
              </Field>
              <Field label={t("nocode.f.description")} className="sm:col-span-2">
                {(p) => <textarea {...p} value={form.description} onChange={set("description")} rows={2} className={`${inputCls} resize-y`} dir="auto" />}
              </Field>
              <Field label={t("nocode.f.url")} hint={t("nocode.h.url")} required error={show("url")} className="sm:col-span-2">
                {(p) => <input {...p} value={form.url} onChange={set("url")} placeholder="https://" className={inputCls} dir="ltr" inputMode="url" />}
              </Field>
            </div>
          </Glass>

          {/* 3) Premium (اختياري) */}
          <section
            className="rounded-[20px] border p-5 sm:p-6"
            style={{ borderColor: `${GOLD}55`, background: `linear-gradient(160deg, ${GOLD}1a, transparent 55%), rgba(255,255,255,0.02)` }}
          >
            <SectionTitle icon={Crown} color={GOLD} title={t("nocode.s.premium")} sub={t("nocode.s.premiumSub")} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("nocode.f.premiumReward")} hint={t("nocode.h.premiumFallback")}>
                {(p) => <input {...p} value={form.premium_reward} onChange={set("premium_reward")} placeholder={form.reward} className={inputCls} dir="auto" />}
              </Field>
              <Field label={t("nocode.f.premiumCondition")} hint={t("nocode.h.premiumFallback")}>
                {(p) => <input {...p} value={form.premium_condition} onChange={set("premium_condition")} placeholder={form.condition} className={inputCls} dir="auto" />}
              </Field>
              <Field
                label={t("nocode.f.premiumUrl")}
                hint={t("nocode.h.premiumUrl")}
                error={show("premium_url")}
                warn={!form.premium_url.trim() ? t("nocode.frozenWarn") : ""}
                className="sm:col-span-2"
              >
                {(p) => <input {...p} value={form.premium_url} onChange={set("premium_url")} placeholder="https://" className={inputCls} dir="ltr" inputMode="url" />}
              </Field>
            </div>
          </section>

          {/* 4) الرابط والمدة */}
          <Glass className="p-5 sm:p-6">
            <SectionTitle icon={Clock} title={t("nocode.s.publish")} sub={t("nocode.s.publishSub")} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("nocode.f.slug")} hint={t("nocode.h.slug", { path: `codpromo.com/go/${slug}` })} error={show("slug")} className="sm:col-span-2">
                {(p) => (
                  <input
                    {...p}
                    value={slug}
                    onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, "-"), slugTouched: true }))}
                    className={`${inputCls} font-mono`}
                    dir="ltr"
                    spellCheck={false}
                  />
                )}
              </Field>
              <Field label={t("featured.startsAt")}>
                {(p) => (
                  <input
                    {...p}
                    type="datetime-local"
                    value={toLocalInput(form.starts_at)}
                    onChange={(e) => setForm((f) => ({ ...f, starts_at: fromLocalInput(e.target.value) || new Date().toISOString() }))}
                    className={`${inputCls} min-w-0 [color-scheme:dark]`}
                  />
                )}
              </Field>
              <Field label={t("featured.endsAt")} error={show("dates")}>
                {(p) => (
                  <input
                    {...p}
                    type="datetime-local"
                    value={toLocalInput(form.ends_at)}
                    onChange={(e) => setForm((f) => ({ ...f, ends_at: fromLocalInput(e.target.value) }))}
                    className={`${inputCls} min-w-0 [color-scheme:dark]`}
                  />
                )}
              </Field>
              <label className="flex cursor-pointer items-center gap-2.5 sm:col-span-2">
                <input type="checkbox" className="peer sr-only" checked={!!form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
                <span className="relative h-6 w-11 shrink-0 rounded-full bg-white/[0.12] transition-colors after:absolute after:start-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-[var(--color-lime)] peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-lime)]/60 rtl:peer-checked:after:-translate-x-5" />
                <span className="text-[13.5px] font-bold text-white">{t("nocode.active")}</span>
              </label>
            </div>
          </Glass>

          {saveErr && (
            <p role="alert" className="flex items-start gap-2 rounded-2xl border border-red-500/30 bg-red-500/[0.08] px-4 py-3 text-[13.5px] font-semibold text-red-300">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {saveErr}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-[14.5px] font-extrabold text-[#0a0a0a] transition-opacity disabled:opacity-50"
              style={LIME_BG}
            >
              {saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
              {saving ? t("nocode.saving") : t("nocode.save")}
            </button>
            <Link to="/admin/nocode" className="rounded-xl border border-white/[0.08] px-4 py-3 text-[14px] font-bold text-[#c9c9cf] transition-colors hover:bg-white/[0.05]">
              {t("nocode.cancel")}
            </Link>
            {touched && !valid && <span className="text-[12.5px] font-semibold text-red-400">{t("nocode.fixFields")}</span>}
          </div>
        </div>

        {/* المعاينة الحية */}
        <aside className="xl:sticky xl:top-6 xl:self-start" aria-label={t("nocode.preview")}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-[14px] font-extrabold text-white">
              <Eye size={16} className="text-[var(--color-lime)]" /> {t("nocode.preview")}
            </h2>
            <Segmented
              size="sm"
              value={previewMode}
              onChange={setPreviewMode}
              label={t("nocode.preview")}
              options={[
                { value: "normal", label: t("featured.modeNormal") },
                { value: "premium", label: t("featured.modePremium"), color: GOLD },
              ]}
            />
          </div>
          <div inert="">
            <NocodeCard deal={previewDeal} premium={previewMode === "premium"} unlocked preview />
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-[#6b7280]">
            {previewMode === "premium" && !previewDeal.has_premium ? t("nocode.previewFrozen") : t("nocode.previewNote")}
          </p>
        </aside>
      </form>
    </>
  );
}

function SectionTitle({ icon: Icon, color = "var(--color-lime)", title, sub }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: "rgba(255,255,255,0.04)", color }}>
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <h2 className="text-[15.5px] font-extrabold text-white">{title}</h2>
        {sub && <p className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--color-mute)]">{sub}</p>}
      </div>
    </div>
  );
}

let fieldSeq = 0;
function Field({ label, required, hint, warn, error, className = "", children }) {
  const [fid] = useState(() => `nc-${++fieldSeq}`);
  const describedBy = [hint && `${fid}-h`, (warn || error) && `${fid}-w`].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <label htmlFor={fid} className="mb-1.5 block text-[13px] font-bold text-[#c9c9cf]">
        {label}
        {required && <span className="ms-1 text-[var(--color-lime)]">*</span>}
      </label>
      {children({ id: fid, "aria-describedby": describedBy, "aria-invalid": error ? "true" : undefined })}
      {hint && (
        <p id={`${fid}-h`} className="mt-1.5 text-[12px] leading-relaxed text-[#6b7280]">
          {hint}
        </p>
      )}
      {(error || warn) && (
        <p id={`${fid}-w`} className={`mt-1.5 flex items-start gap-1.5 text-[12px] font-semibold ${error ? "text-red-400" : "text-[#fbbf24]"}`}>
          <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {error || warn}
        </p>
      )}
    </div>
  );
}
