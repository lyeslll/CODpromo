import { useEffect, useMemo, useState } from "react";
import { Star, Eye, EyeOff, Loader2, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Glass, PageHeader, Skeleton, EmptyState } from "./ui.jsx";
import CompanyLogo from "../../CompanyLogo.jsx";
import { listRatings, setRatingHidden } from "../../../lib/ratings.js";

// ============================================================
//  /admin/ratings — تقييمات الشركات (phase34): القائمة، فلتر حسب الشركة، تخبية / إظهار تقييم.
//  التقييم المخبّي ما يدخلش في المعدّل ولا في الصفحة. القاعدة تتحقق من is_admin في كل نداء.
// ============================================================
export default function RatingsPage({ notify }) {
  const { i18n } = useTranslation();
  const t = useMemo(() => i18n.getFixedT("ar", null, "admin.v2.ratings"), [i18n]);
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    listRatings()
      .then(setRows)
      .catch((e) => {
        setRows([]);
        notify?.("error", e.message);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = async (r) => {
    setBusy(r.id);
    try {
      await setRatingHidden(r.id, !r.hidden);
      setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, hidden: !r.hidden } : x)));
      notify?.("success", r.hidden ? t("shown") : t("hiddenOk"));
    } catch (e) {
      notify?.("error", e.message);
    } finally {
      setBusy(null);
    }
  };

  const list = (rows || []).filter((r) => {
    const s = q.trim().toLowerCase();
    return !s || [r.company_name, r.email, r.full_name].some((v) => String(v || "").toLowerCase().includes(s));
  });
  const visible = (rows || []).filter((r) => !r.hidden);
  const avg = visible.length ? (visible.reduce((a, r) => a + r.stars, 0) / visible.length).toFixed(1) : "—";

  return (
    <>
      <PageHeader title={t("title")} sub={t("sub")} />
      <div className="mb-4 grid grid-cols-3 gap-3">
        {[
          [t("total"), rows ? rows.length : "…"],
          [t("visible"), rows ? visible.length : "…"],
          [t("avg"), rows ? avg : "…"],
        ].map(([label, value]) => (
          <Glass key={label} className="p-4">
            <p className="text-[12px] font-bold text-[#6b7280]">{label}</p>
            <p className="mt-1 text-[24px] font-black text-white [font-family:Inter,sans-serif]">{value}</p>
          </Glass>
        ))}
      </div>
      <Glass className="p-4 sm:p-5">
        <label className="relative mb-4 block max-w-xs">
          <Search size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[#6b7280]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} className="w-full rounded-xl border border-[var(--color-ink-line)] bg-[#0c0c0e] py-2.5 pe-3 ps-9 text-[13px] text-white outline-none focus:border-[var(--color-lime)]" />
        </label>
        {rows === null ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <EmptyState icon={Star} title={t("empty")} desc={t("emptyDesc")} />
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {list.map((r) => (
              <li key={r.id} className={`flex flex-wrap items-center gap-3 py-3 ${r.hidden ? "opacity-50" : ""}`}>
                <CompanyLogo logo={r.company_logo} name={r.company_name} size={36} />
                <div className="min-w-[160px] flex-1">
                  <p className="text-[13.5px] font-extrabold text-white">{r.company_name}</p>
                  <p className="text-[12px] text-[#6b7280]" dir="ltr">
                    {r.full_name ? `${r.full_name} · ` : ""}
                    {r.email}
                  </p>
                </div>
                <span className="flex items-center gap-0.5 text-[#fbbf24]" aria-label={`${r.stars}/5`}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} size={14} className={n <= r.stars ? "fill-current" : "text-white/15"} />
                  ))}
                </span>
                <span className="flex flex-wrap gap-1">
                  {(r.tags || []).map((tag) => (
                    <span key={tag} className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[11px] font-bold text-[#c9c9cf]">
                      {i18n.getFixedT("ar")(`storePage.rating.tags.${tag}`)}
                    </span>
                  ))}
                </span>
                <span className="text-[11.5px] text-[#6b7280] [font-family:Inter,sans-serif]">{new Date(r.updated_at).toLocaleDateString("ar-DZ-u-nu-latn")}</span>
                <button
                  type="button"
                  onClick={() => toggle(r)}
                  disabled={busy === r.id}
                  className="flex min-h-[40px] items-center gap-1.5 rounded-xl border border-white/[0.08] px-3 text-[12.5px] font-bold text-[#c9c9cf] hover:bg-white/[0.05]"
                >
                  {busy === r.id ? <Loader2 size={14} className="animate-spin" /> : r.hidden ? <Eye size={14} /> : <EyeOff size={14} />}
                  {r.hidden ? t("show") : t("hide")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Glass>
    </>
  );
}
