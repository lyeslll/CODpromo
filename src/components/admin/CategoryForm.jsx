import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Loader2, X, Plus, Save, Hash, AlertTriangle } from "lucide-react";

// القيم الافتراضية لفئة جديدة. المصدر العربي (name_ar) إجباري، والباقي اختياري.
const EMPTY = {
  name_ar: "",
  icon: "",
  description_ar: "",
  sort_order: 0,
  is_active: true,
  slug: "",
};

export default function CategoryForm({ initial, onSubmit, onCancel, submitting }) {
  const [form, setForm] = useState(EMPTY);
  const [touched, setTouched] = useState(false);
  const editing = Boolean(initial?.id);

  useEffect(() => {
    setForm(initial ? { ...EMPTY, ...initial } : EMPTY);
    setTouched(false);
  }, [initial]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const valid = form.name_ar.trim();
  // هل غيّر المستخدم الـ slug يدوياً عن قيمته الأصلية؟ (لإظهار التنبيه فقط عند التعديل)
  const slugChanged = editing && (form.slug || "").trim() !== (initial?.slug || "");

  const submit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    const payload = { ...form };
    // عند الإضافة: لا نرسل slug إطلاقاً — يتولّد مرّة واحدة تلقائياً في addCategory.
    // عند التعديل: نرسله فقط إن غيّره المستخدم صراحةً، حتى لا يتغيّر تلقائياً مع تغيّر الاسم.
    if (!editing || !slugChanged) delete payload.slug;
    onSubmit(payload);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      {/* الاسم بالعربية (المصدر) */}
      <Field label="اسم الفئة (بالعربية)" required error={touched && !valid && "الاسم مطلوب"}>
        <input
          value={form.name_ar}
          onChange={set("name_ar")}
          placeholder="مثال: متاجر إلكترونية"
          className={inputCls}
        />
        <span className="mt-1.5 block text-[11.5px] text-[var(--color-mute)]">
          تُترجَم تلقائياً للإنجليزية والفرنسية عند الحفظ.
        </span>
      </Field>

      {/* الأيقونة + ترتيب العرض */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="الأيقونة (اختياري)">
          <input
            value={form.icon || ""}
            onChange={set("icon")}
            placeholder="🛍️ أو اسم أيقونة"
            className={inputCls}
          />
        </Field>
        <Field label="ترتيب العرض">
          <input
            type="number"
            value={form.sort_order ?? 0}
            onChange={set("sort_order")}
            className={inputCls}
          />
        </Field>
      </div>

      {/* الوصف */}
      <Field label="الوصف (اختياري)">
        <textarea
          value={form.description_ar || ""}
          onChange={set("description_ar")}
          rows={2}
          placeholder="وصف مختصر يظهر في رأس صفحة الفئة…"
          className={`${inputCls} resize-none`}
        />
      </Field>

      {/* المعرّف (slug) — للتعديل فقط، مع تنبيه عند تغييره */}
      {editing && (
        <Field label="المعرّف (slug)">
          <div className="relative flex items-center">
            <Hash size={14} className="pointer-events-none absolute right-3 text-[var(--color-mute)]" />
            <input
              value={form.slug || ""}
              onChange={set("slug")}
              dir="ltr"
              className={`${inputCls} pr-9 text-left font-mono tracking-wide`}
            />
          </div>
          {slugChanged && (
            <span className="mt-1.5 flex items-start gap-1.5 text-[11.5px] font-semibold text-orange-400">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              تغيير المعرّف يكسر الروابط القديمة لصفحة هذه الفئة.
            </span>
          )}
        </Field>
      )}

      {/* تفعيل/إخفاء */}
      <div className="flex items-center justify-between rounded-xl border border-[var(--color-ink-line)] bg-white/[0.02] p-3">
        <span className="text-[13px] font-bold text-[var(--text)]">الفئة مفعّلة (تظهر للزوار)؟</span>
        <button
          type="button"
          onClick={() => setForm((f) => ({ ...f, is_active: !(f.is_active !== false) }))}
          className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
          style={{ background: form.is_active !== false ? "var(--color-lime)" : "var(--color-ink-line)" }}
          aria-pressed={form.is_active !== false}
        >
          <span
            className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all"
            style={{ insetInlineStart: form.is_active !== false ? 22 : 2 }}
          />
        </button>
      </div>

      {/* أزرار */}
      <div className="mt-1 flex items-center gap-2">
        <motion.button
          type="submit"
          whileTap={{ scale: 0.98 }}
          disabled={submitting}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3 text-[14.5px] font-extrabold text-[#0a0a0a] disabled:opacity-60"
          style={{ background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" }}
        >
          {submitting ? (
            <Loader2 size={17} className="animate-spin" />
          ) : editing ? (
            <Save size={17} />
          ) : (
            <Plus size={18} />
          )}
          {editing ? "حفظ التعديلات" : "إضافة الفئة"}
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
