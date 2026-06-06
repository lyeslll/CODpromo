import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, Eye, EyeOff, Loader2, Check, ShieldCheck } from "lucide-react";
import AuthShell, { AuthAlert, authInputCls } from "../components/auth/AuthShell.jsx";
import { Field } from "./Login.jsx";
import { useAuth } from "../lib/auth.jsx";

export default function ResetPassword() {
  const { updatePassword, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [linkInvalid, setLinkInvalid] = useState(false);

  // إن لم تُوجد جلسة استعادة بعد انتهاء التحميل → الرابط غير صالح/منتهٍ
  useEffect(() => {
    if (!authLoading && !user) setLinkInvalid(true);
  }, [authLoading, user]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) return setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
    if (password !== confirm) return setError("كلمتا المرور غير متطابقتين");

    setLoading(true);
    const { error } = await updatePassword(password);
    setLoading(false);
    if (error) return setError(error.message || "تعذّر تحديث كلمة المرور");
    setDone(true);
    setTimeout(() => navigate("/login"), 2200);
  };

  if (done) {
    return (
      <AuthShell title="تم بنجاح" subtitle="جارٍ تحويلك لتسجيل الدخول…">
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <div
            className="grid h-16 w-16 place-items-center rounded-2xl"
            style={{ background: "rgba(166,240,0,0.12)", border: "1px solid rgba(166,240,0,0.25)" }}
          >
            <Check size={30} className="text-[var(--color-lime)]" strokeWidth={3} />
          </div>
          <p className="text-[14px] text-[var(--text-soft)]">تم تحديث كلمة المرور.</p>
        </div>
      </AuthShell>
    );
  }

  if (linkInvalid) {
    return (
      <AuthShell
        title="الرابط غير صالح"
        subtitle="انتهت صلاحية رابط الاستعادة أو فُتح بشكل خاطئ"
        footer={
          <Link to="/forgot-password" className="font-bold text-[var(--accent-text)] hover:underline">
            طلب رابط جديد
          </Link>
        }
      >
        <p className="py-2 text-center text-[14px] leading-relaxed text-[var(--text-soft)]">
          افتح رابط الاستعادة من بريدك مباشرةً، أو اطلب رابطاً جديداً.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="كلمة مرور جديدة"
      subtitle="اختر كلمة مرور قوية لحسابك"
      footer={
        <Link to="/login" className="font-bold text-[var(--accent-text)] hover:underline">
          العودة لتسجيل الدخول
        </Link>
      }
    >
      {error && <AuthAlert>{error}</AuthAlert>}

      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="كلمة المرور الجديدة" icon={Lock}>
          <input
            type={show ? "text" : "password"}
            required
            dir="ltr"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="6 أحرف على الأقل"
            className={`${authInputCls} pr-10 pl-10 text-left`}
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-mute)] hover:text-[var(--text)]"
            tabIndex={-1}
          >
            {show ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </Field>

        <Field label="تأكيد كلمة المرور" icon={ShieldCheck}>
          <input
            type={show ? "text" : "password"}
            required
            dir="ltr"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="أعد إدخال كلمة المرور"
            className={`${authInputCls} pr-10 text-left`}
          />
        </Field>

        <motion.button
          type="submit"
          whileTap={{ scale: 0.98 }}
          disabled={loading}
          className="mt-1 flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-[15px] font-extrabold text-[#0a0a0a] disabled:opacity-60"
          style={{ background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" }}
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} strokeWidth={3} />}
          حفظ كلمة المرور
        </motion.button>
      </form>
    </AuthShell>
  );
}
