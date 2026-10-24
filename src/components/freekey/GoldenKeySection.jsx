import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { animate, motion, useMotionValue, useReducedMotion } from "framer-motion";
import { Crown, Key } from "lucide-react";
import { useTranslation, Trans } from "react-i18next";
import { useFreeKey } from "../../lib/freeKeyContext.jsx";
import { setPendingFreeKey } from "../../lib/freeKey.js";
import { hasPremiumOffer } from "../../lib/premiumOffer.js";
import { offersLink } from "../../lib/seo.js";
import { formatNumber } from "../../lib/values.js";
import { canUseFx } from "../../lib/fxCapability.js";
import { useCategories } from "../../lib/categories.jsx";
import { companyCategoryRecord, categoryName } from "../../lib/slug.js";
import { useMobileFx } from "../featured/mobile.js";
import { isImageUrl } from "../CompanyLogo.jsx";
import { GoldenKey, GoldenLock } from "./GoldenKey.jsx";
import "./freekey.css";

const GOLD = "#f0c63c";
const GOLD_SOFT = "#ffe486";
const GOLD_DEEP = "#cf9a1e";
const SHOWN = ["guest", "available", "used"];
const EASE = [0.22, 1, 0.36, 1];
// رأس المفتاح في رسم GoldenKey (x = 19 من 260): مركز الدوران والتصغير، باش الرأس يبقى في الثقب
const TIP_ORIGIN = { rtl: "7.3% 50%", ltr: "92.7% 50%" };

/** شركة المسرح: عندها عرض Premium (ماشي مجمّدة) ومتاحة للمفتاح؛ الأفضل نفس عرض المقارنة. */
function pickKeyCompany(companies, preferred) {
  const ok = (c) => c && hasPremiumOffer(c) && c.free_reveal_enabled !== false && (c.premium_discount || c.discount);
  return ok(preferred) ? preferred : (companies || []).find(ok) || null;
}

/** حروف ديكور خلف الزجاج (مضبّبة، ما تتقراش): الكود الحقيقي ما يوصلش للمتصفّح أبداً. */
function decoyCode(c) {
  const ABC = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const head = ((String(c?.name || "").toUpperCase().match(/[A-Z]/g) || []).join("") + "CDP").slice(0, 3);
  let h = Math.abs(Number(c?.id) || 7);
  let tail = "";
  for (let i = 0; i < 5; i++) {
    h = (h * 1103515245 + 12345) % 2147483648;
    tail += ABC[h % ABC.length];
  }
  return `${head}-${tail}`;
}

/**
 * "المفتاح الذهبي" في الرئيسية (بعد عادي vs Premium): بطاقة Premium وحدة مقفولة بقفل ذهبي،
 * الكود ورا زجاج ضبابي وضوء ذهبي يتنفّس حولها، ومفتاح يطفو جنبها مكتوب عليه "مفتاحك المجاني".
 * كي يقرّب الماوس (ولا كي يوصل القسم في الهاتف) المفتاح يطير للقفل، القفل يرجف وما يتحلّش، وتطلع الجملة.
 * حسب الزائر: زائر → التسجيل، مفتاح متاح → /offers?mode=premium، مستعمل → نافذة Premium.
 * Premium / أدمن / الميزة موقوفة → القسم يختفي. الهاتف: نسخة خفيفة (بلا طفو ولا تنفّس ولا filter)،
 * والحركة مرة وحدة. prefers-reduced-motion → كلش ثابت والجملة باينة.
 */
export default function GoldenKeySection({ companies, preferred, onOpenPremium }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const rtl = i18n.dir() === "rtl";
  const fk = useFreeKey();
  const navigate = useNavigate();
  const mobile = useMobileFx();
  const reduce = useReducedMotion();
  const [fxOk] = useState(() => canUseFx());
  const wide = !mobile;
  const live = wide && fxOk && !reduce; // الطفو + التنفّس + الزجاج الحقيقي
  const company = useMemo(() => pickKeyCompany(companies, preferred), [companies, preferred]);
  const state = fk.status;
  const visible = fk.enabled && SHOWN.includes(state) && !!company;

  const stageRef = useRef(null);
  const keyRef = useRef(null);
  const tipRef = useRef(null);
  const holeRef = useRef(null);
  const restRot = wide ? (rtl ? -14 : 14) : rtl ? -24 : 24;
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rot = useMotionValue(restRot);
  const sc = useMotionValue(1);
  const lockRot = useMotionValue(0);
  const phase = useRef("rest");
  const floatCtl = useRef(null);
  const backTimer = useRef(null);
  const inView = useRef(false);
  const [onScreen, setOnScreen] = useState(false);
  const [said, setSaid] = useState(false);

  const startFloat = useCallback(() => {
    floatCtl.current?.stop();
    floatCtl.current = live && inView.current && phase.current === "rest" ? animate(y, [0, -9, 0], { duration: 5.4, ease: "easeInOut", repeat: Infinity }) : null;
  }, [live, y]);

  // تبديل اللغة / المقاس: المفتاح يرجع لبلاصتو
  useEffect(() => {
    floatCtl.current?.stop();
    clearTimeout(backTimer.current);
    phase.current = "rest";
    x.set(0);
    y.set(0);
    sc.set(1);
    rot.set(restRot);
    lockRot.set(0);
    startFloat();
  }, [restRot, startFloat, x, y, sc, rot, lockRot]);

  useEffect(
    () => () => {
      floatCtl.current?.stop();
      clearTimeout(backTimer.current);
    },
    []
  );

  const goBack = useCallback(async () => {
    if (phase.current !== "locked") return;
    phase.current = "back";
    const o = { duration: 0.85, ease: EASE };
    await Promise.all([animate(x, 0, o), animate(y, 0, o), animate(rot, restRot, o), animate(sc, 1, o)]);
    phase.current = "rest";
    startFloat();
  }, [x, y, rot, sc, restRot, startFloat]);

  // المفتاح يطير للقفل، يحاول يدوّر، القفل يرجف وما يتحلّش، وتطلع الجملة
  const play = useCallback(async () => {
    if (phase.current !== "rest" || reduce) return;
    const tip = tipRef.current?.getBoundingClientRect();
    const hole = holeRef.current?.getBoundingClientRect();
    if (!tip || !hole) return;
    phase.current = "fly";
    floatCtl.current?.stop();
    const dx = x.get() + hole.left + hole.width / 2 - (tip.left + tip.width / 2);
    const dy = y.get() + hole.top + hole.height / 2 - (tip.top + tip.height / 2);
    const fly = { duration: 0.72, ease: EASE };
    await Promise.all([animate(x, dx, fly), animate(y, dy - 12, fly), animate(rot, 0, fly), animate(sc, 0.82, fly)]);
    await Promise.all([animate(y, dy, { duration: 0.16, ease: "easeOut" }), animate(sc, 0.78, { duration: 0.16 })]);
    await animate(rot, [0, rtl ? -16 : 16, 0], { duration: 0.34, ease: "easeInOut" });
    await Promise.all([
      animate(lockRot, [0, -10, 9, -7, 5, -2, 0], { duration: 0.62, ease: "easeInOut" }),
      animate(x, [dx, dx - 3, dx + 3, dx - 2, dx + 1, dx], { duration: 0.62 }),
    ]);
    setSaid(true);
    phase.current = "locked";
    // الكمبيوتر: يرجع يطفو ويقدر يعاود؛ الهاتف: يبقى في القفل (مرة وحدة)
    clearTimeout(backTimer.current);
    if (wide) backTimer.current = setTimeout(goBack, 2200);
  }, [reduce, x, y, rot, sc, lockRot, rtl, wide, goBack]);

  // في الشاشة؟ (الطفو والتنفّس يوقفو برا الشاشة) + الهاتف: الحركة مرة وحدة كي يبان القسم
  useEffect(() => {
    const el = stageRef.current;
    if (!visible || !el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([e]) => {
        inView.current = e.isIntersecting;
        setOnScreen(e.isIntersecting);
        if (!e.isIntersecting) floatCtl.current?.stop();
        else if (phase.current === "rest") startFloat();
        if (!wide && e.intersectionRatio >= 0.55) play();
      },
      { threshold: [0, 0.55] }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible, wide, play, startFloat]);

  // الكمبيوتر: الماوس يقرّب من المفتاح
  const raf = useRef(0);
  const onPointerMove = (e) => {
    if (!wide || e.pointerType !== "mouse" || phase.current !== "rest" || raf.current) return;
    const cx = e.clientX;
    const cy = e.clientY;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      const r = keyRef.current?.getBoundingClientRect();
      if (r && Math.hypot(cx - (r.left + r.width / 2), cy - (r.top + r.height / 2)) < 170) play();
    });
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  if (!visible) return null;

  // العنوان على سطرين: الوقفة بعد "…" هي السطر الأول
  const title = t("freeKey.home.title");
  const cut = title.indexOf("…");
  const usedName = fk.usedCompany?.name;
  const sub =
    state === "guest" ? t("freeKey.home.subGuest") : state === "available" ? t("freeKey.home.subAvailable") : usedName ? t("freeKey.home.subUsed", { company: usedName }) : t("freeKey.home.subUsedGeneric");
  const saidText = t(state === "guest" ? "freeKey.home.saidGuest" : state === "available" ? "freeKey.home.saidAvailable" : "freeKey.home.saidUsed");
  const ctaCls =
    "inline-flex items-center justify-center gap-2.5 rounded-2xl px-7 py-4 text-[16px] font-extrabold text-[#1d1403] outline-none transition-transform hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-[#ffe486] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-ink)]";
  const ctaStyle = { background: `linear-gradient(135deg, ${GOLD_SOFT}, ${GOLD} 55%, ${GOLD_DEEP})`, boxShadow: "0 16px 40px -16px rgba(240,198,60,0.75)" };
  const CtaIcon = state === "used" ? Crown : Key;
  const ctaLabel = t(state === "guest" ? "freeKey.home.ctaGuest" : state === "available" ? "freeKey.home.ctaAvailable" : "freeKey.home.ctaUsed");
  const ctaBody = (
    <>
      <CtaIcon size={18} /> {ctaLabel}
    </>
  );
  const keyStyle = { x, y, rotate: rot, scale: sc, transformOrigin: rtl ? TIP_ORIGIN.rtl : TIP_ORIGIN.ltr };

  return (
    <section
      aria-labelledby="free-key-title"
      onPointerMove={onPointerMove}
      className={`relative overflow-hidden py-24 sm:py-28 ${live ? "fk-fx" : "fk-light"} ${onScreen ? "is-live" : ""}`}
    >
      <div className="relative mx-auto max-w-6xl px-4">
        <header className="mx-auto max-w-2xl text-center">
          <h2 id="free-key-title" className="text-balance text-[32px] font-black leading-[1.15] tracking-tight sm:text-[44px] lg:text-[52px]">
            {cut > 0 ? (
              <>
                {title.slice(0, cut + 1)}
                <br />
                {title.slice(cut + 1).trim()}
              </>
            ) : (
              title
            )}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-balance text-[16px] leading-[1.75] text-[var(--text-soft)] sm:text-[17px]">{sub}</p>
        </header>

        {/* المسرح: بطاقة مقفولة في الوسط + المفتاح جنبها (جهة بداية القراءة، يشير نحو القفل) */}
        <div
          ref={stageRef}
          onClick={play}
          aria-hidden
          className={wide ? "relative mx-auto mt-10 h-[470px] max-w-[1000px]" : "relative mx-auto mt-10 w-full max-w-[340px] pt-[96px]"}
        >
          <span className="fk-halo" />
          <div className={wide ? "absolute left-1/2 top-1/2 w-[340px] -translate-x-1/2 -translate-y-1/2" : "relative"}>
            <KeyTicket company={company} lockRot={lockRot} holeRef={holeRef} />
          </div>
          <motion.div
            ref={keyRef}
            className={`fk-key absolute ${wide ? "w-[230px]" : "top-0 w-[188px]"}`}
            style={wide ? { ...keyStyle, top: "calc(50% - 118px)", insetInlineStart: "calc(50% - 436px)" } : { ...keyStyle, insetInlineStart: "2px" }}
          >
            <GoldenKey label={t("freeKey.home.keyLabel")} flip={!rtl} tipRef={tipRef} className="h-auto w-full drop-shadow-[0_14px_22px_rgba(0,0,0,0.55)]" />
          </motion.div>
        </div>

        {/* الجملة بعد محاولة المفتاح (ثابتة باينة مع prefers-reduced-motion) */}
        <motion.p
          initial={false}
          animate={{ opacity: said || reduce ? 1 : 0, y: said || reduce ? 0 : 8 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="mt-6 text-center text-[19px] font-extrabold text-[#ffe486] sm:text-[21px]"
        >
          {saidText}
        </motion.p>

        <div className="mt-7 flex flex-col items-center gap-3.5 text-center">
          {state === "available" ? (
            <Link to={offersLink(lang, { mode: "premium" })} onFocus={wide ? play : undefined} className={ctaCls} style={ctaStyle}>
              {ctaBody}
            </Link>
          ) : (
            <button
              type="button"
              onFocus={wide ? play : undefined}
              onClick={() => {
                if (state === "guest") {
                  setPendingFreeKey(null, lang);
                  navigate("/signup");
                } else onOpenPremium?.();
              }}
              className={ctaCls}
              style={ctaStyle}
            >
              {ctaBody}
            </button>
          )}

          {state === "guest" && (
            <ul className="fk-fine flex flex-wrap items-center justify-center text-[13px] font-semibold text-[var(--text-soft)]">
              <li>{t("freeKey.home.fine.free")}</li>
              <li>{t("freeKey.home.fine.noCard")}</li>
              <li>{t("freeKey.home.fine.once")}</li>
            </ul>
          )}

          {fk.reveals != null && (
            <p className="text-[13.5px] font-semibold text-[var(--color-mute)]">
              <Trans
                i18nKey="freeKey.home.counter"
                count={fk.reveals}
                values={{ n: formatNumber(fk.reveals, lang) }}
                components={[<b className="font-black tabular-nums text-[#ffe486]" />]}
              />
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/** البطاقة المقفولة في المسرح: نفس تذكرة الكوبون (Premium ذهبي)، بلا أزرار، والقفل فوق الكود. */
function KeyTicket({ company, lockRot, holeRef }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { byId, categories } = useCategories();
  const loc = (f) => (lang !== "ar" && company[`${f}_${lang}`]) || company[f];
  const rec = companyCategoryRecord(company, byId, categories);
  const category = (rec ? categoryName(rec, lang) : loc("category")) || "";
  const value = loc("premium_discount") || loc("discount");
  const desc = loc("premium_description") || loc("description") || "";
  const vars = { "--edge-base": `${GOLD}66`, "--edge-strong": `${GOLD}66`, "--perf": `${GOLD}80`, "--stub": `${GOLD}0d` };

  return (
    <div className="ticket ticket-premium relative" style={vars}>
      <div className="ticket-top relative bg-[var(--color-ink-card)] p-5 pb-4">
        <span className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(120% 70% at 50% 0%, ${GOLD}24, transparent 62%)` }} />
        <span className="ticket-ring ticket-ring-l" />
        <span className="ticket-ring ticket-ring-r" />
        <div className="relative flex items-center gap-3">
          <TicketLogo logo={company.logo} name={company.name} />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[17px] font-extrabold text-[var(--text)]">{company.name}</h3>
            <p className="mt-0.5 truncate text-[12.5px] font-medium text-[var(--color-mute)]">{category}</p>
          </div>
          <span
            className="flex shrink-0 items-center gap-1 self-start rounded-full px-2.5 py-1 text-[10px] font-black text-[#0a0a0a]"
            style={{ background: `linear-gradient(135deg, ${GOLD_SOFT}, ${GOLD_DEEP})` }}
          >
            <Crown size={11} /> {t("card.premiumBadge")}
          </span>
        </div>
        <p className="relative mt-4 line-clamp-2 h-[40px] overflow-hidden text-[13.5px] leading-[1.48] text-[var(--text-soft)]">{desc}</p>
        <div className="relative mt-4">
          <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--color-mute)]">
            <Crown size={12} style={{ color: GOLD }} /> {t("card.premiumDiscount")}
          </div>
          <div className="mt-1 text-[30px] font-black leading-none" style={{ color: GOLD, textShadow: "0 0 24px rgba(240,198,60,0.4)" }}>
            {value}
          </div>
        </div>
      </div>

      <div className="ticket-stub relative bg-[var(--color-ink-card)] px-5 pb-6 pt-5">
        <span className="pointer-events-none absolute inset-0" style={{ background: "var(--stub)" }} />
        <span className="ticket-ring ticket-ring-l" />
        <span className="ticket-ring ticket-ring-r" />
        <span className="ticket-perf" />
        <div className="relative">
          <div className="relative flex h-[54px] items-center justify-between overflow-hidden rounded-xl border border-dashed px-3.5" style={{ borderColor: `${GOLD}55`, background: `${GOLD}0d` }}>
            <span className="relative z-[1] text-[10.5px] font-semibold text-[var(--color-mute)]">{t("card.premiumCode")}</span>
            <span className="fk-glyphs text-[16px]" dir="ltr">
              {decoyCode(company)}
            </span>
            <span className="fk-glass" />
          </div>
          <motion.div className="absolute left-1/2 top-1/2 w-[48px] -translate-x-1/2 -translate-y-1/2" style={{ rotate: lockRot, transformOrigin: "50% 12%" }}>
            <GoldenLock holeRef={holeRef} className="h-auto w-full drop-shadow-[0_8px_14px_rgba(0,0,0,0.55)]" />
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function TicketLogo({ logo, name }) {
  const [errored, setErrored] = useState(false);
  const letter = (name || "؟").trim().charAt(0);
  return (
    <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-[linear-gradient(150deg,#1c1c20,#141417)]">
      {isImageUrl(logo) && !errored ? (
        <img src={logo} alt="" loading="lazy" className="h-full w-full object-cover" onError={() => setErrored(true)} />
      ) : logo && !isImageUrl(logo) ? (
        <span className="text-[26px] leading-none">{logo}</span>
      ) : (
        <span className="text-[22px] font-black leading-none" style={{ color: GOLD_SOFT }}>
          {letter}
        </span>
      )}
    </span>
  );
}
