import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Loader2, Send, MailCheck } from "lucide-react";
import AuthShell, { AuthAlert, authInputCls } from "../components/auth/AuthShell.jsx";
import { Field } from "./Login.jsx";
import { useAuth } from "../lib/auth.jsx";

export default function ForgotPassword() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await resetPassword(email.trim());
    setLoading(false);
    if (error) return setError(error.message || "تعذّر إرسال الرابط");
    setDone(true);
  };

  return (
    <AuthShell
      title="استعادة كلمة المرور"
      subtitle={done ? "تفقّد بريدك الإلكتروني" : "سنرسل لك رابطاً لإعادة التعيين"}
      footer={
        <Link to="/login" className="font-bold text-[var(--accent-text)] hover:underline">
          العودة لتسجيل الدخول
        </Link>
      }
    >
      {done ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <div
            className="grid h-16 w-16 place-items-center rounded-2xl"
            style={{ background: "rgba(166,240,0,0.12)", border: "1px solid rgba(166,240,0,0.25)" }}
          >
            <MailCheck size={30} className="text-[var(--color-lime)]" />
          </div>
          <p className="text-[14px] leading-relaxed text-[var(--text-soft)]">
            إن كان البريد <span className="font-bold text-[var(--text)]">{email}</span> مسجّلاً،
            فستصلك رسالة بها رابط إعادة تعيين كلمة المرور.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          {error && <AuthAlert>{error}</AuthAlert>}
          <Field label="البريد الإلكتروني" icon={Mail}>
            <input
              type="email"
              required
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
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
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={17} />}
            إرسال الرابط
          </motion.button>
        </form>
      )}
    </AuthShell>
  );
}
