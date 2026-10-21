import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { GlowSpot, useCardGlow } from "../../CardGlow.jsx";

// ============================================================
//  لوحة الأدمن v2 — عناصر مشتركة: نصوص عربية ثابتة (i18n)، بطاقة زجاجية بضوء يتبع الماوس،
//  رأس الصفحة، فلتر الفترة، skeleton، حالة فارغة.
// ============================================================

/** نصوص اللوحة: عربية ثابتة من ملفات الترجمة (admin.v2.*). */
export function useAdminT() {
  const { i18n } = useTranslation();
  return useMemo(() => i18n.getFixedT("ar", null, "admin.v2"), [i18n]);
}

export const LIME_BG = { background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" };
export const GOLD_BG = { background: "linear-gradient(135deg, #ffe486, #f0c63c 55%, #cf9a1e)" };

/** بطاقة زجاجية. glow = لون الضوء الذي يتبع الماوس (اختياري). */
export function Glass({ as: Tag = "div", glow, className = "", children, ...rest }) {
  const g = useCardGlow();
  const glowProps = glow ? { ref: g.ref, ...g.handlers } : {};
  return (
    <Tag
      {...glowProps}
      {...rest}
      className={`group relative overflow-hidden rounded-[20px] border border-white/[0.07] bg-white/[0.025] backdrop-blur-xl ${className}`}
    >
      {glow && <GlowSpot color={glow} />}
      <div className="relative">{children}</div>
    </Tag>
  );
}

export function PageHeader({ title, sub, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[24px] font-black tracking-tight text-white sm:text-[28px]">{title}</h1>
        {sub && <p className="mt-1 text-[13.5px] text-[var(--color-mute)]">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** اختيار من عدّة قيم (فلتر الفترة، عادي/Premium…). */
export function Segmented({ value, onChange, options, size = "md", label }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl border border-white/[0.08] bg-black/30 p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`rounded-lg font-bold transition-colors ${size === "sm" ? "px-2.5 py-1 text-[12px]" : "px-3.5 py-1.5 text-[13px]"} ${
              active ? "bg-[var(--color-lime)] text-[#0a0a0a]" : "text-[#a1a1aa] hover:text-white"
            }`}
            style={active && o.color ? { background: o.color } : undefined}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function RangeFilter({ value, onChange }) {
  const t = useAdminT();
  return (
    <Segmented
      value={value}
      onChange={onChange}
      label={t("range.label")}
      options={["today", "7d", "30d", "all"].map((v) => ({ value: v, label: t(`range.${v}`) }))}
    />
  );
}

export function Skeleton({ className = "", style }) {
  return <span style={style} className={`block animate-pulse rounded-lg bg-white/[0.06] ${className}`} />;
}

export function EmptyState({ icon: Icon, title, desc, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {Icon && (
        <span className="grid h-14 w-14 place-items-center rounded-2xl border border-white/[0.07] bg-white/[0.03] text-[#6b7280]">
          <Icon size={24} />
        </span>
      )}
      <p className="mt-4 text-[15px] font-extrabold text-white">{title}</p>
      {desc && <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-[var(--color-mute)]">{desc}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** رقم بتنسيق لاتيني بفواصل الآلاف (نفس أرقام الموقع). */
export const fmt = (n) => (n == null ? "—" : new Intl.NumberFormat("en-US").format(Number(n)));

/** تاريخ قصير بالعربية. */
export const fmtDate = (d, withTime = false) =>
  d
    ? new Date(d).toLocaleDateString("ar", { day: "numeric", month: "short", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) })
    : "—";

export const inputCls =
  "w-full rounded-xl border border-white/[0.08] bg-black/40 px-3.5 py-2.5 text-[14px] font-medium text-white outline-none transition-colors placeholder:text-[#4b4b52] focus:border-[var(--color-lime)]/70";
