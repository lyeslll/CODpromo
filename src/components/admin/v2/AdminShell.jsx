import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Store,
  FolderTree,
  Inbox,
  Vote,
  Users,
  AtSign,
  Crown,
  BarChart3,
  Globe,
  Sparkles,
  Gift,
  PartyPopper,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  ArrowLeft,
  LogOut,
} from "lucide-react";
import Logo from "../../Logo.jsx";
import { useAdminT } from "./ui.jsx";

/** مجموعات القائمة الجانبية — كل عنصر له رابط خاص تحت /admin. */
export const NAV = [
  { group: "home", items: [{ key: "overview", path: "/admin", icon: LayoutDashboard, end: true }] },
  {
    group: "content",
    items: [
      { key: "companies", path: "/admin/companies", icon: Store },
      { key: "featured", path: "/admin/featured", icon: Sparkles },
      { key: "nocode", path: "/admin/nocode", icon: Gift },
      { key: "categories", path: "/admin/categories", icon: FolderTree },
      { key: "requests", path: "/admin/requests", icon: Inbox, badge: "pending" },
      { key: "votes", path: "/admin/votes", icon: Vote },
    ],
  },
  {
    group: "people",
    items: [
      { key: "users", path: "/admin/users", icon: Users },
      { key: "subscribers", path: "/admin/subscribers", icon: AtSign },
      { key: "premium", path: "/admin/premium", icon: Crown },
      { key: "gifts", path: "/admin/gifts", icon: PartyPopper },
    ],
  },
  {
    group: "settings",
    items: [
      { key: "siteStats", path: "/admin/site-stats", icon: BarChart3 },
      { key: "seo", path: "/admin/seo", icon: Globe },
    ],
  },
];

const COLLAPSE_KEY = "codpromo:admin-sidebar-collapsed";
const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
};

/**
 * إطار اللوحة: قائمة جانبية ثابتة على اليسار (تصغر لأيقونات)، وفي الهاتف درج يُفتح بزر.
 * الخلفية شفافة حتى يظهر ضوء الماوس العام (CursorGlow).
 */
export default function AdminShell({ pendingCount = 0, onLogout, children }) {
  const t = useAdminT();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => setDrawer(false), [pathname]);
  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {
      /* تجاهل */
    }
  }, [collapsed]);
  // Esc يغلق الدرج
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e) => e.key === "Escape" && setDrawer(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer]);

  const current = NAV.flatMap((g) => g.items).find((i) => (i.end ? pathname === i.path || pathname === `${i.path}/` : pathname.startsWith(i.path)));

  return (
    <div className="min-h-screen text-white">
      {/* القائمة الثابتة (الحاسوب) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-white/[0.06] bg-[#0b0b0d]/80 backdrop-blur-xl transition-[width] duration-300 lg:flex ${
          collapsed ? "w-[76px]" : "w-[252px]"
        }`}
      >
        <SidebarBody collapsed={collapsed} pendingCount={pendingCount} onLogout={onLogout} />
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="mx-3 mb-3 flex items-center justify-center gap-2 rounded-xl border border-white/[0.07] px-3 py-2 text-[12.5px] font-bold text-[#a1a1aa] transition-colors hover:text-white"
          aria-label={collapsed ? t("nav.expand") : t("nav.collapse")}
          title={collapsed ? t("nav.expand") : t("nav.collapse")}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          {!collapsed && t("nav.collapse")}
        </button>
      </aside>

      {/* شريط الهاتف */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/[0.06] bg-[#0b0b0d]/85 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Logo />
        <div className="flex min-w-0 items-center gap-2">
          {current && <span className="truncate text-[13.5px] font-bold text-[#c9c9cf]">{t(`nav.${current.key}`)}</span>}
          <button
            type="button"
            onClick={() => setDrawer(true)}
            className="relative grid h-10 w-10 place-items-center rounded-xl border border-white/[0.08] text-white"
            aria-label={t("nav.open")}
            aria-expanded={drawer}
          >
            <Menu size={18} />
            {pendingCount > 0 && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-[#fbbf24] ring-2 ring-[#0b0b0d]" />}
          </button>
        </div>
      </header>

      {/* الدرج (الهاتف) */}
      <AnimatePresence>
        {drawer && (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawer(false)}
            />
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label={t("nav.menu")}
              className="fixed inset-y-0 left-0 z-50 flex w-[284px] max-w-[86vw] flex-col border-r border-white/[0.07] bg-[#0b0b0d] lg:hidden"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
            >
              <button
                type="button"
                onClick={() => setDrawer(false)}
                className="absolute left-3 top-4 z-10 grid h-9 w-9 place-items-center rounded-xl border border-white/[0.08] text-[#a1a1aa]"
                aria-label={t("nav.close")}
              >
                <X size={16} />
              </button>
              <SidebarBody collapsed={false} pendingCount={pendingCount} onLogout={onLogout} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <main className={`transition-[padding] duration-300 ${collapsed ? "lg:pl-[76px]" : "lg:pl-[252px]"}`}>
        <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6 lg:py-8">{children}</div>
      </main>
    </div>
  );
}

function SidebarBody({ collapsed, pendingCount, onLogout }) {
  const t = useAdminT();
  return (
    <>
      <div className={`flex h-[68px] shrink-0 items-center border-b border-white/[0.06] ${collapsed ? "justify-center px-2" : "px-5"}`}>
        {collapsed ? (
          <img src="/logo-icon.png" onError={(e) => ((e.currentTarget.onerror = null), (e.currentTarget.src = "/favicon.png"))} alt="CODpromo" className="h-8 w-8 object-contain" />
        ) : (
          <Logo />
        )}
      </div>

      <nav className="no-scrollbar flex-1 overflow-y-auto px-3 py-4" aria-label={t("nav.menu")}>
        {NAV.map((g, gi) => (
          <div key={g.group} className={gi > 0 ? "mt-5" : ""}>
            {collapsed ? (
              gi > 0 && <div className="mx-3 mb-3 h-px bg-white/[0.06]" />
            ) : (
              <p className="mb-1.5 px-3 text-[11.5px] font-bold text-[#6b7280]">{t(`nav.group.${g.group}`)}</p>
            )}
            <ul className="space-y-0.5">
              {g.items.map((it) => (
                <li key={it.key}>
                  <NavLink
                    to={it.path}
                    end={it.end}
                    title={collapsed ? t(`nav.${it.key}`) : undefined}
                    className={({ isActive }) =>
                      `relative flex items-center gap-3 rounded-xl py-2.5 text-[14px] font-bold transition-colors ${collapsed ? "justify-center px-0" : "px-3"} ${
                        isActive ? "bg-[var(--color-lime)]/[0.12] text-[var(--color-lime)]" : "text-[#a1a1aa] hover:bg-white/[0.04] hover:text-white"
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && <span className="absolute inset-y-2 right-0 w-[3px] rounded-full bg-[var(--color-lime)]" aria-hidden />}
                        <it.icon size={18} className="shrink-0" />
                        {!collapsed && <span className="flex-1 truncate">{t(`nav.${it.key}`)}</span>}
                        {it.badge === "pending" && pendingCount > 0 && (
                          <span
                            className={`grid h-5 min-w-5 place-items-center rounded-full bg-[#fbbf24] px-1.5 text-[11px] font-black text-[#0a0a0a] ${collapsed ? "absolute -top-0.5 right-2" : ""}`}
                            aria-label={t("nav.pending", { count: pendingCount })}
                          >
                            {pendingCount}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className={`shrink-0 space-y-1 border-t border-white/[0.06] p-3 ${collapsed ? "" : ""}`}>
        <Link
          to="/"
          title={collapsed ? t("nav.site") : undefined}
          className={`flex items-center gap-3 rounded-xl py-2.5 text-[13.5px] font-bold text-[#a1a1aa] transition-colors hover:bg-white/[0.04] hover:text-white ${collapsed ? "justify-center" : "px-3"}`}
        >
          <ArrowLeft size={17} /> {!collapsed && t("nav.site")}
        </Link>
        <button
          type="button"
          onClick={onLogout}
          title={collapsed ? t("nav.logout") : undefined}
          className={`flex w-full items-center gap-3 rounded-xl py-2.5 text-[13.5px] font-bold text-[#a1a1aa] transition-colors hover:bg-red-500/10 hover:text-red-400 ${collapsed ? "justify-center" : "px-3"}`}
        >
          <LogOut size={17} /> {!collapsed && t("nav.logout")}
        </button>
      </div>
    </>
  );
}
