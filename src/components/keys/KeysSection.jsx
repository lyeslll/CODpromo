import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Crown, Infinity as InfinityIcon, LockOpen, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DiamondGlyph, DiamondKey } from "./DiamondKey.jsx";
import KeysCheckout from "./KeysCheckout.jsx";
import { DIA, DIA_BG, DIA_DEEP, DIA_INK, DIA_SOFT } from "./diamond.js";
import { formatMoney } from "./money.js";
import { useAuth } from "../../lib/auth.jsx";
import { useKeys } from "../../lib/keysContext.jsx";
import { useAndroidApp } from "../../lib/androidApp.js";
import { formatPrice } from "../../lib/pricing.jsx";
import { clearPendingKeys, demoPacks, fetchKeyPacks } from "../../lib/keys.js";
import { getKeysPlayPrices, syncKeysPlay } from "../../lib/keysPlay.js";
import { formatNumber } from "../../lib/values.js";
import "./keys.css";

const GOLD = "#f0c63c";

/**
 * /premium — قسم المفاتيح الماسية (#keys)، الخيار الثاني تحت Premium: الباقات (السعر من القاعدة، ولا سعر
 * التجربة لهاد الحساب)، القواعد، والنظام العادل (الموقع برك). Premium حقيقي (مدفوع / Stork / أدمن): القسم
 * ما يبانش؛ مول الهدية يشوفو. ما نبيعوش مفاتيح أكثر من الأكواد المقفولة (الباقة اللي تفوت الحدّ معطّلة).
 * ?keys=<pack> (رجوع بعد الدخول) → القسم قدّامو والنافذة تتحلّ.
 */
export default function KeysSection({ member }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const keys = useKeys();
  const appMode = useAndroidApp();
  const [data, setData] = useState(null);
  const [checkout, setCheckout] = useState(null);
  const [playPrices, setPlayPrices] = useState({});

  const hidden = member && !keys.demo;

  useEffect(() => {
    if (hidden || authLoading) return;
    let alive = true;
    fetchKeyPacks()
      .then((d) => alive && setData(keys.demo ? { ...d, packs: d.packs.map((p) => ({ ...p, fits: true })), maxKeys: null, blocked: false } : d))
      .catch(() => alive && setData(keys.demo ? demoPacks() : { packs: [], error: true }));
    return () => {
      alive = false;
    };
  }, [hidden, authLoading, user?.id, keys.demo]);

  // داخل التطبيق: أسعار Google Play + مشتريات ما تأكّدتش (consumable)
  const productIds = useMemo(() => (data?.packs || []).map((p) => p.playProductId).filter(Boolean), [data]);
  useEffect(() => {
    if (appMode !== "app" || !productIds.length) return;
    let alive = true;
    getKeysPlayPrices(productIds).then((m) => alive && setPlayPrices(m));
    if (user) syncKeysPlay(productIds).then((ok) => ok && keys.refresh());
    return () => {
      alive = false;
    };
  }, [appMode, productIds, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // رجوع بعد الدخول (?keys=<pack>): القسم قدّامو والنافذة تتحلّ للباقة
  useEffect(() => {
    const q = new URLSearchParams(location.search).get("keys");
    if (!q || !data || authLoading) return;
    clearPendingKeys();
    const params = new URLSearchParams(location.search);
    params.delete("keys");
    const s = params.toString();
    navigate(`${location.pathname}${s ? `?${s}` : ""}#keys`, { replace: true });
    requestAnimationFrame(() => document.getElementById("keys")?.scrollIntoView({ block: "start" }));
    const pack = data.packs.find((p) => p.id === q && p.fits);
    if (pack && user) setCheckout(pack);
  }, [location.search, data, authLoading, user]); // eslint-disable-line react-hooks/exhaustive-deps

  if (hidden) return null;
  const packs = data?.packs || [];
  const credit = keys.showCredit ? keys.credit : null;
  const maxKeys = data?.maxKeys;
  const perKey = (p) => formatMoney(t, lang, Math.round(p.priceDzd / p.keys), "DZD");

  return (
    <section id="keys" aria-labelledby="keys-title" className="relative mx-auto max-w-5xl scroll-mt-28 px-4 pb-16 pt-6 sm:pb-20">
      <div
        className="ticket relative"
        style={{ "--r": "16px", "--edge-base": `${DIA_DEEP}66`, "--edge-strong": `${DIA}99`, "--perf": `${DIA}77` }}
      >
        <div className="ticket-top relative overflow-hidden px-5 pb-7 pt-8 sm:px-10 sm:pt-10" style={{ background: "radial-gradient(70% 90% at 85% 0%, rgba(169,205,255,0.16), transparent 70%), var(--color-ink-card)" }}>
          <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto]">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[12.5px] font-extrabold" style={{ borderColor: `${DIA_DEEP}88`, color: DIA_SOFT, background: "rgba(169,205,255,0.08)" }}>
                <DiamondGlyph size={14} /> {t("keys.section.pill")}
              </span>
              <h2 id="keys-title" className="mt-4 text-balance text-[28px] font-black leading-tight sm:text-[38px]">
                {t("keys.section.title")}
              </h2>
              <p className="mt-3 max-w-xl text-[15.5px] leading-[1.85] text-[var(--text-soft)]">{t("keys.section.sub")}</p>
            </div>
            <motion.div
              initial={{ opacity: 0, rotate: -14, y: 10 }}
              whileInView={{ opacity: 1, rotate: -6, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="hidden justify-self-center lg:block"
            >
              <DiamondKey sparkle flip={i18n.dir() === "ltr"} className="h-auto w-[260px] drop-shadow-[0_18px_30px_rgba(150,195,255,0.35)]" />
            </motion.div>
          </div>

          {/* الباقات */}
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            {(packs.length ? packs : [null, null]).map((p, i) => {
              const fits = p ? p.fits && (maxKeys == null || p.keys <= maxKeys) : true;
              return (
                <div key={p?.id || i} className="relative flex flex-col rounded-2xl border p-4 sm:p-5" style={{ borderColor: `${DIA_DEEP}55`, background: "linear-gradient(170deg, rgba(169,205,255,0.1), rgba(169,205,255,0.02) 60%), var(--color-ink)" }}>
                  {p ? (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <p className="flex items-center gap-2 text-[17px] font-black text-[var(--text)]">
                          <DiamondGlyph size={18} /> {t("keys.count", { count: p.keys })}
                        </p>
                        {p.tier === "test" && <span className="rounded-full border border-[#38bdf8]/50 bg-[#38bdf8]/15 px-2.5 py-0.5 text-[11px] font-black text-[#7dd3fc]">{t("pricing.testBadge")}</span>}
                      </div>
                      <p className="mt-3 text-[26px] font-black leading-none" style={{ color: DIA_SOFT }}>
                        <bdi>{appMode === "app" && playPrices[p.playProductId] ? playPrices[p.playProductId] : formatPrice(t, lang, p.priceDzd, p.priceUsd)}</bdi>
                      </p>
                      {appMode !== "app" && p.tier !== "test" && <p className="mt-1.5 text-[12.5px] font-bold text-[var(--text-soft)]">{t("keys.section.perKey", { price: perKey(p) })}</p>}
                      <button
                        type="button"
                        onClick={() => setCheckout(p)}
                        disabled={!fits}
                        className="dk-glint mt-4 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[14.5px] font-extrabold disabled:cursor-not-allowed disabled:opacity-50"
                        style={{ background: DIA_BG, color: DIA_INK }}
                      >
                        <DiamondGlyph size={16} /> {t("keys.section.buy")}
                      </button>
                      {!fits && <p className="mt-2 text-[12px] font-bold text-[var(--text-soft)]">{t("keys.section.limit", { count: Math.max(maxKeys ?? 0, 0) })}</p>}
                    </>
                  ) : (
                    <div aria-hidden className="h-[132px] animate-pulse rounded-xl bg-[var(--fill-strong)]" />
                  )}
                </div>
              );
            })}
          </div>
          {user && maxKeys != null && maxKeys > 0 && (
            <p className="mt-3 text-[12.5px] font-bold text-[var(--text-soft)]">{t("keys.section.lockedLeft", { count: maxKeys, n: formatNumber(maxKeys, lang) })}</p>
          )}
        </div>

        {/* القواعد + النظام العادل */}
        <div className="ticket-stub relative px-5 py-6 sm:px-10" style={{ background: "rgba(169,205,255,0.05)" }}>
          <span className="ticket-ring ticket-ring-l" />
          <span className="ticket-ring ticket-ring-r" />
          <span className="ticket-perf" />
          <ul className="grid gap-3 text-[13.5px] leading-relaxed text-[var(--text-softer)] sm:grid-cols-3">
            {[
              [LockOpen, "keys.section.rule1"],
              [InfinityIcon, "keys.section.rule2"],
              [RotateCcw, "keys.section.rule3"],
            ].map(([Icon, k]) => (
              <li key={k} className="flex items-start gap-2.5">
                <Icon size={17} className="mt-[3px] shrink-0" style={{ color: DIA_SOFT }} />
                <span>{t(k)}</span>
              </li>
            ))}
          </ul>
          {keys.showCredit && (
            <p className="mt-5 flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[13.5px] font-bold leading-relaxed text-[var(--text-softer)]" style={{ borderColor: `${GOLD}40`, background: "rgba(240,198,60,0.06)" }}>
              <Crown size={16} className="mt-[3px] shrink-0" style={{ color: GOLD }} />
              <span>
                {credit && credit.creditDzd > 0
                  ? credit.covered
                    ? t("keys.credit.covered", { paid: formatMoney(t, lang, credit.creditDzd, "DZD") })
                    : t("keys.credit.line", { paid: formatMoney(t, lang, credit.creditDzd, "DZD"), due: formatPrice(t, lang, credit.dueDzd, credit.dueUsd) })
                  : t("keys.section.fair")}
              </span>
            </p>
          )}
        </div>
      </div>

      <KeysCheckout open={!!checkout} pack={checkout} maxKeys={maxKeys} onClose={() => setCheckout(null)} />
    </section>
  );
}
