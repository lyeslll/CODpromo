import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  ImagePlus,
  Loader2,
  X,
  Check,
  Tag,
  Ticket,
  Wallet,
  Plus,
  Save,
  Crown,
} from "lucide-react";
import { uploadLogo } from "../../lib/supabase.js";
import CompanyLogo from "../CompanyLogo.jsx";
import { getTypeMeta } from "../../lib/types.js";

const TYPES = ["تخفيض", "كوبون", "كاش باك"];
const TYPE_ICON = { "تخفيض": Tag, "كوبون": Ticket, "كاش باك": Wallet };

const EMPTY = {
  name: "",
  description: "",
  discount: "",
  premium_discount: "",
  premium_code: "",
  premium_url: "",
  supports_premium: true,
  type: "تخفيض",
  code: "",
  link: "",
  category: "",
  logo: "",
};

export default function CompanyForm({ initial, onSubmit, onCancel, submitting }) {
  const [form, setForm] = useState(EMPTY);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const [touched, setTouched] = useState(false);
  const fileRef = useRef(null);

  const editing = Boolean(initial?.id);

  useEffect(() => {
    setForm(initial ? { ...EMPTY, ...initial } : EMPTY);
    setUploadErr("");
    setTouched(false);
  }, [initial]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadErr("الملف يجب أن يكون صورة");
      return;
    }
    setUploadErr("");
    setUploading(true);
    try {
      const url = await uploadLogo(file);
      setForm((f) => ({ ...f, logo: url }));
    } catch (err) {
      setUploadErr(err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const valid = form.name.trim() && form.code.trim() && form.discount.trim();

  const submit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (!valid || uploading) return;
    onSubmit(form);
  };

  const meta = getTypeMeta(form.type);

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      {/* رفع اللوجو */}
      <div>
        <Label>لوجو الشركة</Label>
        <div className="flex items-center gap-4">
          <CompanyLogo logo={form.logo} name={form.name} size={72} accent={meta.color} />
          <div className="flex-1">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleFile}
              className="hidden"
              id="logo-input"
            />
            <div className="flex flex-wrap items-center gap-2">
              <label
                htmlFor="logo-input"
                className="flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--color-ink-line)] bg-white/[0.04] px-4 py-2.5 text-[13.5px] font-bold text-white transition-colors hover:bg-white/[0.08]"
              >
                {uploading ? (
                  <Loader2 size={16} className="animate-spin text-[var(--color-lime)]" />
                ) : (
                  <ImagePlus size={16} className="text-[var(--color-lime)]" />
                )}
                {uploading ? "جارٍ الرفع…" : form.logo ? "تغيير الصورة" : "رفع صورة"}
              </label>
              {form.logo && (
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, logo: "" }))}
                  className="flex items-center gap-1 rounded-xl border border-[var(--color-ink-line)] px-3 py-2.5 text-[13px] font-semibold text-[var(--color-mute)] transition-colors hover:text-red-400"
                >
                  <X size={14} /> إزالة
                </button>
              )}
            </div>
            <p className="mt-2 text-[11.5px] text-[var(--color-mute)]">
              PNG / JPG / SVG · تُرفع إلى حاوية logos العامة
            </p>
            {uploadErr && (
              <p className="mt-1 text-[12px] font-semibold text-red-400">{uploadErr}</p>
            )}
          </div>
        </div>
      </div>

      {/* الاسم */}
      <Field label="اسم الشركة" required error={touched && !form.name.trim() && "الاسم مطلوب"}>
        <input
          value={form.name}
          onChange={set("name")}
          placeholder="مثال: YouCan"
          className={inputCls}
        />
      </Field>

      {/* الوصف */}
      <Field label="الوصف">
        <textarea
          value={form.description}
          onChange={set("description")}
          placeholder="وصف مختصر للشركة أو العرض…"
          rows={2}
          className={`${inputCls} resize-none`}
        />
      </Field>

      {/* النوع */}
      <Field label="نوع العرض" required>
        <div className="grid grid-cols-3 gap-2">
          {TYPES.map((t) => {
            const tm = getTypeMeta(t);
            const Icon = TYPE_ICON[t];
            const active = form.type === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setForm((f) => ({ ...f, type: t }))}
                className="relative flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-[13px] font-bold transition-all"
                style={{
                  borderColor: active ? tm.color : "var(--color-ink-line)",
                  background: active ? `${tm.color}1a` : "transparent",
                  color: active ? tm.color : "#c9c9cf",
                }}
              >
                <Icon size={14} />
                {t}
              </button>
            );
          })}
        </div>
      </Field>

      {/* قيمة العرض + الكود */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="قيمة العرض" required error={touched && !form.discount.trim() && "مطلوب"}>
          <input
            value={form.discount}
            onChange={set("discount")}
            placeholder="20% أو 20$"
            className={inputCls}
          />
        </Field>
        <Field label="كود الخصم" required error={touched && !form.code.trim() && "مطلوب"}>
          <input
            value={form.code}
            onChange={set("code")}
            placeholder="SAVE20"
            className={`${inputCls} font-mono tracking-wider`}
          />
        </Field>
      </div>

      {/* خصم Premium */}
      <label className="block rounded-xl border p-3" style={{ borderColor: "rgba(207,154,30,0.4)", background: "rgba(240,198,60,0.06)" }}>
        <span className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-bold" style={{ color: "#cf9a1e" }}>
          <Crown size={14} /> خصم Premium (الأقوى)
        </span>
        <input
          value={form.premium_discount}
          onChange={set("premium_discount")}
          placeholder="مثال: 10% أو 100 دج"
          className={inputCls}
        />
        <span className="mt-1 block text-[11px] text-[var(--color-mute)]">يظهر لأعضاء Premium بدل الخصم العادي. اتركه فارغاً ليبقى نفس الخصم.</span>

        {/* كود ورابط Premium — متناظران مع العادي، مع fallback عند الفراغ */}
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <span className="mb-1.5 block text-[11.5px] font-bold" style={{ color: "#cf9a1e" }}>كود الخصم Premium</span>
            <input
              value={form.premium_code}
              onChange={set("premium_code")}
              placeholder="مثل: PREMIUM50"
              className={`${inputCls} font-mono tracking-wider`}
            />
          </div>
          <div>
            <span className="mb-1.5 block text-[11.5px] font-bold" style={{ color: "#cf9a1e" }}>رابط Premium</span>
            <input
              value={form.premium_url}
              onChange={set("premium_url")}
              dir="ltr"
              placeholder="https://… (اختياري)"
              className={`${inputCls} text-left`}
            />
          </div>
        </div>
        <span className="mt-1 block text-[11px] text-[var(--color-mute)]">اتركهما فارغين لاستعمال كود ورابط العرض العادي.</span>

        {/* تدعم Premium؟ */}
        <div className="mt-3 flex items-center justify-between border-t pt-3" style={{ borderColor: "rgba(207,154,30,0.25)" }}>
          <span className="flex items-center gap-1.5 text-[13px] font-bold text-[var(--text)]">
            <Crown size={14} style={{ color: "#cf9a1e" }} /> تظهر هذه الشركة بهوية Premium؟
          </span>
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, supports_premium: !(f.supports_premium !== false) }))}
            className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
            style={{ background: form.supports_premium !== false ? "#cf9a1e" : "var(--color-ink-line)" }}
            aria-pressed={form.supports_premium !== false}
          >
            <span
              className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all"
              style={{ insetInlineStart: form.supports_premium !== false ? 22 : 2 }}
            />
          </button>
        </div>
      </label>

      {/* الفئة + الرابط */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="الفئة">
          <input
            value={form.category}
            onChange={set("category")}
            placeholder="متجر، دفع، استضافة…"
            className={inputCls}
          />
        </Field>
        <Field label="رابط الموقع">
          <input
            value={form.link}
            onChange={set("link")}
            placeholder="https://example.com"
            dir="ltr"
            className={`${inputCls} text-left`}
          />
        </Field>
      </div>

      {/* أزرار */}
      <div className="mt-1 flex items-center gap-2">
        <motion.button
          type="submit"
          whileTap={{ scale: 0.98 }}
          disabled={submitting || uploading}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3 text-[14.5px] font-extrabold text-[#0a0a0a] disabled:opacity-60"
          style={{
            background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))",
          }}
        >
          {submitting ? (
            <Loader2 size={17} className="animate-spin" />
          ) : editing ? (
            <Save size={17} />
          ) : (
            <Plus size={18} />
          )}
          {editing ? "حفظ التعديلات" : "إضافة الشركة"}
        </motion.button>
        {editing && (
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-1.5 rounded-xl border border-[var(--color-ink-line)] px-4 py-3 text-[14px] font-bold text-white transition-colors hover:bg-white/5"
          >
            <X size={16} /> إلغاء
          </button>
        )}
      </div>
    </form>
  );
}

const inputCls =
  "w-full rounded-xl border border-[var(--color-ink-line)] bg-[#0c0c0e] px-3.5 py-2.5 text-[14px] font-medium text-white outline-none transition-colors placeholder:text-[#4b4b52] focus:border-[var(--color-lime)]";

function Label({ children }) {
  return (
    <span className="mb-1.5 block text-[12.5px] font-bold text-[#c9c9cf]">{children}</span>
  );
}

function Field({ label, required, error, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1 text-[12.5px] font-bold text-[#c9c9cf]">
        {label}
        {required && <span className="text-[var(--color-lime)]">*</span>}
        {error && <span className="mr-auto text-[11.5px] text-red-400">{error}</span>}
      </span>
      {children}
    </label>
  );
}
