import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Info, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import CompanyOfferForm from "../../components/offer-form/CompanyOfferForm.jsx";
import { useBotGuard } from "../../components/auth/botGuard.jsx";
import { useAuth } from "../../lib/auth.jsx";
import { useCategories } from "../../lib/categories.jsx";
import { createRequest, requestFromForm, fetchPartnerOfferDetail, uploadPartnerLogo } from "../../lib/requests.js";

const MAX_PENDING = 5;

/**
 * فورم طلب عرض للشركة (جديد أو "اطلب تعديل" لعرض منشور).
 * نفس CompanyOfferForm (المعاينة الحية + "اقترح كود") بوضع partner:
 * قسم التواصل والشراكة، لوغو PNG/JPG/WebP ≤ 1MB في partner-logos، و honeypot.
 * الطلب يمرّ للمراجعة؛ العرض المنشور ما يتبدّلش حتى يوافق الأدمن.
 */
export default function PartnerOfferPage({ mode, pendingCount = 0 }) {
  const { t, i18n } = useTranslation();
  const { user, profile } = useAuth();
  const { categories } = useCategories();
  const { companyId } = useParams();
  const navigate = useNavigate();
  const guard = useBotGuard();
  const [initial, setInitial] = useState(mode === "new" ? null : undefined);
  const [loadErr, setLoadErr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (mode !== "edit") return;
    let active = true;
    fetchPartnerOfferDetail(Number(companyId))
      .then((d) => active && setInitial(d || null))
      .catch(() => active && setLoadErr(t("partnerForm.notYours")));
    return () => {
      active = false;
    };
  }, [mode, companyId, t]);

  const newInitial = { name: profile?.company_name || user?.user_metadata?.company_name || "" };
  const contactInitial = { website_url: profile?.website || "", whatsapp: profile?.phone || "", contact_name: profile?.full_name || "", contact_email: user?.email || "" };
  const limitReached = pendingCount >= MAX_PENDING;

  const submit = async (company, contact) => {
    setError("");
    const verdict = guard.check();
    if (verdict) return setError(verdict === "fast" ? t("auth.tooFast") : t("partnerForm.errorGeneric"));
    setSubmitting(true);
    try {
      await createRequest(user.id, requestFromForm(company, contact), mode === "edit" ? { type: "edit", companyId: Number(companyId) } : {});
      navigate("/dashboard", { state: { sent: Date.now() } });
    } catch (e) {
      const key = { too_many_pending: "tooMany", company_account_required: "companyOnly", not_your_company: "notYours" }[e.message];
      setError(key ? t(`partnerForm.${key}`, { max: MAX_PENDING }) : t("partnerForm.errorGeneric"));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[24px] font-black tracking-tight sm:text-[28px]">{mode === "edit" ? t("partnerForm.editTitle") : t("partnerForm.newTitle")}</h1>
          <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-[var(--text-soft)]">{mode === "edit" ? t("partnerForm.editSub") : t("partnerForm.newSub")}</p>
        </div>
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-ink-line)] px-3.5 py-2 text-[13.5px] font-bold text-[var(--text-softer)] hover:text-[var(--text)]">
          <ArrowRight size={15} className="ltr:rotate-180" /> {t("partnerForm.back")}
        </Link>
      </div>

      <p className="mb-5 flex items-start gap-2.5 rounded-2xl border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] px-4 py-3 text-[13.5px] leading-relaxed text-[var(--text-soft)]">
        <Info size={17} className="mt-0.5 shrink-0 text-[var(--accent-text)]" /> {t("partnerForm.reviewNote")}
      </p>

      {(error || loadErr || limitReached) && (
        <p role="alert" className="mb-5 flex items-start gap-2 rounded-2xl border border-red-500/30 bg-red-500/[0.08] px-4 py-3 text-[13.5px] font-semibold text-red-300">
          <AlertCircle size={17} className="mt-0.5 shrink-0" /> {error || loadErr || t("partnerForm.tooMany", { max: MAX_PENDING })}
        </p>
      )}

      {loadErr ? null : initial === undefined ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-5">
            {[200, 120, 260].map((h) => (
              <div key={h} className="animate-pulse rounded-[20px] bg-[var(--color-ink-card)]" style={{ height: h }} />
            ))}
          </div>
          <div className="h-[420px] animate-pulse rounded-[20px] bg-[var(--color-ink-card)]" />
        </div>
      ) : (
        <CompanyOfferForm
          key={mode === "edit" ? `edit-${companyId}` : "new"}
          mode="partner"
          lang={i18n.language}
          initial={mode === "edit" ? { ...initial, id: undefined } : newInitial}
          privateInitial={contactInitial}
          categories={categories}
          submitting={submitting || limitReached}
          uploadLogo={(file) => uploadPartnerLogo(file, user.id)}
          logoAccept="image/png,image/jpeg,image/webp"
          trap={guard.trap}
          submitLabel={mode === "edit" ? t("partnerForm.sendEdit") : t("partnerForm.send")}
          onCancel={() => navigate("/dashboard")}
          onSubmit={submit}
        />
      )}
    </>
  );
}
