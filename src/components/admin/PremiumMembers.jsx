import { Crown, CreditCard, Landmark, Wallet, KeyRound, CalendarDays, Mail } from "lucide-react";
import { USD_PLANS, fmtUSD, DZ_PLANS, fmtDZ } from "../../lib/plans.js";

// تسميات عربية (لوحة الأدمن عربية فقط)
const PLAN_LABEL = { month: "شهر", quarter: "3 أشهر", year: "سنة" };
const METHOD = {
  stripe: { label: "بطاقة دولية · Stripe", icon: CreditCard, color: "#635bff" },
  paypal: { label: "PayPal", icon: Wallet, color: "#0070ba" },
  slickpay: { label: "البطاقة الجزائرية · SlickPay", icon: Landmark, color: "#38bdf8" },
};

const fmtDate = (d) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("ar-DZ", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "—";
  }
};

// المبلغ حسب الباقة وطريقة الدفع (المصدر: plans.js للعرض)
function amountFor(p) {
  if (!p.plan_type) return "—";
  if (p.payment_provider === "slickpay") {
    const pl = DZ_PLANS.find((x) => x.key === p.plan_type);
    return pl ? fmtDZ(pl.price) : "—";
  }
  const pl = USD_PLANS.find((x) => x.key === p.plan_type);
  return pl ? fmtUSD(pl.price) : "—";
}

export default function PremiumMembers({ profiles = [], codes = [] }) {
  const paid = profiles.filter((p) => p.is_premium);
  const byId = Object.fromEntries(profiles.map((p) => [p.id, p]));
  const usedCodes = codes
    .filter((c) => c.is_used)
    .map((c) => ({ ...c, member: byId[c.used_by] }));

  return (
    <div className="grid gap-5">
      {/* المشتركون (دفعوا) */}
      <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)]">
        <div className="flex items-center justify-between border-b border-[var(--color-ink-line)] p-4">
          <h2 className="flex items-center gap-2 text-[16px] font-extrabold text-white">
            <Crown size={18} style={{ color: "#f0c63c" }} /> أعضاء Premium
          </h2>
          <span className="rounded-lg bg-[#f0c63c]/15 px-2.5 py-1 text-[12px] font-bold text-[#f0c63c]">{paid.length}</span>
        </div>

        {paid.length === 0 ? (
          <div className="py-12 text-center text-[14px] text-[var(--color-mute)]">لا أعضاء Premium بعد.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-start text-[13px]">
              <thead>
                <tr className="border-b border-[var(--color-ink-line)] text-[11.5px] text-[var(--color-mute)]">
                  <Th>العضو</Th>
                  <Th>طريقة الدفع</Th>
                  <Th>الباقة</Th>
                  <Th>المبلغ</Th>
                  <Th>ينتهي في</Th>
                </tr>
              </thead>
              <tbody>
                {paid.map((p) => {
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
                            {Icon && <Icon size={14} />} {m.label}
                          </span>
                        ) : (
                          <span className="text-[var(--color-mute)]">غير محدّد</span>
                        )}
                      </Td>
                      <Td>{PLAN_LABEL[p.plan_type] || "—"}</Td>
                      <Td className="font-bold text-white">{amountFor(p)}</Td>
                      <Td>
                        <span className="inline-flex items-center gap-1 text-[var(--text-softer)]">
                          <CalendarDays size={13} /> {fmtDate(p.premium_until)}
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
            <KeyRound size={18} className="text-[var(--color-lime)]" /> أعضاء عبر كود Stork
          </h2>
          <span className="rounded-lg bg-[var(--color-lime)]/15 px-2.5 py-1 text-[12px] font-bold text-[var(--color-lime)]">{usedCodes.length}</span>
        </div>

        {usedCodes.length === 0 ? (
          <div className="py-12 text-center text-[14px] text-[var(--color-mute)]">لم يُستعمل أي كود Stork بعد.</div>
        ) : (
          <ul className="divide-y divide-[var(--color-ink-line)]">
            {usedCodes.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 p-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--color-lime)]/12 text-[var(--color-lime)]">
                    <KeyRound size={15} />
                  </span>
                  <div className="min-w-0">
                    <span className="font-mono text-[13.5px] font-extrabold tracking-wider text-white" dir="ltr">{c.code}</span>
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
