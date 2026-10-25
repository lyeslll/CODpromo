import { useRef, useState, useEffect, useCallback, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Copy, Check, Heart, ExternalLink, Flame, Crown, Lock, Undo2, Key, Sparkles, ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getTypeMeta, getTypeKey } from "../lib/types.js";
import { companySlug, companyCategoryRecord, categoryName } from "../lib/slug.js";
import { useCategories } from "../lib/categories.jsx";
import { getPremiumCode } from "../lib/supabase.js";
import NewBadge from "./notifications/NewBadge.jsx";
import { logCodeCopy, copySourceFromPath } from "../lib/copies.js";
import { hasPremiumOffer } from "../lib/premiumOffer.js";
import { useFreeKey } from "../lib/freeKeyContext.jsx";
import { setPendingFreeKey } from "../lib/freeKey.js";
import { useKeys } from "../lib/keysContext.jsx";
import { premiumPath } from "../lib/seo.js";
import { isImageUrl } from "./CompanyLogo.jsx";
import { cachedTone, detectTone, logoSrc, logoSrcSet, tileStyle } from "../lib/logoImage.js";
import CodeVote from "./CodeVote.jsx";
import BidiText from "./BidiText.jsx";
import { GlowSpot, useCardGlow } from "./CardGlow.jsx";
import FreeKeyDialog from "./freekey/FreeKeyDialog.jsx";
import { DiamondGlyph } from "./keys/DiamondKey.jsx";
import { DIA_BG, DIA_DEEP, DIA_GLOW, DIA_INK, DIA_SOFT, PRISM } from "./keys/diamond.js";
import GiftConfetti from "./gift/GiftConfetti.jsx";
import { useWaveValue, useCountText } from "../lib/modeWave.jsx";

// المفتاح الماسي: النوافذ والحركة يتحمّلو غير كي يلزمو (البطاقة في الحزمة الأولى تاع الرئيسية)
const loadUnlockFx = () => import("./keys/DiamondUnlockFx.jsx");
const KeyUnlockDialog = lazy(() => import("./keys/KeyUnlockDialog.jsx"));
const KeyChooser = lazy(() => import("./keys/KeyChooser.jsx"));
const DiamondUnlockFx = lazy(loadUnlockFx);

// هوية Premium الذهبية
const GOLD = "#f0c63c";
const GOLD_DEEP = "#cf9a1e";
const GOLD_SOFT = "#ffe486";
const GOLD_GLOW = "rgba(240,198,60,0.4)";

/**
 * بطاقة عرض على شكل تذكرة كوبون حقيقية:
 *   - الجزء العلوي: معلومات الشركة + الوصف + القيمة.
 *   - خط مثقّب بين نصفي دائرة مقصوصين في الجنبين.
 *   - الجزء السفلي (الكعب): الكود + النسخ + زيارة الموقع + التصويت.
 * لون النوع (تخفيض/كوبون/كاش باك) يظهر في حافة الكوبون والقيمة والأزرار،
 * وفي وضع Premium يصبح كل شيء ذهبياً. القصّ عبر CSS mask (.ticket-* في index.css).
 * وضع Premium لشركة بلا عرض Premium (لا كود Premium) → بطاقة "مجمّدة" رمادية (FrozenTicket):
 * بلا نسخ ولا زيارة ولا خدش ولا نداء لـ RPC، مع رابط onShowNormal يرجّع الصفحة للوضع العادي.
 * المفتاح الذهبي (lib/freeKeyContext.jsx) في البطاقة المقفولة لغير المشترك: زائر → التسجيل،
 * مفتاح متاح → تأكيد ثم خدش، مفتاح مستعمل → الشركة اللي كشفها مكشوفة ديما والباقي نحو Premium.
 * المفتاح الماسي (lib/keysContext.jsx، phase37) لنفس البطاقة المقفولة: عندو مفاتيح → "افتح بمفتاح ماسي" → تأكيد
 * → حركة الفتح → نفس الخدش؛ الشركة المفتوحة بيه مكشوفة ديما. بلا مفاتيح → يختار (الذهبي / شراء مفاتيح / Premium).
 * كل كود مقفول يبيّن الفرق (العادي ← Premium) باش يعرف واش يربح.
 * freeKey={false} = البطاقة كيما كانت (المعاينات وتشريح البطاقة).
 */
export default function CompanyCard({
  company,
  index,
  isFavorite,
  onToggleFav,
  onCopy,
  premium: premiumProp = false,
  unlocked = false,
  onUnlock,
  linkToStore = true,
  copySource,
  onShowNormal,
  freeKey = true,
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const fk = useFreeKey();
  const keys = useKeys();
  // موجة التبديل (lib/modeWave.jsx): البطاقة الظاهرة تلحق الوضع الجديد بعد تأخيرها، والباقي في الحين
  const premium = useWaveValue(premiumProp, `c${company.id}`);
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

  // ===== المفتاح الذهبي: غير المشترك برك، على بطاقة عندها عرض Premium (ماشي مجمّدة) =====
  //  keyOwned: كشفها بمفتاحو → مكشوفة عندو ديما (الخادم يرجّع كودها في get_premium_code).
  //  keyCta: guest (سجّل) | use (استعمل مفتاحك) | upsell (استعملتو → Premium) | null (القفل العادي).
  const keyOn = freeKey && premium && hasPremiumOffer(company) && !unlocked && fk.status !== "loading" && fk.status !== "hidden";
  const keyOwned = keyOn && fk.usedCompanyId === company.id;
  const keyCta =
    !keyOn || keyOwned || !fk.enabled
      ? null
      : fk.status === "used"
      ? "upsell"
      : company.free_reveal_enabled === false
      ? null
      : fk.status === "guest"
      ? "guest"
      : fk.status === "available"
      ? "use"
      : null;
  // ===== المفتاح الماسي: نفس الشروط + حساب عادي (ولا مول هدية انتهت) عندو حالة مفاتيح =====
  //  diaOwned: فتحها بمفتاح ماسي → مكشوفة عندو للأبد (get_diamond_code). diaCta: عندو مفاتيح → "افتح بمفتاح ماسي".
  const diaOn = freeKey && premium && hasPremiumOffer(company) && !unlocked && keys.status === "ok";
  const diaOwned = diaOn && !keyOwned && keys.isOwned(company.id);
  const diaCta = diaOn && !keyOwned && !diaOwned && keys.balance > 0;
  const canSee = unlocked || keyOwned || diaOwned;
  const [keyScratch, setKeyScratch] = useState(false); // كشف جديد في هاد البطاقة: الخدش أولاً
  const [keyDialog, setKeyDialog] = useState(false);
  const [diaDialog, setDiaDialog] = useState(false);
  const [chooser, setChooser] = useState(false);
  const [diaFx, setDiaFx] = useState(false); // حركة المفتاح الماسي فوق الخدش
  // النوافذ تتركّب غير من أول فتح (عشرات البطاقات المقفولة في /offers)، ومن بعد تبقى باش حركة السكير تكمل
  const diaMounted = useRef(false);
  const chooserMounted = useRef(false);
  if (diaDialog) diaMounted.current = true;
  useEffect(() => {
    if (diaDialog) loadUnlockFx(); // الحركة جاهزة قبل التأكيد
  }, [diaDialog]);
  if (chooser) chooserMounted.current = true;
  const [confetti, setConfetti] = useState(null);
  const codeVisible = revealed || ((keyOwned || diaOwned) && !keyScratch);

  // إعادة ضبط الخدش وبيانات Premium عند تبديل الوضع أو تغيّر حالة الاشتراك
  useEffect(() => {
    setRevealed(false);
    setPremiumData(null);
  }, [premium, unlocked]);

  // يجلب كود/رابط Premium مرّة واحدة عند الحاجة (مشترك فعّال أو مفتاح ذهبي على هاد الشركة؛ الخادم يتحقق).
  const ensurePremium = useCallback(async () => {
    if (!premium || !canSee) return null;
    if (premiumData) return premiumData;
    let d = keyOwned ? fk.codeFor(company.id) : null;
    if (!d && diaOwned) d = keys.codeFor(company.id) || (await keys.loadCode(company.id));
    if (!d && !diaOwned) {
      try {
        d = await getPremiumCode(company.id);
      } catch {
        d = null;
      }
    }
    const val = d || { premium_code: null, premium_url: null };
    setPremiumData(val);
    return val;
  }, [premium, canSee, premiumData, company.id, keyOwned, diaOwned, fk.codeFor, keys.codeFor, keys.loadCode]);

  // الشركة المكشوفة بالمفتاح (الذهبي ولا الماسي): الكود يبان مباشرة (بلا خدش في كل زيارة)
  useEffect(() => {
    if ((keyOwned || diaOwned) && !keyScratch && !premiumData) ensurePremium();
  }, [keyOwned, diaOwned, keyScratch, premiumData, ensurePremium]);

  const hot = (company.clicks || 0) >= 50;
  // ضوء دائري بلون النوع يتبع المؤشر (أو موضع اللمس في الهاتف)
  const glow = useCardGlow();

  // رجوع الزائر بعد الدخول (?fk=<id>): البطاقة تجي قدامو، والتأكيد يتحلّ إذا المفتاح متاح
  useEffect(() => {
    if (!freeKey || !premium || fk.pendingId !== company.id || fk.status === "loading") return;
    if (!fk.takePending(company.id)) return;
    glow.ref.current?.scrollIntoView({ behavior: reduceMotion ? "instant" : "smooth", block: "center", inline: "center" });
    if (keyCta === "use") setKeyDialog(true);
  }, [freeKey, premium, fk.pendingId, fk.status, fk.takePending, company.id, keyCta, reduceMotion, glow.ref]);

  useEffect(() => {
    if (!confetti) return;
    const id = setTimeout(() => setConfetti(null), 3800);
    return () => clearTimeout(id);
  }, [confetti]);

  const closeKeyDialog = useCallback(() => setKeyDialog(false), []);
  const closeDiaDialog = useCallback(() => setDiaDialog(false), []);
  const closeChooser = useCallback(() => setChooser(false), []);
  // المفتاح الذهبي متاح لهاد البطاقة (نفس شروط keyCta = "use")
  const goldenHere = keyOn && !keyOwned && fk.enabled && fk.status === "available" && company.free_reveal_enabled !== false;

  // البطاقة المقفولة: زائر → التسجيل (الشركة تتحفظ)، مفاتيح ماسية → التأكيد، حساب بلا مفاتيح → يختار
  // (الذهبي / شراء مفاتيح / Premium)، وإلا كيما قبل (الذهبي ولا نافذة Premium)
  const toSignup = () => {
    setPendingFreeKey(company.id, lang);
    navigate("/signup");
  };
  const keyAction = () => {
    // زائر بلا مفاتيح: يختار (سجّل وخذ المفتاح الذهبي / شراء مفاتيح / Premium)
    if (keyCta === "guest" && !diaCta) {
      setChooser(true);
      return;
    }
    if (diaCta) {
      setDiaDialog(true);
      return;
    }
    if (diaOn) {
      setChooser(true);
      return;
    }
    if (keyCta === "use") {
      setKeyDialog(true);
      return;
    }
    onUnlock?.();
  };

  const confirmKey = async () => {
    const r = await fk.claim(company.id, copySource || copySourceFromPath());
    if (r?.status === "ok" || r?.status === "yours") {
      setPremiumData({ premium_code: r.premium_code ?? null, premium_url: r.premium_url ?? null });
      setRevealed(false);
      setKeyScratch(true);
      setKeyDialog(false);
      return null;
    }
    return r?.status || "error";
  };

  // المفتاح الماسي: تأكيد → الخادم يحرق مفتاح (مرة وحدة لكل شركة) → حركة الفتح فوق الخدش
  const confirmDiamond = async () => {
    const r = await keys.spend(company.id, copySource || copySourceFromPath());
    if (r?.status === "ok" || r?.status === "yours" || r?.status === "free_key") {
      setPremiumData(r.demo ? { premium_code: DEMO_CODE, premium_url: null } : { premium_code: r.premium_code ?? null, premium_url: r.premium_url ?? null });
      setRevealed(false);
      setKeyScratch(true);
      setDiaFx(true);
      setDiaDialog(false);
      return null;
    }
    return r?.status || "error";
  };

  const onScratchReveal = () => {
    setRevealed(true);
    ensurePremium();
    if (!keyScratch) return;
    setKeyScratch(false);
    // قصاصات من فوق البطاقة: ذهبية (المفتاح الذهبي) ولا كريستال (الماسي)
    const r = glow.ref.current?.getBoundingClientRect();
    const origin = r ? { x: (r.left + r.width / 2) / window.innerWidth, y: Math.min(0.8, Math.max(0.12, (r.top + r.height * 0.25) / window.innerHeight)) } : undefined;
    setConfetti({ n: Date.now(), origin, diamond: diaOwned });
  };

  // ألوان حسب الوضع (عادي = لون النوع / Premium = ذهبي)
  const accent = premium ? GOLD : meta.color;
  const accentGlow = premium ? GOLD_GLOW : meta.glow;
  // قيمة الخصم عامة (تُعرض دائماً)؛ أما الكود/الرابط Premium فيُكشفان خادمياً.
  const shownDiscount = premium ? loc("premium_discount") || loc("discount") : loc("discount");
  const normalValue = loc("discount");
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

  const handleCopy = async () => {
    // كود Premium مقفل: لا نسخ — نوجّه للمفتاح الذهبي أو للاشتراك
    if (premium && !canSee) {
      keyAction();
      return;
    }
    // في وضع Premium نجلب الكود الحقيقي خادمياً قبل النسخ (لا نعتمد على صف الشركة)
    let code = company.code;
    let copiedPremium = false;
    if (premium) {
      setRevealed(true); // النسخ = كشف (بلا ما يبقى الغطاء فوق الكود المنسوخ)
      const d = await ensurePremium();
      code = d?.premium_code || company.code;
      copiedPremium = !!d?.premium_code;
    }
    onCopy(company, code);
    // كود Premium مكشوف بالمفتاح الذهبي (ماشي اشتراك) → source = free_key
    logCodeCopy(company.id, copiedPremium, keyOwned && copiedPremium ? "free_key" : copySource);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  if (premium && !hasPremiumOffer(company)) {
    return (
      <FrozenTicket
        company={company}
        index={index}
        isFavorite={isFavorite}
        onToggleFav={onToggleFav}
        linkToStore={linkToStore}
        storeHref={storeHref}
        category={category}
        desc={loc("description") || ""}
        onShowNormal={onShowNormal}
      />
    );
  }

  // متغيّرات التذكرة: حافة بلون النوع (أقوى عند المرور/اللمس) + تلوين الكعب
  const ticketVars = {
    "--edge-base": `${accent}4d`,
    "--edge-strong": `${accent}b3`,
    "--perf": `${accent}80`,
    "--stub": `${accent}0d`,
  };

  return (
    <motion.article
      ref={glow.ref}
      {...glow.handlers}
      data-wave-id={`c${company.id}`}
      initial={{ opacity: 0, y: 26 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10, scale: 0.97 }}
      transition={{ duration: 0.45, delay: Math.min(index * 0.05, 0.35), ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -5 }}
      whileTap={{ y: -2, scale: 0.995 }}
      className={`ticket group relative flex flex-col ${premium ? "ticket-premium" : ""}`}
      style={ticketVars}
    >
      {/* ===== الجزء العلوي: الشركة + الوصف + القيمة ===== */}
      <div className="ticket-top relative bg-[var(--color-ink-card)] p-5 pb-4">
        {/* أمبيانس ذهبي في وضع Premium */}
        {premium && (
          <span
            className="pointer-events-none absolute inset-0"
            style={{ background: `radial-gradient(120% 70% at 50% 0%, ${GOLD}24, transparent 62%)` }}
          />
        )}
        <GlowSpot color={accentGlow} />
        <span aria-hidden className="ticket-ring ticket-ring-l" />
        <span aria-hidden className="ticket-ring ticket-ring-r" />

        {/* شارة Premium كـ overlay مطلق في زاوية جهة end أسفل زر القلب مباشرةً:
            absolute خارج التدفّق → لا تتغيّر أبعاد البطاقة عند التبديل عادي/Premium،
            ولا تغطّي شعار المتجر ولا الاسم. pointer-events-none حتى يمرّ النقر لما تحتها. */}
        {premium &&
          (diaOwned ? (
            // الشركة اللي فتحها بالمفتاح الماسي: نفس البلاصة، شارة "مفتاحك الماسي"
            <span
              data-part="premium-badge"
              className="pointer-events-none absolute end-5 top-14 z-20 flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black"
              style={{ background: "#0d1428", borderColor: `${DIA_DEEP}cc`, color: DIA_SOFT, boxShadow: `0 4px 14px -5px ${DIA_GLOW}` }}
            >
              <DiamondGlyph size={11} /> {t("keys.card.badge")}
            </span>
          ) : keyOwned ? (
            // الشركة اللي كشفها بالمفتاح الذهبي: نفس البلاصة، شارة "مفتاحك الذهبي"
            <span
              data-part="premium-badge"
              className="pointer-events-none absolute end-5 top-14 z-20 flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black"
              style={{ background: "#1d1403", borderColor: `${GOLD}b3`, color: GOLD_SOFT, boxShadow: `0 4px 14px -5px ${GOLD_GLOW}` }}
            >
              <Key size={11} /> {t("freeKey.card.badge")}
            </span>
          ) : (
            <span
              data-part="premium-badge"
              className="pointer-events-none absolute end-5 top-14 z-20 flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black text-[#0a0a0a]"
              style={{ background: `linear-gradient(135deg, ${GOLD_SOFT}, ${GOLD_DEEP})`, boxShadow: `0 4px 14px -5px ${GOLD_GLOW}` }}
            >
              <Crown size={11} /> {t("card.premiumBadge")}
            </span>
          ))}

        {/* الرأس — القلب مثبت أعلى البطاقة (items-start + shrink-0) ولا يتأثر بطول النص */}
        <div className="relative flex items-start justify-between gap-2">
          {linkToStore ? (
            <Link to={storeHref} className="group/link flex min-w-0 items-center gap-3">
              <CardLogo logo={company.logo} bg={company.logo_bg} name={company.name} accent={accent} glow={accentGlow} premium={premium} />
              <div className="min-w-0">
                <h3 className="truncate text-[17px] font-extrabold text-[var(--text)] transition-colors group-hover/link:text-[var(--accent-text)]">{company.name}</h3>
                <p className={`mt-0.5 flex min-w-0 items-center gap-1.5 text-[12.5px] font-medium text-[var(--color-mute)] ${diaOwned ? "pe-[7.25rem]" : premium ? "pe-11" : ""}`}>
                  {/* "جديد": تزادت في آخر 7 أيام (created_at) — تحت الاسم باش الاسم يبقى كامل */}
                  <NewBadge date={company.created_at} size="sm" />
                  <span className="truncate">{category}</span>
                </p>
              </div>
            </Link>
          ) : (
            <div className="flex min-w-0 items-center gap-3">
              <CardLogo logo={company.logo} bg={company.logo_bg} name={company.name} accent={accent} glow={accentGlow} premium={premium} />
              <div className="min-w-0">
                <h3 className="truncate text-[17px] font-extrabold text-[var(--text)]">{company.name}</h3>
                <p className={`mt-0.5 flex min-w-0 items-center gap-1.5 text-[12.5px] font-medium text-[var(--color-mute)] ${diaOwned ? "pe-[7.25rem]" : premium ? "pe-11" : ""}`}>
                  {/* "جديد": تزادت في آخر 7 أيام (created_at) — تحت الاسم باش الاسم يبقى كامل */}
                  <NewBadge date={company.created_at} size="sm" />
                  <span className="truncate">{category}</span>
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
              data-part="fav"
              onClick={() => onToggleFav(company.id)}
              aria-label={t("card.addFav")}
              aria-pressed={!!isFavorite}
              className="relative grid h-8 w-8 place-items-center rounded-full border border-[var(--color-ink-line)] bg-[var(--fill)] transition-colors before:absolute before:-inset-1.5 before:content-[''] hover:bg-[var(--fill-strong)]"
            >
              <Heart size={15} className={isFavorite ? "fill-red-500 text-red-500" : "text-[var(--color-mute)]"} />
            </button>
          </div>
        </div>

        {/* الوصف — ارتفاع ثابت (ثلاثة أسطر) ليتساوى ارتفاع كل البطاقات */}
        <p className="relative mt-4 line-clamp-3 h-[60px] overflow-hidden text-[13.5px] leading-[1.48] text-[var(--text-soft)]">
          <BidiText text={desc} rtl={lang === "ar"} />
        </p>

        {/* قيمة الخصم + شارة النوع */}
        <div className="relative mt-4 flex items-end justify-between">
          <div data-part="value">
            <div className="flex min-w-0 items-center gap-1.5 text-[11.5px] font-semibold text-[var(--color-mute)]">
              {premium && <Crown size={12} style={{ color: GOLD }} />}
              {premium ? t("card.premiumDiscount") : t("card.offerValue")}
              {/* كود مقفول: الفرق (العادي ← Premium) قبل ما يستعمل مفتاح ولا يشري */}
              {premium && !canSee && freeKey && normalValue && normalValue !== shownDiscount && (
                <span data-part="gain" className="flex min-w-0 items-center gap-1" title={t("keys.card.gain", { normal: normalValue, premium: shownDiscount })}>
                  <span aria-hidden>·</span>
                  <s className="max-w-[7.5rem] truncate decoration-[var(--color-mute)]">
                    <BidiText text={normalValue} rtl={lang === "ar"} />
                  </s>
                  <ArrowLeft size={11} aria-hidden className="shrink-0 ltr:rotate-180" />
                </span>
              )}
            </div>
            <div className="text-[30px] font-black leading-none">
              <AnimatedDiscount value={shownDiscount} color={accent} glow={accentGlow} />
            </div>
          </div>
          <span
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold"
            style={{ background: `${accent}1a`, color: accent }}
          >
            <Icon size={13} />
            {t(`types.${getTypeKey(company.type)}`)}
          </span>
        </div>
      </div>

      {/* ===== الكعب: الكود + النسخ + الزيارة + التصويت ===== */}
      <div className="ticket-stub relative bg-[var(--color-ink-card)] px-5 pb-5 pt-4">
        <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "var(--stub)" }} />
        <GlowSpot color={accentGlow} />
        <span aria-hidden className="ticket-ring ticket-ring-l" />
        <span aria-hidden className="ticket-ring ticket-ring-r" />
        <span aria-hidden className="ticket-perf" />

        {/* الكود + نسخ (في Premium يُغطّى الكود ببطاقة خدش) */}
        <div className="relative flex items-stretch gap-2">
          <div data-part="code" className="relative flex-1">
            <div
              className="flex h-full items-center justify-between overflow-hidden rounded-xl border border-dashed px-3.5 py-2.5"
              style={{ borderColor: `${accent}55`, background: `${accent}0d` }}
            >
              <span className="text-[10.5px] font-semibold text-[var(--color-mute)]">
                {premium ? t("card.premiumCode") : t("card.code")}
              </span>
              <span className="font-mono text-[15px] font-extrabold tracking-widest text-[var(--text)]">{shownCode}</span>
            </div>
            {premium && !codeVisible && (
              <ScratchLayer
                t={t}
                unlocked={canSee}
                accent={accent}
                onReveal={onScratchReveal}
                onUnlock={keyAction}
                lockLabel={diaCta ? t("keys.card.open") : !diaOwned && (keyCta === "guest" || keyCta === "use") ? t(`freeKey.card.${keyCta}`) : undefined}
              />
            )}
            {premium && diaFx && keyScratch && (
              <Suspense fallback={null}>
                <DiamondUnlockFx onDone={() => setDiaFx(false)} />
              </Suspense>
            )}
          </div>

          <motion.button
            data-part="copy"
            onClick={handleCopy}
            whileTap={{ scale: 0.94 }}
            className="relative grid min-w-[120px] shrink-0 place-items-center overflow-hidden whitespace-nowrap rounded-xl px-3.5 text-[14px] font-extrabold text-[#0a0a0a]"
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
                  {/* كود Premium مقفول: الزر ما ينسخش — يكشف (المفتاح الذهبي / Premium) */}
                  {premium && !canSee ? (
                    <>
                      <Lock size={15} /> {t("card.unlockCode")}
                    </>
                  ) : (
                    <>
                      <Copy size={15} /> {t("card.copy")}
                    </>
                  )}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>

        {/* زر زيارة الموقع — موجود دائماً بنفس الارتفاع (لا قفزة عند الكشف).
            - عادي / Premium مكشوف وله رابط: زر فعّال بالرابط الحقيقي (shownLink).
            - Premium قبل الكشف: مقفول مظهراً فقط (أيقونة قفل، بلا href —
              ولا يوضع premium_url في DOM إطلاقاً قبل الكشف).
            - لا رابط متاح: نفس الزر معطّلاً (ليبقى الارتفاع ثابتاً). */}
        {premium && !codeVisible ? (
          diaCta ? (
            // المفتاح الماسي بلاصة زر الزيارة المقفول (نفس الارتفاع 42.25px)
            <DiamondCta label={t("keys.card.open")} count={keys.balance} onClick={() => setDiaDialog(true)} />
          ) : keyCta && !diaOwned ? (
            // المفتاح الذهبي بلاصة زر الزيارة المقفول (نفس الارتفاع: الشبكة ما تقفزش)
            <KeyCta kind={keyCta} label={t(`freeKey.card.${keyCta}`)} onClick={keyCta === "use" ? () => setKeyDialog(true) : keyCta === "guest" ? toSignup : keyAction} />
          ) : canSee ? (
            // عضو Premium قبل الخدش: زر فعّال يكشف الكود والرابط (بلا قفل — الكود مفتوح لك)
            <motion.button
              type="button"
              data-part="visit"
              onClick={onScratchReveal}
              whileTap={{ scale: 0.98 }}
              className="relative mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-[13.5px] font-bold text-[var(--text)]"
              style={{ borderColor: `${accent}66`, background: `${accent}14` }}
            >
              <Sparkles size={15} style={{ color: accent }} />
              {t("card.revealAll")}
            </motion.button>
          ) : (
            <div
              data-part="visit"
              aria-disabled="true"
              className="relative mt-2.5 flex cursor-not-allowed select-none items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-[13.5px] font-bold text-[var(--color-mute)] opacity-60"
              style={{ borderColor: `${accent}33`, background: `${accent}08` }}
            >
              <Lock size={14} style={{ color: accent }} />
              {t("card.visit")}
            </div>
          )
        ) : shownLink ? (
          <motion.a
            data-part="visit"
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
            data-part="visit"
            aria-disabled="true"
            className="relative mt-2.5 flex cursor-not-allowed select-none items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-[13.5px] font-bold text-[var(--color-mute)] opacity-60"
            style={{ borderColor: `${accent}33`, background: `${accent}08` }}
          >
            <ExternalLink size={15} style={{ color: accent }} />
            {t("card.visit")}
          </div>
        )}

        {/* قسم التصويت على الكود — "هل نجح هذا الكود معك؟" (عادي + Premium) */}
        <div data-part="vote" className="relative">
          <CodeVote companyId={company.id} accent={accent} glow={accentGlow} />
        </div>
      </div>

      {(keyCta === "use" || keyDialog) && (
        <FreeKeyDialog
          open={keyDialog}
          company={company}
          value={loc("premium_discount") || loc("discount")}
          onConfirm={confirmKey}
          onClose={closeKeyDialog}
        />
      )}
      {diaMounted.current && (
        <Suspense fallback={null}>
        <KeyUnlockDialog
          open={diaDialog}
          company={company}
          normal={normalValue}
          premium={loc("premium_discount") || loc("discount")}
          balance={keys.balance}
          onConfirm={confirmDiamond}
          onGolden={
            goldenHere
              ? () => {
                  setDiaDialog(false);
                  setKeyDialog(true);
                }
              : undefined
          }
          onClose={closeDiaDialog}
        />
        </Suspense>
      )}
      {chooserMounted.current && (
        <Suspense fallback={null}>
        <KeyChooser
          open={chooser}
          company={company}
          normal={normalValue}
          premium={loc("premium_discount") || loc("discount")}
          golden={goldenHere || keyCta === "guest"}
          guest={keyCta === "guest"}
          onGolden={() => {
            setChooser(false);
            if (keyCta === "guest") toSignup();
            else setKeyDialog(true);
          }}
          onBuy={() => {
            setChooser(false);
            navigate(`${premiumPath(lang)}?keys=1#keys`);
          }}
          onPremium={() => {
            setChooser(false);
            onUnlock?.();
          }}
          onClose={closeChooser}
        />
        </Suspense>
      )}
      {confetti &&
        typeof document !== "undefined" &&
        createPortal(<GiftConfetti fire={confetti.n} origin={confetti.origin} colors={confetti.diamond ? PRISM : undefined} />, document.body)}
    </motion.article>
  );
}

/* ===== زر المفتاح الذهبي في البطاقة المقفولة (بلاصة زر الزيارة، نفس الارتفاع 42.25px) =====
   use = "استعمل مفتاحك" (ذهبي ممتلئ الأيقونة) · guest = "سجّل مجاناً…" · upsell = "استعملت مفتاحك…" (هادئ) */
const KEY_CTA_STYLE = {
  use: { borderColor: `${GOLD}b3`, background: `linear-gradient(180deg, ${GOLD}2b, ${GOLD}10)`, color: GOLD_SOFT, boxShadow: `inset 0 1px 0 ${GOLD_SOFT}2e, 0 10px 26px -16px ${GOLD_GLOW}` },
  guest: { borderColor: `${GOLD}66`, background: `${GOLD}12`, color: GOLD_SOFT },
  upsell: { borderColor: `${GOLD}33`, background: `${GOLD}08`, color: "var(--text-soft)" },
};

function KeyCta({ kind, label, onClick }) {
  return (
    <button
      type="button"
      data-part="visit"
      onClick={onClick}
      title={label}
      className="group/key relative mt-2.5 flex h-[42.25px] w-full items-center justify-center gap-2 rounded-xl border px-3 text-[12.5px] font-extrabold leading-[1.25] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#ffe486]/70"
      style={KEY_CTA_STYLE[kind]}
    >
      {kind === "use" ? (
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover/key:-rotate-[18deg]" style={{ background: `linear-gradient(135deg, ${GOLD_SOFT}, ${GOLD_DEEP})` }}>
          <Key size={13} className="text-[#1d1403]" />
        </span>
      ) : kind === "upsell" ? (
        <Crown size={15} className="shrink-0" style={{ color: GOLD }} />
      ) : (
        <Key size={15} className="shrink-0" style={{ color: GOLD }} />
      )}
      <span className="line-clamp-2 text-center">{label}</span>
    </button>
  );
}

/* ===== زر المفتاح الماسي (بلاصة زر الزيارة المقفول، نفس الارتفاع 42.25px) — كريستال + عدد المفاتيح ===== */
function DiamondCta({ label, count, onClick }) {
  return (
    <button
      type="button"
      data-part="visit"
      onClick={onClick}
      title={label}
      className="dk-glint group/key relative mt-2.5 flex h-[42.25px] w-full items-center justify-center gap-2 rounded-xl border px-3 text-[12.5px] font-extrabold leading-[1.25] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#dbeeff]/70"
      style={{ borderColor: `${DIA_DEEP}cc`, background: "linear-gradient(180deg, rgba(169,205,255,0.2), rgba(169,205,255,0.06))", color: DIA_SOFT, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18), 0 10px 26px -16px ${DIA_GLOW}` }}
    >
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover/key:-rotate-[18deg]" style={{ background: DIA_BG }}>
        <DiamondGlyph size={14} />
      </span>
      <span className="line-clamp-2 text-center">{label}</span>
      <span className="shrink-0 rounded-full px-1.5 text-[11px] font-black tabular-nums" style={{ background: DIA_BG, color: DIA_INK }}>
        {count}
      </span>
    </button>
  );
}

// كود المعاينة (KEYS_DEMO): الفتح التجريبي ما يقراش الكود الحقيقي
const DEMO_CODE = "DEMO-KEY";

/* ===== البطاقة المجمّدة: وضع Premium لشركة بلا عرض Premium =====
   رمادية وباهتة بلا أي ذهب (الفرق عن القفل الذهبي = عرض Premium موجود والزائر غير مشترك):
   قفل رمادي + "لا يوجد عرض Premium لهذه الشركة"، بلا نسخ ولا زيارة ولا خدش، والتصويت معطّل.
   نفس أجزاء data-part ونفس الارتفاع، فلا تقفز الشبكة. */
const FROZEN = "#71717a";

function FrozenTicket({ company, index, isFavorite, onToggleFav, linkToStore, storeHref, category, desc, onShowNormal }) {
  const { t, i18n } = useTranslation();
  const meta = getTypeMeta(company.type);
  const Icon = meta.icon;
  const head = (
    <>
      <div className="shrink-0 opacity-60 grayscale">
        <CardLogo logo={company.logo} bg={company.logo_bg} name={company.name} accent={FROZEN} glow="rgba(0,0,0,0)" premium={false} />
      </div>
      <div className="min-w-0">
        <h3 className="truncate text-[17px] font-extrabold text-[var(--text-soft)]">{company.name}</h3>
        <p className="mt-0.5 truncate text-[12.5px] font-medium text-[var(--color-mute)]">{category}</p>
      </div>
    </>
  );

  return (
    <motion.article
      initial={{ opacity: 0, y: 26 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10, scale: 0.97 }}
      transition={{ duration: 0.45, delay: Math.min(index * 0.05, 0.35), ease: [0.16, 1, 0.3, 1] }}
      data-frozen=""
      data-wave-id={`c${company.id}`}
      className="ticket ticket-frozen relative flex flex-col"
      style={{ "--edge-base": "rgba(255,255,255,0.07)", "--edge-strong": "rgba(255,255,255,0.07)", "--perf": "rgba(255,255,255,0.12)" }}
    >
      <div className="ticket-top relative bg-[var(--color-ink-card)] p-5 pb-4">
        <span aria-hidden className="ticket-ring ticket-ring-l" />
        <span aria-hidden className="ticket-ring ticket-ring-r" />
        <div className="relative flex items-start justify-between gap-2">
          {linkToStore ? (
            <Link to={storeHref} className="flex min-w-0 items-center gap-3">
              {head}
            </Link>
          ) : (
            <div className="flex min-w-0 items-center gap-3">{head}</div>
          )}
          <button
            data-part="fav"
            onClick={() => onToggleFav(company.id)}
            aria-label={t("card.addFav")}
            aria-pressed={!!isFavorite}
            className="grid h-8 w-8 shrink-0 place-items-center self-start rounded-full border border-[var(--color-ink-line)] bg-[var(--fill)] transition-colors hover:bg-[var(--fill-strong)]"
          >
            <Heart size={15} className={isFavorite ? "fill-red-500 text-red-500" : "text-[var(--color-mute)]"} />
          </button>
        </div>

        <p className="relative mt-4 line-clamp-3 h-[60px] overflow-hidden text-[13.5px] leading-[1.48] text-[var(--color-mute)]"><BidiText text={desc} rtl={i18n.language === "ar"} /></p>

        <div className="relative mt-4 flex items-end justify-between">
          <div data-part="value">
            <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--color-mute)]">
              <Crown size={12} /> {t("card.premiumDiscount")}
            </div>
            <div className="text-[30px] font-black leading-none text-[#52525b]">—</div>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-white/[0.04] px-3 py-1.5 text-[12px] font-bold text-[var(--color-mute)]">
            <Icon size={13} />
            {t(`types.${getTypeKey(company.type)}`)}
          </span>
        </div>
      </div>

      <div className="ticket-stub relative bg-[var(--color-ink-card)] px-5 pb-5 pt-4">
        <span aria-hidden className="ticket-ring ticket-ring-l" />
        <span aria-hidden className="ticket-ring ticket-ring-r" />
        <span aria-hidden className="ticket-perf" />

        <div
          data-part="code"
          role="note"
          className="relative flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.1] bg-white/[0.025] px-3.5 py-2.5 text-center"
        >
          <Lock size={15} className="shrink-0" style={{ color: FROZEN }} />
          <span className="text-[12.5px] font-bold leading-snug text-[var(--text-soft)]">{t("card.frozen")}</span>
        </div>

        {onShowNormal ? (
          <button
            data-part="visit"
            type="button"
            onClick={onShowNormal}
            className="relative mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-transparent px-4 py-2.5 text-[13px] font-bold text-[var(--text-softer)] underline-offset-4 transition-colors hover:text-[var(--text)] hover:underline"
          >
            <Undo2 size={14} /> {t("card.showNormal")}
          </button>
        ) : (
          <div data-part="visit" aria-hidden className="relative mt-2.5 h-[42px]" />
        )}

        <div data-part="vote" className="relative opacity-50" inert="">
          <CodeVote companyId={company.id} accent={FROZEN} glow="rgba(113,113,122,0.2)" />
        </div>
      </div>
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

function ScratchLayer({ t, unlocked, accent = GOLD, onReveal, onUnlock, lockLabel }) {
  // غير مشترك: غطاء مقفل — أيقونة قفل فقط، والضغط عليه يفتح نافذة "افتح خصومات Premium"
  // (ولا المفتاح الذهبي: lockLabel = نص زر المفتاح)
  if (!unlocked) {
    return (
      <button
        type="button"
        onClick={onUnlock}
        aria-label={lockLabel || t("card.unlockPremium")}
        className="absolute inset-0 flex cursor-pointer select-none items-center justify-center gap-1.5 overflow-hidden rounded-xl"
        style={METAL_BG}
      >
        <Lock size={13} className="text-[#2f333a]" />
        <span className="text-[12px] font-extrabold text-[#2f333a]">{t("card.premiumCode")}</span>
      </button>
    );
  }

  // مشترك مصرّح له: نظام خدش حقيقي بالـCanvas (يعمل بنفس القوة في الهاتف والحاسوب)
  return <ScratchCanvas accent={accent} onReveal={onReveal} />;
}

/* ===== خدش بالـHTML5 Canvas (Scratch-to-Reveal) =====
   - غطاء بتدرّج أسود/ذهبي + نقشة + نص "اخدش للكشف 👆".
   - الخدش الحقيقي عبر Pointer Events (ماوس + لمس) بفرشاة destination-out ناعمة.
   - كشف تلقائي عند ~50٪ ممسوحة (تلاشٍ ناعم + لمعة sweep احتفالية).
   - جزيئات ذهبية أثناء الخدش + اهتزاز خفيف (vibrate) في الهاتف.
   - touch-action:none + preventDefault لمنع تمرير الصفحة أثناء الخدش. */
function ScratchCanvas({ accent = GOLD, onReveal }) {
  const { t } = useTranslation();
  const rootRef = useRef(null);
  const coverRef = useRef(null); // كانفاس الغطاء (يُخدش)
  const partRef = useRef(null); // كانفاس الجزيئات (فوق، بلا تفاعل)
  const s = useRef({ drawing: false, revealed: false, started: false, last: null, particles: [], lastSample: 0, raf: 0 });
  const [done, setDone] = useState(false);

  const vibrate = (ms) => {
    try {
      navigator.vibrate?.(ms);
    } catch {
      /* غير مدعوم */
    }
  };

  // رسم الغطاء (تدرّج + نقشة + نص)
  // يرسم نفس خلفية METAL_BG بالضبط على الكانفاس (قابلة للخدش). النص/الأيقونة
  // ليسا هنا — هما عنصر DOM فوق الكانفاس (pointer-events:none) ليرثا Tajawal تماماً.
  const drawCover = useCallback((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    // 1) القاعدة: linear-gradient(135deg, #c2c7d0, #9aa0aa 40%, #d6dbe3 60%, #8f95a0)
    const base = ctx.createLinearGradient(0, 0, w, h);
    base.addColorStop(0, "#c2c7d0");
    base.addColorStop(0.4, "#9aa0aa");
    base.addColorStop(0.6, "#d6dbe3");
    base.addColorStop(1, "#8f95a0");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    // 2) repeating-linear-gradient(115deg, …) بدمج overlay (نفس METAL_BG)
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.translate(w / 2, h / 2);
    ctx.rotate((115 * Math.PI) / 180);
    const diag = Math.hypot(w, h);
    for (let x = -diag; x < diag; x += 18) {
      const stripe = ctx.createLinearGradient(x, 0, x + 18, 0);
      stripe.addColorStop(0, "#c6cbd4");
      stripe.addColorStop(6 / 18, "#aab0ba");
      stripe.addColorStop(12 / 18, "#d4d9e1");
      stripe.addColorStop(1, "#9aa0aa");
      ctx.fillStyle = stripe;
      ctx.fillRect(x, -diag, 18, diag * 2);
    }
    ctx.restore();
    ctx.globalCompositeOperation = "source-over";
    // 3) لمعات داخلية (نفس boxShadow inset في METAL_BG)
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillRect(0, 0, w, 1);
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(0, h - 1, w, 1);
  }, []);

  // إعداد الكانفاس + إعادة الضبط عند تغيّر المقاس
  useEffect(() => {
    const root = rootRef.current;
    const cover = coverRef.current;
    const part = partRef.current;
    if (!root || !cover || !part) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const setup = () => {
      if (s.current.revealed) return; // لا نعيد رسم الغطاء بعد الكشف
      const r = root.getBoundingClientRect();
      const w = Math.max(1, Math.round(r.width));
      const h = Math.max(1, Math.round(r.height));
      for (const c of [cover, part]) {
        c.width = w * dpr;
        c.height = h * dpr;
        c.style.width = `${w}px`;
        c.style.height = `${h}px`;
        c.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      drawCover(cover.getContext("2d"), w, h);
    };
    setup();
    const ro = new ResizeObserver(setup);
    ro.observe(root);
    return () => {
      ro.disconnect();
      if (s.current.raf) cancelAnimationFrame(s.current.raf);
      s.current.raf = 0;
    };
  }, [drawCover]);

  // حلقة الجزيئات
  const tick = useCallback(() => {
    const part = partRef.current;
    if (!part) return;
    const ctx = part.getContext("2d");
    const w = part.clientWidth;
    const h = part.clientHeight;
    ctx.clearRect(0, 0, w, h);
    const st = s.current;
    st.particles = st.particles.filter((p) => p.life > 0);
    for (const p of st.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.13;
      p.life -= 1;
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    st.raf = st.particles.length || st.drawing ? requestAnimationFrame(tick) : 0;
  }, []);

  const ensureTick = useCallback(() => {
    if (!s.current.raf) s.current.raf = requestAnimationFrame(tick);
  }, [tick]);

  const spawnParticles = useCallback(
    (x, y) => {
      const st = s.current;
      const colors = [GOLD_SOFT, GOLD, GOLD_DEEP, "#a6f000"];
      for (let i = 0; i < 4; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = Math.random() * 2 + 0.5;
        st.particles.push({
          x,
          y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - 1,
          life: 28 + Math.random() * 22,
          maxLife: 50,
          size: Math.random() * 1.6 + 0.6,
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }
      if (st.particles.length > 140) st.particles.splice(0, st.particles.length - 140);
      ensureTick();
    },
    [ensureTick]
  );

  const pos = (e) => {
    const r = coverRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const scratchTo = useCallback(
    (x, y) => {
      const ctx = coverRef.current.getContext("2d");
      const st = s.current;
      const radius = 22;
      ctx.globalCompositeOperation = "destination-out";
      const stamp = (px, py) => {
        const rg = ctx.createRadialGradient(px, py, 0, px, py, radius);
        rg.addColorStop(0, "rgba(0,0,0,1)");
        rg.addColorStop(0.55, "rgba(0,0,0,0.65)");
        rg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();
      };
      if (st.last) {
        const dx = x - st.last.x;
        const dy = y - st.last.y;
        const dist = Math.hypot(dx, dy);
        const steps = Math.max(1, Math.floor(dist / 6));
        for (let i = 0; i <= steps; i++) stamp(st.last.x + (dx * i) / steps, st.last.y + (dy * i) / steps);
      } else {
        stamp(x, y);
      }
      ctx.globalCompositeOperation = "source-over";
      st.last = { x, y };
      spawnParticles(x, y);
    },
    [spawnParticles]
  );

  // نسبة المساحة الممسوحة (عيّنة مخفّفة لتفادي ثقل getImageData)
  const sampleRatio = () => {
    const cover = coverRef.current;
    const ctx = cover.getContext("2d");
    let data;
    try {
      data = ctx.getImageData(0, 0, cover.width, cover.height).data;
    } catch {
      return 0;
    }
    let cleared = 0;
    let total = 0;
    const step = 4 * 24; // كل ~24 بكسل
    for (let i = 3; i < data.length; i += step) {
      total++;
      if (data[i] < 100) cleared++;
    }
    return total ? cleared / total : 0;
  };

  const reveal = useCallback(() => {
    const st = s.current;
    if (st.revealed) return;
    st.revealed = true;
    st.drawing = false;
    vibrate([18, 30, 18]); // اهتزاز احتفالي عند الكشف الكامل
    setDone(true); // تلاشٍ ناعم + لمعة sweep
    setTimeout(() => onReveal?.(), 520);
  }, [onReveal]);

  const onDown = (e) => {
    const st = s.current;
    if (st.revealed) return;
    e.preventDefault();
    st.drawing = true;
    st.last = null;
    if (!st.started) {
      st.started = true;
      vibrate(12); // اهتزاز خفيف عند بداية الخدش
    }
    coverRef.current.setPointerCapture?.(e.pointerId);
    const { x, y } = pos(e);
    scratchTo(x, y);
    ensureTick();
  };

  const onMove = (e) => {
    const st = s.current;
    if (!st.drawing || st.revealed) return;
    e.preventDefault();
    const { x, y } = pos(e);
    scratchTo(x, y);
    const now = performance.now();
    if (now - st.lastSample > 110) {
      st.lastSample = now;
      if (sampleRatio() >= 0.5) reveal();
    }
  };

  const onUp = (e) => {
    const st = s.current;
    st.drawing = false;
    st.last = null;
    coverRef.current?.releasePointerCapture?.(e.pointerId);
  };

  return (
    <div
      ref={rootRef}
      className={`absolute inset-0 overflow-hidden rounded-xl transition-opacity duration-500 ${done ? "opacity-0" : "opacity-100"}`}
      style={{ touchAction: "none" }}
    >
      <canvas
        ref={coverRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
        onPointerCancel={onUp}
        className="absolute inset-0 h-full w-full cursor-pointer select-none touch-none"
      />
      {/* الأيقونة + النص كعنصر DOM (pointer-events:none) — نفس markup زر القفل العادي
          بالضبط فيرث Tajawal ونفس الحجم/السماكة/اللون، فيتطابق المظهر تماماً. */}
      <div className="pointer-events-none absolute inset-0 flex select-none items-center justify-center gap-1.5">
        <Sparkles size={14} className="text-[#2f333a]" />
        <span className="text-[12.5px] font-extrabold text-[#2f333a]">{t("card.scratchReveal")}</span>
      </div>
      <canvas ref={partRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      {/* لمعة ذهبية احتفالية عند الكشف */}
      {done && (
        <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
          <motion.span
            initial={{ x: "-130%" }}
            animate={{ x: "130%" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="absolute inset-y-0 w-2/3 -skew-x-12"
            style={{ background: `linear-gradient(90deg, transparent, ${GOLD_SOFT}, transparent)` }}
          />
        </span>
      )}
    </div>
  );
}

/* ===== عدّاد متحرّك لقيمة الخصم (~0.6 ثانية، في البطاقة الظاهرة برك — lib/modeWave.jsx) ===== */
function AnimatedDiscount({ value, color, glow }) {
  const ref = useRef(null);
  const display = useCountText(value, ref);
  return (
    <span ref={ref} style={{ color, textShadow: `0 0 24px ${glow}` }}>{display}</span>
  );
}

/* ===== لوجو البطاقة ===== */
function CardLogo({ logo, name, accent, glow, premium, bg = null }) {
  // 0 = النسخة المصغّرة (WebP بحجم البطاقة)، 1 = الملف الأصلي، 2 = فشل → الحرف
  const [fail, setFail] = useState(0);
  const showImage = isImageUrl(logo) && fail < 2;
  const showEmoji = !showImage && logo && !isImageUrl(logo);
  const letter = (name || "؟").trim().charAt(0);
  const [tone, setTone] = useState(() => (showImage && !bg ? cachedTone(logo) : undefined));
  useEffect(() => setFail(0), [logo]);
  useEffect(() => {
    if (!showImage || bg || cachedTone(logo)) return;
    let alive = true;
    detectTone(logo).then((t) => alive && setTone(t));
    return () => {
      alive = false;
    };
  }, [logo, bg, showImage]);
  const tile = showImage ? tileStyle(bg, tone ?? cachedTone(logo)) : null;
  const pad = tile ? Math.round(64 * tile.pad) : 0;

  return (
    <div
      className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl transition-transform duration-300 group-hover:scale-105"
      style={{
        background: showImage ? tile.background : "linear-gradient(150deg, #1c1c20, #141417)",
        boxShadow: `0 6px 18px -10px ${glow}`,
        padding: pad,
      }}
    >
      {showImage ? (
        <img
          src={fail ? logo : logoSrc(logo, 128)}
          srcSet={fail ? undefined : logoSrcSet(logo, 64)}
          width={64}
          height={64}
          alt={name || "logo"}
          loading="lazy"
          decoding="async"
          onError={() => setFail((n) => n + 1)}
          className={`h-full w-full ${pad ? "object-contain" : "object-cover"}`}
        />
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
