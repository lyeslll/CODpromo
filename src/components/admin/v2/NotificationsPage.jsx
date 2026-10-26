import { useEffect, useMemo, useState } from "react";
import { Bell, BellRing, Eye, EyeOff, Languages, Loader2, Pencil, Power, Send, Smartphone } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Glass, PageHeader, Segmented, Skeleton, EmptyState, LIME_BG, fmt, fmtDate, inputCls } from "./ui.jsx";
import { fetchCompanies, translateCompanyFields } from "../../../lib/supabase.js";
import { fetchComingSoon, isComingSoon } from "../../../lib/comingSoon.js";
import { ensureLang } from "../../../i18n/index.js";
import {
  adminCreateNotification,
  adminListNotifications,
  adminPushOverview,
  adminPushTest,
  adminSetNotificationHidden,
  adminSetPushEnabled,
  adminUpdateNotification,
  renderNotification,
  safePath,
} from "../../../lib/notifications.js";
import { kindLook } from "../../notifications/NotificationRow.jsx";
import PushToggle from "../../notifications/PushToggle.jsx";

// ============================================================
//  /admin/notifications — الإشعارات (phase "notifications"):
//  الأرقام (أجهزة push، الدفعات في 24 ساعة، الوضع)، إشعار جديد بقوالب جاهزة (شركة جديدة / كود جديد /
//  قريباً / ميزة جديدة / إعلان) + ترجمة تلقائية + معاينة بالثلاث لغات، والقائمة (إخفاء / تعديل النص والرابط).
//  الأوتوماتيكي (شركة، كود، عرض بلا كود، بطاقة "قريباً") يتصنع وحدو في القاعدة. كلش عبر RPCs (admin_assert).
//  "قريباً" (phase soon-notify): بطاقات "قريباً" في القائمة بـ "(قريباً)"، والقالب = الجرس برك (بلا هاتف).
// ============================================================
const LANGS = ["ar", "en", "fr"];
const TEMPLATES = ["company", "code", "coming_soon", "feature", "announcement"];
const EMPTY = { title: "", title_en: "", title_fr: "", body: "", body_en: "", body_fr: "", url: "" };

export default function NotificationsPage({ notify }) {
  const { i18n } = useTranslation();
  const t = useMemo(() => i18n.getFixedT("ar", null, "notify.admin"), [i18n]);
  const [rows, setRows] = useState(null);
  const [overview, setOverview] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [busy, setBusy] = useState(null);
  const [langsReady, setLangsReady] = useState(false);

  const reload = () => {
    adminListNotifications()
      .then(setRows)
      .catch((e) => {
        setRows([]);
        notify?.("error", e.message);
      });
    adminPushOverview()
      .then(setOverview)
      .catch(() => setOverview(null));
  };

  useEffect(() => {
    reload();
    // العروض اللي تخدم + بطاقات "قريباً" (fetchCompanies ما يجيبهمش)
    Promise.all([fetchCompanies(), fetchComingSoon().catch(() => [])])
      .then(([live, soon]) =>
        setCompanies([...(Array.isArray(live) ? live : []), ...(Array.isArray(soon) ? soon : [])].sort((a, b) => a.name.localeCompare(b.name)))
      )
      .catch(() => setCompanies([]));
    // المعاينة بالإنجليزية والفرنسية تحتاج ملفات اللغة
    Promise.all([ensureLang("en"), ensureLang("fr")]).finally(() => setLangsReady(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleHidden = async (n) => {
    setBusy(`h${n.id}`);
    try {
      await adminSetNotificationHidden(n.id, !n.is_hidden);
      setRows((p) => p.map((x) => (x.id === n.id ? { ...x, is_hidden: !n.is_hidden, visible: n.is_hidden && !x.company_hidden } : x)));
      notify?.("success", n.is_hidden ? t("shownOk") : t("hiddenOk"));
    } catch (e) {
      notify?.("error", e.message);
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    setBusy("test");
    try {
      const r = await adminPushTest();
      if (r?.status === "ok") notify?.("success", t("testOk", { count: r.devices }));
      else notify?.("error", t(`testErr.${r?.status === "no_device" ? "noDevice" : r?.status === "rate_limited" ? "rateLimited" : "other"}`));
      setTimeout(reload, 4000);
    } catch (e) {
      notify?.("error", e.message);
    } finally {
      setBusy(null);
    }
  };

  const setEnabled = async (on) => {
    setBusy("mode");
    try {
      const r = await adminSetPushEnabled(on);
      if (r?.status === "ok") notify?.("success", on ? t("modeOnOk") : t("modeOffOk"));
      else notify?.("error", t("modeTest"));
      reload();
    } catch (e) {
      notify?.("error", e.message);
    } finally {
      setBusy(null);
    }
  };

  const mode = overview?.mode;
  return (
    <>
      <PageHeader title={t("title")} sub={t("sub")} />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Glass className="p-4">
          <p className="text-[12px] font-bold text-[#6b7280]">{t("stat.mode")}</p>
          <p className={`mt-1.5 text-[15px] font-black ${mode === "live" ? "text-[var(--color-lime)]" : mode === "test" ? "text-[#fbbf24]" : "text-[#a1a1aa]"}`}>
            {overview ? t(`mode.${mode}`) : "…"}
          </p>
        </Glass>
        {[
          [t("stat.devices"), overview ? fmt(overview.devices) : "…", overview ? t("stat.byLang", { ar: overview.by_lang?.ar || 0, en: overview.by_lang?.en || 0, fr: overview.by_lang?.fr || 0 }) : ""],
          [t("stat.users"), overview ? fmt(overview.users) : "…", t("stat.usersHint")],
          [t("stat.batches"), overview ? `${fmt(overview.batches_24h)} / ${fmt(overview.cap_24h)}` : "…", t("stat.batchesHint")],
        ].map(([label, value, hint]) => (
          <Glass key={label} className="p-4">
            <p className="text-[12px] font-bold text-[#6b7280]">{label}</p>
            <p className="mt-1 text-[24px] font-black text-white [font-family:Inter,sans-serif]">{value}</p>
            {hint && <p className="mt-0.5 text-[11.5px] text-[#6b7280]">{hint}</p>}
          </Glass>
        ))}
      </div>

      <Glass className="mb-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-xl">
            <p className="flex items-center gap-2 text-[14px] font-extrabold text-white">
              <Smartphone size={16} className="text-[var(--color-lime)]" /> {t("device.title")}
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[#a1a1aa]">{mode === "test" ? t("device.testNote") : t("device.note")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={test}
              disabled={busy === "test" || !overview?.my_devices}
              title={!overview?.my_devices ? t("testErr.noDevice") : undefined}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-white/[0.1] px-3.5 text-[13px] font-bold text-white transition-colors hover:bg-white/[0.06] disabled:opacity-50"
            >
              {busy === "test" ? <Loader2 size={15} className="animate-spin" /> : <BellRing size={15} />}
              {t("test", { count: overview?.my_devices || 0 })}
            </button>
            {mode && mode !== "test" && (
              <button
                type="button"
                onClick={() => setEnabled(mode !== "live")}
                disabled={busy === "mode"}
                className={`inline-flex min-h-[40px] items-center gap-2 rounded-xl px-3.5 text-[13px] font-bold transition-colors disabled:opacity-50 ${
                  mode === "live" ? "border border-red-500/30 text-red-300 hover:bg-red-500/10" : "text-[#0a0a0a]"
                }`}
                style={mode === "live" ? undefined : LIME_BG}
              >
                <Power size={15} /> {mode === "live" ? t("modeOff") : t("modeOn")}
              </button>
            )}
          </div>
        </div>
        <div className="mt-3 max-w-md">
          <PushToggle variant="row" />
        </div>
      </Glass>

      <Composer t={t} companies={companies} langsReady={langsReady} notify={notify} onCreated={reload} />

      <Glass className="p-4 sm:p-5">
        <h2 className="mb-3 text-[16px] font-extrabold text-white">{t("list.title")}</h2>
        {rows === null ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon={Bell} title={t("list.empty")} desc={t("list.emptyDesc")} />
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {rows.map((n) => (
              <Row key={n.id} n={n} t={t} busy={busy} onToggle={() => toggleHidden(n)} notify={notify} onSaved={reload} />
            ))}
          </ul>
        )}
      </Glass>
    </>
  );
}

/** نص الإشعار بلغة معيّنة (نفس القاعدة تاع الموقع و send-push). */
function useRender() {
  const { i18n } = useTranslation();
  return (n, lang) => renderNotification(n, i18n.getFixedT(lang), lang);
}

function Composer({ t, companies, langsReady, notify, onCreated }) {
  const render = useRender();
  const [kind, setKind] = useState("company");
  const [companyId, setCompanyId] = useState("");
  const [q, setQ] = useState("");
  const [f, setF] = useState(EMPTY);
  const [push, setPush] = useState(true);
  const [showTr, setShowTr] = useState(false);
  const [busy, setBusy] = useState(null);

  const soon = kind === "coming_soon";
  const needsCompany = kind === "company" || kind === "code" || soon;
  // قالب "قريباً" = بطاقات "قريباً" برك
  const pool = soon ? companies.filter(isComingSoon) : companies;
  const company = pool.find((c) => String(c.id) === String(companyId)) || null;
  const list = pool.filter((c) => !q.trim() || c.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 60);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const sendPush = push && !soon;

  // معاينة: نفس شكل الإشعار المنشور
  const draft = {
    id: 0,
    kind,
    published_at: new Date().toISOString(),
    ...f,
    company: needsCompany && company ? company : null,
    deal: null,
    ...(soon && company ? { soon: { name: company.name, cards: 1 } } : {}),
  };

  const translate = async () => {
    if (!f.title.trim() && !f.body.trim()) return;
    setBusy("tr");
    try {
      const fields = {};
      if (f.title.trim()) fields.title = f.title.trim();
      if (f.body.trim()) fields.body = f.body.trim();
      const r = await translateCompanyFields(fields);
      setF((p) => ({
        ...p,
        title_en: r?.en?.title || p.title_en,
        title_fr: r?.fr?.title || p.title_fr,
        body_en: r?.en?.body || p.body_en,
        body_fr: r?.fr?.body || p.body_fr,
      }));
      setShowTr(true);
    } catch (e) {
      notify?.("error", e.message);
    } finally {
      setBusy(null);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (needsCompany && !company) return notify?.("error", t("form.pickCompany"));
    if (!needsCompany && !f.title.trim()) return notify?.("error", t("form.needTitle"));
    const url = f.url.trim();
    if (url && safePath(url) !== url) return notify?.("error", t("form.badUrl"));
    setBusy("save");
    try {
      const r = await adminCreateNotification({ kind, companyId: needsCompany ? company.id : null, ...f, url: url || null, push: sendPush });
      if (r?.status === "ok") {
        notify?.("success", sendPush ? t("form.okPush") : t("form.ok"));
        setF(EMPTY);
        setCompanyId("");
        setQ("");
        onCreated?.();
      } else {
        notify?.("error", t(`form.err.${["hidden", "rate_limited", "not_soon"].includes(r?.status) ? r.status : "invalid"}`));
      }
    } catch (err) {
      notify?.("error", err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Glass className="mb-4 p-4 sm:p-5">
      <form onSubmit={submit} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
          <div>
            <h2 className="text-[16px] font-extrabold text-white">{t("form.title")}</h2>
            <p className="mt-0.5 text-[12.5px] text-[#a1a1aa]">{t("form.sub")}</p>
          </div>
          <Segmented value={kind} onChange={setKind} label={t("form.template")} options={TEMPLATES.map((k) => ({ value: k, label: t(`tpl.${k}`) }))} />

          {needsCompany && (
            <div className="space-y-2">
              <label className="block text-[12.5px] font-bold text-[#c9c9cf]">{t("form.company")}</label>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("form.search")} className={inputCls} />
              <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className={inputCls} size={Math.min(6, Math.max(2, list.length))}>
                {list.map((c) => (
                  <option key={c.id} value={c.id}>
                    {isComingSoon(c) ? `${c.name} ${t("form.soonSuffix")}` : c.name}
                  </option>
                ))}
              </select>
              <p className="text-[11.5px] text-[#6b7280]">{soon ? t("form.soonHint") : t("form.companyHint")}</p>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-[12.5px] font-bold text-[#c9c9cf]">{needsCompany ? t("form.titleOpt") : t("form.titleReq")}</span>
              <input value={f.title} onChange={set("title")} maxLength={140} placeholder={needsCompany ? render(draft, "ar").title : ""} className={inputCls} />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-[12.5px] font-bold text-[#c9c9cf]">{t("form.body")}</span>
              <textarea value={f.body} onChange={set("body")} maxLength={300} rows={2} placeholder={needsCompany ? render(draft, "ar").body : ""} className={inputCls} />
            </label>
            {!needsCompany && (
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-[12.5px] font-bold text-[#c9c9cf]">{t("form.url")}</span>
                <input value={f.url} onChange={set("url")} dir="ltr" placeholder="/new" className={inputCls} />
                <span className="mt-1 block text-[11.5px] text-[#6b7280]">{t("form.urlHint")}</span>
              </label>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={translate}
              disabled={busy === "tr" || (!f.title.trim() && !f.body.trim())}
              className="inline-flex min-h-[38px] items-center gap-2 rounded-xl border border-white/[0.1] px-3 text-[12.5px] font-bold text-white hover:bg-white/[0.06] disabled:opacity-50"
            >
              {busy === "tr" ? <Loader2 size={14} className="animate-spin" /> : <Languages size={14} />} {t("form.translate")}
            </button>
            <button type="button" onClick={() => setShowTr((v) => !v)} className="min-h-[38px] rounded-xl px-3 text-[12.5px] font-bold text-[#a1a1aa] hover:text-white">
              {showTr ? t("form.hideTr") : t("form.showTr")}
            </button>
          </div>
          {showTr && (
            <div className="grid gap-3 sm:grid-cols-2">
              {["en", "fr"].map((l) => (
                <div key={l} className="space-y-2" dir="ltr">
                  <input value={f[`title_${l}`]} onChange={set(`title_${l}`)} maxLength={140} placeholder={`Title (${l})`} className={inputCls} />
                  <textarea value={f[`body_${l}`]} onChange={set(`body_${l}`)} maxLength={300} rows={2} placeholder={`Text (${l})`} className={inputCls} />
                </div>
              ))}
            </div>
          )}

          {soon ? (
            <p className="flex items-center gap-2 text-[12.5px] font-bold" style={{ color: kindLook(draft).color }}>
              <Bell size={14} /> {t("form.bellOnly")}
            </p>
          ) : (
            <label className="flex items-center gap-2.5 text-[13px] font-bold text-white">
              <input type="checkbox" checked={push} onChange={(e) => setPush(e.target.checked)} className="h-4 w-4 accent-[var(--color-lime)]" />
              {t("form.push")}
            </label>
          )}

          <button
            type="submit"
            disabled={busy === "save"}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-5 text-[14px] font-extrabold text-[#0a0a0a] disabled:opacity-60"
            style={LIME_BG}
          >
            {busy === "save" ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} {t("form.publish")}
          </button>
        </div>

        <div className="space-y-3">
          <p className="text-[12.5px] font-bold text-[#c9c9cf]">{t("form.preview")}</p>
          {LANGS.map((l) => {
            const r = langsReady || l === "ar" ? render(draft, l) : { title: "…", body: "" };
            const look = kindLook(draft);
            return (
              <div key={l} dir={l === "ar" ? "rtl" : "ltr"} className="flex items-start gap-3 rounded-2xl border border-white/[0.08] bg-black/40 p-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: `${look.color}1f`, color: look.color }}>
                  <look.Icon size={17} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-bold uppercase text-[#6b7280]">{l}</span>
                  <span className="block text-[13.5px] font-extrabold text-white">{r.title || t("form.previewEmpty")}</span>
                  {r.body && <span className="mt-0.5 block text-[12.5px] text-[#a1a1aa]">{r.body}</span>}
                </span>
              </div>
            );
          })}
        </div>
      </form>
    </Glass>
  );
}

function Row({ n, t, busy, onToggle, notify, onSaved }) {
  const render = useRender();
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState(() => ({
    title: n.title || "",
    title_en: n.title_en || "",
    title_fr: n.title_fr || "",
    body: n.body || "",
    body_en: n.body_en || "",
    body_fr: n.body_fr || "",
    // الرابط المحسوب (صفحة الشركة، بلا كود، بحث "قريباً") ماشي نص الأدمين
    url: n.url && !n.url.startsWith("/store/") && n.url !== "/offers?kind=nocode" && !n.url.startsWith("/offers?soon=1&q=") ? n.url : "",
  }));
  const [saving, setSaving] = useState(false);
  const r = render(n, "ar");
  const look = kindLook(n);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const save = async () => {
    const url = f.url.trim();
    if (url && safePath(url) !== url) return notify?.("error", t("form.badUrl"));
    if ((n.kind === "feature" || n.kind === "announcement") && !f.title.trim()) return notify?.("error", t("form.needTitle"));
    setSaving(true);
    try {
      const res = await adminUpdateNotification(n.id, { ...f, url: url || null });
      if (res?.status === "ok") {
        notify?.("success", t("list.saved"));
        setEdit(false);
        onSaved?.();
      } else notify?.("error", t("form.err.invalid"));
    } catch (e) {
      notify?.("error", e.message);
    } finally {
      setSaving(false);
    }
  };

  const pushLabel =
    n.kind === "coming_soon"
      ? t("push.bell")
      : n.push_state === "sent"
      ? t("push.sent", { count: n.push_sent })
      : n.push_state === "pending" && !n.push
      ? t("push.off")
      : t(`push.${n.push_state}`);

  return (
    <li className={`py-3 ${n.is_hidden || !n.visible ? "opacity-55" : ""}`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: `${look.color}1f`, color: look.color }}>
          <look.Icon size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-extrabold text-white">{r.title}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-[#6b7280]">
            <span>{fmtDate(n.published_at, true)}</span>
            <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 font-bold text-[#c9c9cf]">{t(`kind.${n.kind}`)}</span>
            <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 font-bold">{n.is_auto ? t("auto") : t("manual")}</span>
            <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 font-bold">{pushLabel}</span>
            <span>{t("reads", { count: n.reads || 0 })}</span>
            {n.company_hidden && <span className="font-bold text-[#fbbf24]">{t("companyHidden")}</span>}
            {n.is_hidden && <span className="font-bold text-[#fbbf24]">{t("hidden")}</span>}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setEdit((v) => !v)}
            aria-label={t("list.edit")}
            title={t("list.edit")}
            className="grid h-9 w-9 place-items-center rounded-lg text-[#a1a1aa] hover:bg-white/[0.06] hover:text-white"
          >
            <Pencil size={15} />
          </button>
          <button
            type="button"
            onClick={onToggle}
            disabled={busy === `h${n.id}`}
            aria-label={n.is_hidden ? t("list.show") : t("list.hide")}
            title={n.is_hidden ? t("list.show") : t("list.hide")}
            className="grid h-9 w-9 place-items-center rounded-lg text-[#a1a1aa] hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
          >
            {busy === `h${n.id}` ? <Loader2 size={15} className="animate-spin" /> : n.is_hidden ? <Eye size={15} /> : <EyeOff size={15} />}
          </button>
        </div>
      </div>
      {edit && (
        <div className="mt-3 space-y-3 rounded-2xl border border-white/[0.08] bg-black/30 p-3">
          <p className="text-[11.5px] text-[#6b7280]">{n.kind === "feature" || n.kind === "announcement" ? t("list.editHintOwn") : t("list.editHint")}</p>
          <div className="grid gap-3 lg:grid-cols-3">
            {LANGS.map((l) => {
              const sfx = l === "ar" ? "" : `_${l}`;
              return (
                <div key={l} className="space-y-2" dir={l === "ar" ? "rtl" : "ltr"}>
                  <span className="block text-[11px] font-bold uppercase text-[#6b7280]">{l}</span>
                  <input value={f[`title${sfx}`]} onChange={set(`title${sfx}`)} maxLength={140} placeholder={render(n, l).title} className={inputCls} />
                  <textarea value={f[`body${sfx}`]} onChange={set(`body${sfx}`)} maxLength={300} rows={2} placeholder={render(n, l).body} className={inputCls} />
                </div>
              );
            })}
          </div>
          <label className="block max-w-md">
            <span className="mb-1 block text-[12px] font-bold text-[#c9c9cf]">{t("form.url")}</span>
            <input value={f.url} onChange={set("url")} dir="ltr" placeholder={n.url} className={inputCls} />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl px-4 text-[13px] font-extrabold text-[#0a0a0a] disabled:opacity-60"
              style={LIME_BG}
            >
              {saving && <Loader2 size={14} className="animate-spin" />} {t("list.save")}
            </button>
            <button type="button" onClick={() => setEdit(false)} className="min-h-[40px] rounded-xl px-3 text-[13px] font-bold text-[#a1a1aa] hover:text-white">
              {t("list.cancel")}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
