import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { ImagePlus, Loader2, X, Tag, Ticket, Wallet, Plus, Save, Crown, Sparkles, AlertTriangle, Lock, Building2, Gift, Wand2, Check, Handshake, ShieldAlert } from "lucide-react";
import CompanyLogo from "../CompanyLogo.jsx";
import CompanyCard from "../CompanyCard.jsx";
import { uploadLogo } from "../../lib/supabase.js";
import { getTypeMeta } from "../../lib/types.js";
import { parseVal } from "../../lib/values.js";

// ============================================================
//  CompanyOfferForm — فورم إضافة/تعديل شركة وعرضها، مستقل لإعادة الاستعمال
//  (لوحة الأدمن الآن، وبوابة الشركات لاحقاً). نفس أعمدة جدول companies بالضبط.
//  props:
//   initial          صف الشركة (مع premium_code / premium_url إن وُجدا)
//   categories       قائمة الفئات
//   onSubmit(company, private)  private = null إن كان showPrivate=false
//   onCancel, submitting
//   onCreateCategory(name_ar) → الفئة المُنشأة (يُظهر زر "فئة جديدة" إن مُرّر)
//   showPrivate      قسم المعلومات الداخلية (الأدمن فقط) + privateInitial
//   mode             "admin" (افتراضي) أو "partner": قسم "التواصل والشراكة" للشركة
//                    (WhatsApp إجباري + تنبيه "لا كلمات سر") بدل المعلومات الداخلية
//   uploadLogo       رفع مخصّص للوغو (الشركة: bucket partner-logos)، وlogoAccept لأنواع الملف
//   trap             عنصر honeypot (useBotGuard) يُوضع داخل الفورم
//   submitLabel      نص زر الإرسال (الشركة: "أرسل الطلب")
//   lang             لغة نصوص الفورم (الأدمن: "ar" ثابتة)
// ============================================================

const TYPES = [
  { value: "تخفيض", key: "discount", icon: Tag },
  { value: "كوبون", key: "coupon", icon: Ticket },
  { value: "كاش باك", key: "cashback", icon: Wallet },
];
const GOLD = "#f0c63c";
const GOLD_SOFT = "#ffe486";

const EMPTY = {
  name: "",
  logo: "",
  category_id: "",
  type: "تخفيض",
  discount: "",
  code: "",
  link: "",
  description: "",
  premium_discount: "",
  premium_code: "",
  premium_url: "",
  premium_description: "",
  supports_premium: true,
};
const EMPTY_PRIVATE = { website_url: "", contact_name: "", whatsapp: "", email: "", commission_pct: "", affiliate_dashboard_url: "", affiliate_url: "", notes: "" };
// قسم الشركة: نفس المفاتيح تقريباً + رسالة لنا (contact_email بدل email)
const EMPTY_CONTACT = { website_url: "", contact_name: "", whatsapp: "", contact_email: "", affiliate_url: "", affiliate_dashboard_url: "", commission_pct: "", message: "" };
const URL_FIELDS = ["link", "premium_url", "website_url", "affiliate_dashboard_url"];

/** كود Premium صعب التخمين: 3 حروف من اسم الشركة + 4 رموز عشوائية (بلا 0/O/1/I). */
function suggestCode(name) {
  const ABC = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const prefix = (String(name).toUpperCase().match(/[A-Z]/g) || []).join("").slice(0, 3) || "CP";
  const buf = new Uint32Array(4);
  crypto.getRandomValues(buf);
  return `${prefix}-${Array.from(buf, (n) => ABC[n % ABC.length]).join("")}`;
}

/** هل قيمة Premium أقوى من العادية؟ null = لا نقدر نقارن (وحدات مختلفة أو بلا رقم). */
function premiumIsStronger(normal, premium) {
  const a = parseVal(normal);
  const b = parseVal(premium);
  if (!a || !b) return null;
  const unit = (p) => `${p.prefix}|${p.suffix}`.replace(/\s+/g, "").toLowerCase();
  if (unit(a) !== unit(b)) return null;
  return b.num > a.num;
}

export default function CompanyOfferForm({
  initial,
  categories = [],
  onSubmit,
  onCancel,
  submitting = false,
  onCreateCategory,
  showPrivate = false,
  privateInitial = null,
  mode = "admin",
  uploadLogo: uploadLogoProp,
  logoAccept = "image/*",
  trap = null,
  submitLabel,
  lang,
}) {
  const partner = mode === "partner";
  const { i18n } = useTranslation();
  const formLang = lang || i18n.language;
  const t = useMemo(() => i18n.getFixedT(formLang, null, "offerForm"), [i18n, formLang]);
  const editing = Boolean(initial?.id);

  const [form, setForm] = useState(() => initForm(initial, categories));
  const [priv, setPriv] = useState(() => (partner ? { ...EMPTY_CONTACT, ...cleanTo(privateInitial, EMPTY_CONTACT) } : { ...EMPTY_PRIVATE, ...clean(privateInitial) }));
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const [touched, setTouched] = useState(false);
  const [previewMode, setPreviewMode] = useState("normal");
  const [catDialog, setCatDialog] = useState(false);
  const fileRef = useRef(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));
  const setP = (k) => (e) => setPriv((p) => ({ ...p, [k]: e.target.value }));
  const meta = getTypeMeta(form.type);

  const catName = (c) => (formLang !== "ar" && c[`name_${formLang}`]) || c.name_ar || c.slug;
  const sortedCats = useMemo(
    () => [...categories].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || catName(a).localeCompare(catName(b))),
    [categories, formLang] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return setUploadErr(t("errors.image"));
    if (partner && !["image/png", "image/jpeg", "image/webp"].includes(file.type)) return setUploadErr(t("errors.logoType"));
    if (partner && file.size > 1024 * 1024) return setUploadErr(t("errors.logoSize"));
    setUploadErr("");
    setUploading(true);
    try {
      const url = await (uploadLogoProp || uploadLogo)(file);
      setForm((f) => ({ ...f, logo: url }));
    } catch (err) {
      setUploadErr(err.message === "logo_type" ? t("errors.logoType") : err.message === "logo_size" ? t("errors.logoSize") : err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // تنبيهات (لا تمنع الحفظ)
  const strength = form.premium_discount.trim() ? premiumIsStronger(form.discount, form.premium_discount) : null;
  const badUrl = (v) => v && v.trim() && !/^https:\/\//i.test(v.trim());
  const urlWarn = (k) => (badUrl(k in form ? form[k] : priv[k]) ? t("warn.https") : null);

  const missing = {
    name: !form.name.trim(),
    discount: !form.discount.trim(),
    code: !form.code.trim(),
  };
  if (partner) missing.whatsapp = !priv.whatsapp.trim();
  const valid = !missing.name && !missing.discount && !missing.code && !missing.whatsapp;

  const submit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (!valid || uploading) {
      document.querySelector("[data-invalid='true']")?.focus();
      return;
    }
    const selected = categories.find((c) => c.id === form.category_id);
    const company = {
      ...form,
      category_id: form.category_id || null,
      // النص category يطابق اسم الفئة العربي (توافق مع الكود القديم)
      category: selected ? selected.name_ar || "" : "",
    };
    onSubmit(company, showPrivate || partner ? priv : null);
  };

  // بطاقة المعاينة = نفس CompanyCard اللي في /offers
  const previewCompany = {
    ...(initial || {}),
    ...form,
    id: initial?.id ?? 0,
    clicks: initial?.clicks ?? 0,
    name: form.name || t("preview.namePh"),
    discount: form.discount || "20%",
    code: form.code || "ILYES10",
    category: categories.find((c) => c.id === form.category_id)?.name_ar || "",
    // بلا كود Premium → البطاقة مجمّدة في وضع Premium (نفس قاعدة الموقع)
    has_premium_code: !!String(form.premium_code || "").trim(),
    // نعرض النص العربي المكتوب (لا الترجمة القديمة) حتى تتبدّل المعاينة وأنت تكتب
    description_en: null,
    description_fr: null,
    discount_en: null,
    discount_fr: null,
    premium_discount_en: null,
    premium_discount_fr: null,
    premium_description_en: null,
    premium_description_fr: null,
  };

  return (
    <form onSubmit={submit} noValidate className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex min-w-0 flex-col gap-5">
        {/* 1) الشركة */}
        <Section icon={Building2} title={t("s.company")} sub={t("s.companySub")}>
          <div className="flex flex-wrap items-center gap-4">
            <CompanyLogo logo={form.logo} name={form.name} size={72} accent={meta.color} />
            <div className="min-w-0 flex-1">
              <input ref={fileRef} type="file" accept={logoAccept} onChange={handleFile} className="hidden" id="cof-logo" />
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="cof-logo" className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-[13.5px] font-bold text-white transition-colors hover:bg-white/[0.08]">
                  {uploading ? <Loader2 size={16} className="animate-spin text-[var(--color-lime)]" /> : <ImagePlus size={16} className="text-[var(--color-lime)]" />}
                  {uploading ? t("logo.uploading") : form.logo ? t("logo.change") : t("logo.upload")}
                </label>
                {form.logo && !uploading && (
                  <button type="button" onClick={() => setForm((f) => ({ ...f, logo: "" }))} className="flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-[#6b7280] transition-colors hover:text-red-400">
                    <X size={15} /> {t("logo.remove")}
                  </button>
                )}
              </div>
              <Hint>{partner ? t("logo.hintPartner") : t("logo.hint")}</Hint>
              {uploadErr && <p className="mt-1 text-[12px] font-semibold text-red-400">{uploadErr}</p>}
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label={t("f.name")} required hint={t("h.name")} error={touched && missing.name ? t("errors.required") : null}>
              {(p) => <input {...p} value={form.name} onChange={set("name")} className={inputCls} dir="auto" />}
            </Field>
            <Field label={t("f.category")} hint={partner ? t("partner.hCategory") : t("h.category")}>
              {(p) => (
                <div className="flex gap-2">
                  <select {...p} value={form.category_id || ""} onChange={set("category_id")} className={`${inputCls} cursor-pointer`}>
                    <option value="" className="bg-[#0b0b0d]">
                      {t("f.noCategory")}
                    </option>
                    {sortedCats.map((c) => (
                      <option key={c.id} value={c.id} className="bg-[#0b0b0d]">
                        {catName(c)}
                      </option>
                    ))}
                  </select>
                  {onCreateCategory && (
                    <button type="button" onClick={() => setCatDialog(true)} className="flex shrink-0 items-center gap-1.5 rounded-xl border border-white/[0.08] px-3 text-[13px] font-bold text-[var(--color-lime)] transition-colors hover:bg-white/[0.05]">
                      <Plus size={15} /> {t("f.newCategory")}
                    </button>
                  )}
                </div>
              )}
            </Field>
            {(showPrivate || partner) && (
              <Field label={t("f.website")} hint={partner ? t("h.websitePartner") : t("h.website")} warn={urlWarn("website_url")} className="sm:col-span-2">
                {(p) => <input {...p} value={priv.website_url} onChange={setP("website_url")} placeholder="https://" className={inputCls} dir="ltr" inputMode="url" />}
              </Field>
            )}
          </div>
        </Section>

        {/* 2) نوع العرض */}
        <Section icon={Tag} title={t("s.type")} sub={t("s.typeSub")}>
          <div role="radiogroup" aria-label={t("s.type")} className="grid grid-cols-3 gap-2.5">
            {TYPES.map((tp) => {
              const m = getTypeMeta(tp.value);
              const active = form.type === tp.value;
              return (
                <button
                  key={tp.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setForm((f) => ({ ...f, type: tp.value }))}
                  className="flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3.5 text-[13.5px] font-extrabold transition-all"
                  style={{
                    borderColor: active ? m.color : "rgba(255,255,255,0.08)",
                    background: active ? `${m.color}1f` : "rgba(255,255,255,0.02)",
                    color: active ? m.color : "#a1a1aa",
                    boxShadow: active ? `0 10px 30px -16px ${m.color}` : "none",
                  }}
                >
                  <tp.icon size={20} />
                  {t(`types.${tp.key}`)}
                </button>
              );
            })}
          </div>
        </Section>

        {/* 3) العرض العادي */}
        <section className="rounded-[20px] border p-5 sm:p-6" style={{ borderColor: `${meta.color}55`, background: `linear-gradient(160deg, ${meta.color}14, transparent 55%), rgba(255,255,255,0.02)` }}>
          <SectionHead icon={Gift} color={meta.color} title={t("s.free")} sub={t("s.freeSub")} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("f.discount")} required hint={t("h.discount")} error={touched && missing.discount ? t("errors.required") : null}>
              {(p) => <input {...p} value={form.discount} onChange={set("discount")} className={inputCls} dir="auto" />}
            </Field>
            <Field label={t("f.code")} required hint={partner ? t("partner.hCode") : t("h.code")} error={touched && missing.code ? t("errors.required") : null}>
              {(p) => <input {...p} value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} className={`${inputCls} font-mono tracking-wider`} dir="ltr" autoCapitalize="characters" spellCheck={false} />}
            </Field>
            <Field label={t("f.link")} hint={t("h.link")} warn={urlWarn("link")} className="sm:col-span-2">
              {(p) => <input {...p} value={form.link} onChange={set("link")} placeholder="https://" className={inputCls} dir="ltr" inputMode="url" />}
            </Field>
            <Field label={t("f.description")} hint={partner ? t("partner.hDescription") : t("h.description")} className="sm:col-span-2">
              {(p) => <textarea {...p} value={form.description} onChange={set("description")} rows={3} className={`${inputCls} resize-y`} dir="auto" />}
            </Field>
          </div>
        </section>

        {/* 4) عرض Premium */}
        <section className="rounded-[20px] border p-5 sm:p-6" style={{ borderColor: `${GOLD}55`, background: `linear-gradient(160deg, ${GOLD}1a, transparent 55%), rgba(255,255,255,0.02)` }}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <SectionHead icon={Crown} color={GOLD} title={t("s.premium")} sub={t("s.premiumSub")} />
            <Switch checked={form.supports_premium !== false} onChange={(v) => setForm((f) => ({ ...f, supports_premium: v }))} label={t("f.supportsPremium")} />
          </div>
          <div className={`grid gap-4 transition-opacity sm:grid-cols-2 ${form.supports_premium === false ? "opacity-45" : ""}`}>
            <Field label={t("f.premiumDiscount")} hint={t("h.premiumDiscount")} warn={strength === false ? t("warn.weaker") : null}>
              {(p) => <input {...p} value={form.premium_discount} onChange={set("premium_discount")} placeholder={form.discount || ""} className={inputCls} dir="auto" />}
            </Field>
            <Field
              label={t("f.premiumCode")}
              hint={partner ? t("partner.hPremiumCode") : t("h.premiumCode")}
              warn={form.supports_premium !== false && !String(form.premium_code || "").trim() ? t("warn.frozen") : null}
            >
              {(p) => (
                <div className="flex gap-2">
                  <input {...p} value={form.premium_code} onChange={(e) => setForm((f) => ({ ...f, premium_code: e.target.value.toUpperCase() }))} placeholder={form.code || ""} className={`${inputCls} font-mono tracking-wider`} dir="ltr" spellCheck={false} />
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, premium_code: suggestCode(f.name) }))}
                    className="flex shrink-0 items-center gap-1.5 rounded-xl border px-3 text-[13px] font-bold transition-colors hover:bg-white/[0.04]"
                    style={{ borderColor: `${GOLD}55`, color: GOLD_SOFT }}
                  >
                    <Wand2 size={15} /> {t("f.suggest")}
                  </button>
                </div>
              )}
            </Field>
            <Field label={t("f.premiumUrl")} hint={t("h.premiumUrl")} warn={urlWarn("premium_url")} className="sm:col-span-2">
              {(p) => <input {...p} value={form.premium_url} onChange={set("premium_url")} placeholder={form.link || "https://"} className={inputCls} dir="ltr" inputMode="url" />}
            </Field>
            <Field label={t("f.premiumDescription")} hint={partner ? t("partner.hPremiumDescription") : t("h.premiumDescription")} className="sm:col-span-2">
              {(p) => <textarea {...p} value={form.premium_description} onChange={set("premium_description")} rows={3} placeholder={form.description || ""} className={`${inputCls} resize-y`} dir="auto" />}
            </Field>
          </div>
          <p className="mt-4 flex items-start gap-2 text-[12.5px] leading-relaxed text-[#a1a1aa]">
            <Sparkles size={14} className="mt-0.5 shrink-0" style={{ color: GOLD }} /> {t("h.fallback")}
          </p>
        </section>

        {/* 5) معلومات داخلية */}
        {showPrivate && (
          <Section icon={Lock} title={t("s.private")} sub={t("s.privateSub")} badge={t("s.adminOnly")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("f.contactName")} hint={t("h.contactName")}>
                {(p) => <input {...p} value={priv.contact_name} onChange={setP("contact_name")} className={inputCls} dir="auto" autoComplete="off" />}
              </Field>
              <Field label={t("f.whatsapp")} hint={t("h.whatsapp")}>
                {(p) => <input {...p} value={priv.whatsapp} onChange={setP("whatsapp")} className={inputCls} dir="ltr" inputMode="tel" autoComplete="off" />}
              </Field>
              <Field label={t("f.email")} hint={t("h.email")}>
                {(p) => <input {...p} type="email" value={priv.email} onChange={setP("email")} className={inputCls} dir="ltr" autoComplete="off" />}
              </Field>
              <Field label={t("f.commission")} hint={t("h.commission")}>
                {(p) => <input {...p} type="number" min="0" max="100" step="0.5" value={priv.commission_pct} onChange={setP("commission_pct")} className={inputCls} dir="ltr" />}
              </Field>
              <Field label={t("partner.fAffiliateUrl")} hint={t("partner.hAffiliateUrl")} warn={urlWarn("affiliate_url")} className="sm:col-span-2">
                {(p) => <input {...p} value={priv.affiliate_url} onChange={setP("affiliate_url")} placeholder="https://" className={inputCls} dir="ltr" inputMode="url" autoComplete="off" />}
              </Field>
              <Field label={t("f.affiliate")} hint={t("h.affiliate")} warn={urlWarn("affiliate_dashboard_url")} className="sm:col-span-2">
                {(p) => <input {...p} value={priv.affiliate_dashboard_url} onChange={setP("affiliate_dashboard_url")} placeholder="https://" className={inputCls} dir="ltr" inputMode="url" autoComplete="off" />}
              </Field>
              <Field label={t("f.notes")} hint={t("h.notes")} className="sm:col-span-2">
                {(p) => <textarea {...p} value={priv.notes} onChange={setP("notes")} rows={3} className={`${inputCls} resize-y`} dir="auto" />}
              </Field>
            </div>
          </Section>
        )}

        {/* 5ب) التواصل والشراكة (الشركة) */}
        {partner && (
          <Section icon={Handshake} title={t("partner.sContact")} sub={t("partner.sContactSub")}>
            <p role="note" className="mb-4 flex items-start gap-2.5 rounded-xl border border-[#fbbf24]/40 bg-[#fbbf24]/[0.08] px-3.5 py-3 text-[13px] font-bold leading-relaxed text-[#fde68a]">
              <ShieldAlert size={17} className="mt-0.5 shrink-0" /> {t("partner.noPasswords")}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("f.contactName")} hint={t("partner.hContactName")}>
                {(p) => <input {...p} value={priv.contact_name} onChange={setP("contact_name")} className={inputCls} dir="auto" autoComplete="name" />}
              </Field>
              <Field label={t("f.whatsapp")} required hint={t("h.whatsapp")} error={touched && missing.whatsapp ? t("errors.required") : null}>
                {(p) => <input {...p} value={priv.whatsapp} onChange={setP("whatsapp")} className={inputCls} dir="ltr" inputMode="tel" autoComplete="tel" />}
              </Field>
              <Field label={t("f.email")} hint={t("h.email")}>
                {(p) => <input {...p} type="email" value={priv.contact_email} onChange={setP("contact_email")} className={inputCls} dir="ltr" autoComplete="email" />}
              </Field>
              <Field label={t("f.commission")} hint={t("partner.hCommission")}>
                {(p) => <input {...p} type="number" min="0" max="100" step="0.5" value={priv.commission_pct} onChange={setP("commission_pct")} className={inputCls} dir="ltr" />}
              </Field>
              <Field label={t("partner.fAffiliateUrl")} hint={t("partner.hAffiliateUrl")} warn={urlWarn("affiliate_url")} className="sm:col-span-2">
                {(p) => <input {...p} value={priv.affiliate_url} onChange={setP("affiliate_url")} placeholder="https://" className={inputCls} dir="ltr" inputMode="url" autoComplete="off" />}
              </Field>
              <Field label={t("f.affiliate")} hint={t("h.affiliate")} warn={urlWarn("affiliate_dashboard_url")} className="sm:col-span-2">
                {(p) => <input {...p} value={priv.affiliate_dashboard_url} onChange={setP("affiliate_dashboard_url")} placeholder="https://" className={inputCls} dir="ltr" inputMode="url" autoComplete="off" />}
              </Field>
              <Field label={t("partner.fMessage")} hint={t("partner.hMessage")} className="sm:col-span-2">
                {(p) => <textarea {...p} value={priv.message} onChange={setP("message")} rows={3} maxLength={2000} className={`${inputCls} resize-y`} dir="auto" />}
              </Field>
            </div>
          </Section>
        )}
        {/* honeypot داخل حاوية بلا حجم: موضعه البعيد ما يوسّعش الصفحة (RTL) */}
        {trap && <div className="relative h-0 overflow-hidden">{trap}</div>}

        {/* الحفظ */}
        <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-2 rounded-2xl border border-white/[0.08] bg-[#0b0b0d]/90 p-3 backdrop-blur-xl">
          <button
            type="submit"
            disabled={submitting || uploading}
            className="flex items-center gap-2 rounded-xl px-5 py-3 text-[14.5px] font-extrabold text-[#0a0a0a] transition-transform hover:scale-[1.01] disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" }}
          >
            {submitting ? <Loader2 size={17} className="animate-spin" /> : editing ? <Save size={17} /> : <Plus size={17} />}
            {submitLabel || (editing ? t("save") : t("add"))}
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel} className="rounded-xl border border-white/[0.08] px-4 py-3 text-[14px] font-bold text-[#c9c9cf] transition-colors hover:bg-white/[0.05]">
              {t("cancel")}
            </button>
          )}
          {touched && !valid && <span className="text-[12.5px] font-semibold text-red-400">{t("errors.fixFields")}</span>}
        </div>
      </div>

      {/* المعاينة الحية */}
      <aside className="xl:sticky xl:top-6" aria-label={t("preview.title")}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-[14px] font-extrabold text-white">{t("preview.title")}</h2>
          <div role="radiogroup" aria-label={t("preview.title")} className="inline-flex rounded-xl border border-white/[0.08] bg-black/30 p-1">
            {["normal", "premium"].map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={previewMode === m}
                onClick={() => setPreviewMode(m)}
                className="rounded-lg px-3 py-1 text-[12.5px] font-bold transition-colors"
                style={previewMode === m ? { background: m === "premium" ? `linear-gradient(135deg, ${GOLD_SOFT}, ${GOLD})` : meta.color, color: "#0a0a0a" } : { color: "#a1a1aa" }}
              >
                {m === "premium" ? t("preview.premium") : t("preview.normal")}
              </button>
            ))}
          </div>
        </div>
        <Inert>
          <CompanyCard
            company={previewCompany}
            index={0}
            isFavorite={false}
            onToggleFav={() => {}}
            onCopy={() => {}}
            premium={previewMode === "premium"}
            unlocked={false}
            linkToStore={false}
          />
        </Inert>
        <p className="mt-3 text-[12px] leading-relaxed text-[#6b7280]">
          {previewMode === "premium"
            ? form.supports_premium === false
              ? t("preview.premiumOff")
              : !String(form.premium_code || "").trim()
              ? t("preview.premiumFrozen")
              : t("preview.premiumNote", { code: form.premium_code })
            : t("preview.normalNote")}
        </p>
      </aside>

      <AnimatePresence>
        {catDialog && (
          <NewCategoryDialog
            t={t}
            onClose={() => setCatDialog(false)}
            onCreate={async (name) => {
              const created = await onCreateCategory(name);
              if (created?.id) setForm((f) => ({ ...f, category_id: created.id }));
              setCatDialog(false);
            }}
          />
        )}
      </AnimatePresence>
    </form>
  );
}

function initForm(initial, categories) {
  const base = { ...EMPTY };
  for (const k of Object.keys(EMPTY)) if (initial?.[k] != null) base[k] = initial[k];
  if (!base.category_id && initial?.category) {
    const match = categories.find((c) => c.name_ar === initial.category);
    if (match) base.category_id = match.id;
  }
  return base;
}
const cleanTo = (o, shape) => Object.fromEntries(Object.entries(o || {}).filter(([k, v]) => k in shape && v != null).map(([k, v]) => [k, String(v)]));
const clean = (o) => Object.fromEntries(Object.entries(o || {}).filter(([k, v]) => k in EMPTY_PRIVATE && v != null).map(([k, v]) => [k, String(v)]));

const inputCls =
  "w-full rounded-xl border border-white/[0.08] bg-black/40 px-3.5 py-2.5 text-[14px] font-medium text-white outline-none transition-colors placeholder:text-[#4b4b52] focus:border-[var(--color-lime)]/70 aria-[invalid=true]:border-red-500/70";

function Section({ icon, title, sub, badge, children }) {
  return (
    <section className="rounded-[20px] border border-white/[0.07] bg-white/[0.025] p-5 backdrop-blur-xl sm:p-6">
      <SectionHead icon={icon} color="var(--color-lime)" title={title} sub={sub} badge={badge} />
      {children}
    </section>
  );
}

function SectionHead({ icon: Icon, color, title, sub, badge }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: "rgba(255,255,255,0.04)", color }}>
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <h2 className="flex flex-wrap items-center gap-2 text-[16px] font-extrabold text-white">
          {title}
          {badge && <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] font-bold text-[#a1a1aa]">{badge}</span>}
        </h2>
        {sub && <p className="mt-0.5 text-[12.5px] text-[#6b7280]">{sub}</p>}
      </div>
    </div>
  );
}

let fieldSeq = 0;
function Field({ label, required, hint, warn, error, className = "", children }) {
  const [id] = useState(() => `cof-${++fieldSeq}`);
  const describedBy = [hint && `${id}-h`, (warn || error) && `${id}-w`].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-bold text-[#c9c9cf]">
        {label}
        {required && <span className="ms-1 text-[var(--color-lime)]">*</span>}
      </label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? "true" : undefined, "data-invalid": error ? "true" : undefined })}
      {hint && <Hint id={`${id}-h`}>{hint}</Hint>}
      {(error || warn) && (
        <p id={`${id}-w`} className={`mt-1.5 flex items-start gap-1.5 text-[12px] font-semibold ${error ? "text-red-400" : "text-[#fbbf24]"}`}>
          <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {error || warn}
        </p>
      )}
    </div>
  );
}

function Hint({ id, children }) {
  return (
    <p id={id} className="mt-1.5 text-[12px] leading-relaxed text-[#6b7280]">
      {children}
    </p>
  );
}

function Switch({ checked, onChange, label }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2 text-[13px] font-bold text-[#c9c9cf]">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative h-6 w-11 rounded-full transition-colors"
        style={{ background: checked ? GOLD : "rgba(255,255,255,0.12)" }}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </label>
  );
}

/** المعاينة غير تفاعلية (لا نسخ ولا تصويت ولا تركيز بالكيبورد). */
function Inert({ children }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.setAttribute("inert", "");
  }, []);
  return (
    <div ref={ref} aria-hidden="true" className="pointer-events-none select-none">
      {children}
    </div>
  );
}

/** نافذة صغيرة لإضافة فئة بلا الخروج من الفورم. */
function NewCategoryDialog({ t, onClose, onCreate }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const inputRef = useRef(null);
  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = async () => {
    if (!name.trim()) return setErr(t("errors.required"));
    setBusy(true);
    setErr("");
    try {
      await onCreate(name.trim());
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  };

  return (
    <motion.div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 px-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cof-cat-title"
        initial={{ y: 16, scale: 0.97 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 10, scale: 0.98 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-[20px] border border-white/[0.08] bg-[#0f0f12] p-5"
      >
        <h3 id="cof-cat-title" className="text-[16px] font-extrabold text-white">
          {t("cat.title")}
        </h3>
        <p className="mt-1 text-[12.5px] text-[#6b7280]">{t("cat.sub")}</p>
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            }
          }}
          placeholder={t("cat.placeholder")}
          aria-label={t("cat.title")}
          className={`${inputCls} mt-4`}
          dir="auto"
        />
        {err && <p className="mt-2 text-[12px] font-semibold text-red-400">{err}</p>}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-[14px] font-extrabold text-[#0a0a0a] disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" }}
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} {t("cat.save")}
          </button>
          <button type="button" onClick={onClose} className="rounded-xl border border-white/[0.08] px-4 py-2.5 text-[14px] font-bold text-[#c9c9cf]">
            {t("cancel")}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/**
 * معاينة بطاقة عرض (نفس CompanyCard اللي في /offers) — غير تفاعلية.
 * offer: سطر شركة أو طلب (company_name / name، discount / title…). premium: وجه Premium.
 */
export function OfferPreview({ offer, premium = false }) {
  const company = {
    ...offer,
    // رقم الطلب ماشي رقم شركة: نستعمل الشركة المرتبطة فقط (وإلا لا إحصائيات تصويت دخيلة)
    id: offer?.company_id || -1,
    clicks: 0,
    name: offer?.name || offer?.company_name || "—",
    discount: offer?.discount || offer?.title || "—",
    code: offer?.code || "—",
    has_premium_code: offer?.has_premium_code ?? !!String(offer?.premium_code || "").trim(),
    description_en: null,
    description_fr: null,
    discount_en: null,
    discount_fr: null,
    premium_discount_en: null,
    premium_discount_fr: null,
    premium_description_en: null,
    premium_description_fr: null,
  };
  return (
    <Inert>
      <CompanyCard company={company} index={0} isFavorite={false} onToggleFav={() => {}} onCopy={() => {}} premium={premium} unlocked={false} linkToStore={false} />
    </Inert>
  );
}
