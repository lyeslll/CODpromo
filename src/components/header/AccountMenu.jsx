import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Heart, LayoutDashboard, LogOut, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../lib/auth.jsx";
import { favoritesPath } from "../../lib/seo.js";

/**
 * قائمة الحساب في هيدر الكمبيوتر: الكبسولة (الحرف + الاسم) تحلّ قائمة صغيرة — حسابي، المفضّلة، لوحة التحكم
 * (الأدمين برك)، الخروج. بلاصة زر "خروج" وحدو جنب الاسم (كان سهل يتضغط بالغلط).
 */
export default function AccountMenu({ name, initial, onLogout }) {
  const { t, i18n } = useTranslation();
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const btnRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item = "flex min-h-[44px] items-center gap-2.5 rounded-xl px-3 text-[13.5px] font-bold text-[var(--text-softer)] transition-colors hover:bg-[var(--fill)] hover:text-[var(--text)]";
  return (
    <div ref={ref} className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-xl border border-[var(--color-ink-line)] bg-[var(--fill)] py-1.5 pe-2.5 ps-1.5 transition-colors hover:bg-[var(--fill-strong)]"
      >
        <span className="grid h-7 w-7 place-items-center rounded-lg text-[13px] font-black text-[#0a0a0a]" style={{ background: "linear-gradient(150deg, var(--color-lime-soft), var(--color-lime-deep))" }}>
          {initial}
        </span>
        <span className="max-w-[110px] truncate text-[13px] font-bold text-[var(--text)]">{name}</span>
        <ChevronDown size={15} className={`text-[var(--color-mute)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="absolute end-0 top-[calc(100%+8px)] z-50 w-64 rounded-2xl border border-[var(--color-ink-line)] bg-[var(--elev)] p-1.5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)]"
          >
            <p className="truncate px-3 pb-2 pt-1.5 text-[12px] text-[var(--color-mute)]" dir="ltr">
              {user?.email}
            </p>
            <Link role="menuitem" to="/dashboard" onClick={() => setOpen(false)} className={item}>
              <LayoutDashboard size={16} /> {t("nav.account")}
            </Link>
            <Link role="menuitem" to={favoritesPath(i18n.language)} onClick={() => setOpen(false)} className={item}>
              <Heart size={16} /> {t("bottomNav.favorites")}
            </Link>
            {profile?.is_admin === true && (
              <Link role="menuitem" to="/admin" onClick={() => setOpen(false)} className={item}>
                <ShieldCheck size={16} /> {t("header.admin")}
              </Link>
            )}
            <div className="my-1 border-t border-[var(--color-ink-line)]" />
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              className={`${item} w-full text-red-400 hover:text-red-300`}
            >
              <LogOut size={16} /> {t("nav.logoutLong")}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
