import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Search, Tag, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCategories } from "../../lib/categories.jsx";
import { offersLink } from "../../lib/seo.js";
import { categoryName, categoryRecordSlug, companyCategoryRecord } from "../../lib/slug.js";
import { activeCategories, countByCategory, matchesSearch } from "../../lib/offerFilters.js";
import { getTypeMeta } from "../../lib/types.js";
import CompanyLogo from "../CompanyLogo.jsx";
import { useHeaderOffers } from "./headerData.js";

const MAX_OFFERS = 6;
const MAX_CATS = 3;

/**
 * نافذة البحث السريع (زر البحث في الهيدر أو Ctrl+K / ⌘K): النتائج تظهر أثناء الكتابة،
 * والضغط على نتيجة يفتح /offers بالبحث (أو بالفئة). الأسهم للتنقّل، Enter للفتح، Esc للإغلاق.
 */
export default function QuickSearch({ open, onClose }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const navigate = useNavigate();
  const { categories, byId } = useCategories();
  const offers = useHeaderOffers(open);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);

  // عند الفتح: حقل فارغ + تركيز عليه؛ عند الإغلاق: يرجع التركيز لما كان عليه (زر البحث مثلاً)
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement;
    setQ("");
    setActive(0);
    const id = setTimeout(() => inputRef.current?.focus(), 40);
    return () => {
      clearTimeout(id);
      prev?.focus?.({ preventScroll: true });
    };
  }, [open]);

  const cats = useMemo(() => activeCategories(categories), [categories]);
  const counts = useMemo(() => countByCategory(offers, cats), [offers, cats]);
  const query = q.trim();

  const items = useMemo(() => {
    if (!query) return [];
    const low = query.toLowerCase();
    const offerHits = offers.filter((c) => matchesSearch(c, query, lang, byId, categories)).slice(0, MAX_OFFERS);
    const catHits = cats
      .filter((c) => [categoryName(c, lang), c.name_ar, c.name_en, c.name_fr].some((v) => v && v.toLowerCase().includes(low)))
      .slice(0, MAX_CATS);
    return [
      ...offerHits.map((o) => ({ key: `o-${o.id}`, kind: "offer", o })),
      ...catHits.map((c) => ({ key: `c-${c.id}`, kind: "cat", c })),
      { key: "all", kind: "all" },
    ];
  }, [query, offers, cats, lang, byId, categories]);

  const suggestions = useMemo(
    () => cats.filter((c) => (counts[c.id] || 0) > 0).sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0)).slice(0, 6),
    [cats, counts]
  );

  useEffect(() => setActive(0), [query]);

  const go = (item) => {
    let to;
    if (item?.kind === "offer") to = offersLink(lang, { q: item.o.name });
    else if (item?.kind === "cat") to = offersLink(lang, { category: categoryRecordSlug(item.c) });
    else to = offersLink(lang, query ? { q: query } : {});
    onClose();
    navigate(to);
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown" && items.length) {
      e.preventDefault();
      setActive((a) => (a + 1) % items.length);
    } else if (e.key === "ArrowUp" && items.length) {
      e.preventDefault();
      setActive((a) => (a - 1 + items.length) % items.length);
    } else if (e.key === "Enter" && e.target === inputRef.current) {
      e.preventDefault();
      go(items[active]);
    } else if (e.key === "Tab") {
      // التركيز يبقى داخل النافذة
      const f = [...e.currentTarget.querySelectorAll("input, button")];
      const i = f.indexOf(document.activeElement);
      e.preventDefault();
      f[e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i + 1) % f.length]?.focus();
    }
  };

  const offerCount = items.filter((i) => i.kind !== "all").length;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="qs"
          className="fixed inset-0 z-[90] flex items-start justify-center px-4 pt-[max(env(safe-area-inset-top),12vh)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <div aria-hidden onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t("header.search")}
            onKeyDown={onKeyDown}
            initial={{ opacity: 0, y: -14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-xl overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--elev)]/95 shadow-[0_30px_80px_-24px_rgba(0,0,0,0.9)] backdrop-blur-2xl"
          >
            <span aria-hidden className="pointer-events-none absolute inset-x-10 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(166,240,0,0.55), transparent)" }} />
            <div className="flex items-center gap-3 border-b border-[var(--color-ink-line)] px-4 py-3.5">
              <Search size={19} className="shrink-0 text-[var(--accent-text)]" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("search.placeholder")}
                role="combobox"
                aria-expanded={items.length > 0}
                aria-controls="qs-list"
                aria-activedescendant={items[active] ? `qs-${items[active].key}` : undefined}
                className="w-full bg-transparent text-[16px] font-semibold text-[var(--text)] outline-none placeholder:text-[var(--color-mute)]"
              />
              <button
                type="button"
                onClick={onClose}
                aria-label={t("header.close")}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[var(--color-mute)] transition-colors hover:bg-[var(--fill)] hover:text-[var(--text)]"
              >
                <X size={17} />
              </button>
            </div>

            <div className="max-h-[min(60vh,440px)] overflow-y-auto p-2">
              {!query ? (
                <div className="px-3 py-3">
                  <p className="text-[13px] font-semibold text-[var(--color-mute)]">{t("header.searchHint")}</p>
                  {suggestions.length > 0 && (
                    <>
                      <p className="mt-4 text-[12.5px] font-bold text-[var(--text-soft)]">{t("header.suggestions")}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {suggestions.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => go({ kind: "cat", c })}
                            className="rounded-full border border-[var(--color-ink-line)] bg-[var(--fill)] px-3 py-1.5 text-[12.5px] font-bold text-[var(--text-softer)] transition-colors hover:border-[var(--color-lime)]/45 hover:text-[var(--text)]"
                          >
                            {categoryName(c, lang)}
                            <span className="ms-1.5 text-[11px] text-[var(--color-mute)]">{counts[c.id]}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <ul id="qs-list" role="listbox" aria-label={t("header.search")}>
                  {offerCount === 0 && (
                    <li className="px-3 pb-1 pt-3 text-[13px] font-semibold text-[var(--color-mute)]">{t("header.searchEmpty", { q: query })}</li>
                  )}
                  {items.map((item, i) => {
                    const on = i === active;
                    return (
                      <li
                        key={item.key}
                        id={`qs-${item.key}`}
                        role="option"
                        aria-selected={on}
                        onMouseEnter={() => setActive(i)}
                        onClick={() => go(item)}
                        className={`relative flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${on ? "bg-[var(--fill-strong)]" : ""}`}
                      >
                        {on && <span aria-hidden className="absolute inset-y-2 start-0 w-[3px] rounded-full bg-[var(--color-lime)]" />}
                        <ResultRow item={item} lang={lang} t={t} byId={byId} categories={categories} counts={counts} query={query} />
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="hidden items-center gap-4 border-t border-[var(--color-ink-line)] px-4 py-2.5 text-[11.5px] font-semibold text-[var(--color-mute)] sm:flex">
              <Kbd label="↵">{t("header.kbdOpen")}</Kbd>
              <Kbd label="↑↓">{t("header.kbdMove")}</Kbd>
              <Kbd label={t("header.keyEsc")}>{t("header.close")}</Kbd>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

function Kbd({ label, children }) {
  return (
    <span className="flex items-center gap-1.5">
      <kbd dir="ltr" className="rounded-md border border-[var(--color-ink-line)] bg-[var(--fill)] px-1.5 py-0.5 font-sans text-[11px] font-bold text-[var(--text-softer)]">
        {label}
      </kbd>
      {children}
    </span>
  );
}

function ResultRow({ item, lang, t, byId, categories, counts, query }) {
  if (item.kind === "offer") {
    const c = item.o;
    const meta = getTypeMeta(c.type);
    const rec = companyCategoryRecord(c, byId, categories);
    const value = (lang !== "ar" && c[`discount_${lang}`]) || c.discount || "";
    return (
      <>
        <CompanyLogo logo={c.logo} name={c.name} size={36} accent={meta.color} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14.5px] font-extrabold text-[var(--text)]">{c.name}</span>
          <span className="block truncate text-[12px] font-medium text-[var(--color-mute)]">{rec ? categoryName(rec, lang) : c.category}</span>
        </span>
        <bdi className="shrink-0 text-[14px] font-black" style={{ color: meta.color }}>
          {value}
        </bdi>
      </>
    );
  }
  if (item.kind === "cat") {
    return (
      <>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--color-lime)]/10 text-[var(--accent-text)]">
          <Tag size={16} />
        </span>
        <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-[var(--text)]">{categoryName(item.c, lang)}</span>
        <span className="shrink-0 text-[12px] font-bold text-[var(--color-mute)]">{t("home.categoryCount", { count: counts[item.c.id] || 0 })}</span>
      </>
    );
  }
  return (
    <>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--fill)] text-[var(--text-softer)]">
        <Search size={16} />
      </span>
      <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-[var(--accent-text)]">{t("header.searchAll", { q: query })}</span>
      <ArrowLeft size={16} className="shrink-0 text-[var(--color-mute)] ltr:rotate-180" />
    </>
  );
}
