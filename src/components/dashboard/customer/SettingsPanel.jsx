import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, LogOut, Trash2, Check, Eye, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../../lib/auth.jsx";
import { useLocale } from "../../../lib/locale.jsx";
import { LANGS, Flag, useLangPick } from "../../LanguageSwitcher.jsx";
import { updateMyName, hasPasswordLogin } from "../../../lib/account.js";

const inputCls =
  "w-full rounded-xl border border-[var(--color-ink-line)] bg-[var(--fill)] px-3.5 py-2.5 text-[14px] text-[var(--text)] outline-none transition-colors placeholder:text-[var(--color-mute)] focus:border-[var(--color-lime)]/60";
const saveCls =
  "inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-[13.5px] font-extrabold text-[#0a0a0a] disabled:opacity-60";
const LIME_BG = { background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" };

/** الإعدادات: الاسم، كلمة السر (حسابات الإيميل فقط)، اللغة، الخروج، حذف الحساب. */
export default function SettingsPanel() {
  const { t } = useTranslation();
  const { user, profile, refreshProfile, updatePassword, signOut } = useAuth();
  const navigate = useNavigate();
  const canPassword = hasPasswordLogin(user);

  const logout = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)]">
      <h2 className="px-5 pt-5 text-[18px] font-extrabold text-[var(--text)] sm:px-6">{t("dashboard.settings.title")}</h2>
      <div className="grid lg:grid-cols-3">
        <Block title={t("dashboard.settings.name")}>
          <NameForm userId={user.id} initial={profile?.full_name || user?.user_metadata?.full_name || ""} onSaved={refreshProfile} />
        </Block>
        <Block title={t("dashboard.settings.password")}>
          {canPassword ? <PasswordForm updatePassword={updatePassword} /> : <p className="text-[13px] leading-relaxed text-[var(--text-soft)]">{t("dashboard.settings.googleOnly")}</p>}
        </Block>
        <Block title={t("dashboard.settings.language")}>
          <LanguageChoice />
        </Block>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-ink-line)] px-5 py-4 sm:px-6">
        <button
          type="button"
          onClick={logout}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-ink-line)] px-4 py-2.5 text-[13.5px] font-bold text-[var(--text)] transition-colors hover:bg-[var(--fill)]"
        >
          <LogOut size={15} /> {t("dashboard.settings.logout")}
        </button>
        <Link to="/account-deletion" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--color-mute)] transition-colors hover:text-red-400">
          <Trash2 size={14} /> {t("dashboard.settings.deleteAccount")}
        </Link>
      </div>
    </section>
  );
}

function Block({ title, children }) {
  return (
    <div className="border-t border-[var(--color-ink-line)] px-5 py-5 first:border-t-0 sm:px-6 lg:border-t-0 lg:border-e lg:last:border-e-0">
      <h3 className="mb-3 text-[14px] font-extrabold text-[var(--text-softer)]">{title}</h3>
      {children}
    </div>
  );
}

function Status({ ok, err }) {
  const { t } = useTranslation();
  if (err) return <p className="mt-2 text-[12.5px] font-semibold text-red-400">{err}</p>;
  if (ok)
    return (
      <p className="mt-2 flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--accent-text)]">
        <Check size={14} /> {t("dashboard.settings.saved")}
      </p>
    );
  return null;
}

function NameForm({ userId, initial, onSaved }) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setOk(false);
    setErr("");
    if (!name.trim()) return setErr(t("dashboard.settings.nameRequired"));
    setBusy(true);
    try {
      await updateMyName(userId, name);
      await onSaved?.();
      setOk(true);
    } catch {
      setErr(t("dashboard.settings.failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2.5">
      <label className="sr-only" htmlFor="dash-name">
        {t("dashboard.settings.name")}
      </label>
      <input id="dash-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className={inputCls} dir="auto" autoComplete="name" />
      <button type="submit" disabled={busy || name.trim() === initial.trim()} className={saveCls} style={LIME_BG}>
        {busy && <Loader2 size={15} className="animate-spin" />} {t("dashboard.settings.saveName")}
      </button>
      <Status ok={ok} err={err} />
    </form>
  );
}

function PasswordForm({ updatePassword }) {
  const { t } = useTranslation();
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setOk(false);
    setErr("");
    if (pwd.length < 6) return setErr(t("auth.reset.errShort"));
    if (pwd !== confirm) return setErr(t("auth.reset.errMismatch"));
    setBusy(true);
    const { error } = await updatePassword(pwd);
    setBusy(false);
    if (error) return setErr(t("dashboard.settings.failed"));
    setPwd("");
    setConfirm("");
    setOk(true);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2.5">
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          placeholder={t("auth.reset.newPassword")}
          aria-label={t("auth.reset.newPassword")}
          autoComplete="new-password"
          className={`${inputCls} pe-11`}
          dir="ltr"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={t(show ? "dashboard.settings.hide" : "dashboard.settings.show")}
          className="absolute inset-y-0 end-0 grid w-11 place-items-center text-[var(--color-mute)] hover:text-[var(--text)]"
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      <input
        type={show ? "text" : "password"}
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder={t("auth.reset.confirm")}
        aria-label={t("auth.reset.confirm")}
        autoComplete="new-password"
        className={inputCls}
        dir="ltr"
      />
      <button type="submit" disabled={busy || !pwd} className={saveCls} style={LIME_BG}>
        {busy && <Loader2 size={15} className="animate-spin" />} {t("dashboard.settings.savePassword")}
      </button>
      <Status ok={ok} err={err} />
    </form>
  );
}

function LanguageChoice() {
  const { lang } = useLocale();
  const pick = useLangPick();
  return (
    <div className="grid gap-2" role="radiogroup">
      {LANGS.map((l) => {
        const active = l.code === lang;
        return (
          <button
            key={l.code}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => pick(l.code)}
            className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-[14px] font-bold transition-colors ${
              active ? "border-[var(--color-lime)]/50 bg-[var(--color-lime)]/[0.08] text-[var(--text)]" : "border-[var(--color-ink-line)] text-[var(--text-soft)] hover:bg-[var(--fill)]"
            }`}
          >
            <Flag code={l.flag} size={18} />
            <span className="flex-1 text-start">{l.label}</span>
            {active && <Check size={15} className="text-[var(--color-lime)]" />}
          </button>
        );
      })}
    </div>
  );
}
