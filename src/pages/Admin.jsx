import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  LogOut,
  ArrowLeft,
  Check,
  AlertCircle,
  Store,
  Tag,
  Ticket,
  Wallet,
  LayoutDashboard,
  Users,
  Inbox,
  AtSign,
} from "lucide-react";

import {
  fetchCompanies,
  addCompany,
  updateCompany,
  deleteCompany,
} from "../lib/supabase.js";
import { fetchAllProfiles, fetchAllRequests, acceptRequest, setRequestStatus } from "../lib/admin.js";
import { fetchSubscribers } from "../lib/subscribers.js";
import { ADMIN_PIN, ADMIN_SESSION_KEY } from "../lib/config.js";
import Logo from "../components/Logo.jsx";
import CompanyForm from "../components/admin/CompanyForm.jsx";
import CompanyTable from "../components/admin/CompanyTable.jsx";
import AdminOverview from "../components/admin/AdminOverview.jsx";
import UsersTable from "../components/admin/UsersTable.jsx";
import RequestsManager from "../components/admin/RequestsManager.jsx";
import SubscribersTable from "../components/admin/SubscribersTable.jsx";

export default function Admin() {
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem(ADMIN_SESSION_KEY) === "1"
  );

  if (!unlocked) return <PinGate onUnlock={() => setUnlocked(true)} />;
  return <Dashboard onLock={() => setUnlocked(false)} />;
}

/* ===================== بوابة الرمز ===================== */
function PinGate({ onUnlock }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => inputRef.current?.focus(), []);

  const submit = (e) => {
    e.preventDefault();
    if (pin === ADMIN_PIN) {
      sessionStorage.setItem(ADMIN_SESSION_KEY, "1");
      onUnlock();
    } else {
      setError(true);
      setPin("");
    }
  };

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-[var(--color-ink)] px-4">
      <div
        className="pointer-events-none absolute left-1/2 top-1/3 h-[400px] w-[600px] -translate-x-1/2 rounded-full blur-[120px]"
        style={{ background: "radial-gradient(circle, rgba(166,240,0,0.14), transparent 65%)" }}
      />
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-sm rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] p-7 text-center"
      >
        <div
          className="mx-auto grid h-16 w-16 place-items-center rounded-2xl"
          style={{
            background: "linear-gradient(150deg, rgba(166,240,0,0.18), rgba(166,240,0,0.04))",
            border: "1px solid rgba(166,240,0,0.25)",
          }}
        >
          <Lock size={26} className="text-[var(--color-lime)]" />
        </div>
        <h1 className="mt-5 text-[22px] font-black text-white">لوحة تحكم CODpromo</h1>
        <p className="mt-1.5 text-[13.5px] text-[var(--color-mute)]">
          أدخل رمز الدخول للمتابعة
        </p>

        <motion.input
          ref={inputRef}
          type="password"
          value={pin}
          onChange={(e) => {
            setPin(e.target.value);
            setError(false);
          }}
          placeholder="••••••••"
          animate={error ? { x: [0, -8, 8, -6, 6, 0] } : {}}
          transition={{ duration: 0.4 }}
          className={`mt-6 w-full rounded-xl border bg-[#0c0c0e] px-4 py-3 text-center text-[16px] font-bold tracking-widest text-white outline-none transition-colors ${
            error ? "border-red-500" : "border-[var(--color-ink-line)] focus:border-[var(--color-lime)]"
          }`}
        />
        {error && (
          <p className="mt-2 flex items-center justify-center gap-1.5 text-[12.5px] font-semibold text-red-400">
            <AlertCircle size={14} /> رمز غير صحيح
          </p>
        )}

        <button
          type="submit"
          className="mt-5 w-full rounded-xl px-5 py-3 text-[14.5px] font-extrabold text-[#0a0a0a]"
          style={{
            background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))",
          }}
        >
          دخول
        </button>

        <Link
          to="/"
          className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--color-mute)] transition-colors hover:text-white"
        >
          <ArrowLeft size={14} /> العودة للموقع
        </Link>
      </motion.form>
    </div>
  );
}

/* ===================== اللوحة ===================== */
function Dashboard({ onLock }) {
  const [tab, setTab] = useState("overview");
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // الشركة قيد التعديل
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null); // { type, msg }
  const toastTimer = useRef(null);
  const formRef = useRef(null);

  // بيانات المراحل الجديدة (مستخدمون + طلبات)
  const [profiles, setProfiles] = useState([]);
  const [requests, setRequests] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [loadingSubs, setLoadingSubs] = useState(true);
  const [busyReqId, setBusyReqId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchCompanies()
      .then((d) => setCompanies(Array.isArray(d) ? d : []))
      .catch((e) => notify("error", e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    fetchAllProfiles()
      .then(setProfiles)
      .catch(() => setProfiles([]))
      .finally(() => setLoadingUsers(false));
    fetchAllRequests()
      .then(setRequests)
      .catch(() => setRequests([]))
      .finally(() => setLoadingRequests(false));
    fetchSubscribers()
      .then(setSubscribers)
      .catch(() => setSubscribers([]))
      .finally(() => setLoadingSubs(false));
  }, [load]);

  const notify = (type, msg) => {
    setToast({ type, msg });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  const stats = useMemo(() => {
    const by = (t) => companies.filter((c) => c.type === t).length;
    return {
      total: companies.length,
      discount: by("تخفيض"),
      coupon: by("كوبون"),
      cashback: by("كاش باك"),
    };
  }, [companies]);

  const handleSubmit = async (form) => {
    setSubmitting(true);
    try {
      if (editing?.id) {
        const updated = await updateCompany(editing.id, form);
        setCompanies((prev) => prev.map((c) => (c.id === editing.id ? { ...c, ...updated } : c)));
        notify("success", "تم حفظ التعديلات بنجاح");
        setEditing(null);
      } else {
        const created = await addCompany(form);
        setCompanies((prev) => [created, ...prev]);
        notify("success", "تمت إضافة الشركة بنجاح");
      }
    } catch (e) {
      notify("error", e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteCompany(id);
      setCompanies((prev) => prev.filter((c) => c.id !== id));
      if (editing?.id === id) setEditing(null);
      notify("success", "تم حذف الشركة");
    } catch (e) {
      notify("error", e.message);
    }
  };

  const startEdit = (company) => {
    setEditing(company);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // قبول طلب شركة → نشره في companies + تحديث الحالة
  const handleAccept = async (req) => {
    setBusyReqId(req.id);
    try {
      const created = await acceptRequest(req);
      setCompanies((prev) => [created, ...prev]);
      setRequests((prev) => prev.map((r) => (r.id === req.id ? { ...r, status: "accepted" } : r)));
      notify("success", "تم قبول الطلب ونشره كشركة");
    } catch (e) {
      notify("error", e.message);
    } finally {
      setBusyReqId(null);
    }
  };

  // رفض طلب
  const handleReject = async (req) => {
    setBusyReqId(req.id);
    try {
      await setRequestStatus(req.id, "rejected");
      setRequests((prev) => prev.map((r) => (r.id === req.id ? { ...r, status: "rejected" } : r)));
      notify("success", "تم رفض الطلب");
    } catch (e) {
      notify("error", e.message);
    } finally {
      setBusyReqId(null);
    }
  };

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  const logout = () => {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    onLock();
  };

  return (
    <div className="min-h-screen bg-[var(--color-ink)] text-white">
      {/* شريط علوي */}
      <header className="sticky top-0 z-40 border-b border-[var(--color-ink-line)] bg-[#0c0c0e]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="hidden rounded-lg border border-[var(--color-ink-line)] bg-white/[0.04] px-2.5 py-1 text-[12px] font-bold text-[var(--color-lime)] sm:inline">
              لوحة التحكم
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="flex items-center gap-1.5 rounded-xl border border-[var(--color-ink-line)] px-3.5 py-2 text-[13.5px] font-bold text-white transition-colors hover:bg-white/5"
            >
              <ArrowLeft size={15} /> <span className="hidden sm:inline">الموقع</span>
            </Link>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 rounded-xl border border-[var(--color-ink-line)] px-3.5 py-2 text-[13.5px] font-bold text-[#c9c9cf] transition-colors hover:border-red-500/40 hover:text-red-400"
            >
              <LogOut size={15} /> <span className="hidden sm:inline">خروج</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* شريط التبويبات */}
        <div className="no-scrollbar mb-6 flex gap-2 overflow-x-auto">
          <TabButton active={tab === "overview"} onClick={() => setTab("overview")} icon={LayoutDashboard}>
            نظرة عامة
          </TabButton>
          <TabButton active={tab === "companies"} onClick={() => setTab("companies")} icon={Store}>
            الشركات
          </TabButton>
          <TabButton active={tab === "users"} onClick={() => setTab("users")} icon={Users}>
            المستخدمون
          </TabButton>
          <TabButton active={tab === "requests"} onClick={() => setTab("requests")} icon={Inbox} badge={pendingCount}>
            الطلبات
          </TabButton>
          <TabButton active={tab === "subscribers"} onClick={() => setTab("subscribers")} icon={AtSign}>
            المشتركون
          </TabButton>
        </div>

        {/* نظرة عامة */}
        {tab === "overview" && (
          <AdminOverview profiles={profiles} companies={companies} requests={requests} />
        )}

        {/* الشركات (إدارة موجودة كما هي) */}
        {tab === "companies" && (
          <>
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard icon={Store} label="إجمالي الشركات" value={stats.total} color="#a6f000" />
              <StatCard icon={Tag} label="تخفيض" value={stats.discount} color="#a6f000" />
              <StatCard icon={Ticket} label="كوبون" value={stats.coupon} color="#38bdf8" />
              <StatCard icon={Wallet} label="كاش باك" value={stats.cashback} color="#fbbf24" />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[420px_1fr]">
              <div ref={formRef} className="lg:sticky lg:top-[84px] lg:self-start">
                <div className="rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] p-5">
                  <div className="mb-5 flex items-center justify-between">
                    <h2 className="text-[17px] font-extrabold text-white">
                      {editing ? "تعديل شركة" : "إضافة شركة جديدة"}
                    </h2>
                    {editing && (
                      <span className="rounded-md bg-[var(--color-lime)]/15 px-2 py-1 text-[11.5px] font-bold text-[var(--color-lime)]">
                        #{editing.id}
                      </span>
                    )}
                  </div>
                  <CompanyForm
                    key={editing?.id || "new"}
                    initial={editing}
                    submitting={submitting}
                    onSubmit={handleSubmit}
                    onCancel={() => setEditing(null)}
                  />
                </div>
              </div>

              <CompanyTable
                companies={companies}
                loading={loading}
                editingId={editing?.id}
                onEdit={startEdit}
                onDelete={handleDelete}
              />
            </div>
          </>
        )}

        {/* المستخدمون + تصدير CSV */}
        {tab === "users" && <UsersTable profiles={profiles} loading={loadingUsers} />}

        {/* طلبات الشركات */}
        {tab === "requests" && (
          <RequestsManager
            requests={requests}
            profiles={profiles}
            loading={loadingRequests}
            onAccept={handleAccept}
            onReject={handleReject}
            busyId={busyReqId}
          />
        )}

        {/* مشتركو النشرة */}
        {tab === "subscribers" && (
          <SubscribersTable subscribers={subscribers} loading={loadingSubs} />
        )}
      </div>

      {/* التوست */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="fixed bottom-5 left-1/2 z-50 flex max-w-[90vw] -translate-x-1/2 items-center gap-2.5 rounded-2xl border bg-[#0c0c0e]/95 px-4 py-3 shadow-[0_16px_50px_-12px_rgba(0,0,0,0.9)] backdrop-blur-xl"
            style={{ borderColor: toast.type === "error" ? "#ef444455" : "#33351f" }}
          >
            <span
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full"
              style={{
                background: toast.type === "error" ? "#ef4444" : "var(--color-lime)",
                color: toast.type === "error" ? "#fff" : "#0a0a0a",
              }}
            >
              {toast.type === "error" ? <AlertCircle size={16} /> : <Check size={16} strokeWidth={3} />}
            </span>
            <span className="text-[13.5px] font-semibold text-white">{toast.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, badge, children }) {
  return (
    <button
      onClick={onClick}
      className="relative flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-[13.5px] font-bold transition-all"
      style={{
        borderColor: active ? "var(--color-lime)" : "var(--color-ink-line)",
        background: active ? "rgba(166,240,0,0.1)" : "transparent",
        color: active ? "var(--color-lime)" : "#c9c9cf",
      }}
    >
      <Icon size={16} />
      {children}
      {badge > 0 && (
        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#fbbf24] px-1.5 text-[11px] font-black text-[#0a0a0a]">
          {badge}
        </span>
      )}
    </button>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] p-4">
      <span
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
        style={{ background: `${color}1a`, color }}
      >
        <Icon size={20} />
      </span>
      <div className="min-w-0">
        <div className="text-[24px] font-black leading-none text-white">{value}</div>
        <div className="mt-1 truncate text-[12px] font-medium text-[var(--color-mute)]">{label}</div>
      </div>
    </div>
  );
}
