import { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { useTranslation } from "react-i18next";
import AuthShell, { GoogleButton, AuthAlert, authInputCls } from "../components/auth/AuthShell.jsx";
import Captcha from "../components/auth/Captcha.jsx";
import { useAuth } from "../lib/auth.jsx";

/** يحوّل رسالة خطأ Supabase إلى مفتاح ترجمة. */
export function loginErrorKey(msg = "") {
  if (/invalid login credentials/i.test(msg)) return "errCredentials";
  if (/email not confirmed/i.test(msg)) return "errNotConfirmed";
  if (/rate limit/i.test(msg)) return "errRateLimit";
  return "errGeneric";
}

export default function Login() {
  const { signIn, signInWithGoogle } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const captchaRef = useRef(null);

  const resetCaptcha = () => {
    captchaRef.current?.resetCaptcha();
    setCaptchaToken("");
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!captchaToken) return setError(t("auth.login.errCaptcha"));
    setLoading(true);
    const { error } = await signIn(email.trim(), password, captchaToken);
    setLoading(false);
    if (error) {
      resetCaptcha();
      return setError(t(`auth.login.${loginErrorKey(error.message)}`));
    }
    navigate("/dashboard");
  };

  const google = async () => {
    setError("");
    setGoogleLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      setGoogleLoading(false);
      setError(t(`auth.login.${loginErrorKey(error.message)}`));
    }
  };

  return (
    <AuthShell
      title={t("auth.login.title")}
      subtitle={t("auth.login.subtitle")}
      footer={
        <span>
          {t("auth.login.noAccount")}{" "}
          <Link to="/signup" className="font-bold text-[var(--accent-text)] hover:underline">
            {t("auth.login.createAccount")}
          </Link>
        </span>
      }
    >
      {error && <AuthAlert>{error}</AuthAlert>}

      <GoogleButton onClick={google} loading={googleLoading} label={t("auth.login.google")} />

      <Divider />

      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label={t("auth.login.email")} icon={Mail}>
          <input
            type="email"
            required
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={`${authInputCls} ps-10 text-left`}
          />
        </Field>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[12.5px] font-bold text-[var(--text-softer)]">{t("auth.login.password")}</span>
            <Link
              to="/forgot-password"
              className="text-[12.5px] font-semibold text-[var(--accent-text)] hover:underline"
            >
              {t("auth.login.forgot")}
            </Link>
          </div>
          <Field icon={Lock}>
            <input
              type={show ? "text" : "password"}
              required
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={`${authInputCls} ps-10 pe-10 text-left`}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-[var(--color-mute)] hover:text-[var(--text)]"
              tabIndex={-1}
            >
              {show ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </Field>
        </div>

        <Captcha ref={captchaRef} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken("")} />

        <motion.button
          type="submit"
          whileTap={{ scale: 0.98 }}
          disabled={loading}
          className="mt-1 flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-[15px] font-extrabold text-[#0a0a0a] disabled:opacity-60"
          style={{ background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" }}
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
          {t("auth.login.submit")}
        </motion.button>
      </form>
    </AuthShell>
  );
}

/* مكوّنات مساعدة مشتركة */
export function Field({ label, icon: Icon, children }) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1.5 block text-[12.5px] font-bold text-[var(--text-softer)]">{label}</span>
      )}
      <div className="relative flex items-center">
        {Icon && (
          <Icon size={17} className="pointer-events-none absolute start-3 text-[var(--color-mute)]" />
        )}
        {children}
      </div>
    </label>
  );
}

export function Divider() {
  const { t } = useTranslation();
  return (
    <div className="my-5 flex items-center gap-3 text-[12px] text-[var(--color-mute)]">
      <span className="h-px flex-1 bg-[var(--color-ink-line)]" />
      {t("auth.or")}
      <span className="h-px flex-1 bg-[var(--color-ink-line)]" />
    </div>
  );
}
