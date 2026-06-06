import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, Heart, ExternalLink, Flame } from "lucide-react";
import { getTypeMeta } from "../lib/types.js";
import { isImageUrl } from "./CompanyLogo.jsx";

export default function CompanyCard({ company, index, isFavorite, onToggleFav, onCopy }) {
  const meta = getTypeMeta(company.type);
  const Icon = meta.icon;
  const [copied, setCopied] = useState(false);
  const cardRef = useRef(null);

  const hot = (company.clicks || 0) >= 50;

  // بقعة ضوء تتبع المؤشر
  const handleMouseMove = (e) => {
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  const handleCopy = () => {
    onCopy(company);
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
      className="group relative flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] p-5 transition-colors duration-300 hover:border-[var(--color-lime)]/40"
    >
      {/* توهّج علوي حسب النوع */}
      <span
        className="pointer-events-none absolute -top-px left-1/2 h-px w-2/3 -translate-x-1/2 opacity-60"
        style={{ background: `linear-gradient(90deg, transparent, ${meta.color}, transparent)` }}
      />
      {/* بقعة ضوء تتبع المؤشر */}
      <span
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(280px circle at var(--mx,50%) var(--my,0%), ${meta.glow}, transparent 65%)`,
        }}
      />

      {/* الرأس: الشعار + النوع */}
      <div className="relative flex items-start justify-between">
        <div className="flex items-center gap-3">
          <CardLogo logo={company.logo} name={company.name} accent={meta.color} glow={meta.glow} />
          <div className="min-w-0">
            <h3 className="truncate text-[17px] font-extrabold text-[var(--text)]">{company.name}</h3>
            <p className="mt-0.5 truncate text-[12.5px] font-medium text-[var(--color-mute)]">
              {company.category}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {hot && (
            <span className="flex items-center gap-1 rounded-full bg-orange-500/15 px-2 py-1 text-[10.5px] font-bold text-orange-400">
              <Flame size={11} /> رائج
            </span>
          )}
          <button
            onClick={() => onToggleFav(company.id)}
            aria-label="إضافة للمفضلة"
            className="grid h-8 w-8 place-items-center rounded-full border border-[var(--color-ink-line)] bg-[var(--fill)] transition-colors hover:bg-[var(--fill-strong)]"
          >
            <Heart
              size={15}
              className={isFavorite ? "fill-red-500 text-red-500" : "text-[var(--color-mute)]"}
            />
          </button>
        </div>
      </div>

      {/* الوصف */}
      {company.description && (
        <p className="relative mt-4 line-clamp-2 text-[13.5px] leading-relaxed text-[var(--text-soft)]">
          {company.description}
        </p>
      )}

      {/* قيمة الخصم + شارة النوع */}
      <div className="relative mt-4 flex items-end justify-between">
        <div>
          <div className="text-[11.5px] font-semibold text-[var(--color-mute)]">قيمة العرض</div>
          <div
            className="text-[30px] font-black leading-none"
            style={{ color: meta.color, textShadow: `0 0 24px ${meta.glow}` }}
          >
            {company.discount}
          </div>
        </div>
        <span
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold"
          style={{ background: `${meta.color}1a`, color: meta.color }}
        >
          <Icon size={13} />
          {meta.label}
        </span>
      </div>

      {/* الكود + زر النسخ */}
      <div className="relative mt-5 flex items-stretch gap-2">
        {/* تذكرة الكود */}
        <div
          className="relative flex flex-1 items-center justify-between overflow-hidden rounded-xl border border-dashed px-3.5 py-2.5"
          style={{ borderColor: `${meta.color}55`, background: `${meta.color}0d` }}
        >
          <span className="text-[10.5px] font-semibold text-[var(--color-mute)]">الكود</span>
          <span className="font-mono text-[15px] font-extrabold tracking-widest text-[var(--text)]">
            {company.code}
          </span>
        </div>

        {/* زر النسخ */}
        <motion.button
          onClick={handleCopy}
          whileTap={{ scale: 0.94 }}
          className="relative grid w-[120px] shrink-0 place-items-center overflow-hidden rounded-xl px-4 text-[14px] font-extrabold text-[#0a0a0a]"
          style={{
            background: copied
              ? "linear-gradient(135deg, #34d399, #10b981)"
              : `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)`,
            boxShadow: `0 10px 26px -12px ${meta.glow}`,
          }}
        >
          <AnimatePresence mode="wait" initial={false}>
            {copied ? (
              <motion.span
                key="done"
                initial={{ y: 14, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -14, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-1.5"
              >
                <Check size={16} /> تم النسخ
              </motion.span>
            ) : (
              <motion.span
                key="copy"
                initial={{ y: 14, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -14, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-1.5"
              >
                <Copy size={15} /> نسخ الكود
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      {/* زر زيارة الموقع */}
      {company.link && (
        <motion.a
          href={company.link}
          target="_blank"
          rel="noopener noreferrer"
          whileTap={{ scale: 0.98 }}
          className="group/btn relative mt-2.5 flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-[13.5px] font-bold text-[var(--text)] transition-colors"
          style={{ borderColor: `${meta.color}44`, background: `${meta.color}0d` }}
        >
          <ExternalLink size={15} style={{ color: meta.color }} />
          زيارة الموقع
        </motion.a>
      )}
    </motion.article>
  );
}

/**
 * عرض لوجو الشركة داخل البطاقة فقط:
 *  - إطار بخلفية بيضاء فاتحة (تختفي معها الحواف السوداء حول اللوجو)
 *  - الصورة كاملة دون قص (object-contain) + حشوة تتنفّس
 *  - زوايا ناعمة مع overflow:hidden لقصّ نظيف
 *  - fallback أنيق: إيموجي أو أول حرف من الاسم
 */
function CardLogo({ logo, name, accent, glow }) {
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
        <img
          src={logo}
          alt={name || "logo"}
          loading="lazy"
          onError={() => setErrored(true)}
          className="h-full w-full object-cover"
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
