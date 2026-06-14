import { useRef, useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, animate } from "framer-motion";
import { Copy, Check, Heart, ExternalLink, Flame, Crown, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getTypeMeta, getTypeKey } from "../lib/types.js";
import { companySlug, companyCategoryRecord, categoryName } from "../lib/slug.js";
import { useCategories } from "../lib/categories.jsx";
import { getPremiumCode } from "../lib/supabase.js";
import { isImageUrl } from "./CompanyLogo.jsx";

// هوية Premium الذهبية
const GOLD = "#f0c63c";
const GOLD_DEEP = "#cf9a1e";
const GOLD_SOFT = "#ffe486";
const GOLD_GLOW = "rgba(240,198,60,0.4)";

export default function CompanyCard({
  company,
  index,
  isFavorite,
  onToggleFav,
  onCopy,
  premium = false,
  unlocked = false,
  onUnlock,
  linkToStore = true,
}) {
  const { t, i18n } = useTranslation();
  const { byId, categories } = useCategories();
  const meta = getTypeMeta(company.type);
  const Icon = meta.icon;

  // المحتوى الديناميكي: نعرض ترجمة اللغة النشطة، مع fallback للعربية الأصلية
  const lang = i18n.language;
  // رابط صفحة الشركة (بادئة اللغة لغير العربية)
  const storeHref = `${lang && lang !== "ar" ? `/${lang}` : ""}/store/${companySlug(company)}`;
  const loc = (field) => (lang !== "ar" && company[`${field}_${lang}`]) || company[field];
  // في وضع Premium نعرض وصف Premium (باللغة الحالية) مع fallback للوصف العادي إن كان فارغاً.
  const desc = (premium ? loc("premium_description") || loc("description") : loc("description")) || "";
  // اسم الفئة: من category_id عبر الجدول (المصدر الحقيقي)، مع fallback للنص الحر القديم
  const catRecord = companyCategoryRecord(company, byId, categories);
  const category = (catRecord ? categoryName(catRecord, lang) : loc("category")) || "";
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);
  // بيانات Premium تُجلب خادمياً عبر RPC (لا تأتي ضمن صف الشركة العام).
  // null = لم تُطلب/لم تصل بعد. { premium_code, premium_url } = وصلت.
  const [premiumData, setPremiumData] = useState(null);
  const cardRef = useRef(null);

  // إعادة ضبط الخدش وبيانات Premium عند تبديل الوضع أو تغيّر حالة الاشتراك
  useEffect(() => {
    setRevealed(false);
    setPremiumData(null);
  }, [premium, unlocked]);

  // يجلب كود/رابط Premium مرّة واحدة عند الحاجة (مشترك فعّال فقط؛ الخادم يتحقق).
  const ensurePremium = useCallback(async () => {
    if (!premium || !unlocked) return null;
    if (premiumData) return premiumData;
    let d;
    try {
      d = await getPremiumCode(company.id);
    } catch {
      d = null;
    }
    const val = d || { premium_code: null, premium_url: null };
    setPremiumData(val);
    return val;
  }, [premium, unlocked, premiumData, company.id]);

  const hot = (company.clicks || 0) >= 50;

  // ألوان حسب الوضع (عادي / Premium ذهبي)
  const accent = premium ? GOLD : meta.color;
  const accentGlow = premium ? GOLD_GLOW : meta.glow;
  // قيمة الخصم عامة (تُعرض دائماً)؛ أما الكود/الرابط Premium فيُكشفان خادمياً.
  const shownDiscount = premium ? loc("premium_discount") || loc("discount") : loc("discount");
  // في وضع Premium: قبل وصول بيانات RPC نعرض حاجباً (••••••)، وبعده الكود الحقيقي
  // (مع fallback للكود العادي إن كان premium_code فارغاً). غير Premium: الكود العادي.
  const shownCode = premium
    ? premiumData
      ? premiumData.premium_code || company.code
      : "••••••"
    : company.code;
  const shownLink = premium
    ? premiumData
      ? premiumData.premium_url || company.link
      : null
    : company.link;

  const handleMouseMove = (e) => {
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  const handleCopy = async () => {
    // كود Premium مقفل: لا نسخ — نوجّه للاشتراك
    if (premium && !unlocked) {
      onUnlock?.();
      return;
    }
    // في وضع Premium نجلب الكود الحقيقي خادمياً قبل النسخ (لا نعتمد على صف الشركة)
    let code = company.code;
    if (premium) {
      const d = await ensurePremium();
      code = d?.premium_code || company.code;
    }
    onCopy(company, code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <motion.article
      ref={cardRef}
      onMouseMove={handleMouseMove}
      initial={{ opacity: 0, y: 26 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10, scale: 0.97 }}
      transition={{ duration: 0.45, delay: Math.min(index * 0.05, 0.35), ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -6 }}
      className={`group relative flex flex-col overflow-hidden rounded-[var(--radius-card)] border bg-[var(--color-ink-card)] p-5 transition-colors duration-300 ${
        premium ? "" : "border-[var(--color-ink-line)] hover:border-[var(--color-lime)]/40"
      }`}
      style={
        premium
          ? { borderColor: `${GOLD}66`, boxShadow: `0 0 0 1px ${GOLD}1f, 0 22px 55px -28px ${GOLD_GLOW}` }
          : undefined
      }
    >
      {/* أمبيانس ذهبي في وضع Premium */}
      {premium && (
        <span
          className="pointer-events-none absolute inset-0"
          style={{ background: `radial-gradient(120% 65% at 50% 0%, ${GOLD}1f, transparent 60%)` }}
        />
      )}

      {/* توهّج علوي */}
      <span
        className="pointer-events-none absolute -top-px left-1/2 h-px w-2/3 -translate-x-1/2 opacity-70"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
      />
      {/* بقعة ضوء تتبع المؤشر */}
      <span
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(280px circle at var(--mx,50%) var(--my,0%), ${accentGlow}, transparent 65%)`,
        }}
      />

      {/* شارة Premium كـ overlay مطلق في زاوية جهة end (يسار RTL) أسفل زر القلب مباشرةً بمسافة صغيرة:
          - absolute خارج التدفّق → لا تتغيّر أبعاد البطاقة عند التبديل عادي/Premium.
          - على جهة end فلا تغطّي شعار المتجر (الباقي كاملاً في جهة start/اليمين).
          - ليست في صف الاسم → الاسم يظهر كاملاً غير مقصوص.
          - pointer-events-none حتى يمرّ النقر لما تحتها. */}
      {premium && (
        <span
          className="pointer-events-none absolute end-5 top-14 z-20 flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black text-[#0a0a0a]"
          style={{ background: `linear-gradient(135deg, ${GOLD_SOFT}, ${GOLD_DEEP})`, boxShadow: `0 4px 14px -5px ${GOLD_GLOW}` }}
        >
          <Crown size={11} /> PREMIUM
        </span>
      )}

      {/* الرأس — القلب مثبت أعلى البطاقة (items-start + shrink-0) ولا يتأثر بطول النص */}
      <div className="relative flex items-start justify-between gap-2">
        {linkToStore ? (
          <Link to={storeHref} className="group/link flex min-w-0 items-center gap-3">
            <CardLogo logo={company.logo} name={company.name} accent={accent} glow={accentGlow} premium={premium} />
            <div className="min-w-0">
              <h3 className="truncate text-[17px] font-extrabold text-[var(--text)] transition-colors group-hover/link:text-[var(--accent-text)]">{company.name}</h3>
              <p className="mt-0.5 truncate text-[12.5px] font-medium text-[var(--color-mute)]">
                {category}
              </p>
            </div>
          </Link>
        ) : (
          <div className="flex min-w-0 items-center gap-3">
            <CardLogo logo={company.logo} name={company.name} accent={accent} glow={accentGlow} premium={premium} />
            <div className="min-w-0">
              <h3 className="truncate text-[17px] font-extrabold text-[var(--text)]">{company.name}</h3>
              <p className="mt-0.5 truncate text-[12.5px] font-medium text-[var(--color-mute)]">
                {category}
              </p>
            </div>
          </div>
        )}

        <div className="flex shrink-0 items-center gap-1.5 self-start">
          {hot && !premium && (
            <span className="flex items-center gap-1 rounded-full bg-orange-500/15 px-2 py-1 text-[10.5px] font-bold text-orange-400">
              <Flame size={11} /> {t("card.hot")}
            </span>
          )}
          <button
            onClick={() => onToggleFav(company.id)}
            aria-label={t("card.addFav")}
            className="grid h-8 w-8 place-items-center rounded-full border border-[var(--color-ink-line)] bg-[var(--fill)] transition-colors hover:bg-[var(--fill-strong)]"
          >
            <Heart size={15} className={isFavorite ? "fill-red-500 text-red-500" : "text-[var(--color-mute)]"} />
          </button>
        </div>
      </div>

      {/* الوصف — ارتفاع ثابت (ثلاثة أسطر) ليتساوى ارتفاع كل البطاقات */}
      <p className="relative mt-4 line-clamp-3 h-[60px] overflow-hidden text-[13.5px] leading-[1.48] text-[var(--text-soft)]">
        {desc}
      </p>

      {/* قيمة الخصم + شارة النوع */}
      <div className="relative mt-4 flex items-end justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--color-mute)]">
            {premium && <Crown size={12} style={{ color: GOLD }} />}
            {premium ? t("card.premiumDiscount") : t("card.offerValue")}
          </div>
          <div className="text-[30px] font-black leading-none">
            <AnimatedDiscount value={shownDiscount} color={accent} glow={accentGlow} />
          </div>
        </div>
        <span
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold"
          style={{ background: `${meta.color}1a`, color: meta.color }}
        >
          <Icon size={13} />
          {t(`types.${getTypeKey(company.type)}`)}
        </span>
      </div>

      {/* الكود + نسخ (نفس التصميم؛ في Premium يُغطّى الكود ببطاقة خدش) */}
      <div className="relative mt-5 flex items-stretch gap-2">
        <div className="relative flex-1">
          <div
            className="flex h-full items-center justify-between overflow-hidden rounded-xl border border-dashed px-3.5 py-2.5"
            style={{ borderColor: `${accent}55`, background: `${accent}0d` }}
          >
            <span className="text-[10.5px] font-semibold text-[var(--color-mute)]">
              {premium ? t("card.premiumCode") : t("card.code")}
            </span>
            <span className="font-mono text-[15px] font-extrabold tracking-widest text-[var(--text)]">
              {shownCode}
            </span>
          </div>
          {premium && !revealed && (
            <ScratchLayer
              t={t}
              unlocked={unlocked}
              onReveal={() => {
                setRevealed(true);
                ensurePremium();
              }}
              onUnlock={() => onUnlock?.()}
            />
          )}
        </div>

        <motion.button
          onClick={handleCopy}
          whileTap={{ scale: 0.94 }}
          className="relative grid w-[120px] shrink-0 place-items-center overflow-hidden rounded-xl px-4 text-[14px] font-extrabold text-[#0a0a0a]"
          style={{
            background: copied
              ? "linear-gradient(135deg, #34d399, #10b981)"
              : premium
              ? `linear-gradient(135deg, ${GOLD_SOFT}, ${GOLD_DEEP})`
              : `linear-gradient(135deg, ${accent}, ${accent}cc)`,
            boxShadow: `0 10px 26px -12px ${accentGlow}`,
          }}
        >
          <AnimatePresence mode="wait" initial={false}>
            {copied ? (
              <motion.span key="done" initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -14, opacity: 0 }} transition={{ duration: 0.2 }} className="flex items-center gap-1.5">
                <Check size={16} /> {t("card.copied")}
              </motion.span>
            ) : (
              <motion.span key="copy" initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -14, opacity: 0 }} transition={{ duration: 0.2 }} className="flex items-center gap-1.5">
                <Copy size={15} /> {t("card.copy")}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      {/* زر زيارة الموقع — موجود دائماً بنفس الارتفاع (لا قفزة عند الكشف).
          - عادي / Premium مكشوف وله رابط: زر فعّال بالرابط الحقيقي (shownLink).
          - Premium قبل الكشف: مقفول مظهراً فقط (أيقونة قفل، disabled، بلا href —
            ولا يوضع premium_url في DOM إطلاقاً قبل الكشف).
          - لا رابط متاح: نفس الزر معطّلاً (ليبقى الارتفاع ثابتاً). */}
      {premium && !revealed ? (
        <div
          aria-disabled="true"
          className="relative mt-2.5 flex cursor-not-allowed select-none items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-[13.5px] font-bold text-[var(--color-mute)] opacity-60"
          style={{ borderColor: `${accent}33`, background: `${accent}08` }}
        >
          <Lock size={14} style={{ color: accent }} />
          {t("card.visit")}
        </div>
      ) : shownLink ? (
        <motion.a
          href={shownLink}
          target="_blank"
          rel="noopener noreferrer"
          whileTap={{ scale: 0.98 }}
          className="group/btn relative mt-2.5 flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-[13.5px] font-bold text-[var(--text)] transition-colors"
          style={{ borderColor: `${accent}44`, background: `${accent}0d` }}
        >
          <ExternalLink size={15} style={{ color: accent }} />
          {t("card.visit")}
        </motion.a>
      ) : (
        <div
          aria-disabled="true"
          className="relative mt-2.5 flex cursor-not-allowed select-none items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-[13.5px] font-bold text-[var(--color-mute)] opacity-60"
          style={{ borderColor: `${accent}33`, background: `${accent}08` }}
        >
          <ExternalLink size={15} style={{ color: accent }} />
          {t("card.visit")}
        </div>
      )}
    </motion.article>
  );
}

/* ===== بطاقة الخدش فوق كود Premium ===== */
// الخلفية المعدنية المشتركة بين الحالتين
const METAL_BG = {
  background:
    "repeating-linear-gradient(115deg, #c6cbd4 0px, #aab0ba 6px, #d4d9e1 12px, #9aa0aa 18px), linear-gradient(135deg, #c2c7d0, #9aa0aa 40%, #d6dbe3 60%, #8f95a0)",
  backgroundBlendMode: "overlay",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(0,0,0,0.2)",
};

function ScratchLayer({ t, unlocked, onReveal, onUnlock }) {
  const [progress, setProgress] = useState(0);

  // غير مشترك: غطاء مقفل — أيقونة قفل فقط، والضغط عليه يفتح نافذة "افتح خصومات Premium"
  if (!unlocked) {
    return (
      <button
        type="button"
        onClick={onUnlock}
        aria-label={t("card.unlockPremium")}
        className="absolute inset-0 flex cursor-pointer select-none items-center justify-center gap-1.5 overflow-hidden rounded-xl"
        style={METAL_BG}
      >
        <Lock size={13} className="text-[#4a4f58]" />
        <span className="text-[11.5px] font-extrabold text-[#4a4f58]">{t("card.premiumCode")}</span>
      </button>
    );
  }

  // مشترك: غطاء معدني يُخدش للكشف عن الكود
  const scratch = () => {
    setProgress((p) => {
      const np = Math.min(1, p + 0.1);
      if (np >= 0.65) onReveal();
      return np;
    });
  };
  const onMove = (e) => {
    // الماوس (تمرير) أو اللمس (سحب الإصبع)
    if (e.pointerType === "mouse" ? true : e.pressure > 0 || e.buttons === 1) scratch();
  };

  return (
    <motion.div
      onPointerMove={onMove}
      onPointerDown={scratch}
      animate={{ opacity: 1 - progress * 0.95 }}
      transition={{ duration: 0.15 }}
      className="absolute inset-0 flex cursor-pointer touch-none select-none items-center justify-center gap-1.5 overflow-hidden rounded-xl"
      style={METAL_BG}
    >
      <Lock size={13} className="text-[#4a4f58]" />
      <span className="text-[11.5px] font-extrabold text-[#4a4f58]">{t("card.scratchReveal")}</span>
      {/* لمعة معدنية */}
      <span
        className="pointer-events-none absolute inset-y-0 w-1/3 -skew-x-12 opacity-50"
        style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)", left: `${progress * 120 - 20}%` }}
      />
    </motion.div>
  );
}

/* ===== عدّاد متحرّك لقيمة الخصم ===== */
function parseVal(v) {
  const m = String(v ?? "").match(/^(\D*)([\d.,]+)(.*)$/s);
  if (!m) return null;
  return { prefix: m[1], num: parseFloat(m[2].replace(/,/g, "")), suffix: m[3] };
}

function AnimatedDiscount({ value, color, glow }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(parseVal(value)?.num ?? null);

  useEffect(() => {
    const p = parseVal(value);
    if (!p || Number.isNaN(p.num)) {
      setDisplay(value);
      prev.current = null;
      return;
    }
    const from = prev.current ?? p.num;
    const controls = animate(from, p.num, {
      duration: 0.7,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(`${p.prefix}${Math.round(v)}${p.suffix}`),
    });
    prev.current = p.num;
    return () => controls.stop();
  }, [value]);

  return (
    <span style={{ color, textShadow: `0 0 24px ${glow}` }}>{display}</span>
  );
}

/* ===== لوجو البطاقة ===== */
function CardLogo({ logo, name, accent, glow, premium }) {
  const [errored, setErrored] = useState(false);
  const showImage = isImageUrl(logo) && !errored;
  const showEmoji = !showImage && logo && !isImageUrl(logo);
  const letter = (name || "؟").trim().charAt(0);

  return (
    <div
      className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl transition-transform duration-300 group-hover:scale-105"
      style={{
        background: showImage ? "transparent" : "linear-gradient(150deg, #1c1c20, #141417)",
        boxShadow: `0 6px 18px -10px ${glow}`,
      }}
    >
      {showImage ? (
        <img src={logo} alt={name || "logo"} loading="lazy" onError={() => setErrored(true)} className="h-full w-full object-cover" />
      ) : showEmoji ? (
        <span style={{ fontSize: 30, lineHeight: 1 }}>{logo}</span>
      ) : (
        <span className="font-black" style={{ fontSize: 26, color: accent, lineHeight: 1 }}>
          {letter}
        </span>
      )}
    </div>
  );
}
