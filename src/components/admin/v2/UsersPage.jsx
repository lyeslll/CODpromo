import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Download, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Users, X, Loader2, Crown, Infinity as InfinityIcon, Copy, Heart, AlertCircle } from "lucide-react";
import CompanyLogo from "../../CompanyLogo.jsx";
import { getTypeMeta } from "../../../lib/types.js";
import { listAdminUsers, listAllAdminUsers, fetchUserCopies } from "../../../lib/adminStats.js";
import { Glass, PageHeader, Skeleton, EmptyState, fmt, fmtDate, inputCls, LIME_BG, useAdminT } from "./ui.jsx";

const PAGE = 25;

/** المستخدمون: بحث + فلاتر + ترتيب + صفحات (كلها في قاعدة البيانات عبر admin_list_users). */
export default function UsersPage() {
  const t = useAdminT();
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [plan, setPlan] = useState("");
  const [type, setType] = useState("");
  const [range, setRange] = useState("all");
  const [sort, setSort] = useState({ key: "created_at", desc: true });
  const [page, setPage] = useState(0);
  const [state, setState] = useState({ rows: [], total: 0, loading: true, error: "" });
  const [open, setOpen] = useState(null);
  const [exporting, setExporting] = useState(false);

  // بحث بعد توقّف الكتابة
  useEffect(() => {
    const id = setTimeout(() => setSearch(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);
  useEffect(() => setPage(0), [search, plan, type, range, sort]);

  const filters = { search, plan, type, range, sort: sort.key, desc: sort.desc };

  useEffect(() => {
    let active = true;
    setState((s) => ({ ...s, loading: true, error: "" }));
    listAdminUsers({ ...filters, limit: PAGE, offset: page * PAGE })
      .then(({ rows, total }) => active && setState({ rows, total: total ?? 0, loading: false, error: "" }))
      .catch((e) => active && setState({ rows: [], total: 0, loading: false, error: e.message }));
    return () => {
      active = false;
    };
  }, [search, plan, type, range, sort, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const pages = Math.max(1, Math.ceil(state.total / PAGE));

  const toggleSort = (key) => setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: true }));

  const exportCsv = async () => {
    setExporting(true);
    try {
      const rows = await listAllAdminUsers(filters);
      downloadCsv(rows, t);
    } catch (e) {
      setState((s) => ({ ...s, error: e.message }));
    } finally {
      setExporting(false);
    }
  };

  const cols = [
    { key: "name", label: t("users.col.name"), sort: "name" },
    { key: "type", label: t("users.col.type") },
    { key: "plan", label: t("users.col.plan") },
    { key: "provider", label: t("users.col.provider") },
    { key: "created", label: t("users.col.created"), sort: "created_at" },
    { key: "last", label: t("users.col.lastSignIn"), sort: "last_sign_in" },
    { key: "fav", label: t("users.col.favorites"), sort: "favorites", num: true },
    { key: "copies", label: t("users.col.copies"), sort: "copies", num: true },
  ];

  return (
    <>
      <PageHeader
        title={t("nav.users")}
        sub={state.loading ? t("common.loading") : t("users.count", { count: state.total })}
        actions={
          <button
            type="button"
            onClick={exportCsv}
            disabled={exporting || !state.total}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13.5px] font-extrabold text-[#0a0a0a] disabled:opacity-50"
            style={LIME_BG}
          >
            {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} {t("users.export")}
          </button>
        }
      />

      <Glass className="mb-4 p-3 sm:p-4">
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto]">
          <label className="relative block">
            <span className="sr-only">{t("users.search")}</span>
            <Search size={16} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#6b7280]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("users.search")} className={`${inputCls} pr-10`} />
          </label>
          <Select value={plan} onChange={setPlan} label={t("users.col.plan")} options={[["", t("users.allPlans")], ["free", t("plan.free")], ["premium", t("plan.premium")], ["lifetime", t("plan.lifetime")]]} />
          <Select value={type} onChange={setType} label={t("users.col.type")} options={[["", t("users.allTypes")], ["customer", t("type.customer")], ["company", t("type.company")]]} />
          <Select value={range} onChange={setRange} label={t("range.label")} options={["all", "today", "7d", "30d"].map((v) => [v, t(`users.joined_${v}`)])} />
        </div>
      </Glass>

      <Glass>
        {state.error ? (
          <EmptyState icon={AlertCircle} title={t("common.loadFailed")} desc={state.error} />
        ) : !state.loading && state.rows.length === 0 ? (
          <EmptyState icon={Users} title={t("users.emptyTitle")} desc={t("users.emptyDesc")} />
        ) : (
          <>
            {/* الحاسوب: جدول */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[960px] text-[13px]">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[12px] text-[var(--color-mute)]">
                    {cols.map((c) => (
                      <th key={c.key} scope="col" className={`whitespace-nowrap px-4 py-3 font-bold ${c.num ? "text-center" : "text-start"}`}>
                        {c.sort ? (
                          <button type="button" onClick={() => toggleSort(c.sort)} className="inline-flex items-center gap-1 hover:text-white" aria-sort={sort.key === c.sort ? (sort.desc ? "descending" : "ascending") : "none"}>
                            {c.label}
                            {sort.key === c.sort ? sort.desc ? <ChevronDown size={13} /> : <ChevronUp size={13} /> : null}
                          </button>
                        ) : (
                          c.label
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {state.loading
                    ? Array.from({ length: 8 }, (_, i) => (
                        <tr key={i} className="border-b border-white/[0.04]">
                          {cols.map((c) => (
                            <td key={c.key} className="px-4 py-3.5">
                              <Skeleton className="h-4 w-full max-w-[140px]" />
                            </td>
                          ))}
                        </tr>
                      ))
                    : state.rows.map((u) => (
                        <tr key={u.id} onClick={() => setOpen(u)} className="cursor-pointer border-b border-white/[0.04] transition-colors last:border-0 hover:bg-white/[0.03]">
                          <td className="px-4 py-3">
                            <button type="button" onClick={(e) => (e.stopPropagation(), setOpen(u))} className="block max-w-[260px] text-start">
                              <span className="block truncate font-bold text-white">{u.full_name || "—"}</span>
                              <span className="block truncate text-[12px] text-[var(--color-mute)]" dir="ltr" style={{ textAlign: "right" }}>
                                {u.email}
                              </span>
                            </button>
                          </td>
                          <td className="px-4 py-3 text-[#c9c9cf]">{t(`type.${u.account_type || "customer"}`)}</td>
                          <td className="px-4 py-3">
                            <PlanChip plan={u.plan} until={u.premium_until} />
                          </td>
                          <td className="px-4 py-3">
                            <Provider value={u.provider} />
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-[#c9c9cf]">{fmtDate(u.created_at)}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-[#c9c9cf]">{fmtDate(u.last_sign_in_at)}</td>
                          <td className="px-4 py-3 text-center font-bold tabular-nums text-white">{fmt(u.favorites_count)}</td>
                          <td className="px-4 py-3 text-center font-bold tabular-nums text-white">{fmt(u.copies_count)}</td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>

            {/* الهاتف: بطاقات */}
            <ul className="divide-y divide-white/[0.05] md:hidden">
              {state.loading
                ? Array.from({ length: 6 }, (_, i) => (
                    <li key={i} className="p-4">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="mt-2 h-3 w-56" />
                    </li>
                  ))
                : state.rows.map((u) => (
                    <li key={u.id}>
                      <button type="button" onClick={() => setOpen(u)} className="flex w-full items-center gap-3 p-4 text-start">
                        <div className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-bold text-white">{u.full_name || "—"}</span>
                          <span className="block truncate text-[12px] text-[var(--color-mute)]">
                            <bdi dir="ltr">{u.email}</bdi>
                          </span>
                          <span className="mt-1.5 flex flex-wrap items-center gap-2 text-[11.5px] text-[var(--color-mute)]">
                            <PlanChip plan={u.plan} />
                            <Provider value={u.provider} />
                            <span>{fmtDate(u.created_at)}</span>
                          </span>
                        </div>
                        <ChevronLeft size={16} className="shrink-0 text-[#6b7280]" />
                      </button>
                    </li>
                  ))}
            </ul>

            {/* الصفحات */}
            <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-4 py-3 text-[12.5px] text-[var(--color-mute)]">
              <span>{t("users.page", { page: page + 1, pages })}</span>
              <div className="flex items-center gap-1.5">
                <PagerBtn disabled={page === 0 || state.loading} onClick={() => setPage((p) => p - 1)} label={t("users.prev")}>
                  <ChevronRight size={16} />
                </PagerBtn>
                <PagerBtn disabled={page + 1 >= pages || state.loading} onClick={() => setPage((p) => p + 1)} label={t("users.next")}>
                  <ChevronLeft size={16} />
                </PagerBtn>
              </div>
            </div>
          </>
        )}
      </Glass>

      <UserDrawer user={open} onClose={() => setOpen(null)} />
    </>
  );
}

function Select({ value, onChange, options, label }) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={`${inputCls} cursor-pointer`} aria-label={label}>
        {options.map(([v, l]) => (
          <option key={v} value={v} className="bg-[#0b0b0d]">
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function PagerBtn({ disabled, onClick, label, children }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} aria-label={label} className="grid h-9 w-9 place-items-center rounded-lg border border-white/[0.08] text-white transition-colors hover:bg-white/[0.05] disabled:opacity-35">
      {children}
    </button>
  );
}

export function PlanChip({ plan, until }) {
  const t = useAdminT();
  if (plan === "lifetime")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#f0c63c]/15 px-2 py-0.5 text-[11.5px] font-extrabold text-[#ffe486]">
        <InfinityIcon size={12} /> {t("plan.lifetime")}
      </span>
    );
  if (plan === "premium")
    return (
      <span className="inline-flex flex-col">
        <span className="inline-flex items-center gap-1 rounded-full bg-[#f0c63c]/15 px-2 py-0.5 text-[11.5px] font-extrabold text-[#ffe486]">
          <Crown size={12} /> {t("plan.premium")}
        </span>
        {until && <span className="mt-0.5 text-[11px] text-[var(--color-mute)]">{t("users.until", { date: fmtDate(until) })}</span>}
      </span>
    );
  return <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[11.5px] font-bold text-[#a1a1aa]">{t("plan.free")}</span>;
}

function Provider({ value }) {
  const t = useAdminT();
  const list = String(value || "email").split(",");
  return (
    <span className="inline-flex gap-1">
      {list.map((p) => (
        <span key={p} className="rounded-md border border-white/[0.08] px-1.5 py-0.5 text-[11px] font-bold text-[#c9c9cf]">
          {p === "google" ? "Google" : p === "email" ? t("users.providerEmail") : p}
        </span>
      ))}
    </span>
  );
}

/** لوحة جانبية: تفاصيل المستخدم + آخر الأكواد اللي نسخها. */
function UserDrawer({ user, onClose }) {
  const t = useAdminT();
  const [copies, setCopies] = useState(null);
  const closeRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setCopies(null);
    fetchUserCopies(user.id, 10)
      .then((d) => active && setCopies(d))
      .catch(() => active && setCopies([]));
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    setTimeout(() => closeRef.current?.focus(), 50);
    return () => {
      active = false;
      window.removeEventListener("keydown", onKey);
    };
  }, [user, onClose]);

  return (
    <AnimatePresence>
      {user && (
        <>
          <motion.div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={user.full_name || user.email}
            className="fixed inset-y-0 right-0 z-50 flex w-[420px] max-w-full flex-col overflow-y-auto border-l border-white/[0.07] bg-[#0b0b0d]"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
          >
            <div className="flex items-start gap-3 border-b border-white/[0.06] p-5">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-[18px] font-black text-[#0a0a0a]" style={LIME_BG}>
                {(user.full_name || user.email || "؟").trim().charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[17px] font-black text-white">{user.full_name || "—"}</h2>
                <p className="truncate text-[12.5px] text-[var(--color-mute)]">
                  <bdi dir="ltr">{user.email}</bdi>
                </p>
                <div className="mt-2">
                  <PlanChip plan={user.plan} until={user.premium_until} />
                </div>
              </div>
              <button ref={closeRef} type="button" onClick={onClose} aria-label={t("common.close")} className="grid h-9 w-9 place-items-center rounded-xl border border-white/[0.08] text-[#a1a1aa] hover:text-white">
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-px border-b border-white/[0.05] bg-white/[0.05]">
              {[
                [Heart, t("users.col.favorites"), user.favorites_count],
                [Copy, t("users.col.copies"), user.copies_count],
              ].map(([Icon, k, v]) => (
                <div key={k} className="bg-[#0b0b0d] p-4">
                  <div className="flex items-center gap-1 text-[11.5px] text-[var(--color-mute)]">
                    <Icon size={12} /> {k}
                  </div>
                  <div className="mt-1 text-[20px] font-black tabular-nums text-white">{fmt(v)}</div>
                </div>
              ))}
            </div>
            {(() => {
              const info = [
                [t("users.col.type"), t(`type.${user.account_type || "customer"}`)],
                [t("users.col.provider"), <Provider key="p" value={user.provider} />],
                [t("users.col.created"), fmtDate(user.created_at, true)],
                [t("users.col.lastSignIn"), fmtDate(user.last_sign_in_at, true)],
                [t("users.planType"), user.plan_type ? t(`users.planTypes.${user.plan_type}`, { defaultValue: user.plan_type }) : "—"],
                [t("users.provider"), user.payment_provider || "—"],
                ...(user.company_name ? [[t("users.company"), user.company_name]] : []),
              ];
              return (
                <dl className="grid grid-cols-2 gap-px bg-white/[0.05] text-[13px]">
                  {info.map(([k, v], i) => (
                    <div key={k} className={`bg-[#0b0b0d] p-4 ${info.length % 2 && i === info.length - 1 ? "col-span-2" : ""}`}>
                      <dt className="text-[11.5px] text-[var(--color-mute)]">{k}</dt>
                      <dd className="mt-1 font-bold text-white">{v}</dd>
                    </div>
                  ))}
                </dl>
              );
            })()}

            <div className="p-5">
              <h3 className="mb-3 text-[14px] font-extrabold text-white">{t("users.recentCopies")}</h3>
              {copies == null ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : copies.length === 0 ? (
                <p className="rounded-xl border border-white/[0.06] px-4 py-6 text-center text-[13px] text-[var(--color-mute)]">{t("users.noCopies")}</p>
              ) : (
                <ul className="space-y-1.5">
                  {copies.map((c, i) => (
                    <li key={`${c.company_id}-${i}`} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/[0.03]">
                      <CompanyLogo logo={c.logo} name={c.name} size={34} accent={c.premium ? "#f0c63c" : getTypeMeta(c.type).color} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 truncate text-[13.5px] font-bold text-white">
                          {c.name} {c.premium && <Crown size={12} className="text-[#ffe486]" />}
                        </span>
                        <span className="text-[11.5px] text-[var(--color-mute)]">{fmtDate(c.created_at, true)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

/** تصدير CSV (مع BOM حتى يفتح Excel العربية صحيحاً). */
function downloadCsv(rows, t) {
  const head = ["name", "email", "type", "plan", "premium_until", "provider", "created", "last_sign_in", "favorites", "copies"].map((k) => t(`users.csv.${k}`));
  const esc = (v) => {
    const s = v == null ? "" : String(v);
    // نمنع حقن الصيغ في Excel (= + - @ في بداية الخانة)
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const lines = rows.map((u) =>
    [u.full_name, u.email, u.account_type, u.plan, u.premium_until || "", u.provider, u.created_at, u.last_sign_in_at || "", u.favorites_count, u.copies_count].map(esc).join(",")
  );
  const blob = new Blob(["﻿" + [head.map(esc).join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `codpromo-users-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
