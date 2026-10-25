import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Crown, EyeOff, ExternalLink, Hourglass, Pencil, Plus, Users } from "lucide-react";
import CompanyLogo from "../../CompanyLogo.jsx";
import { fetchAdminComingSoon } from "../../../lib/comingSoon.js";
import { SOON, SOON_BG, SOON_INK } from "../../coming-soon/tone.js";
import { Glass, PageHeader, Skeleton, EmptyState, fmt, fmtDate, useAdminT } from "./ui.jsx";

const OLD_DAYS = 30;

/**
 * /admin/coming-soon — كل بطاقات "العرض قريباً" (حتى المخفية): عدد اللي ينتظرون (بريد حقيقي = مرة، أرقام برك
 * بلا أسماء ولا إيميلات — admin_coming_soon)، الحسابات والجديدة منها (إشارة لحسابات وهمية)، الأيام، وتنبيه
 * أكثر من 30 يوماً. الإضافة = /admin/companies/new?soon=1، والتفعيل = تعديل البطاقة وإطفاء "قريباً".
 */
export default function ComingSoonPage({ notify }) {
  const t = useAdminT();
  const [rows, setRows] = useState(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    fetchAdminComingSoon()
      .then(setRows)
      .catch((e) => {
        setRows([]);
        setFailed(true);
        notify?.("error", e.message);
      });
  }, [notify]);
  useEffect(() => {
    load();
  }, [load]);

  const old = (rows || []).filter((r) => Number(r.days) > OLD_DAYS);
  const add = (
    <Link to="/admin/companies/new?soon=1" className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13.5px] font-extrabold" style={{ background: SOON_BG, color: SOON_INK }}>
      <Plus size={16} /> {t("soon.add")}
    </Link>
  );

  return (
    <>
      <PageHeader title={t("soon.title")} sub={rows ? `${t("soon.total", { count: rows.length })} · ${t("soon.sub")}` : t("soon.sub")} actions={add} />

      {old.length > 0 && (
        <p role="alert" className="mb-4 flex items-start gap-2 rounded-2xl border border-[#fbbf24]/40 bg-[#fbbf24]/[0.08] px-4 py-3 text-[13px] font-bold leading-relaxed text-[#fde68a]">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          {t("soon.oldCount", { count: old.length })} — {t("soon.old")}
        </p>
      )}

      {rows === null ? (
        <div className="grid gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[76px] w-full rounded-[20px]" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Glass>
          <EmptyState icon={Hourglass} title={failed ? t("common.loadFailed") : t("soon.title")} desc={failed ? "" : t("soon.empty")} action={add} />
        </Glass>
      ) : (
        <ul className="grid gap-3">
          {rows.map((r) => {
            const late = Number(r.days) > OLD_DAYS;
            return (
              <li key={r.id}>
                <Glass className="p-4" glow="rgba(255,126,179,0.18)">
                  <div className="flex flex-wrap items-center gap-4">
                    <CompanyLogo logo={r.logo} bg={r.logo_bg} name={r.name} size={48} accent={SOON} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-[15px] font-extrabold text-white">{r.name}</span>
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-black" style={{ background: `${SOON}1f`, color: SOON }}>
                          <Hourglass size={11} /> {t("companies.soonBadge")}
                        </span>
                        {r.premium_coming_soon && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#f0c63c]/15 px-2 py-0.5 text-[11px] font-black text-[#ffe486]">
                            <Crown size={11} /> {t("soon.premium")}
                          </span>
                        )}
                        {r.status === "hidden" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-bold text-[#a1a1aa]">
                            <EyeOff size={11} /> {t("soon.hidden")}
                          </span>
                        )}
                      </div>
                      <p className={`mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] font-semibold ${late ? "text-[#fbbf24]" : "text-[var(--color-mute)]"}`}>
                        <span>
                          {t("soon.colSince")}: {fmtDate(r.since)} · {t("soon.days", { count: Number(r.days) || 0 })}
                        </span>
                        {late && (
                          <span className="inline-flex items-center gap-1">
                            <AlertTriangle size={12} /> {t("soon.old")}
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="text-center" title={t("soon.waitingHint")}>
                      <div className="flex items-center justify-center gap-1.5 text-[22px] font-black tabular-nums" style={{ color: SOON }}>
                        <Users size={17} /> {fmt(r.waiting)}
                      </div>
                      <div className="text-[11.5px] font-bold text-[var(--color-mute)]">{t("soon.colWaiting")}</div>
                    </div>
                    <div className="min-w-[8rem] text-[11.5px] leading-relaxed text-[var(--color-mute)]">
                      <div>{t("soon.accounts", { count: Number(r.accounts) || 0 })}</div>
                      <div className={Number(r.new_accounts) > 0 ? "font-bold text-[#fbbf24]" : ""} title={t("soon.newAccountsHint")}>
                        {t("soon.newAccounts", { count: Number(r.new_accounts) || 0 })}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {r.slug && r.status !== "hidden" && (
                        <a href={`/store/${r.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-white/[0.08] px-3 text-[12.5px] font-bold text-[#c9c9cf] hover:text-white">
                          <ExternalLink size={14} /> {t("soon.view")}
                        </a>
                      )}
                      <Link to={`/admin/companies/${r.id}`} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3 text-[12.5px] font-extrabold" style={{ background: SOON_BG, color: SOON_INK }}>
                        <Pencil size={14} /> {t("soon.edit")}
                      </Link>
                    </div>
                  </div>
                </Glass>
              </li>
            );
          })}
        </ul>
      )}

      <Glass className="mt-5 p-4">
        <p className="text-[13.5px] font-extrabold text-white">{t("soon.howTitle")}</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-mute)]">{t("soon.how")}</p>
        <p className="mt-2 text-[12px] text-[var(--color-mute)]">{t("soon.waitingHint")}</p>
      </Glass>
    </>
  );
}
