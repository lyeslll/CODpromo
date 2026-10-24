import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Link, useNavigate, Routes, Route, Navigate, useParams } from "react-router-dom";
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
  Vote,
  BarChart3,
  Plus,
  ArrowRight,
  SearchX,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAuth } from "../lib/auth.jsx";

import {
  fetchCompaniesAdmin,
  addCompany,
  updateCompany,
  deleteCompany,
  translateCompanyFields,
  fetchCategories,
  addCategory,
  updateCategory,
  deleteCategory,
  getPremiumCode,
  fetchCompanyPageFields,
} from "../lib/supabase.js";
import { fetchAllProfiles, fetchAllRequests, fetchPremiumProfiles, isActivePremium } from "../lib/admin.js";
import { publishRequest, rejectRequest } from "../lib/requests.js";
import { fetchSubscribers } from "../lib/subscribers.js";
import { fetchStorkCodes, addStorkCode, deleteStorkCode } from "../lib/stork.js";
import { ADMIN_PIN, ADMIN_SESSION_KEY } from "../lib/config.js";
import Logo from "../components/Logo.jsx";
import CompanyOfferForm, { clearCompanyDraft } from "../components/offer-form/CompanyOfferForm.jsx";
import CompanyTable from "../components/admin/CompanyTable.jsx";
import AdminShell from "../components/admin/v2/AdminShell.jsx";
import OverviewPage from "../components/admin/v2/OverviewPage.jsx";
import UsersPage from "../components/admin/v2/UsersPage.jsx";
import FeaturedPage from "../components/admin/v2/FeaturedPage.jsx";
import NocodePage from "../components/admin/v2/NocodePage.jsx";
import NocodeEditor from "../components/admin/v2/NocodeEditor.jsx";
import GiftsPage from "../components/admin/v2/GiftsPage.jsx";
import FreeKeyPage from "../components/admin/v2/FreeKeyPage.jsx";
import SalesPage from "../components/admin/v2/SalesPage.jsx";
import PricingPage from "../components/admin/v2/PricingPage.jsx";
import RatingsPage from "../components/admin/v2/RatingsPage.jsx";
import { setCompanyFreeReveal } from "../lib/freeKey.js";
import { Glass, PageHeader, Skeleton, EmptyState, LIME_BG } from "../components/admin/v2/ui.jsx";
import { fetchCompanyPrivate, saveCompanyPrivate } from "../lib/adminStats.js";
import RequestsManager from "../components/admin/RequestsManager.jsx";
import SubscribersTable from "../components/admin/SubscribersTable.jsx";
import StorkManager from "../components/admin/StorkManager.jsx";
import PremiumMembers from "../components/admin/PremiumMembers.jsx";
import SeoManager from "../components/admin/SeoManager.jsx";
import CategoryForm from "../components/admin/CategoryForm.jsx";
import CategoryTable from "../components/admin/CategoryTable.jsx";
import VotesTable from "../components/admin/VotesTable.jsx";
import SiteStatsManager from "../components/admin/SiteStatsManager.jsx";

export default function Admin() {
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem(ADMIN_SESSION_KEY) === "1"
  );
  // الجلسة المُصادَقة: لازمة كي تحمل كتابات اللوحة توكن المستخدم (JWT) بدل مفتاح anon.
  const { user, loading, profile, profileLoaded } = useAuth();
  const navigate = useNavigate();

  // 0) حساب أدمن مسجّل (profiles.is_admin) → يدخل مباشرة بلا رمز.
  //    تسهيل فقط: الحماية الحقيقية لكل الكتابات هي RLS is_admin() في قاعدة البيانات.
  if (loading || (user && !profileLoaded)) return <AdminLoading />;
  //    "خروج" يرجع لداشبورد الحساب.
  if (user && profile?.is_admin === true) return <Dashboard onLock={() => navigate("/dashboard")} />;

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
  const { i18n } = useTranslation();
  const tAr = useMemo(() => i18n.getFixedT("ar"), [i18n]);
  const tc = (k, o) => tAr(`admin.v2.${k}`, o);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [translatingAll, setTranslatingAll] = useState(false);
  const [translateProgress, setTranslateProgress] = useState({ done: 0, total: 0 });
  const [toast, setToast] = useState(null); // { type, msg }
  const toastTimer = useRef(null);
  const navigate = useNavigate();

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
  const [premiumMembers, setPremiumMembers] = useState([]);
  const [loadingPremium, setLoadingPremium] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [loadingSubs, setLoadingSubs] = useState(true);
  const [loadingStork, setLoadingStork] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    // بهوية الأدمين: الشركات المخفية من الموقع (phase36) تبانلو هنا باش يقدر يرجّعها
    fetchCompaniesAdmin()
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
    fetchPremiumProfiles()
      .then(setPremiumMembers)
      .catch(() => setPremiumMembers([]))
      .finally(() => setLoadingPremium(false));
    fetchCategories()
      .then((d) => setCategories(Array.isArray(d) ? d : []))
      .catch(() => setCategories([]))
      .finally(() => setLoadingCats(false));
  }, [load]);

  const handleAddStork = async (code) => {
    const created = await addStorkCode(code);
    setStorkCodes((prev) => [created, ...prev]);
    notify("success", tc("stork.added", { code: created.code }));
  };

  const handleDeleteStork = async (id) => {
    await deleteStorkCode(id);
    setStorkCodes((prev) => prev.filter((c) => c.id !== id));
    notify("success", tc("stork.deleted"));
  };

  // Premium فعّال (نفس قاعدة has_premium_access)، بلا الأدمن
  const premiumCount = premiumMembers.filter(isActivePremium).length;

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

  // حفظ شركة من صفحة المحرّر (+ المعلومات الداخلية في company_private)
  const handleSave = async (id, form, priv) => {
    setSubmitting(true);
    try {
      let saved;
      if (id) {
        saved = await updateCompany(id, form);
        setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, ...saved } : c)));
      } else {
        saved = await addCompany(form);
        setCompanies((prev) => [saved, ...prev]);
      }
      // "متاح للمفتاح الذهبي": عبر RPC (admin_set_company_free_reveal)، ماشي مع باقي الحقول
      const wantFree = form.free_reveal_enabled;
      if (typeof wantFree === "boolean" && saved?.id && (saved.free_reveal_enabled !== false) !== wantFree) {
        await setCompanyFreeReveal(saved.id, wantFree);
        setCompanies((prev) => prev.map((c) => (c.id === saved.id ? { ...c, free_reveal_enabled: wantFree } : c)));
      }
      if (priv && saved?.id) await saveCompanyPrivate(saved.id, priv);
      clearCompanyDraft(id ? String(id) : "new");
      notify("success", id ? tc("companies.saved") : tc("companies.added"));
      navigate("/admin/companies");
    } catch (e) {
      notify("error", e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // "فئة جديدة" من داخل فورم الشركة
  const handleQuickCategory = async (name_ar) => {
    const created = await addCategory({ name_ar, is_active: true });
    setCategories((prev) => [created, ...prev]);
    notify("success", tc("companies.categoryAdded"));
    return created;
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
      notify("success", "تم حذف الشركة");
    } catch (e) {
      notify("error", e.message);
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

  // إخفاء / إظهار شركة في الموقع (status: hidden / active) — الشركة ما تتمسحش (phase36)
  const handleToggleHidden = async (id, hide) => {
    const name = companies.find((c) => c.id === id)?.name || "";
    const status = hide ? "hidden" : "active";
    setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
    try {
      await updateCompany(id, { status });
      notify("success", tc(hide ? "companies.hiddenDone" : "companies.shownDone", { name }));
    } catch (e) {
      setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, status: hide ? "active" : "hidden" } : c)));
      notify("error", e.message);
    }
  };

  // "متاح للمفتاح الذهبي" مباشرةً من الجدول (تحديث متفائل مع تراجع عند الفشل)
  const handleToggleFreeReveal = async (id, value) => {
    setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, free_reveal_enabled: value } : c)));
    try {
      await setCompanyFreeReveal(id, value);
    } catch (e) {
      setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, free_reveal_enabled: !value } : c)));
      notify("error", e.message);
    }
  };

  // مراجعة ونشر طلب شركة: إنشاء الشركة (أو تحديث شركتها في طلب التعديل) + المعلومات الداخلية
  // + ربط الطلب بالشركة وبحساب صاحبها (RPC admin_publish_request يتحقق من is_admin في القاعدة)
  // شركة أُنشئت لطلب ثم فشلت خطوة لاحقة: إعادة المحاولة تحدّثها بدل إنشاء نسخة ثانية
  const publishedFor = useRef({});
  const handlePublishRequest = async (req, form, priv) => {
    // روابط البطاقة تظهر للعموم كـ href: http(s) فقط (لا javascript: ولا غيره)
    const bad = ["link", "premium_url"].find((k) => form[k] && !/^https?:\/\//i.test(String(form[k]).trim()));
    if (bad) return notify("error", tc("req.badLink"));
    setSubmitting(true);
    try {
      let saved;
      const targetId = req.request_type === "edit" && req.company_id ? req.company_id : publishedFor.current[req.id];
      if (targetId) {
        saved = await updateCompany(targetId, form);
        setCompanies((prev) => prev.map((c) => (c.id === targetId ? { ...c, ...saved } : c)));
      } else {
        saved = await addCompany(form);
        publishedFor.current[req.id] = saved.id;
        setCompanies((prev) => [saved, ...prev]);
      }
      if (priv) await saveCompanyPrivate(saved.id, priv);
      await publishRequest(req.id, saved.id);
      setRequests((prev) => prev.map((r) => (r.id === req.id ? { ...r, status: "accepted", company_id: saved.id, rejection_reason: null } : r)));
      clearCompanyDraft(`req-${req.id}`);
      notify("success", tc("req.published", { name: saved.name }));
      navigate("/admin/requests");
    } catch (e) {
      notify("error", e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // رفض طلب مع سبب يظهر للشركة
  const handleReject = async (req, reason) => {
    await rejectRequest(req.id, reason);
    setRequests((prev) => prev.map((r) => (r.id === req.id ? { ...r, status: "rejected", rejection_reason: reason } : r)));
    notify("success", tc("req.rejected"));
  };

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  const logout = () => {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    onLock();
  };

  return (
    <AdminShell pendingCount={pendingCount} onLogout={logout}>
      <Routes>
        <Route index element={<OverviewPage />} />

        <Route
          path="companies"
          element={
            <>
              <PageHeader
                title={tc("nav.companies")}
                sub={tc("companies.sub", { count: stats.total })}
                actions={
                  <Link to="/admin/companies/new" className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13.5px] font-extrabold text-[#0a0a0a]" style={LIME_BG}>
                    <Plus size={16} /> {tc("companies.add")}
                  </Link>
                }
              />
              <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard icon={Store} label={tc("companies.total")} value={stats.total} color="#a6f000" />
                <StatCard icon={Tag} label={tAr("offerForm.types.discount")} value={stats.discount} color="#a6f000" />
                <StatCard icon={Ticket} label={tAr("offerForm.types.coupon")} value={stats.coupon} color="#38bdf8" />
                <StatCard icon={Wallet} label={tAr("offerForm.types.cashback")} value={stats.cashback} color="#fbbf24" />
              </div>

              {/* ترجمة تلقائية لكل الأوصاف (en + fr) */}
              <Glass className="mb-5 p-4">
                <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--color-lime)]/12 text-[var(--color-lime)]">
                      <Languages size={20} />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[14px] font-extrabold text-white">{tc("companies.translateTitle")}</div>
                      <div className="text-[12px] text-[var(--color-mute)]">{tc("companies.translateDesc")}</div>
                    </div>
                  </div>
                  <button
                    onClick={handleTranslateAll}
                    disabled={translatingAll}
                    className="flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-[13.5px] font-extrabold text-[#0a0a0a] transition-transform hover:scale-[1.02] disabled:opacity-60"
                    style={LIME_BG}
                  >
                    {translatingAll ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        {tc("companies.translating", { done: translateProgress.done, total: translateProgress.total })}
                      </>
                    ) : (
                      <>
                        <Languages size={16} /> {tc("companies.translateAll")}
                      </>
                    )}
                  </button>
                </div>
              </Glass>

              <CompanyTable
                companies={companies}
                loading={loading}
                editingId={null}
                onEdit={(c) => navigate(`/admin/companies/${c.id}`)}
                onDelete={handleDelete}
                onTogglePremium={handleTogglePremium}
                onToggleFreeReveal={handleToggleFreeReveal}
                onToggleHidden={handleToggleHidden}
              />
            </>
          }
        />
        <Route
          path="companies/new"
          element={<CompanyEditorPage companies={companies} loading={loading} categories={categories} submitting={submitting} onSave={handleSave} onCreateCategory={handleQuickCategory} />}
        />
        <Route
          path="companies/:id"
          element={<CompanyEditorPage companies={companies} loading={loading} categories={categories} submitting={submitting} onSave={handleSave} onCreateCategory={handleQuickCategory} />}
        />

        {/* العروض المميّزة — قسم الرئيسية + صف /offers */}
        <Route path="featured" element={<FeaturedPage companies={companies} loading={loading} notify={notify} />} />

        {/* عروض بلا كود — القائمة + الفورم */}
        <Route path="nocode" element={<NocodePage notify={notify} />} />
        <Route path="nocode/new" element={<NocodeEditor companies={companies} categories={categories} notify={notify} />} />
        <Route path="nocode/:id" element={<NocodeEditor key="edit" companies={companies} categories={categories} notify={notify} />} />

        {/* الفئات — إدارة كاملة (إضافة/تعديل/حذف + ترجمة تلقائية) */}
        <Route
          path="categories"
          element={
            <>
              <PageHeader title={tc("nav.categories")} sub={tc("pages.categoriesSub")} />
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[420px_1fr]">
                <div ref={catFormRef} className="lg:sticky lg:top-6 lg:self-start">
                  <div className="rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] p-5">
                    <div className="mb-5 flex items-center justify-between">
                      <h2 className="text-[17px] font-extrabold text-white">{editingCat ? "تعديل فئة" : "إضافة فئة جديدة"}</h2>
                      {editingCat && (
                        <span className="rounded-md bg-[var(--color-lime)]/15 px-2 py-1 text-[11.5px] font-bold text-[var(--color-lime)]" dir="ltr">
                          {editingCat.slug}
                        </span>
                      )}
                    </div>
                    <CategoryForm key={editingCat?.id || "new"} initial={editingCat} submitting={submittingCat} onSubmit={handleCatSubmit} onCancel={() => setEditingCat(null)} />
                  </div>
                </div>
                <CategoryTable categories={categories} counts={categoryCounts} loading={loadingCats} editingId={editingCat?.id} onEdit={startEditCat} onDelete={handleDeleteCategory} />
              </div>
            </>
          }
        />

        <Route
          path="requests"
          element={
            <>
              <PageHeader title={tc("nav.requests")} sub={tc("pages.requestsSub", { count: pendingCount })} />
              <RequestsManager requests={requests} profiles={profiles} loading={loadingRequests} onReject={handleReject} />
            </>
          }
        />
        <Route
          path="requests/:id"
          element={<RequestReviewPage requests={requests} loading={loadingRequests} categories={categories} submitting={submitting} onPublish={handlePublishRequest} onCreateCategory={handleQuickCategory} />}
        />
        {/* تقييمات الشركات (phase34): القائمة + تخبية */}
        <Route path="ratings" element={<RatingsPage notify={notify} />} />
        <Route
          path="votes"
          element={
            <>
              <PageHeader title={tc("nav.votes")} sub={tc("pages.votesSub")} />
              <VotesTable companies={companies} />
            </>
          }
        />
        <Route path="users" element={<UsersPage />} />
        <Route
          path="subscribers"
          element={
            <>
              <PageHeader title={tc("nav.subscribers")} sub={tc("pages.subscribersSub")} />
              <SubscribersTable subscribers={subscribers} loading={loadingSubs} />
            </>
          }
        />
        <Route
          path="premium"
          element={
            <>
              <PageHeader title={tc("nav.premium")} sub={tc("pages.premiumSub")} />
              <div className="flex flex-col gap-6">
                <PremiumMembers members={premiumMembers} loading={loadingPremium} codes={storkCodes} />
                <StorkManager codes={storkCodes} loading={loadingStork} onAdd={handleAddStork} onDelete={handleDeleteStork} premiumCount={premiumCount} />
              </div>
            </>
          }
        />
        {/* الهدايا — روابط Premium مجاني لمدة محدّدة (منفصلة على الدفع وعلى Stork) */}
        <Route path="gifts" element={<GiftsPage notify={notify} />} />
        {/* المفتاح الذهبي — كود Premium واحد مجاناً لكل حساب (ما يعطيش Premium) */}
        <Route path="free-key" element={<FreeKeyPage notify={notify} />} />
        {/* Premium مدى الحياة — المبيعات (purchases + أهلية الاسترداد) والأسعار (pricing_settings) */}
        <Route path="sales" element={<SalesPage notify={notify} />} />
        <Route path="pricing" element={<PricingPage notify={notify} />} />
        <Route
          path="site-stats"
          element={
            <>
              <PageHeader title={tc("nav.siteStats")} sub={tc("pages.siteStatsSub")} />
              <SiteStatsManager notify={notify} />
            </>
          }
        />
        <Route
          path="seo"
          element={
            <>
              <PageHeader title={tc("nav.seo")} sub={tc("pages.seoSub")} />
              <SeoManager companies={companies} notify={notify} onUpdated={(patch) => setCompanies((prev) => prev.map((c) => (c.id === patch.id ? { ...c, ...patch } : c)))} />
            </>
          }
        />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>

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
    </AdminShell>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <Glass glow={`${color}2e`} className="p-4">
      <div className="flex items-center gap-3">
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
    </Glass>
  );
}

/* ===================== صفحة إضافة/تعديل شركة (/admin/companies/new و /admin/companies/:id) ===================== */
function CompanyEditorPage({ companies, loading, categories, submitting, onSave, onCreateCategory }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const tc = useMemo(() => i18n.getFixedT("ar", null, "admin.v2"), [i18n]);
  const isNew = !id;
  const company = isNew ? null : companies.find((c) => String(c.id) === id);
  // كود/رابط Premium + المعلومات الداخلية: تُجلب خادمياً (غير موجودة في الجلب العام)
  const [extra, setExtra] = useState(isNew ? { premiumLoaded: true, pageLoaded: true, priv: null } : null);

  useEffect(() => {
    if (isNew || !company) return;
    let active = true;
    setExtra(null);
    Promise.all([
      getPremiumCode(company.id).then((d) => ({ ok: true, d }), () => ({ ok: false })),
      fetchCompanyPrivate(company.id).catch(() => null),
      fetchCompanyPageFields(company.id).then((d) => ({ ok: true, d }), () => ({ ok: false })),
    ]).then(([pc, priv, page]) => {
      if (!active) return;
      setExtra({
        premiumLoaded: pc.ok, premium_code: pc.d?.premium_code || "", premium_url: pc.d?.premium_url || "", priv,
        pageLoaded: page.ok, page: page.d || {},
      });
    });
    return () => {
      active = false;
    };
  }, [isNew, company?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const back = (
    <Link to="/admin/companies" className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] px-3.5 py-2 text-[13px] font-bold text-[#c9c9cf] hover:text-white">
      <ArrowRight size={15} /> {tc("companies.back")}
    </Link>
  );

  if (!isNew && !loading && !company) {
    return (
      <Glass>
        <EmptyState icon={SearchX} title={tc("companies.notFound")} desc={tc("companies.notFoundDesc")} action={back} />
      </Glass>
    );
  }

  return (
    <>
      <PageHeader title={isNew ? tc("companies.addTitle") : tc("companies.editTitle", { name: company?.name || "" })} sub={isNew ? tc("companies.addSub") : `#${id}`} actions={back} />
      {!extra || (!isNew && !company) ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-5">
            {[220, 120, 260, 260].map((h, i) => (
              <Skeleton key={i} className="w-full rounded-[20px]" style={{ height: h }} />
            ))}
          </div>
          <Skeleton className="h-[420px] w-full rounded-[20px]" />
        </div>
      ) : (
        <CompanyOfferForm
          key={company?.id || "new"}
          lang="ar"
          initial={isNew ? null : { ...company, ...extra.page, premium_code: extra.premium_code, premium_url: extra.premium_url }}
          privateInitial={extra.priv}
          categories={categories}
          submitting={submitting}
          showPrivate
          freeRevealSwitch
          pageFields
          draftKey={isNew ? "new" : String(company.id)}
          onCreateCategory={onCreateCategory}
          onCancel={() => navigate("/admin/companies")}
          onSubmit={(form, priv) => {
            // إن تعذّر جلب كود/رابط Premium لا نرسلهما (حتى لا نمسح القيم المحفوظة)
            const payload = { ...form };
            if (!extra.premiumLoaded) {
              delete payload.premium_code;
              delete payload.premium_url;
            }
            // نفس الشي لنصوص صفحة الشركة
            if (!extra.pageLoaded) {
              delete payload.about;
              delete payload.features;
              delete payload.usage_steps;
            }
            onSave(isNew ? null : company.id, payload, priv);
          }}
        />
      )}
    </>
  );
}

/* ===================== مراجعة طلب شركة ونشره (/admin/requests/:id) ===================== */
function RequestReviewPage({ requests, loading, categories, submitting, onPublish, onCreateCategory }) {
  const { id } = useParams();
  const { i18n } = useTranslation();
  const tc = useMemo(() => i18n.getFixedT("ar", null, "admin.v2"), [i18n]);
  const req = requests.find((r) => String(r.id) === id);
  const [existingPrivate, setExistingPrivate] = useState(undefined);

  // طلب تعديل: نكمّل المعلومات الداخلية المحفوظة (قيم الطلب تتقدّم إن وُجدت)
  useEffect(() => {
    if (!req) return;
    if (!(req.request_type === "edit" && req.company_id)) return setExistingPrivate(null);
    fetchCompanyPrivate(req.company_id).then(setExistingPrivate, () => setExistingPrivate(null));
  }, [req?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const back = (
    <Link to="/admin/requests" className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] px-3.5 py-2 text-[13px] font-bold text-[#c9c9cf] hover:text-white">
      <ArrowRight size={15} /> {tc("req.back")}
    </Link>
  );

  if (!loading && !req) {
    return (
      <Glass>
        <EmptyState icon={SearchX} title={tc("req.notFound")} action={back} />
      </Glass>
    );
  }
  if (!req || existingPrivate === undefined) {
    return <Skeleton className="h-[600px] w-full rounded-[20px]" />;
  }

  const pick = (...v) => v.find((x) => x != null && x !== "") ?? "";
  const initial = {
    name: pick(req.company_name, req.title),
    logo: req.logo || "",
    category_id: req.category_id || "",
    type: req.type || "تخفيض",
    discount: pick(req.discount, req.title),
    code: req.code || "",
    link: req.link || "",
    description: req.description || "",
    premium_discount: req.premium_discount || "",
    premium_code: req.premium_code || "",
    premium_url: req.premium_url || "",
    premium_description: req.premium_description || "",
    supports_premium: req.supports_premium !== false,
  };
  const ep = existingPrivate || {};
  // معلومات التواصل: آخر ما أرسلته الشركة. ما اتفق عليه الأدمن (النسبة، الملاحظات) يبقى إن وُجد،
  // ورسالة الشركة تُضاف للملاحظات بدل أن تمسحها.
  const notes = [ep.notes, req.message && `${tc("req.f.message")}: ${req.message}`].filter(Boolean).join("\n\n");
  const privateInitial = {
    website_url: pick(req.website_url, ep.website_url),
    contact_name: pick(req.contact_name, ep.contact_name),
    whatsapp: pick(req.whatsapp, ep.whatsapp),
    email: pick(req.contact_email, ep.email),
    commission_pct: pick(ep.commission_pct, req.commission_pct),
    affiliate_dashboard_url: pick(req.affiliate_dashboard_url, ep.affiliate_dashboard_url),
    affiliate_url: pick(req.affiliate_url, ep.affiliate_url),
    notes,
  };

  return (
    <>
      <PageHeader
        title={tc("req.reviewTitle", { name: initial.name })}
        sub={req.request_type === "edit" ? tc("req.reviewEditSub", { id: req.company_id }) : tc("req.reviewSub")}
        actions={back}
      />
      <CompanyOfferForm
        key={`req-${req.id}`}
        lang="ar"
        initial={initial}
        privateInitial={privateInitial}
        categories={categories}
        submitting={submitting}
        showPrivate
        // طلب تعديل: الفورم ما فيهش نصوص الصفحة المحفوظة → ما نبعثوهمش (ما نمسحوهمش)
        pageFields={req.request_type !== "edit"}
        draftKey={`req-${req.id}`}
        onCreateCategory={onCreateCategory}
        submitLabel={tc("req.publish")}
        onSubmit={(form, priv) => onPublish(req, form, priv)}
      />
    </>
  );
}

