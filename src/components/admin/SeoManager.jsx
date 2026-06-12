import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Pencil, ExternalLink, Loader2, Check, X, Plus, Trash2,
  ChevronUp, ChevronDown, Languages, Save, Copy, Globe, Link2, AlertCircle,
} from "lucide-react";
import CompanyLogo from "../CompanyLogo.jsx";
import { getTypeMeta } from "../../lib/types.js";
import { companySlug, slugify } from "../../lib/slug.js";
import { storeTitle, storeDescription, SITE_URL } from "../../lib/seo.js";
import {
  updateCompanyRaw, fetchCompanyFaqs, saveCompanyFaqs, fetchFaqCounts,
  fetchSiteSettings, updateSiteSettings, translateCompanyFields,
} from "../../lib/supabase.js";

const inputCls =
  "w-full rounded-xl border border-[var(--color-ink-line)] bg-[#0c0c0e] px-3.5 py-2.5 text-[14px] font-medium text-white outline-none transition-colors placeholder:text-[#4b4b52] focus:border-[var(--color-lime)]";

/** حالة SEO لشركة: كامل (slug+عنوان+وصف+سؤال) / جزئي / ناقص. */
function seoStatus(c, faqCount) {
  const hasTitle = !!(c.seo_title && c.seo_title.trim());
  const hasDesc = !!(c.seo_description && c.seo_description.trim());
  const hasSlug = !!(c.slug && c.slug.trim());
  if (hasSlug && hasTitle && hasDesc && faqCount > 0) return { key: "complete", color: "#a6f000", label: "مكتمل" };
  if (hasSlug && (hasTitle || hasDesc)) return { key: "partial", color: "#fbbf24", label: "جزئي" };
  return { key: "minimal", color: "#9aa0aa", label: "ناقص (افتراضي تلقائي)" };
}

export default function SeoManager({ companies, onUpdated, notify }) {
  const [q, setQ] = useState("");
  const [faqCounts, setFaqCounts] = useState({});
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    fetchFaqCounts().then(setFaqCounts).catch(() => setFaqCounts({}));
  }, []);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return companies;
    return companies.filter(
      (c) => c.name?.toLowerCase().includes(term) || c.slug?.toLowerCase().includes(term)
    );
  }, [companies, q]);

  const sitemapUrl = `${SITE_URL}/sitemap.xml`;

  return (
    <div className="flex flex-col gap-6">
      {/* ===== إعدادات SEO العامة ===== */}
      <GlobalSettings notify={notify} sitemapUrl={sitemapUrl} />

      {/* ===== جدول الشركات + حالة SEO ===== */}
      <div className="rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-ink-line)] p-4">
          <div>
            <h2 className="text-[17px] font-extrabold text-white">SEO الشركات</h2>
            <p className="text-[12.5px] text-[var(--color-mute)]">تحكّم في الرابط والعنوان والوصف والكلمات والأسئلة الشائعة لكل شركة.</p>
          </div>
          <div className="relative flex items-center">
            <Search size={15} className="pointer-events-none absolute right-3 text-[var(--color-mute)]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث…" className="w-44 rounded-xl border border-[var(--color-ink-line)] bg-[#0c0c0e] py-2 pr-9 pl-3 text-[13px] text-white outline-none focus:border-[var(--color-lime)]" />
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="py-16 text-center text-[14px] text-[var(--color-mute)]">لا شركات.</div>
        ) : (
          <ul className="divide-y divide-[var(--color-ink-line)]">
            {rows.map((c) => {
              const meta = getTypeMeta(c.type);
              const st = seoStatus(c, faqCounts[c.id] || 0);
              return (
                <li key={c.id} className="flex items-center gap-3 p-3 transition-colors hover:bg-white/[0.02] sm:p-4">
                  <CompanyLogo logo={c.logo} name={c.name} size={42} accent={meta.color} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[14.5px] font-bold text-white">{c.name}</span>
                      <span className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-bold" style={{ background: `${st.color}1a`, color: st.color }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.color }} /> {st.label}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-[var(--color-mute)]" dir="ltr">
                      <Link2 size={12} /> <span className="truncate">/store/{c.slug || companySlug(c)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <a href={`/store/${c.slug || companySlug(c)}`} target="_blank" rel="noopener noreferrer" title="معاينة" className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--color-ink-line)] text-[var(--color-mute)] transition-colors hover:text-[var(--color-lime)]">
                      <ExternalLink size={15} />
                    </a>
                    <button onClick={() => setEditing(c)} title="تحرير SEO" className="flex h-9 items-center gap-1.5 rounded-lg border border-[var(--color-ink-line)] px-3 text-[13px] font-bold text-[#c9c9cf] transition-colors hover:border-[var(--color-lime)] hover:text-[var(--color-lime)]">
                      <Pencil size={14} /> تحرير
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <AnimatePresence>
        {editing && (
          <SeoEditor
            company={editing}
            onClose={() => setEditing(null)}
            onSaved={(patch, faqCount) => {
              onUpdated?.(patch);
              setFaqCounts((m) => ({ ...m, [patch.id]: faqCount }));
              setEditing(null);
            }}
            notify={notify}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ===================== إعدادات الموقع العامة ===================== */
function GlobalSettings({ notify, sitemapUrl }) {
  const [form, setForm] = useState({
    home_title: "", home_title_en: "", home_title_fr: "",
    home_description: "", home_description_en: "", home_description_fr: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchSiteSettings()
      .then((s) => setForm((f) => ({ ...f, ...Object.fromEntries(Object.keys(f).map((k) => [k, s[k] || ""])) })))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setSaving(true);
    try {
      await updateSiteSettings(form);
      notify?.("success", "تم حفظ إعدادات الموقع");
    } catch (e) {
      notify?.("error", e.message);
    } finally {
      setSaving(false);
    }
  };

  const copySitemap = async () => {
    try {
      await navigator.clipboard.writeText(sitemapUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* تجاهل */ }
  };

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--color-lime)]/12 text-[var(--color-lime)]"><Globe size={20} /></span>
        <div>
          <h2 className="text-[16px] font-extrabold text-white">إعدادات SEO العامة</h2>
          <p className="text-[12px] text-[var(--color-mute)]">عنوان ووصف الصفحة الرئيسية بالثلاث لغات + رابط الـ sitemap.</p>
        </div>
      </div>

      {/* رابط sitemap */}
      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--color-ink-line)] bg-[#0c0c0e] p-2.5">
        <span className="shrink-0 text-[12px] font-bold text-[var(--color-mute)]">رابط Sitemap:</span>
        <code className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--color-lime)]" dir="ltr">{sitemapUrl}</code>
        <button onClick={copySitemap} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--color-ink-line)] px-3 py-1.5 text-[12.5px] font-bold text-white transition-colors hover:border-[var(--color-lime)]">
          {copied ? <><Check size={14} className="text-[var(--color-lime)]" /> نُسخ</> : <><Copy size={14} /> نسخ</>}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-6 text-[var(--color-mute)]"><Loader2 size={16} className="animate-spin" /> جارٍ التحميل…</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { lang: "العربية", t: "home_title", d: "home_description", ph: "CODpromo · أكواد الخصم والكوبونات" },
            { lang: "English", t: "home_title_en", d: "home_description_en", ph: "CODpromo · Promo Codes & Coupons" },
            { lang: "Français", t: "home_title_fr", d: "home_description_fr", ph: "CODpromo · Codes Promo & Coupons" },
          ].map((col) => (
            <div key={col.t} className="flex flex-col gap-2">
              <span className="text-[12.5px] font-bold text-[#c9c9cf]">{col.lang}</span>
              <input value={form[col.t]} onChange={set(col.t)} placeholder={col.ph} className={inputCls} dir={col.t === "home_title" ? "rtl" : "ltr"} />
              <textarea value={form[col.d]} onChange={set(col.d)} placeholder="وصف الصفحة الرئيسية…" rows={3} className={`${inputCls} resize-none`} dir={col.d === "home_description" ? "rtl" : "ltr"} />
            </div>
          ))}
        </div>
      )}

      <div className="mt-4">
        <button onClick={save} disabled={saving || loading} className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13.5px] font-extrabold text-[#0a0a0a] disabled:opacity-60" style={{ background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" }}>
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} حفظ الإعدادات
        </button>
      </div>
    </div>
  );
}

/* ===================== محرّر SEO لشركة ===================== */
function SeoEditor({ company, onClose, onSaved, notify }) {
  const [form, setForm] = useState({
    slug: company.slug || companySlug(company),
    seo_title: company.seo_title || "", seo_title_en: company.seo_title_en || "", seo_title_fr: company.seo_title_fr || "",
    seo_description: company.seo_description || "", seo_description_en: company.seo_description_en || "", seo_description_fr: company.seo_description_fr || "",
    seo_keywords: company.seo_keywords || "", seo_keywords_en: company.seo_keywords_en || "", seo_keywords_fr: company.seo_keywords_fr || "",
  });
  const [faqs, setFaqs] = useState([]);
  const [loadingFaqs, setLoadingFaqs] = useState(true);
  const [saving, setSaving] = useState(false);
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    fetchCompanyFaqs(company.id)
      .then((rows) => setFaqs(rows.map((r) => ({ ...r }))))
      .catch(() => setFaqs([]))
      .finally(() => setLoadingFaqs(false));
  }, [company.id]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // القيم الافتراضية التلقائية (placeholder) — تُحسب من بيانات الشركة بدون حقول SEO.
  const bare = { ...company, seo_title: "", seo_title_en: "", seo_title_fr: "", seo_description: "", seo_description_en: "", seo_description_fr: "" };
  const defaultTitle = storeTitle(bare, "ar");
  const defaultDesc = storeDescription(bare, "ar");

  const addFaq = () => setFaqs((f) => [...f, { question: "", answer: "" }]);
  const removeFaq = (i) => setFaqs((f) => f.filter((_, idx) => idx !== i));
  const setFaq = (i, k, v) => setFaqs((f) => f.map((x, idx) => (idx === i ? { ...x, [k]: v } : x)));
  const move = (i, dir) => setFaqs((f) => {
    const j = i + dir;
    if (j < 0 || j >= f.length) return f;
    const copy = [...f];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    return copy;
  });

  // ترجمة تلقائية: حقول SEO + الأسئلة في نداء واحد.
  const translateAll = async () => {
    setTranslating(true);
    try {
      const src = {};
      if (form.seo_title.trim()) src.seo_title = form.seo_title.trim();
      if (form.seo_description.trim()) src.seo_description = form.seo_description.trim();
      if (form.seo_keywords.trim()) src.seo_keywords = form.seo_keywords.trim();
      faqs.forEach((f, i) => {
        if (f.question?.trim()) src[`faq_${i}_q`] = f.question.trim();
        if (f.answer?.trim()) src[`faq_${i}_a`] = f.answer.trim();
      });
      if (Object.keys(src).length === 0) {
        notify?.("error", "لا يوجد محتوى لترجمته — املأ الحقول أولاً.");
        setTranslating(false);
        return;
      }
      const { en = {}, fr = {} } = await translateCompanyFields(src);
      setForm((f) => ({
        ...f,
        seo_title_en: en.seo_title ?? f.seo_title_en,
        seo_title_fr: fr.seo_title ?? f.seo_title_fr,
        seo_description_en: en.seo_description ?? f.seo_description_en,
        seo_description_fr: fr.seo_description ?? f.seo_description_fr,
        seo_keywords_en: en.seo_keywords ?? f.seo_keywords_en,
        seo_keywords_fr: fr.seo_keywords ?? f.seo_keywords_fr,
      }));
      setFaqs((arr) => arr.map((f, i) => ({
        ...f,
        question_en: en[`faq_${i}_q`] ?? f.question_en,
        answer_en: en[`faq_${i}_a`] ?? f.answer_en,
        question_fr: fr[`faq_${i}_q`] ?? f.question_fr,
        answer_fr: fr[`faq_${i}_a`] ?? f.answer_fr,
      })));
      notify?.("success", "تمت الترجمة التلقائية (en + fr)");
    } catch (e) {
      notify?.("error", e.message || "تعذّرت الترجمة");
    } finally {
      setTranslating(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const slug = slugify(form.slug) || companySlug(company);
      const patch = { ...form, slug };
      const updated = await updateCompanyRaw(company.id, patch);
      const cleanFaqs = faqs.filter((f) => (f.question || "").trim() && (f.answer || "").trim());
      await saveCompanyFaqs(company.id, cleanFaqs);
      onSaved?.({ ...company, ...updated, ...patch }, cleanFaqs.length);
      notify?.("success", "تم حفظ بيانات SEO");
    } catch (e) {
      notify?.("error", e.message);
      setSaving(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.98 }}
        onClick={(e) => e.stopPropagation()}
        className="my-6 w-full max-w-2xl rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)]"
      >
        {/* رأس */}
        <div className="flex items-center justify-between gap-3 border-b border-[var(--color-ink-line)] p-4">
          <div className="flex items-center gap-3">
            <CompanyLogo logo={company.logo} name={company.name} size={40} accent={getTypeMeta(company.type).color} />
            <div>
              <h3 className="text-[16px] font-extrabold text-white">SEO · {company.name}</h3>
              <p className="text-[12px] text-[var(--color-mute)]">حرّر بيانات الفهرسة والمشاركة</p>
            </div>
          </div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--color-ink-line)] text-[var(--color-mute)] hover:text-white"><X size={16} /></button>
        </div>

        <div className="flex max-h-[70vh] flex-col gap-5 overflow-y-auto p-5">
          {/* slug */}
          <Field label="الرابط (slug)" hint="يظهر في الرابط: /store/الرابط — أحرف لاتينية صغيرة وشرطات.">
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-[12.5px] text-[var(--color-mute)]" dir="ltr">/store/</span>
              <input value={form.slug} onChange={set("slug")} dir="ltr" className={`${inputCls} text-left`} placeholder="youcan" />
            </div>
          </Field>

          {/* العنوان (عربي + ترجمتاه) */}
          <Field label="عنوان SEO (Title)" hint={`اتركه فارغاً ليُولَّد تلقائياً: ${defaultTitle}`}>
            <input value={form.seo_title} onChange={set("seo_title")} className={inputCls} placeholder={defaultTitle} />
            <TransPair en={form.seo_title_en} fr={form.seo_title_fr} onEn={set("seo_title_en")} onFr={set("seo_title_fr")} />
          </Field>

          {/* الوصف */}
          <Field label="وصف SEO (Meta description)" hint={`اتركه فارغاً ليُولَّد تلقائياً من وصف الشركة.`}>
            <textarea value={form.seo_description} onChange={set("seo_description")} rows={2} className={`${inputCls} resize-none`} placeholder={defaultDesc} />
            <TransPair textarea en={form.seo_description_en} fr={form.seo_description_fr} onEn={set("seo_description_en")} onFr={set("seo_description_fr")} />
          </Field>

          {/* الكلمات المفتاحية */}
          <Field label="الكلمات المفتاحية" hint="كلمات مفصولة بفواصل.">
            <input value={form.seo_keywords} onChange={set("seo_keywords")} className={inputCls} placeholder="كود خصم, كوبون, تخفيضات" />
            <TransPair en={form.seo_keywords_en} fr={form.seo_keywords_fr} onEn={set("seo_keywords_en")} onFr={set("seo_keywords_fr")} />
          </Field>

          {/* الأسئلة الشائعة */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[12.5px] font-bold text-[#c9c9cf]">الأسئلة الشائعة (FAQ)</span>
              <button onClick={addFaq} className="flex items-center gap-1.5 rounded-lg border border-[var(--color-ink-line)] px-2.5 py-1.5 text-[12.5px] font-bold text-[var(--color-lime)] transition-colors hover:bg-[var(--color-lime)]/10">
                <Plus size={14} /> إضافة سؤال
              </button>
            </div>
            {loadingFaqs ? (
              <div className="flex items-center gap-2 py-3 text-[13px] text-[var(--color-mute)]"><Loader2 size={14} className="animate-spin" /> جارٍ التحميل…</div>
            ) : faqs.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--color-ink-line)] p-3 text-center text-[12.5px] text-[var(--color-mute)]">لا أسئلة بعد — أضف سؤالاً.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {faqs.map((f, i) => (
                  <div key={i} className="rounded-xl border border-[var(--color-ink-line)] bg-[#0c0c0e] p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[11.5px] font-bold text-[var(--color-mute)]">سؤال {i + 1}</span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => move(i, -1)} disabled={i === 0} className="grid h-7 w-7 place-items-center rounded-md border border-[var(--color-ink-line)] text-[var(--color-mute)] disabled:opacity-30 hover:text-white"><ChevronUp size={14} /></button>
                        <button onClick={() => move(i, 1)} disabled={i === faqs.length - 1} className="grid h-7 w-7 place-items-center rounded-md border border-[var(--color-ink-line)] text-[var(--color-mute)] disabled:opacity-30 hover:text-white"><ChevronDown size={14} /></button>
                        <button onClick={() => removeFaq(i)} className="grid h-7 w-7 place-items-center rounded-md border border-[var(--color-ink-line)] text-[var(--color-mute)] hover:border-red-500/50 hover:text-red-400"><Trash2 size={14} /></button>
                      </div>
                    </div>
                    <input value={f.question || ""} onChange={(e) => setFaq(i, "question", e.target.value)} placeholder="السؤال…" className={`${inputCls} mb-2`} />
                    <textarea value={f.answer || ""} onChange={(e) => setFaq(i, "answer", e.target.value)} placeholder="الجواب…" rows={2} className={`${inputCls} resize-none`} />
                    {(f.question_en || f.answer_en || f.question_fr || f.answer_fr) && (
                      <p className="mt-1.5 flex items-center gap-1 text-[11px] text-[var(--color-lime)]"><Check size={12} /> مُترجَم (en/fr)</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* تذييل: أفعال */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-ink-line)] p-4">
          <div className="flex items-center gap-2">
            <button onClick={translateAll} disabled={translating} className="flex items-center gap-2 rounded-xl border border-[var(--color-ink-line)] px-3.5 py-2.5 text-[13px] font-bold text-white transition-colors hover:border-[var(--color-lime)] disabled:opacity-60">
              {translating ? <Loader2 size={15} className="animate-spin" /> : <Languages size={15} className="text-[var(--color-lime)]" />} ترجمة تلقائية
            </button>
            <a href={`/store/${slugify(form.slug) || companySlug(company)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-xl border border-[var(--color-ink-line)] px-3.5 py-2.5 text-[13px] font-bold text-white transition-colors hover:border-[var(--color-lime)]">
              <ExternalLink size={15} /> معاينة
            </a>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="rounded-xl border border-[var(--color-ink-line)] px-4 py-2.5 text-[13.5px] font-bold text-white hover:bg-white/5">إلغاء</button>
            <button onClick={save} disabled={saving} className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13.5px] font-extrabold text-[#0a0a0a] disabled:opacity-60" style={{ background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" }}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} حفظ
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* حقل بعنوان وتلميح */
function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12.5px] font-bold text-[#c9c9cf]">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-[var(--color-mute)]">{hint}</span>}
    </label>
  );
}

/* زوج حقول الترجمة (en / fr) */
function TransPair({ en, fr, onEn, onFr, textarea }) {
  const cls = `${inputCls} text-left text-[13px]`;
  return (
    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
      {textarea ? (
        <>
          <textarea value={en} onChange={onEn} dir="ltr" rows={2} placeholder="English…" className={`${cls} resize-none`} />
          <textarea value={fr} onChange={onFr} dir="ltr" rows={2} placeholder="Français…" className={`${cls} resize-none`} />
        </>
      ) : (
        <>
          <input value={en} onChange={onEn} dir="ltr" placeholder="English…" className={cls} />
          <input value={fr} onChange={onFr} dir="ltr" placeholder="Français…" className={cls} />
        </>
      )}
    </div>
  );
}
