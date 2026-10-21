import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, X, Mail, Clock, CheckCircle2, XCircle, Inbox, MessageCircle, ClipboardCheck, Ban, Crown, ExternalLink, PencilLine } from "lucide-react";
import CompanyLogo from "../CompanyLogo.jsx";
import { OfferPreview } from "../offer-form/CompanyOfferForm.jsx";
import { getTypeMeta } from "../../lib/types.js";
import { waNumber } from "../../lib/requests.js";
import { Glass, Segmented, EmptyState, Skeleton, fmtDate, useAdminT } from "./v2/ui.jsx";

const STATUS = {
  pending: { color: "#fbbf24", icon: Clock },
  accepted: { color: "#a6f000", icon: CheckCircle2 },
  rejected: { color: "#ef4444", icon: XCircle },
};
const TABS = ["pending", "accepted", "rejected", "all"];

/**
 * طلبات الشركات: تبويبات (معلّقة / مقبولة / مرفوضة / الكل)، وكل طلب بمعاينته (عادي/Premium)
 * ومعلوماته وأزرار واتساب/إيميل. "مراجعة ونشر" يفتح /admin/requests/:id، و"رفض" بسبب يظهر للشركة.
 */
export default function RequestsManager({ requests, profiles, loading, onReject }) {
  const t = useAdminT();
  const [tab, setTab] = useState("pending");
  const [rejecting, setRejecting] = useState(null);

  const emailByUser = useMemo(() => Object.fromEntries(profiles.map((p) => [p.id, p.email])), [profiles]);
  const counts = useMemo(() => Object.fromEntries(TABS.map((k) => [k, k === "all" ? requests.length : requests.filter((r) => r.status === k).length])), [requests]);
  const rows = requests.filter((r) => tab === "all" || r.status === tab);

  return (
    <>
      <div className="mb-4">
        <Segmented value={tab} onChange={setTab} label={t("nav.requests")} options={TABS.map((k) => ({ value: k, label: `${t(`req.tab.${k}`)} (${counts[k]})` }))} />
      </div>

      {loading ? (
        <div className="grid gap-4">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-[260px] w-full rounded-[20px]" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Glass>
          <EmptyState icon={Inbox} title={t(`req.empty.${tab}`)} desc={t("req.emptyDesc")} />
        </Glass>
      ) : (
        <div className="grid gap-4">
          {rows.map((r) => (
            <RequestCard key={r.id} r={r} email={emailByUser[r.user_id]} onReject={() => setRejecting(r)} />
          ))}
        </div>
      )}

      <AnimatePresence>{rejecting && <RejectDialog request={rejecting} onClose={() => setRejecting(null)} onConfirm={async (reason) => { await onReject(rejecting, reason); setRejecting(null); }} />}</AnimatePresence>
    </>
  );
}

function RequestCard({ r, email, onReject }) {
  const t = useAdminT();
  const [face, setFace] = useState("normal");
  const st = STATUS[r.status] || STATUS.pending;
  const meta = getTypeMeta(r.type);
  const name = r.company_name || r.title || "—";
  const wa = waNumber(r.whatsapp);
  const waText = encodeURIComponent(t("req.waMessage", { name }));
  const mailTo = r.contact_email || email;
  const info = [
    [t("req.f.value"), r.discount || r.title],
    [t("req.f.code"), r.code, true],
    [t("req.f.premiumValue"), r.premium_discount],
    [t("req.f.premiumCode"), r.premium_code, true],
    [t("req.f.link"), r.link, true],
    [t("req.f.website"), r.website_url, true],
    [t("req.f.contact"), r.contact_name],
    [t("req.f.whatsapp"), r.whatsapp, true],
    [t("req.f.email"), mailTo, true],
    [t("req.f.commission"), r.commission_pct != null ? `${r.commission_pct}%` : null],
    [t("req.f.affiliate"), r.affiliate_url, true],
    [t("req.f.affiliateDash"), r.affiliate_dashboard_url, true],
  ].filter(([, v]) => v != null && v !== "");

  return (
    <Glass className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start gap-3">
        <CompanyLogo logo={r.logo} name={name} size={48} accent={meta.color} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[17px] font-black text-white">{name}</h3>
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-extrabold" style={{ background: `${st.color}1f`, color: st.color }}>
              <st.icon size={12} /> {t(`req.status.${r.status in STATUS ? r.status : "pending"}`)}
            </span>
            {r.request_type === "edit" && (
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 text-[11.5px] font-bold text-[#c9c9cf]">
                <PencilLine size={11} /> {t("req.editOf", { id: r.company_id })}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[12.5px] text-[var(--color-mute)]">
            {t("req.sentOn", { date: fmtDate(r.created_at, true) })}
            {email && (
              <>
                {" "}
                <bdi dir="ltr">{email}</bdi>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {wa && (
            <a href={`https://wa.me/${wa}?text=${waText}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-[#25d366]/15 px-3 py-2 text-[13px] font-extrabold text-[#4ade80] hover:bg-[#25d366]/25">
              <MessageCircle size={15} /> {t("req.whatsapp")}
            </a>
          )}
          {mailTo && (
            <a href={`mailto:${mailTo}?subject=${encodeURIComponent(t("req.mailSubject", { name }))}`} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-[13px] font-bold text-white hover:bg-white/5">
              <Mail size={15} /> {t("req.email")}
            </a>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-[320px_1fr]">
        <div>
          <div className="mb-2 inline-flex rounded-lg border border-white/10 bg-black/30 p-0.5" role="radiogroup" aria-label={t("req.preview")}>
            {["normal", "premium"].map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={face === f}
                onClick={() => setFace(f)}
                className="flex items-center gap-1 rounded-md px-2.5 py-1 text-[12px] font-bold"
                style={face === f ? { background: f === "premium" ? "#f0c63c" : meta.color, color: "#0a0a0a" } : { color: "#a1a1aa" }}
              >
                {f === "premium" && <Crown size={11} />} {t(`req.face.${f}`)}
              </button>
            ))}
          </div>
          <OfferPreview offer={r} premium={face === "premium"} />
        </div>

        <div className="min-w-0">
          <dl className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
            {info.map(([k, v, ltr]) => (
              <div key={k} className="min-w-0">
                <dt className="text-[11.5px] text-[var(--color-mute)]">{k}</dt>
                <dd className="mt-0.5 break-words text-[13.5px] font-bold text-white">{ltr ? <bdi dir="ltr">{v}</bdi> : v}</dd>
              </div>
            ))}
          </dl>
          {r.description && (
            <div className="mt-4">
              <div className="text-[11.5px] text-[var(--color-mute)]">{t("req.f.description")}</div>
              <p className="mt-0.5 whitespace-pre-line text-[13.5px] leading-relaxed text-[#c9c9cf]" dir="auto">
                {r.description}
              </p>
            </div>
          )}
          {r.message && (
            <div className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
              <div className="text-[11.5px] text-[var(--color-mute)]">{t("req.f.message")}</div>
              <p className="mt-0.5 whitespace-pre-line text-[13.5px] leading-relaxed text-[#c9c9cf]" dir="auto">
                {r.message}
              </p>
            </div>
          )}
          {r.status === "rejected" && r.rejection_reason && (
            <p className="mt-4 rounded-xl border border-red-500/25 bg-red-500/[0.06] px-3 py-2 text-[13px] text-red-200">
              <b>{t("req.reason")}</b> {r.rejection_reason}
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {r.status !== "accepted" && (
              <Link to={`/admin/requests/${r.id}`} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13.5px] font-extrabold text-[#0a0a0a]" style={{ background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" }}>
                <ClipboardCheck size={16} /> {t("req.review")}
              </Link>
            )}
            {r.status === "pending" && (
              <button type="button" onClick={onReject} className="inline-flex items-center gap-2 rounded-xl border border-red-500/40 px-4 py-2.5 text-[13.5px] font-bold text-red-300 hover:bg-red-500/10">
                <Ban size={15} /> {t("req.reject")}
              </button>
            )}
            {r.status === "accepted" && r.company_id && (
              <Link to={`/admin/companies/${r.company_id}`} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-[13.5px] font-bold text-white hover:bg-white/5">
                <ExternalLink size={15} /> {t("req.openCompany")}
              </Link>
            )}
          </div>
        </div>
      </div>
    </Glass>
  );
}

function RejectDialog({ request, onClose, onConfirm }) {
  const t = useAdminT();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const confirm = async () => {
    if (!reason.trim()) return setErr(t("req.reasonRequired"));
    setBusy(true);
    try {
      await onConfirm(reason.trim());
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  };
  return (
    <motion.div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 px-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rej-title"
        initial={{ y: 16, scale: 0.97 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 10 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-[20px] border border-white/[0.08] bg-[#0f0f12] p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <h3 id="rej-title" className="text-[16px] font-extrabold text-white">
            {t("req.rejectTitle", { name: request.company_name || request.title })}
          </h3>
          <button type="button" onClick={onClose} aria-label={t("common.close")} className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-[#a1a1aa]">
            <X size={14} />
          </button>
        </div>
        <p className="mt-1 text-[12.5px] text-[var(--color-mute)]">{t("req.rejectSub")}</p>
        <textarea
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          maxLength={500}
          placeholder={t("req.reasonPh")}
          aria-label={t("req.reason")}
          className="mt-4 w-full resize-y rounded-xl border border-white/[0.08] bg-black/40 px-3.5 py-2.5 text-[14px] text-white outline-none focus:border-red-400/60"
        />
        {err && <p className="mt-2 text-[12px] font-semibold text-red-400">{err}</p>}
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={confirm} disabled={busy} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500/90 py-2.5 text-[14px] font-extrabold text-white disabled:opacity-60">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Ban size={16} />} {t("req.confirmReject")}
          </button>
          <button type="button" onClick={onClose} className="rounded-xl border border-white/[0.08] px-4 py-2.5 text-[14px] font-bold text-[#c9c9cf]">
            {t("stork.cancel")}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
