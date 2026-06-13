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
  Crown,
  Languages,
  Loader2,
  Globe,
  FolderTree,
  ShieldCheck,
  LogIn,
} from "lucide-react";

import { useAuth } from "../lib/auth.jsx";

import {
  fetchCompanies,
  addCompany,
  updateCompany,
  deleteCompany,
  translateCompanyFields,
  fetchCategories,
  addCategory,
  updateCategory,
  deleteCategory,
  getPremiumCode,
} from "../lib/supabase.js";
import { fetchAllProfiles, fetchAllRequests, acceptRequest, setRequestStatus } from "../lib/admin.js";
import { fetchSubscribers } from "../lib/subscribers.js";
import { fetchStorkCodes, addStorkCode } from "../lib/stork.js";
import { ADMIN_PIN, ADMIN_SESSION_KEY } from "../lib/config.js";
import Logo from "../components/Logo.jsx";
import CompanyForm from "../components/admin/CompanyForm.jsx";
import CompanyTable from "../components/admin/CompanyTable.jsx";
import AdminOverview from "../components/admin/AdminOverview.jsx";
import UsersTable from "../components/admin/UsersTable.jsx";
import RequestsManager from "../components/admin/RequestsManager.jsx";
import SubscribersTable from "../components/admin/SubscribersTable.jsx";
import StorkManager from "../components/admin/StorkManager.jsx";
import PremiumMembers from "../components/admin/PremiumMembers.jsx";
import SeoManager from "../components/admin/SeoManager.jsx";
import CategoryForm from "../components/admin/CategoryForm.jsx";
import CategoryTable from "../components/admin/CategoryTable.jsx";

export default function Admin() {
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem(ADMIN_SESSION_KEY) === "1"
  );
  // الجلسة المُصادَقة: لازمة كي تحمل كتابات اللوحة توكن المستخدم (JWT) بدل مفتاح anon.
  const { user, loading } = useAuth();

  // 1) بوابة الرمز كما هي (لا تتغيّر).
  if (!unlocked) return <PinGate onUnlock={() => setUnlocked(true)} />;
  // 2) ننتظر تحميل الجلسة قبل الحكم على تسجيل الدخول (تفادي وميض شاشة الدعوة).
  if (loading) return <AdminLoading />;
  // 3) إن لم يكن المستخدم مسجّلاً عبر نظام المصادقة → دعوة لتسجيل الدخول (ليس حاجزاً صلباً على is_admin).
  if (!user) return <LoginInvite onLock={() => setUnlocked(false)} />;
  return <Dashboard onLock={() => setUnlocked(false)} />;
}

/* ===================== شاشة انتظار تحميل الجلسة ===================== */
function AdminLoading() {
  return (
    <div className="grid min-h-screen place-items-center bg-[var(--color-ink)]">
      <Loader2 size={28} className="animate-spin text-[var(--color-lime)]" />
    </div>
  );
}

/* ===================== دعوة لتسجيل الدخول (بعد الرمز) ===================== */
// الرمز صحيح لكن لا توجد جلسة مُصادَقة — نطلب تسجيل الدخول حتى تحمل الكتابات JWT.
function LoginInvite({ onLock }) {
  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-[var(--color-ink)] px-4">
      <div
        className="pointer-events-none absolute left-1/2 top-1/3 h-[400px] w-[600px] -translate-x-1/2 rounded-full blur-[120px]"
        style={{ background: "radial-gradient(circle, rgba(166,240,0,0.14), transparent 65%)" }}
      />
      <motion.div
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
          <ShieldCheck size={26} className="text-[var(--color-lime)]" />
        </div>
        <h1 className="mt-5 text-[22px] font-black text-white">سجّل الدخول للمتابعة</h1>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--color-mute)]">
          الرمز صحيح. لإدارة المحتوى يجب تسجيل الدخول بحسابك أولاً حتى تُحفَظ تعديلاتك بهويتك.
        </p>

        <Link
          to="/login"
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-[14.5px] font-extrabold text-[#0a0a0a]"
          style={{
            background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))",
          }}
        >
          <LogIn size={16} /> تسجيل الدخول
        </Link>

        <button
          onClick={onLock}
          className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--color-mute)] transition-colors hover:text-white"
        >
          <ArrowLeft size={14} /> رجوع لبوابة الرمز
        </button>
      </motion.div>
    </div>
  );
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
  const [translatingAll, setTranslatingAll] = useState(false);
  const [translateProgress, setTranslateProgress] = useState({ done: 0, total: 0 });
  const [toast, setToast] = useState(null); // { type, msg }
  const toastTimer = useRef(null);
  const formRef = useRef(null);

  // الفئات (المرحلة 2)
  const [categories, setCategories] = useState([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [editingCat, setEditingCat] = useState(null); // الفئة قيد التعديل
  const [submittingCat, setSubmittingCat] = useState(false);
  const catFormRef = useRef(null);

  // بيانات المراحل الجديدة (مستخدمون + طلبات)
  const [profiles, setProfiles] = useState([]);
  const [requests, setRequests] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [storkCodes, setStorkCodes] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [loadingSubs, setLoadingSubs] = useState(true);
  const [loadingStork, setLoadingStork] = useState(true);
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
    fetchStorkCodes()
      .then(setStorkCodes)
      .catch(() => setStorkCodes([]))
      .finally(() => setLoadingStork(false));
    fetchCategories()
      .then((d) => setCategories(Array.isArray(d) ? d : []))
      .catch(() => setCategories([]))
      .finally(() => setLoadingCats(false));
  }, [load]);

  const handleAddStork = async (code) => {
    const created = await addStorkCode(code);
    setStorkCodes((prev) => [created, ...prev]);
    notify("success", "تمت إضافة الكود");
  };

  const premiumCount = profiles.filter((p) => p.is_premium).length;

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

  // عدد الشركات في كل فئة: بالأساس عبر category_id، ومع fallback لمطابقة النص العربي
  // للشركات التي لم يُملأ لها category_id بعد (قبل/بدون backfill).
  const categoryCounts = useMemo(() => {
    const map = {};
    for (const cat of categories) map[cat.id] = 0;
    for (const c of companies) {
      let id = c.category_id;
      if (!id && c.category) {
        const match = categories.find((cat) => cat.name_ar === c.category);
        if (match) id = match.id;
      }
      if (id && map[id] != null) map[id] += 1;
    }
    return map;
  }, [categories, companies]);

  // إضافة/تعديل فئة (الترجمة en/fr تلقائية داخل addCategory/updateCategory)
  const handleCatSubmit = async (form) => {
    setSubmittingCat(true);
    try {
      if (editingCat?.id) {
        const updated = await updateCategory(editingCat.id, form);
        setCategories((prev) => prev.map((c) => (c.id === editingCat.id ? { ...c, ...updated } : c)));
        notify("success", "تم حفظ الفئة بنجاح");
        setEditingCat(null);
      } else {
        const created = await addCategory(form);
        setCategories((prev) => [created, ...prev]);
        notify("success", "تمت إضافة الفئة بنجاح");
      }
    } catch (e) {
      notify("error", e.message);
    } finally {
      setSubmittingCat(false);
    }
  };

  const startEditCat = (cat) => {
    setEditingCat(cat);
    catFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // حذف فئة: القاعدة تُفرّغ category_id للشركات المرتبطة (ON DELETE SET NULL).
  // نعكس ذلك محلياً كي يتحدّث العدّاد فوراً دون إعادة جلب.
  const handleDeleteCategory = async (id) => {
    try {
      await deleteCategory(id);
      setCategories((prev) => prev.filter((c) => c.id !== id));
      setCompanies((prev) =>
        prev.map((c) => (c.category_id === id ? { ...c, category_id: null } : c))
      );
      if (editingCat?.id === id) setEditingCat(null);
      notify("success", "تم حذف الفئة");
    } catch (e) {
      notify("error", e.message);
    }
  };

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

  // ترجمة كل الشركات (Backfill): تترجم الوصف + الفئة وتحفظ en/fr لكل شركة.
  // نترجم فقط ما له وصف/فئة عربية (نتخطّى ما لا نص له).
  const handleTranslateAll = async () => {
    if (translatingAll) return;
    const targets = companies.filter(
      (c) => (c.description && c.description.trim()) || (c.category && c.category.trim())
    );
    setTranslatingAll(true);
    setTranslateProgress({ done: 0, total: targets.length });
    let done = 0;
    let failed = 0;
    let lastError = "";
    for (const c of targets) {
      const src = {};
      if (c.description?.trim()) src.description = c.description.trim();
      if (c.category?.trim()) src.category = c.category.trim();
      try {
        const { en = {}, fr = {} } = await translateCompanyFields(src);
        const patch = {};
        if (en.description != null) patch.description_en = en.description;
        if (en.category != null) patch.category_en = en.category;
        if (fr.description != null) patch.description_fr = fr.description;
        if (fr.category != null) patch.category_fr = fr.category;
        if (Object.keys(patch).length) {
          const updated = await updateCompany(c.id, patch);
          setCompanies((prev) => prev.map((x) => (x.id === c.id ? { ...x, ...updated } : x)));
        }
        done += 1;
      } catch (e) {
        failed += 1;
        lastError = e?.message || String(e);
        // نطبع السبب الحقيقي للتشخيص (مثلاً PGRST204 = عمود غير موجود في مخزّن المخطّط)
        console.error("translate-all failed for company", c.id, e);
      }
      setTranslateProgress({ done: done + failed, total: targets.length });
    }
    setTranslatingAll(false);
    notify(
      failed && !done ? "error" : "success",
      `تمت ترجمة ${done} شركة${failed ? ` · فشل ${failed}` : ""}` +
        (failed && lastError ? ` — السبب: ${lastError}` : "")
    );
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

  const startEdit = async (company) => {
    setEditing(company);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    // كود/رابط Premium لم يعودا ضمن الجلب العام (مقفلان خادمياً) — نجلبهما عبر RPC
    // (مسموح للأدمن) كي يظهرا في النموذج، وإلا قد يُحفظ الحقلان فارغين عند التعديل.
    try {
      const pc = await getPremiumCode(company.id);
      if (pc) {
        setEditing((cur) =>
          cur && cur.id === company.id
            ? { ...cur, premium_code: pc.premium_code || "", premium_url: pc.premium_url || "" }
            : cur
        );
      }
    } catch {
      /* تجاهل — يبقى الحقلان فارغين، ويعيد الأدمن إدخالهما عند الحاجة */
    }
  };

  // تبديل دعم Premium لشركة مباشرةً من الجدول (تحديث متفائل مع تراجع عند الفشل)
  const handleTogglePremium = async (id, value) => {
    setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, supports_premium: value } : c)));
    try {
      await updateCompany(id, { supports_premium: value });
    } catch (e) {
      setCompanies((prev) =>
        prev.map((c) => (c.id === id ? { ...c, supports_premium: !value } : c))
      );
      notify("error", e.message);
    }
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
          <TabButton active={tab === "categories"} onClick={() => setTab("categories")} icon={FolderTree}>
            الفئات
          </TabButton>
          <TabButton active={tab === "seo"} onClick={() => setTab("seo")} icon={Globe}>
            SEO
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
          <TabButton active={tab === "stork"} onClick={() => setTab("stork")} icon={Crown} badge={premiumCount}>
            Premium / Stork
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

            {/* ترجمة تلقائية لكل الأوصاف (en + fr) */}
            <div className="mb-6 flex flex-col items-start justify-between gap-3 rounded-2xl border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] p-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--color-lime)]/12 text-[var(--color-lime)]">
                  <Languages size={20} />
                </span>
                <div className="min-w-0">
                  <div className="text-[14px] font-extrabold text-white">ترجمة المحتوى تلقائياً</div>
                  <div className="text-[12px] text-[var(--color-mute)]">
                    تترجم وصف وفئة كل الشركات إلى الإنجليزية والفرنسية (الأوصاف الجديدة تُترجَم تلقائياً عند الحفظ).
                  </div>
                </div>
              </div>
              <button
                onClick={handleTranslateAll}
                disabled={translatingAll}
                className="flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-[13.5px] font-extrabold text-[#0a0a0a] transition-transform hover:scale-[1.02] disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" }}
              >
                {translatingAll ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    جارٍ الترجمة… {translateProgress.done}/{translateProgress.total}
                  </>
                ) : (
                  <>
                    <Languages size={16} /> ترجم الكل
                  </>
                )}
              </button>
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
                    categories={categories}
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
                onTogglePremium={handleTogglePremium}
              />
            </div>
          </>
        )}

        {/* الفئات — إدارة كاملة (إضافة/تعديل/حذف + ترجمة تلقائية) */}
        {tab === "categories" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[420px_1fr]">
            <div ref={catFormRef} className="lg:sticky lg:top-[84px] lg:self-start">
              <div className="rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] p-5">
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="text-[17px] font-extrabold text-white">
                    {editingCat ? "تعديل فئة" : "إضافة فئة جديدة"}
                  </h2>
                  {editingCat && (
                    <span
                      className="rounded-md bg-[var(--color-lime)]/15 px-2 py-1 text-[11.5px] font-bold text-[var(--color-lime)]"
                      dir="ltr"
                    >
                      {editingCat.slug}
                    </span>
                  )}
                </div>
                <CategoryForm
                  key={editingCat?.id || "new"}
                  initial={editingCat}
                  submitting={submittingCat}
                  onSubmit={handleCatSubmit}
                  onCancel={() => setEditingCat(null)}
                />
              </div>
            </div>

            <CategoryTable
              categories={categories}
              counts={categoryCounts}
              loading={loadingCats}
              editingId={editingCat?.id}
              onEdit={startEditCat}
              onDelete={handleDeleteCategory}
            />
          </div>
        )}

        {/* SEO — تحكم كامل لكل شركة + إعدادات عامة */}
        {tab === "seo" && (
          <SeoManager
            companies={companies}
            notify={notify}
            onUpdated={(patch) =>
              setCompanies((prev) => prev.map((c) => (c.id === patch.id ? { ...c, ...patch } : c)))
            }
          />
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

        {/* Premium / أكواد Stork */}
        {tab === "stork" && (
          <div className="flex flex-col gap-6">
            <PremiumMembers profiles={profiles} codes={storkCodes} />
            <StorkManager
              codes={storkCodes}
              loading={loadingStork}
              onAdd={handleAddStork}
              premiumCount={premiumCount}
            />
          </div>
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
