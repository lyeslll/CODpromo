import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  Mail,
  Globe,
  Phone,
  Loader2,
  ImagePlus,
  X,
  Send,
  PlusCircle,
  Clock,
  CheckCircle2,
  XCircle,
  Tag,
  Ticket,
  Wallet,
} from "lucide-react";
import DashboardShell, { WelcomeCard, SectionTitle } from "../../components/dashboard/DashboardShell.jsx";
import CompanyLogo from "../../components/CompanyLogo.jsx";
import { getTypeMeta } from "../../lib/types.js";
import { useAuth } from "../../lib/auth.jsx";
import { uploadLogo } from "../../lib/supabase.js";
import { fetchMyRequests, createRequest } from "../../lib/requests.js";

const TYPES = [
  { key: "تخفيض", icon: Tag },
  { key: "كوبون", icon: Ticket },
  { key: "كاش باك", icon: Wallet },
];

const STATUS = {
  pending: { label: "قيد المراجعة", color: "#fbbf24", icon: Clock },
  accepted: { label: "مقبول", color: "#a6f000", icon: CheckCircle2 },
  rejected: { label: "مرفوض", color: "#ef4444", icon: XCircle },
};

const EMPTY = { title: "", type: "تخفيض", description: "", code: "", link: "", logo: "" };

export default function CompanyDashboard() {
  const { user, profile } = useAuth();
  const companyName =
    profile?.company_name || user?.user_metadata?.company_name || user?.user_metadata?.full_name || "شركتك";

  const [form, setForm] = useState(EMPTY);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    let active = true;
    fetchMyRequests(user.id)
      .then((r) => active && setRequests(r))
      .catch(() => active && setRequests([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [user.id]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const url = await uploadLogo(file);
      setForm((f) => ({ ...f, logo: url }));
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.title.trim()) return setError("عنوان العرض مطلوب");
    setSubmitting(true);
    try {
      const created = await createRequest(user.id, { ...form, company_name: companyName });
      setRequests((prev) => [created, ...prev]);
      setForm(EMPTY);
      setToast(true);
      setTimeout(() => setToast(false), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const meta = getTypeMeta(form.type);

  return (
    <DashboardShell badge="حساب شركة">
      <WelcomeCard title={`مرحباً، ${companyName} 🏢`} subtitle="أرسل عروضك ليراجعها فريق CODpromo وتظهر للزبائن">
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <InfoPill icon={Mail} label="البريد" value={user?.email} />
          <InfoPill icon={Phone} label="الهاتف" value={profile?.phone} />
          <InfoPill icon={Globe} label="الموقع" value={profile?.website} />
        </div>
      </WelcomeCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr]">
        {/* النموذج */}
        <div>
          <SectionTitle icon={PlusCircle}>طلب عرض جديد</SectionTitle>
          <form
            onSubmit={submit}
            className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] p-5"
          >
            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/[0.08] px-3.5 py-2.5 text-[13px] font-semibold text-red-400">
                {error}
              </div>
            )}

            {/* رفع اللوجو */}
            <div className="flex items-center gap-4">
              <CompanyLogo logo={form.logo} name={form.title || companyName} size={64} accent={meta.color} />
              <div className="flex-1">
                <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" id="req-logo" />
                <div className="flex flex-wrap items-center gap-2">
                  <label
                    htmlFor="req-logo"
                    className="flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--color-ink-line)] bg-[var(--fill)] px-4 py-2.5 text-[13.5px] font-bold text-[var(--text)] transition-colors hover:bg-[var(--fill-strong)]"
                  >
                    {uploading ? <Loader2 size={16} className="animate-spin text-[var(--color-lime)]" /> : <ImagePlus size={16} className="text-[var(--color-lime)]" />}
                    {uploading ? "جارٍ الرفع…" : form.logo ? "تغيير اللوجو" : "رفع لوجو"}
                  </label>
                  {form.logo && (
                    <button type="button" onClick={() => setForm((f) => ({ ...f, logo: "" }))} className="flex items-center gap-1 rounded-xl border border-[var(--color-ink-line)] px-3 py-2.5 text-[13px] font-semibold text-[var(--color-mute)] hover:text-red-400">
                      <X size={14} /> إزالة
                    </button>
                  )}
                </div>
              </div>
            </div>

            <Field label="عنوان العرض" required>
              <input value={form.title} onChange={set("title")} placeholder="مثال: خصم 20% على كل الطلبات" className={inputCls} />
            </Field>

            <div>
              <Lbl>نوع العرض</Lbl>
              <div className="grid grid-cols-3 gap-2">
                {TYPES.map((t) => {
                  const tm = getTypeMeta(t.key);
                  const active = form.type === t.key;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, type: t.key }))}
                      className="flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-[13px] font-bold transition-all"
                      style={{
                        borderColor: active ? tm.color : "var(--color-ink-line)",
                        background: active ? `${tm.color}1a` : "transparent",
                        color: active ? tm.color : "var(--text-softer)",
                      }}
                    >
                      <t.icon size={14} /> {t.key}
                    </button>
                  );
                })}
              </div>
            </div>

            <Field label="الوصف">
              <textarea value={form.description} onChange={set("description")} rows={2} placeholder="تفاصيل العرض…" className={`${inputCls} resize-none`} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="كود الخصم">
                <input value={form.code} onChange={set("code")} placeholder="SAVE20" className={`${inputCls} font-mono tracking-wider`} />
              </Field>
              <Field label="الرابط">
                <input value={form.link} onChange={set("link")} dir="ltr" placeholder="https://…" className={`${inputCls} text-left`} />
              </Field>
            </div>

            <motion.button
              type="submit"
              whileTap={{ scale: 0.98 }}
              disabled={submitting || uploading}
              className="mt-1 flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-[14.5px] font-extrabold text-[#0a0a0a] disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" }}
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={17} />}
              إرسال الطلب
            </motion.button>
          </form>
        </div>

        {/* الطلبات السابقة */}
        <div>
          <SectionTitle
            icon={Building2}
            action={<span className="text-[13px] font-bold text-[var(--color-mute)]">{requests.length}</span>}
          >
            طلباتي
          </SectionTitle>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-14 text-[var(--color-mute)]">
              <Loader2 size={18} className="animate-spin" /> جارٍ التحميل…
            </div>
          ) : requests.length === 0 ? (
            <div className="rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] px-6 py-12 text-center text-[14px] text-[var(--text-soft)]">
              لا توجد طلبات بعد — أرسل أول عرض من النموذج.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <AnimatePresence>
                {requests.map((r) => (
                  <RequestItem key={r.id} req={r} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* توست */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-[var(--color-ink-line)] bg-[var(--elev)]/95 px-4 py-3 text-[13.5px] font-semibold text-[var(--text)] backdrop-blur-xl"
          >
            <CheckCircle2 size={17} className="text-[var(--color-lime)]" />
            تم إرسال الطلب — سيُراجَع قريباً
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardShell>
  );
}

function RequestItem({ req }) {
  const meta = getTypeMeta(req.type);
  const st = STATUS[req.status] || STATUS.pending;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex items-center gap-3 rounded-2xl border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] p-3.5"
    >
      <CompanyLogo logo={req.logo} name={req.title} size={44} accent={meta.color} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-bold text-[var(--text)]">{req.title}</div>
        <div className="mt-0.5 flex items-center gap-2 text-[12px] text-[var(--color-mute)]">
          <span className="rounded px-1.5 py-0.5 font-bold" style={{ background: `${meta.color}1a`, color: meta.color }}>{req.type}</span>
          {req.code && <span className="font-mono font-bold text-[var(--text-softer)]">{req.code}</span>}
        </div>
      </div>
      <span
        className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-bold"
        style={{ background: `${st.color}1a`, color: st.color }}
      >
        <st.icon size={12} /> {st.label}
      </span>
    </motion.div>
  );
}

const inputCls =
  "w-full rounded-xl border border-[var(--color-ink-line)] bg-[var(--color-ink)] px-3.5 py-2.5 text-[14px] font-medium text-[var(--text)] outline-none transition-colors placeholder:text-[var(--color-mute)] focus:border-[var(--color-lime)]";

function Lbl({ children }) {
  return <span className="mb-1.5 block text-[12.5px] font-bold text-[var(--text-softer)]">{children}</span>;
}

function Field({ label, required, children }) {
  return (
    <label className="block">
      <Lbl>
        {label}
        {required && <span className="text-[var(--color-lime)]"> *</span>}
      </Lbl>
      {children}
    </label>
  );
}

function InfoPill({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-ink-line)] bg-[var(--fill)] px-4 py-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--color-lime)]/12 text-[var(--color-lime)]">
        <Icon size={17} />
      </span>
      <div className="min-w-0">
        <div className="text-[11.5px] font-medium text-[var(--color-mute)]">{label}</div>
        <div className="truncate text-[13.5px] font-bold text-[var(--text)]" dir="auto">{value || "—"}</div>
      </div>
    </div>
  );
}
