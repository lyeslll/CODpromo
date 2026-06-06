import { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  Loader2,
  UserPlus,
  MailCheck,
  Building2,
  Phone,
  Globe,
} from "lucide-react";
import AuthShell, { GoogleButton, AuthAlert, authInputCls } from "../components/auth/AuthShell.jsx";
import Captcha from "../components/auth/Captcha.jsx";
import { Field, Divider } from "./Login.jsx";
import { useAuth } from "../lib/auth.jsx";

const TYPES = [
  { key: "customer", label: "زبون عادي", desc: "استفد من الكوبونات والعروض", icon: User },
  { key: "company", label: "شركة / مورّد", desc: "اعرض كوبوناتك وخدماتك", icon: Building2 },
];

export default function Signup() {
  const { signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [accountType, setAccountType] = useState("customer");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const captchaRef = useRef(null);

  const isCompany = accountType === "company";

  const resetCaptcha = () => {
    captchaRef.current?.resetCaptcha();
    setCaptchaToken("");
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (isCompany && !companyName.trim()) return setError("اسم الشركة مطلوب");
    if (password.length < 6) return setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
    if (!captchaToken) return setError("يرجى إكمال التحقق (Captcha)");

    const metadata = isCompany
      ? {
          account_type: "company",
          company_name: companyName.trim(),
          full_name: companyName.trim(),
          phone: phone.trim(),
          website: website.trim(),
        }
      : { account_type: "customer", full_name: fullName.trim() };

    setLoading(true);
    const { data, error } = await signUp(email.trim(), password, metadata, captchaToken);
    setLoading(false);
    if (error) {
      resetCaptcha();
      return setError(translate(error.message));
    }
    if (data.session) navigate("/");
    else setDone(true);
  };

  const google = async () => {
    setError("");
    setGoogleLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      setGoogleLoading(false);
      setError(translate(error.message));
    }
  };

  if (done) {
    return (
      <AuthShell
        title="تأكّد من بريدك"
        subtitle="أرسلنا لك رابط تفعيل الحساب"
        footer={
          <Link to="/login" className="font-bold text-[var(--accent-text)] hover:underline">
            العودة لتسجيل الدخول
          </Link>
        }
      >
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <div
            className="grid h-16 w-16 place-items-center rounded-2xl"
            style={{ background: "rgba(166,240,0,0.12)", border: "1px solid rgba(166,240,0,0.25)" }}
          >
            <MailCheck size={30} className="text-[var(--color-lime)]" />
          </div>
          <p className="text-[14px] leading-relaxed text-[var(--text-soft)]">
            افتح رسالة التفعيل المُرسلة إلى{" "}
            <span className="font-bold text-[var(--text)]">{email}</span> ثم سجّل الدخول.
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="إنشاء حساب"
      subtitle="انضمّ إلى CODpromo ووفّر في كل طلب"
      footer={
        <span>
          لديك حساب بالفعل؟{" "}
          <Link to="/login" className="font-bold text-[var(--accent-text)] hover:underline">
            تسجيل الدخول
          </Link>
        </span>
      }
    >
      {error && <AuthAlert>{error}</AuthAlert>}

      {/* اختيار نوع الحساب */}
      <div className="mb-5 grid grid-cols-2 gap-2.5">
        {TYPES.map((t) => {
          const active = accountType === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setAccountType(t.key)}
              className="relative flex flex-col items-center gap-1.5 rounded-2xl border p-3.5 text-center transition-all"
              style={{
                borderColor: active ? "var(--color-lime)" : "var(--color-ink-line)",
                background: active ? "rgba(166,240,0,0.08)" : "var(--fill)",
              }}
            >
              <span
                className="grid h-9 w-9 place-items-center rounded-xl"
                style={{
                  background: active ? "var(--color-lime)" : "var(--fill-strong)",
                  color: active ? "#0a0a0a" : "var(--text-soft)",
                }}
              >
                <t.icon size={18} />
              </span>
              <span className="text-[13.5px] font-extrabold text-[var(--text)]">{t.label}</span>
              <span className="text-[11px] leading-tight text-[var(--color-mute)]">{t.desc}</span>
            </button>
          );
        })}
      </div>

      <GoogleButton onClick={google} loading={googleLoading} label="التسجيل عبر Google" />

      <Divider />

      <form onSubmit={submit} className="flex flex-col gap-4">
        {isCompany ? (
          <>
            <Field label="اسم الشركة" icon={Building2}>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="اسم شركتك أو متجرك"
                className={`${authInputCls} pr-10`}
              />
            </Field>
            <Field label="رقم الهاتف" icon={Phone}>
              <input
                type="tel"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+213 ..."
                className={`${authInputCls} pr-10 text-left`}
              />
            </Field>
            <Field label="الموقع / الرابط" icon={Globe}>
              <input
                type="url"
                dir="ltr"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://example.com"
                className={`${authInputCls} pr-10 text-left`}
              />
            </Field>
          </>
        ) : (
          <Field label="الاسم الكامل" icon={User}>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="اسمك الكامل"
              className={`${authInputCls} pr-10`}
            />
          </Field>
        )}

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

        <Field label="كلمة المرور" icon={Lock}>
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

        <Captcha ref={captchaRef} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken("")} />

        <motion.button
          type="submit"
          whileTap={{ scale: 0.98 }}
          disabled={loading}
          className="mt-1 flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-[15px] font-extrabold text-[#0a0a0a] disabled:opacity-60"
          style={{ background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" }}
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
          إنشاء الحساب
        </motion.button>
      </form>
    </AuthShell>
  );
}

function translate(msg = "") {
  if (/already registered|already exists|user already/i.test(msg)) return "هذا البريد مسجّل مسبقاً";
  if (/password should be at least/i.test(msg)) return "كلمة المرور قصيرة جداً";
  if (/invalid email/i.test(msg)) return "صيغة البريد غير صحيحة";
  if (/captcha/i.test(msg)) return "فشل التحقق (Captcha)، حاول مجدداً";
  if (/rate limit/i.test(msg)) return "محاولات كثيرة، حاول بعد قليل";
  return msg || "تعذّر إنشاء الحساب";
}
