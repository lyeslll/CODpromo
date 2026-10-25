import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, ChevronLeft, CreditCard, Landmark, Loader2, Lock, LogIn, Smartphone, UserPlus, Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";
import KeysSheet from "./KeysSheet.jsx";
import { DiamondGlyph } from "./DiamondKey.jsx";
import { DIA, DIA_BG, DIA_DEEP, DIA_SOFT } from "./diamond.js";
import { useAuth } from "../../lib/auth.jsx";
import { useKeys } from "../../lib/keysContext.jsx";
import { useAndroidApp } from "../../lib/androidApp.js";
import { formatPrice } from "../../lib/pricing.jsx";
import { setPendingKeys, startKeysCheckout, KEYS_DEMO } from "../../lib/keys.js";
import { getKeysPlayPrices, purchaseKeysPlay } from "../../lib/keysPlay.js";

const WEB_METHODS = [
  { key: "slickpay", icon: Landmark, currency: "dzd" },
  { key: "stripe", icon: CreditCard, currency: "usd" },
  { key: "paypal", icon: Wallet, currency: "usd" },
];

// خطأ الخادم (keys-checkout) → رسالة (keys.buyErr.*)
const ERR = { has_premium: "hasPremium", limit: "limit", inactive: "inactive", outdated: "outdated" };

/**
 * شراء باقة مفاتيح: ملخص (العدد، السعر من الخادم، وسم سعر التجربة) ثم طرق الدفع — الموقع: SlickPay / Stripe /
 * PayPal، داخل التطبيق: Google Play برك (بلا أي ذكر لطرق أخرى ولا للرصيد). زائر → "أنشئ حسابك أولاً" ويرجع
 * لنفس الباقة. المبلغ الموثوق يتقرّر في الخادم. المعاينة: صفحة رجوع تجريبية بلا بوابة.
 */
export default function KeysCheckout({ open, pack, maxKeys, onClose }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const navigate = useNavigate();
  const { user } = useAuth();
  const keys = useKeys();
  const appMode = useAndroidApp();
  const [paying, setPaying] = useState(null);
  const [error, setError] = useState("");
  const [playPrice, setPlayPrice] = useState(null);

  useEffect(() => {
    if (!open) return;
    setPaying(null);
    setError("");
  }, [open]);

  useEffect(() => {
    if (!open || appMode !== "app" || !pack?.playProductId) return;
    let alive = true;
    getKeysPlayPrices([pack.playProductId]).then((m) => alive && setPlayPrice(m[pack.playProductId] || null));
    return () => {
      alive = false;
    };
  }, [open, appMode, pack?.playProductId]);

  if (!pack) return null;
  const guest = !user && !keys.demo;
  const blocked = keys.status === "hidden" && !keys.demo;

  const toAuth = (path) => {
    setPendingKeys(pack.id, lang);
    onClose();
    navigate(path);
  };

  const errText = (e) => {
    const k = ERR[e?.code] || "generic";
    return t(`keys.buyErr.${k}`, { count: e?.maxKeys ?? maxKeys ?? 0 });
  };

  const payWeb = async (m) => {
    if (paying) return;
    setError("");
    setPaying(m.key);
    try {
      await startKeysCheckout(m.key, pack.id);
    } catch (e) {
      setPaying(null);
      setError(errText(e));
    }
  };

  const payPlay = async () => {
    if (paying) return;
    setError("");
    setPaying("play");
    const r = await purchaseKeysPlay(pack.playProductId);
    setPaying(null);
    if (!r.ok) {
      if (r.errorKey === "cancelled") return;
      return setError(t(`keys.playErr.${r.errorKey || "generic"}`));
    }
    keys.refresh();
    onClose();
    navigate(`/keys/return?via=google_play&pack=${encodeURIComponent(pack.id)}`);
  };

  const methods = appMode === "app" ? [{ key: "play", icon: Smartphone }] : appMode === "web" ? WEB_METHODS : [];

  return (
    <KeysSheet
      open={open}
      onClose={onClose}
      busy={!!paying}
      labelledBy="keys-checkout-title"
      title={guest ? t("keys.buy.accountTitle") : t("keys.buy.title")}
      icon={
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: DIA_BG }}>
          <DiamondGlyph size={20} />
        </span>
      }
    >
      {/* ملخص الطلب */}
      <div className="ticket" style={{ "--r": "11px", "--edge-base": `${DIA_DEEP}88`, "--edge-strong": `${DIA}aa`, "--perf": `${DIA}88` }}>
        <div className="ticket-top relative px-4 pb-4 pt-3.5" style={{ background: "linear-gradient(160deg, rgba(169,205,255,0.16), rgba(169,205,255,0.03) 65%), var(--color-ink-card)" }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[15px] font-extrabold text-[var(--text)]">{t("keys.count", { count: pack.keys })}</p>
              <p className="mt-0.5 text-[12px] font-bold" style={{ color: DIA_SOFT }}>
                {t("keys.buy.forever")}
              </p>
            </div>
            {pack.tier === "test" && (
              <span className="shrink-0 rounded-full border border-[#38bdf8]/50 bg-[#38bdf8]/15 px-2.5 py-1 text-[11px] font-black text-[#7dd3fc]">{t("pricing.testBadge")}</span>
            )}
          </div>
          <p className="mt-3 text-[24px] font-black leading-none" style={{ color: DIA_SOFT }}>
            <bdi>{appMode === "app" && playPrice ? playPrice : formatPrice(t, lang, pack.priceDzd, pack.priceUsd)}</bdi>
          </p>
        </div>
      </div>

      {blocked ? (
        <p className="mt-5 rounded-xl border border-[#f0c63c]/30 bg-[#f0c63c]/[0.06] px-3.5 py-3 text-[13.5px] font-semibold leading-relaxed text-[var(--text-softer)]">{t("keys.buyErr.hasPremium")}</p>
      ) : guest ? (
        <div className="mt-5 flex flex-col">
          <p className="text-[14px] leading-[1.75] text-[var(--text-soft)]">{t("keys.buy.accountDesc")}</p>
          <button type="button" onClick={() => toAuth("/signup")} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-[15px] font-extrabold" style={{ background: DIA_BG, color: "#0b1430" }}>
            <UserPlus size={18} /> {t("checkout.accountSignup")}
          </button>
          <button type="button" onClick={() => toAuth("/login")} className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--color-ink-line)] px-6 py-3.5 text-[15px] font-bold text-[var(--text)] transition-colors hover:bg-[var(--fill)]">
            <LogIn size={17} /> {t("checkout.accountLogin")}
          </button>
        </div>
      ) : (
        <>
          <p className="mb-2.5 mt-6 text-[13px] font-extrabold text-[var(--text-softer)]">{t("checkout.methodsLabel")}</p>
          {error && (
            <div role="alert" className="mb-2.5 rounded-xl border border-red-500/30 bg-red-500/[0.08] px-3.5 py-2 text-[12.5px] font-semibold text-red-400">
              {error}
            </div>
          )}
          <div className="flex flex-col gap-2" aria-busy={appMode === "checking"}>
            {appMode === "checking" && <div aria-hidden className="h-[72px] animate-pulse rounded-2xl bg-[var(--fill-strong)]" />}
            {methods.map((m) => {
              const busy = paying === m.key;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => (m.key === "play" ? payPlay() : payWeb(m))}
                  disabled={!!paying && !busy}
                  aria-busy={busy}
                  className="group flex w-full items-center gap-3 rounded-2xl border p-3 text-start transition-colors hover:border-[#a9cdff]/70 hover:bg-[rgba(169,205,255,0.07)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a9cdff] disabled:cursor-not-allowed disabled:opacity-55"
                  style={{ borderColor: busy ? DIA : "var(--color-ink-line)", background: busy ? "rgba(169,205,255,0.1)" : "var(--color-ink)" }}
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border" style={{ borderColor: `${DIA_DEEP}66`, background: "rgba(169,205,255,0.08)", color: DIA_SOFT }}>
                    {busy ? <Loader2 size={19} className="animate-spin" /> : <m.icon size={20} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-[14.5px] font-extrabold text-[var(--text)]">{t(`premium.methods.${m.key}Name`)}</span>
                      {m.currency && <span className="rounded-md bg-[var(--fill-strong)] px-1.5 py-0.5 text-[10.5px] font-bold text-[var(--text-soft)]">{t(`checkout.${m.currency}`)}</span>}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-[var(--text-soft)]">
                      {busy ? t("checkout.redirecting") : m.key === "play" && playPrice ? t("premium.playPrice", { price: playPrice }) : t(`premium.methods.${m.key}Desc`)}
                    </span>
                  </span>
                  <ChevronLeft size={18} className="shrink-0 text-[var(--color-mute)] transition-colors group-hover:text-[#a9cdff] ltr:rotate-180" />
                </button>
              );
            })}
          </div>
          {KEYS_DEMO && <p className="mt-3 text-center text-[11.5px] font-bold text-[var(--color-mute)]">{t("keys.buy.demoNote")}</p>}
        </>
      )}

      <p className="mt-4 flex items-start gap-2 text-[12px] leading-relaxed text-[var(--color-mute)]">
        <Lock size={13} className="mt-[2px] shrink-0" /> {t("checkout.secure")}
      </p>
      <p className="mt-1.5 flex items-start gap-2 text-[12px] leading-relaxed text-[var(--color-mute)]">
        {/* "ما لم يُحسب في Premium" = الموقع برك (داخل التطبيق ووقت الفحص: بلا ذكر للخصم من Premium) */}
        <Check size={13} strokeWidth={3} className="mt-[2px] shrink-0 text-[var(--color-lime)]" /> {t(appMode === "web" ? "keys.buy.refund" : "keys.buy.refundApp")}
      </p>
      <div className="mt-4 border-t border-dashed border-[var(--color-ink-line)] pt-3 text-[12.5px]">
        <Link to="/terms#keys" onClick={onClose} className="font-bold text-[var(--text-soft)] underline decoration-dotted underline-offset-4 transition-colors hover:text-[var(--text)]">
          {t("pricing.terms")}
        </Link>
      </div>
    </KeysSheet>
  );
}
