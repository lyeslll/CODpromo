import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  PartyPopper,
  Plus,
  Users,
  Link2,
  CalendarClock,
  Copy,
  Check,
  MessageCircle,
  X,
  Loader2,
  AlertCircle,
  UserRound,
  UsersRound,
  Ban,
} from "lucide-react";
import {
  listGifts,
  fetchGiftStats,
  createGift,
  setGiftActive,
  listGiftRedemptions,
  revokeGift,
  formatGiftCode,
  giftUrl,
  giftDuration,
} from "../../../lib/gifts.js";
import { useAdminT, Glass, PageHeader, Segmented, Skeleton, EmptyState, fmt, fmtDate, inputCls, LIME_BG, GOLD_BG } from "./ui.jsx";

const GOLD = "#f0c63c";
const DURATIONS = [30, 90, 180, 365];
const STATUS_STYLE = {
  active: { color: "#a6f000", bg: "rgba(166,240,0,0.12)" },
  exhausted: { color: GOLD, bg: "rgba(240,198,60,0.12)" },
  expired: { color: "#a1a1aa", bg: "rgba(255,255,255,0.06)" },
  inactive: { color: "#6b7280", bg: "rgba(255,255,255,0.04)" },
};

/** نص المدة بالعربية الثابتة: nom ("3 أشهر") أو acc ("شهرين"، بعد "أهداك"). */
function useDurationText() {
  const { i18n } = useTranslation();
  const tAr = useMemo(() => i18n.getFixedT("ar"), [i18n]);
  return useCallback(
    (days, kase = "nom") => {
      const { unit, count } = giftDuration(days);
      return tAr(`gift.dur.${unit}${kase === "acc" ? "Acc" : "Nom"}`, { count });
    },
    [tAr]
  );
}

/** نسخ نص للحافظة (مع بديل للمتصفّحات القديمة). */
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/**
 * /admin/gifts — نظام الهدايا (phase30): روابط تعطي Premium مجاني لمدة محدّدة.
 * فوق: أرقام الهدايا برك (admin_gift_stats). "هدية جديدة": شخصية (مرة وحدة) أو دعوة جماعية (حدّ أقصى)،
 * المدة، الانتهاء الاختياري، والملاحظة. القائمة: نسخ الرابط، واتساب برسالة جاهزة، تشغيل/إيقاف،
 * والضغط على رابط يبيّن شكون استعملو مع "سحب الهدية". كل شي عبر RPCs تتحقق من is_admin.
 */
export default function GiftsPage({ notify }) {
  const t = useAdminT();
  const durText = useDurationText();
  const [rows, setRows] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(null);
  const [copied, setCopied] = useState(null);
  const copiedTimer = useRef(null);

  const loadStats = useCallback(() => {
    fetchGiftStats()
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  const load = useCallback(async () => {
    setError("");
    try {
      setRows(await listGifts());
    } catch {
      setError(t("gifts.loadError"));
      setRows([]);
    }
    loadStats();
  }, [t, loadStats]);

  useEffect(() => {
    load();
    return () => clearTimeout(copiedTimer.current);
  }, [load]);

  const copyLink = async (g) => {
    const ok = await copyText(giftUrl(g.code));
    if (!ok) return notify("error", t("gifts.copyFailed"));
    setCopied(g.id);
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(null), 1600);
  };

  const waHref = (g) => `https://wa.me/?text=${encodeURIComponent(t("gifts.waMessage", { duration: durText(g.duration_days, "acc"), url: giftUrl(g.code) }))}`;

  const toggle = async (g) => {
    setBusy(g.id);
    try {
      await setGiftActive(g.id, !g.is_active);
      setRows((prev) => prev.map((x) => (x.id === g.id ? { ...x, is_active: !g.is_active, status: computeStatus({ ...x, is_active: !g.is_active }) } : x)));
      loadStats();
    } catch (e) {
      notify("error", e.message);
    } finally {
      setBusy(null);
    }
  };

  const onCreated = (g) => {
    setRows((prev) => [g, ...(prev || [])]);
    loadStats();
  };
  const closeCreate = useCallback(() => setCreating(false), []);
  const closeDrawer = useCallback(() => setOpen(null), []);

  const onRevoked = (campaignId) => {
    setRows((prev) => prev.map((x) => (x.id === campaignId ? { ...x, active_holders: Math.max(0, (x.active_holders || 0) - 1) } : x)));
    loadStats();
  };

  const newBtn = (
    <button type="button" onClick={() => setCreating(true)} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13.5px] font-extrabold text-[#0a0a0a]" style={LIME_BG}>
      <Plus size={16} /> {t("gifts.new")}
    </button>
  );

  return (
    <>
      <PageHeader title={t("nav.gifts")} sub={t("pages.giftsSub")} actions={newBtn} />

      {/* أرقام الهدايا برك (منفصلة على مشتركي Premium والدخل) */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat icon={Users} label={t("gifts.stats.accounts")} value={stats?.active_accounts} color={GOLD} />
        <Stat icon={Link2} label={t("gifts.stats.links")} value={stats?.active_links} color="#a6f000" />
        <Stat icon={CalendarClock} label={t("gifts.stats.month")} value={stats?.uses_month} color="#ffe486" />
      </div>

      {error && (
        <p role="alert" className="mb-5 flex items-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/[0.08] px-4 py-3 text-[13.5px] font-semibold text-red-300">
          <AlertCircle size={17} /> {error}
        </p>
      )}

      <Glass className="p-4 sm:p-5">
        <div className="mb-4">
          <h2 className="text-[16px] font-extrabold text-white">{t("gifts.listTitle")}</h2>
          <p className="mt-0.5 text-[12.5px] text-[var(--color-mute)]">{t("gifts.listHint")}</p>
        </div>

        {rows === null ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[118px] rounded-2xl" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon={PartyPopper} title={t("gifts.emptyTitle")} desc={t("gifts.emptyDesc")} action={newBtn} />
        ) : (
          <ul className="space-y-3">
            {rows.map((g) => (
              <GiftRow
                key={g.id}
                gift={g}
                durText={durText}
                busy={busy === g.id}
                copied={copied === g.id}
                waHref={waHref(g)}
                onCopy={() => copyLink(g)}
                onToggle={() => toggle(g)}
                onOpen={() => setOpen(g)}
              />
            ))}
          </ul>
        )}
      </Glass>

      <CreateGiftModal open={creating} onClose={closeCreate} onCreated={onCreated} notify={notify} durText={durText} copyLink={copyLink} copied={copied} waHref={waHref} />
      <RedemptionsDrawer gift={open} onClose={closeDrawer} durText={durText} notify={notify} onRevoked={onRevoked} />
    </>
  );
}

const computeStatus = (g, now = Date.now()) => {
  if (!g.is_active) return "inactive";
  if (g.expires_at && new Date(g.expires_at).getTime() <= now) return "expired";
  if (g.uses_count >= g.max_uses) return "exhausted";
  return "active";
};

function Stat({ icon: Icon, label, value, color }) {
  return (
    <Glass glow={`${color}2e`} className="p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: `${color}1a`, color }}>
          <Icon size={20} />
        </span>
        <div className="min-w-0">
          <div className="text-[24px] font-black leading-none tabular-nums text-white [font-family:Inter,sans-serif]">{value == null ? <Skeleton className="h-6 w-10" /> : fmt(value)}</div>
          <div className="mt-1 truncate text-[12px] font-medium text-[var(--color-mute)]">{label}</div>
        </div>
      </div>
    </Glass>
  );
}

function GiftRow({ gift: g, durText, busy, copied, waHref, onCopy, onToggle, onOpen }) {
  const t = useAdminT();
  const status = g.status || computeStatus(g);
  const st = STATUS_STYLE[status];
  const KindIcon = g.kind === "group" ? UsersRound : UserRound;
  const pct = Math.min(100, Math.round(((g.uses_count || 0) / Math.max(1, g.max_uses)) * 100));

  return (
    <li className="rounded-2xl border border-white/[0.07] bg-[#0f0f12] p-3.5 sm:p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: "rgba(240,198,60,0.12)", color: GOLD }}>
          <KindIcon size={20} />
        </span>
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-start">
          <span className="block truncate text-[15px] font-extrabold text-white">{g.label || t("gifts.noLabel")}</span>
          <span className="mt-0.5 block truncate font-mono text-[12px] font-bold tracking-wider text-[#a1a1aa]">
            <bdi dir="ltr">{formatGiftCode(g.code)}</bdi>
          </span>
          <span className="mt-2 flex flex-wrap items-center gap-1.5">
            <Chip color={GOLD} bg="rgba(240,198,60,0.12)">{t(`gifts.kind.${g.kind}`)}</Chip>
            <Chip color="#ffe486" bg="rgba(255,228,134,0.08)">{durText(g.duration_days)}</Chip>
            <Chip color={st.color} bg={st.bg}>{t(`gifts.status.${status}`)}</Chip>
            <Chip color="#a1a1aa" bg="rgba(255,255,255,0.05)">{g.expires_at ? t("gifts.expiresOn", { date: fmtDate(g.expires_at) }) : t("gifts.noExpiry")}</Chip>
          </span>
        </button>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 pt-1.5" title={g.is_active ? t("gifts.disable") : t("gifts.enable")}>
          <input type="checkbox" className="peer sr-only" checked={!!g.is_active} disabled={busy} onChange={onToggle} aria-label={t("gifts.activeLabel")} />
          <span className="relative h-6 w-11 shrink-0 rounded-full bg-white/[0.12] transition-colors after:absolute after:start-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-[var(--color-lime)] peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-lime)]/60 rtl:peer-checked:after:-translate-x-5" />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-[160px] flex-1 sm:max-w-[260px]">
          <div className="flex items-center justify-between text-[12px] font-bold">
            <span className="text-[#a1a1aa]">{t("gifts.usage")}</span>
            <span className="tabular-nums text-white [font-family:Inter,sans-serif]" dir="ltr">
              {fmt(g.uses_count)}/{fmt(g.max_uses)}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.07]" role="progressbar" aria-valuemin={0} aria-valuemax={g.max_uses} aria-valuenow={g.uses_count} aria-label={t("gifts.usage")}>
            <span className="block h-full rounded-full" style={{ width: `${pct}%`, ...GOLD_BG }} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <ActionBtn onClick={onCopy} icon={copied ? Check : Copy} label={copied ? t("gifts.copied") : t("gifts.copy")} active={copied} />
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[12.5px] font-bold text-[#c9c9cf] transition-colors hover:border-[#25d366]/50 hover:bg-[#25d366]/10 hover:text-white"
          >
            <MessageCircle size={14} /> {t("gifts.whatsapp")}
          </a>
          <ActionBtn onClick={onOpen} icon={Users} label={t("gifts.whoUsed", { n: g.uses_count })} />
        </div>
      </div>
    </li>
  );
}

function Chip({ color, bg, children }) {
  return (
    <span className="whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ color, background: bg }}>
      {children}
    </span>
  );
}

function ActionBtn({ onClick, icon: Icon, label, active = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12.5px] font-bold transition-colors ${
        active ? "border-[var(--color-lime)]/50 bg-[var(--color-lime)]/10 text-[var(--color-lime)]" : "border-white/[0.08] text-[#c9c9cf] hover:bg-white/[0.06] hover:text-white"
      }`}
    >
      <Icon size={14} /> {label}
    </button>
  );
}

/* ===================== هدية جديدة ===================== */
function CreateGiftModal({ open, onClose, onCreated, notify, durText, copyLink, copied, waHref }) {
  const t = useAdminT();
  const [kind, setKind] = useState("personal");
  const [preset, setPreset] = useState(90);
  const [customDays, setCustomDays] = useState("");
  const [maxUses, setMaxUses] = useState("50");
  const [expires, setExpires] = useState("");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null);
  const firstRef = useRef(null);

  // تصفير الفورم كي تتحل النافذة برك (ماشي مع كل إعادة رسم للصفحة، وإلا يضيع الرابط الجاهز)
  useEffect(() => {
    if (!open) return;
    setKind("personal");
    setPreset(90);
    setCustomDays("");
    setMaxUses("50");
    setExpires("");
    setLabel("");
    setError("");
    setCreated(null);
    setTimeout(() => firstRef.current?.focus(), 60);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const days = preset === "custom" ? Number(customDays) : preset;
  // أول يوم مسموح لتاريخ الانتهاء (غداً) بتوقيت الجهاز
  const minDate = useMemo(() => {
    const d = new Date(Date.now() + 86400000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!Number.isInteger(days) || days < 1 || days > 3650) return setError(t("gifts.form.errDays"));
    const max = Number(maxUses);
    if (kind === "group" && (!Number.isInteger(max) || max < 2 || max > 100000)) return setError(t("gifts.form.errMax"));
    // الانتهاء: آخر اليوم المختار
    const exp = expires ? new Date(`${expires}T23:59:59`) : null;
    if (exp && (Number.isNaN(exp.getTime()) || exp.getTime() <= Date.now())) return setError(t("gifts.form.errExpiry"));
    setSaving(true);
    try {
      const g = await createGift({ kind, durationDays: days, maxUses: kind === "group" ? max : null, expiresAt: exp ? exp.toISOString() : null, label: label.trim() });
      onCreated(g);
      setCreated(g);
      notify("success", t("gifts.form.created"));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 grid place-items-center p-3 sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="gift-new-title"
            className="relative max-h-[92vh] w-full max-w-[480px] overflow-y-auto rounded-[22px] border border-white/[0.08] bg-[#0b0b0d] p-5 sm:p-6"
            initial={{ y: 24, scale: 0.97 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 16, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 id="gift-new-title" className="text-[19px] font-black text-white">
                  {created ? t("gifts.form.readyTitle") : t("gifts.new")}
                </h2>
                <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-mute)]">{created ? t("gifts.form.readySub") : t("gifts.form.sub")}</p>
              </div>
              <button type="button" onClick={onClose} aria-label={t("common.close")} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/[0.08] text-[#a1a1aa] hover:text-white">
                <X size={16} />
              </button>
            </div>

            {created ? (
              <div>
                <div className="rounded-2xl border border-[#f0c63c]/35 bg-[#f0c63c]/[0.06] p-4">
                  <p className="flex flex-wrap gap-1.5">
                    <Chip color={GOLD} bg="rgba(240,198,60,0.12)">{t(`gifts.kind.${created.kind}`)}</Chip>
                    <Chip color="#ffe486" bg="rgba(255,228,134,0.08)">{durText(created.duration_days)}</Chip>
                  </p>
                  <p className="mt-2.5 break-all font-mono text-[13px] font-bold text-white">
                    <bdi dir="ltr">{giftUrl(created.code)}</bdi>
                  </p>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => copyLink(created)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13.5px] font-extrabold text-[#0a0a0a]"
                    style={LIME_BG}
                  >
                    {copied === created.id ? <Check size={16} /> : <Copy size={16} />} {copied === created.id ? t("gifts.copied") : t("gifts.copy")}
                  </button>
                  <a
                    href={waHref(created)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#25d366]/45 bg-[#25d366]/10 px-4 py-2.5 text-[13.5px] font-extrabold text-white hover:bg-[#25d366]/20"
                  >
                    <MessageCircle size={16} /> {t("gifts.whatsapp")}
                  </a>
                </div>
                <button type="button" onClick={onClose} className="mt-3 w-full rounded-xl border border-white/[0.08] px-4 py-2.5 text-[13.5px] font-bold text-[#c9c9cf] hover:text-white">
                  {t("gifts.form.done")}
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-5">
                <fieldset>
                  <legend className="mb-2 text-[13px] font-bold text-[#c9c9cf]">{t("gifts.form.kind")}</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {["personal", "group"].map((k) => {
                      const active = kind === k;
                      const Icon = k === "group" ? UsersRound : UserRound;
                      return (
                        <button
                          key={k}
                          ref={k === "personal" ? firstRef : undefined}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => setKind(k)}
                          className={`rounded-xl border p-3 text-start transition-colors ${active ? "border-[#f0c63c]/70 bg-[#f0c63c]/[0.08]" : "border-white/[0.08] bg-black/30 hover:border-white/[0.16]"}`}
                        >
                          <span className="flex items-center gap-2 text-[14px] font-extrabold text-white">
                            <Icon size={16} style={{ color: active ? GOLD : "#a1a1aa" }} /> {t(`gifts.kind.${k}`)}
                          </span>
                          <span className="mt-1 block text-[11.5px] leading-snug text-[var(--color-mute)]">{t(`gifts.form.${k}Hint`)}</span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="mb-2 text-[13px] font-bold text-[#c9c9cf]">{t("gifts.form.duration")}</legend>
                  <div className="flex flex-wrap gap-2">
                    <Segmented
                      value={preset}
                      onChange={setPreset}
                      label={t("gifts.form.duration")}
                      size="sm"
                      options={[...DURATIONS.map((d) => ({ value: d, label: durText(d) })), { value: "custom", label: t("gifts.form.customDays") }]}
                    />
                  </div>
                  {preset === "custom" && (
                    <label className="mt-2.5 block">
                      <span className="sr-only">{t("gifts.form.daysLabel")}</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={3650}
                        value={customDays}
                        onChange={(e) => setCustomDays(e.target.value)}
                        placeholder={t("gifts.form.daysLabel")}
                        className={inputCls}
                        autoFocus
                      />
                    </label>
                  )}
                </fieldset>

                {kind === "group" && (
                  <label className="block">
                    <span className="mb-2 block text-[13px] font-bold text-[#c9c9cf]">{t("gifts.form.maxUses")}</span>
                    <input type="number" inputMode="numeric" min={2} max={100000} value={maxUses} onChange={(e) => setMaxUses(e.target.value)} className={inputCls} />
                  </label>
                )}

                <label className="block">
                  <span className="mb-2 block text-[13px] font-bold text-[#c9c9cf]">{t("gifts.form.expires")}</span>
                  <input type="date" min={minDate} value={expires} onChange={(e) => setExpires(e.target.value)} className={`${inputCls} [color-scheme:dark]`} />
                  <span className="mt-1.5 block text-[11.5px] text-[var(--color-mute)]">{t("gifts.form.expiresHint")}</span>
                </label>

                <label className="block">
                  <span className="mb-2 block text-[13px] font-bold text-[#c9c9cf]">{t("gifts.form.label")}</span>
                  <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} placeholder={t("gifts.form.labelPh")} className={inputCls} />
                </label>

                {error && (
                  <p role="alert" className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/[0.08] px-3.5 py-2.5 text-[12.5px] font-semibold text-red-300">
                    <AlertCircle size={15} /> {error}
                  </p>
                )}

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button type="button" onClick={onClose} className="rounded-xl border border-white/[0.08] px-4 py-2.5 text-[13.5px] font-bold text-[#c9c9cf] hover:text-white">
                    {t("gifts.form.cancel")}
                  </button>
                  <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-[13.5px] font-extrabold text-[#0a0a0a] disabled:opacity-60" style={LIME_BG}>
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <PartyPopper size={16} />} {t("gifts.form.create")}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ===================== من استعمل الرابط + سحب الهدية ===================== */
function RedemptionsDrawer({ gift, onClose, durText, notify, onRevoked }) {
  const t = useAdminT();
  const [list, setList] = useState(null);
  const [busy, setBusy] = useState(null);
  const closeRef = useRef(null);
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  // الجلب كي يتبدّل الرابط المفتوح برك (notify يتبدّل مع كل رسم للوحة)
  useEffect(() => {
    if (!gift) return;
    let active = true;
    setList(null);
    listGiftRedemptions(gift.id)
      .then((d) => active && setList(d))
      .catch((e) => {
        if (!active) return;
        setList([]);
        notifyRef.current("error", e.message);
      });
    setTimeout(() => closeRef.current?.focus(), 50);
    return () => {
      active = false;
    };
  }, [gift]);

  useEffect(() => {
    if (!gift) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [gift, onClose]);

  const revoke = async (r) => {
    if (!window.confirm(t("gifts.drawer.confirm", { name: r.full_name || r.email || t("gifts.drawer.deleted") }))) return;
    setBusy(r.id);
    try {
      const res = await revokeGift(r.id);
      setList((prev) => prev.map((x) => (x.id === r.id ? { ...x, revoked_at: res?.revoked_at || new Date().toISOString(), active: false } : x)));
      if (r.active) onRevoked(gift.id);
      notify("success", t("gifts.drawer.revokedToast"));
    } catch (e) {
      notify("error", e.message);
    } finally {
      setBusy(null);
    }
  };

  const stateOf = (r) => (r.revoked_at ? "revoked" : r.active ? "active" : "ended");
  const STATE_STYLE = { active: STATUS_STYLE.active, ended: STATUS_STYLE.expired, revoked: { color: "#f87171", bg: "rgba(248,113,113,0.12)" } };

  return (
    <AnimatePresence>
      {gift && (
        <>
          <motion.div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={t("gifts.drawer.title")}
            className="fixed inset-y-0 right-0 z-50 flex w-[440px] max-w-full flex-col overflow-y-auto border-l border-white/[0.07] bg-[#0b0b0d]"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
          >
            <div className="flex items-start gap-3 border-b border-white/[0.06] p-5">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl" style={{ background: "rgba(240,198,60,0.12)", color: GOLD }}>
                {gift.kind === "group" ? <UsersRound size={22} /> : <UserRound size={22} />}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[17px] font-black text-white">{gift.label || t("gifts.noLabel")}</h2>
                <p className="mt-0.5 truncate font-mono text-[12px] font-bold tracking-wider text-[#a1a1aa]">
                  <bdi dir="ltr">{formatGiftCode(gift.code)}</bdi>
                </p>
                <p className="mt-2 flex flex-wrap gap-1.5">
                  <Chip color={GOLD} bg="rgba(240,198,60,0.12)">{t(`gifts.kind.${gift.kind}`)}</Chip>
                  <Chip color="#ffe486" bg="rgba(255,228,134,0.08)">{durText(gift.duration_days)}</Chip>
                  <Chip color="#c9c9cf" bg="rgba(255,255,255,0.05)">
                    {t("gifts.usage")} <bdi dir="ltr">{fmt(gift.uses_count)}/{fmt(gift.max_uses)}</bdi>
                  </Chip>
                </p>
              </div>
              <button ref={closeRef} type="button" onClick={onClose} aria-label={t("common.close")} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/[0.08] text-[#a1a1aa] hover:text-white">
                <X size={16} />
              </button>
            </div>

            <div className="p-5">
              <h3 className="mb-3 text-[14px] font-extrabold text-white">{t("gifts.drawer.title")}</h3>
              {list === null ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-[74px] w-full rounded-xl" />
                  ))}
                </div>
              ) : list.length === 0 ? (
                <p className="rounded-xl border border-white/[0.06] px-4 py-8 text-center text-[13px] text-[var(--color-mute)]">{t("gifts.drawer.none")}</p>
              ) : (
                <ul className="space-y-2">
                  {list.map((r) => {
                    const s = stateOf(r);
                    return (
                      <li key={r.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <span className="block truncate text-[14px] font-bold text-white">
                              <bdi>{r.full_name || (r.user_id ? "—" : t("gifts.drawer.deleted"))}</bdi>
                            </span>
                            {r.email && (
                              <span className="block truncate text-[12px] text-[var(--color-mute)]">
                                <bdi dir="ltr">{r.email}</bdi>
                              </span>
                            )}
                          </div>
                          <Chip color={STATE_STYLE[s].color} bg={STATE_STYLE[s].bg}>
                            {t(`gifts.drawer.state.${s}`)}
                          </Chip>
                        </div>
                        <dl className="mt-2.5 grid grid-cols-2 gap-2 text-[12px]">
                          <div>
                            <dt className="text-[var(--color-mute)]">{t("gifts.drawer.redeemed")}</dt>
                            <dd className="mt-0.5 font-bold text-[#c9c9cf]">{fmtDate(r.redeemed_at, true)}</dd>
                          </div>
                          <div>
                            <dt className="text-[var(--color-mute)]">{r.revoked_at ? t("gifts.drawer.revokedAt") : t("gifts.drawer.until")}</dt>
                            <dd className="mt-0.5 font-bold text-[#c9c9cf]">{fmtDate(r.revoked_at || r.premium_until, true)}</dd>
                          </div>
                        </dl>
                        {!r.revoked_at && r.active && (
                          <button
                            type="button"
                            onClick={() => revoke(r)}
                            disabled={busy === r.id}
                            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 px-2.5 py-1.5 text-[12.5px] font-bold text-red-300 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                          >
                            {busy === r.id ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />} {t("gifts.drawer.revoke")}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="mt-4 text-[11.5px] leading-relaxed text-[var(--color-mute)]">{t("gifts.drawer.note")}</p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
