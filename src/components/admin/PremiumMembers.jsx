import { useMemo, useState } from "react";
import { Crown, CreditCard, Landmark, Wallet, KeyRound, CalendarDays, Mail, Smartphone, Clock } from "lucide-react";
import { isActivePremium } from "../../lib/admin.js";
import { Segmented, Skeleton, fmtDate, useAdminT } from "./v2/ui.jsx";

const METHOD = {
  stripe: { icon: CreditCard, color: "#635bff" },
  paypal: { icon: Wallet, color: "#0070ba" },
  slickpay: { icon: Landmark, color: "#38bdf8" },
  google_play: { icon: Smartphone, color: "#34a853" },
};


/**
 * أعضاء Premium: تبويب "فعّال" (حسب قاعدة has_premium_access، بلا الأدمن) وتبويب "منتهي".
 * members = fetchPremiumProfiles() (أصحاب is_premium أو premium_until).
 */
export default function PremiumMembers({ members = [], loading, codes = [] }) {
  const t = useAdminT();
  const [tab, setTab] = useState("active");
  const active = useMemo(() => members.filter(isActivePremium), [members]);
  const expired = useMemo(() => members.filter((p) => !isActivePremium(p)), [members]);
  const rows = tab === "active" ? active : expired;

  const byId = Object.fromEntries(members.map((p) => [p.id, p]));
  const usedCodes = codes.filter((c) => c.is_used).map((c) => ({ ...c, member: byId[c.used_by] }));

  return (
    <div className="grid gap-5">
      <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-ink-line)] p-4">
          <h2 className="flex items-center gap-2 text-[16px] font-extrabold text-white">
            <Crown size={18} style={{ color: "#f0c63c" }} /> {t("premium.members")}
          </h2>
          <Segmented
            value={tab}
            onChange={setTab}
            size="sm"
            label={t("premium.members")}
            options={[
              { value: "active", label: `${t("premium.tabActive")} (${active.length})` },
              { value: "expired", label: `${t("premium.tabExpired")} (${expired.length})` },
            ]}
          />
        </div>

        {loading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-[14px] text-[var(--color-mute)]">{tab === "active" ? t("premium.emptyActive") : t("premium.emptyExpired")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-start text-[13px]">
              <thead>
                <tr className="border-b border-[var(--color-ink-line)] text-[11.5px] text-[var(--color-mute)]">
                  <Th>{t("premium.col.member")}</Th>
                  <Th>{t("premium.col.method")}</Th>
                  <Th>{t("premium.col.plan")}</Th>
                  <Th>{t("premium.col.amount")}</Th>
                  <Th>{tab === "active" ? t("premium.col.ends") : t("premium.col.ended")}</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const m = METHOD[p.payment_provider];
                  const Icon = m?.icon;
                  return (
                    <tr key={p.id} className="border-b border-[var(--color-ink-line)] last:border-0">
                      <Td>
                        <div className="flex items-center gap-2">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[12px] font-black text-[#0a0a0a]" style={{ background: "linear-gradient(150deg,#ffe486,#cf9a1e)" }}>
                            {(p.full_name || p.email || "؟").trim().charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            {p.full_name && <div className="truncate font-bold text-white">{p.full_name}</div>}
                            <div className="flex items-center gap-1 truncate text-[12px] text-[var(--color-mute)]" dir="ltr">
                              <Mail size={11} /> {p.email}
                            </div>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        {m ? (
                          <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: m.color }}>
                            {Icon && <Icon size={14} />} {t(`premium.method.${p.payment_provider}`)}
                          </span>
                        ) : (
                          <span className="text-[var(--color-mute)]">{t("premium.method.none")}</span>
                        )}
                      </Td>
                      <Td>{p.plan_type ? t(`users.planTypes.${p.plan_type}`, { defaultValue: p.plan_type }) : "—"}</Td>
                      <Td className="font-bold text-white">{p.plan_type === "lifetime" ? t("premium.lifetimeCell") : "—"}</Td>
                      <Td>
                        <span className="inline-flex items-center gap-1 text-[var(--text-softer)]">
                          {tab === "active" ? <CalendarDays size={13} /> : <Clock size={13} />}
                          {p.premium_until ? fmtDate(p.premium_until) : t("premium.noEnd")}
                        </span>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* أعضاء عبر كود Stork */}
      <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)]">
        <div className="flex items-center justify-between border-b border-[var(--color-ink-line)] p-4">
          <h2 className="flex items-center gap-2 text-[16px] font-extrabold text-white">
            <KeyRound size={18} className="text-[var(--color-lime)]" /> {t("premium.viaStork")}
          </h2>
          <span className="rounded-lg bg-[var(--color-lime)]/15 px-2.5 py-1 text-[12px] font-bold text-[var(--color-lime)]">{usedCodes.length}</span>
        </div>
        {usedCodes.length === 0 ? (
          <div className="py-12 text-center text-[14px] text-[var(--color-mute)]">{t("premium.noStorkUsed")}</div>
        ) : (
          <ul className="divide-y divide-[var(--color-ink-line)]">
            {usedCodes.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 p-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--color-lime)]/12 text-[var(--color-lime)]">
                    <KeyRound size={15} />
                  </span>
                  <div className="min-w-0">
                    <span className="font-mono text-[13.5px] font-extrabold tracking-wider text-white" dir="ltr">
                      {c.code}
                    </span>
                    <div className="truncate text-[12px] text-[var(--color-mute)]" dir="ltr">
                      {c.member?.email || c.used_by || "—"}
                    </div>
                  </div>
                </div>
                <span className="shrink-0 text-[12px] text-[var(--color-mute)]">{fmtDate(c.used_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Th({ children }) {
  return <th className="px-4 py-2.5 text-start font-semibold">{children}</th>;
}
function Td({ children, className = "" }) {
  return <td className={`px-4 py-3 align-middle text-[var(--text-softer)] ${className}`}>{children}</td>;
}
