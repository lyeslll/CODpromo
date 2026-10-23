import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Loader2, Crown, ExternalLink, AlertCircle, RotateCw, Gift } from "lucide-react";
import { useTranslation } from "react-i18next";
import Logo from "../components/Logo.jsx";
import Seo from "../components/Seo.jsx";
import PremiumModal from "../components/PremiumModal.jsx";
import { useAuth } from "../lib/auth.jsx";
import { usePremium } from "../lib/premium.jsx";
import { goToDeal } from "../lib/nocode.js";
import { offersLink } from "../lib/seo.js";

/**
 * /go/<slug>(?premium=1) — التحويل النظيف لعروض بلا كود.
 * RPC nocode_go تسجّل الضغطة وتُرجع الرابط، ثم window.location.replace (الرابط الحقيقي لا يظهر
 * في أي مكان من الواجهة — حتى الرابط الاحتياطي زرّ لا <a href>). Premium يُتحقَّق منه خادمياً؛
 * غير المشترك يرى نافذة Premium بدل التحويل. الصفحة noindex وممنوعة في robots.txt.
 */
export default function GoPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { slug = "" } = useParams();
  const [params] = useSearchParams();
  const premium = params.get("premium") === "1";
  const { user, loading: authLoading } = useAuth();
  const { unlocked, premiumReady } = usePremium();
  const [state, setState] = useState({ phase: "loading", name: "" });
  const [slow, setSlow] = useState(false);
  const [modal, setModal] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const urlRef = useRef(null);

  useEffect(() => {
    // ننتظر الجلسة (والملف والهدية) حتى تحمل الضغطة هوية المستخدم وحالة Premium الصحيحة
    if (authLoading || !premiumReady) return;
    let active = true;
    setSlow(false);
    if (premium && !unlocked) {
      setState({ phase: "premium", name: "" });
      setModal(true);
      return;
    }
    setState({ phase: "loading", name: "" });
    goToDeal(slug, premium)
      .then((r) => {
        if (!active) return;
        // القاعدة تقبل http(s) فقط (CHECK)، ونتحقق هنا أيضاً قبل أي تحويل
        if (r.status === "ok" && /^https?:\/\//i.test(r.url || "")) {
          urlRef.current = r.url;
          setState({ phase: "redirect", name: r.name || "" });
          window.location.replace(r.url);
        } else if (r.status === "premium_required") {
          setState({ phase: "premium", name: r.name || "" });
          setModal(true);
        } else if (r.status === "no_premium") {
          setState({ phase: "no_premium", name: r.name || "" });
        } else {
          setState({ phase: "not_found", name: "" });
        }
      })
      .catch(() => active && setState({ phase: "error", name: "" }));
    return () => {
      active = false;
    };
  }, [slug, premium, unlocked, user, authLoading, premiumReady, attempt]);

  // رابط احتياطي إذا لم يتمّ التحويل خلال لحظات
  useEffect(() => {
    if (state.phase !== "redirect") return;
    const id = setTimeout(() => setSlow(true), 2500);
    return () => clearTimeout(id);
  }, [state.phase]);

  const { phase, name } = state;
  const btn = "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-[14.5px] font-extrabold transition-colors";
  const ghost = `${btn} border border-[var(--color-ink-line)] bg-[var(--fill)] text-[var(--text)] hover:bg-[var(--fill-strong)]`;
  const normalLink = `/go/${encodeURIComponent(slug)}`;

  let body;
  if (phase === "loading" || phase === "redirect") {
    body = (
      <>
        <Badge>
          <Loader2 size={26} className="motion-safe:animate-spin" />
        </Badge>
        <h1 className="mt-6 text-[21px] font-black leading-snug" aria-live="polite">
          {name ? t("go.redirectTo", { name }) : t("go.redirecting")}
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--text-soft)]">{t("go.sub")}</p>
        {slow && urlRef.current && (
          <button type="button" onClick={() => window.location.assign(urlRef.current)} className={`${ghost} mt-7`}>
            <ExternalLink size={16} /> {t("go.fallback")}
          </button>
        )}
      </>
    );
  } else if (phase === "premium") {
    body = (
      <>
        <Badge gold>
          <Crown size={26} />
        </Badge>
        <h1 className="mt-6 text-[21px] font-black leading-snug">{t("go.premiumTitle")}</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--text-soft)]">{t("go.premiumSub")}</p>
        <div className="mt-7 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => setModal(true)}
            className={`${btn} text-[#0a0a0a]`}
            style={{ background: "linear-gradient(135deg, #ffe486, #cf9a1e)" }}
          >
            <Crown size={16} /> {t("go.openPremium")}
          </button>
          <Link to={normalLink} replace className={ghost}>
            <Gift size={16} /> {t("go.takeNormal")}
          </Link>
        </div>
      </>
    );
  } else if (phase === "no_premium") {
    body = (
      <>
        <Badge>
          <Gift size={26} />
        </Badge>
        <h1 className="mt-6 text-[21px] font-black leading-snug">{t("go.noPremiumTitle")}</h1>
        <div className="mt-7 flex flex-col gap-2.5">
          <Link to={normalLink} replace className={ghost}>
            <Gift size={16} /> {t("go.takeNormal")}
          </Link>
        </div>
      </>
    );
  } else if (phase === "error") {
    body = (
      <>
        <Badge>
          <AlertCircle size={26} />
        </Badge>
        <h1 className="mt-6 text-[21px] font-black leading-snug">{t("go.error")}</h1>
        <div className="mt-7 flex flex-col gap-2.5">
          <button type="button" onClick={() => setAttempt((a) => a + 1)} className={ghost}>
            <RotateCw size={16} /> {t("go.retry")}
          </button>
        </div>
      </>
    );
  } else {
    body = (
      <>
        <Badge>
          <Gift size={26} />
        </Badge>
        <h1 className="mt-6 text-[21px] font-black leading-snug">{t("go.notFound")}</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--text-soft)]">{t("go.notFoundSub")}</p>
        <div className="mt-7 flex flex-col gap-2.5">
          <Link to={offersLink(lang, { kind: "nocode" })} className={ghost}>
            {t("go.browse")}
          </Link>
        </div>
      </>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[var(--color-ink)] px-5 py-12 text-[var(--text)]">
      <Seo lang={lang} title={t("go.title")} description={t("go.sub")} noindex />
      <main className="w-full max-w-sm text-center">
        <div className="flex justify-center">
          <Logo />
        </div>
        <div className="mt-10">{body}</div>
      </main>
      <PremiumModal open={modal} onClose={() => setModal(false)} />
    </div>
  );
}

function Badge({ gold = false, children }) {
  return (
    <span
      className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border"
      style={
        gold
          ? { borderColor: "rgba(240,198,60,0.4)", background: "rgba(240,198,60,0.1)", color: "#f0c63c" }
          : { borderColor: "rgba(183,148,255,0.32)", background: "rgba(183,148,255,0.1)", color: "#b794ff" }
      }
    >
      {children}
    </span>
  );
}
