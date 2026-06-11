import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  Loader2,
  Copy,
  Check,
  Trash2,
  Crown,
  Mail,
  User,
  CalendarDays,
  Store,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import DashboardShell, { WelcomeCard, SectionTitle } from "../../components/dashboard/DashboardShell.jsx";
import CompanyLogo from "../../components/CompanyLogo.jsx";
import PremiumModal from "../../components/PremiumModal.jsx";
import { getTypeMeta, getTypeKey } from "../../lib/types.js";
import { useAuth } from "../../lib/auth.jsx";
import { fetchFavoritesWithCompany, removeFavorite } from "../../lib/favorites.js";

export default function CustomerDashboard() {
  const { user, profile } = useAuth();
  const { t, i18n } = useTranslation();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [premiumModal, setPremiumModal] = useState(false);

  const name = profile?.full_name || user?.user_metadata?.full_name || t("dashboard.customer.friend");
  const joined = new Date(profile?.created_at || user?.created_at || Date.now()).toLocaleDateString(i18n.language);

  useEffect(() => {
    let active = true;
    fetchFavoritesWithCompany(user.id)
      .then((rows) => active && setFavorites(rows))
      .catch(() => active && setFavorites([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [user.id]);

  const remove = async (companyId) => {
    setFavorites((prev) => prev.filter((f) => f.company_id !== companyId));
    try {
      await removeFavorite(user.id, companyId);
    } catch {
      /* تجاهل */
    }
  };

  return (
    <DashboardShell badge={t("dashboard.customer.badge")}>
      <WelcomeCard title={t("dashboard.customer.welcome", { name })} subtitle={t("dashboard.customer.subtitle")}>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <InfoPill icon={Mail} label={t("dashboard.customer.email")} value={user?.email} />
          <InfoPill icon={User} label={t("dashboard.customer.accountType")} value={t("dashboard.customer.accountTypeVal")} />
          <InfoPill icon={CalendarDays} label={t("dashboard.customer.memberSince")} value={joined} />
        </div>
      </WelcomeCard>

      {/* ترقية Premium */}
      <div className="mt-5 flex flex-col items-start justify-between gap-4 overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-lime)]/30 bg-[var(--color-lime)]/[0.06] p-6 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--color-lime)]/15 text-[var(--color-lime)]">
            <Crown size={24} />
          </span>
          <div>
            <h3 className="text-[17px] font-extrabold text-[var(--text)]">{t("dashboard.customer.upgradeTitle")}</h3>
            <p className="text-[13px] text-[var(--text-soft)]">{t("dashboard.customer.upgradeDesc")}</p>
          </div>
        </div>
        <button
          onClick={() => setPremiumModal(true)}
          className="rounded-xl px-5 py-2.5 text-[14px] font-extrabold text-[#0a0a0a] transition-transform hover:scale-[1.02]"
          style={{ background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" }}
        >
          {t("dashboard.customer.upgradeBtn")}
        </button>
      </div>

      {/* المفضّلة */}
      <SectionTitle
        icon={Heart}
        action={<span className="text-[13px] font-bold text-[var(--color-mute)]">{t("dashboard.customer.items", { count: favorites.length })}</span>}
      >
        {t("dashboard.customer.favorites")}
      </SectionTitle>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-14 text-[var(--color-mute)]">
          <Loader2 size={18} className="animate-spin" /> {t("dashboard.loading")}
        </div>
      ) : favorites.length === 0 ? (
        <EmptyFavorites />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <AnimatePresence>
            {favorites.map((f) => (
              <FavoriteItem key={f.company_id} company={f.companies} onRemove={() => remove(f.company_id)} />
            ))}
          </AnimatePresence>
        </div>
      )}

      <PremiumModal open={premiumModal} onClose={() => setPremiumModal(false)} />
    </DashboardShell>
  );
}

function InfoPill({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-ink-line)] bg-[var(--fill)] px-4 py-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--color-lime)]/12 text-[var(--color-lime)]">
        <Icon size={17} />
      </span>
      <div className="min-w-0">
        <div className="text-[11.5px] font-medium text-[var(--color-mute)]">{label}</div>
        <div className="truncate text-[13.5px] font-bold text-[var(--text)]" dir="auto">
          {value || "—"}
        </div>
      </div>
    </div>
  );
}

function FavoriteItem({ company, onRemove }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const discount = (lang !== "ar" && company[`discount_${lang}`]) || company.discount;
  const meta = getTypeMeta(company.type);
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(company.code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="flex items-center gap-3 rounded-2xl border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] p-3.5"
    >
      <CompanyLogo logo={company.logo} name={company.name} size={48} accent={meta.color} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[14.5px] font-bold text-[var(--text)]">{company.name}</span>
          <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[10.5px] font-bold" style={{ background: `${meta.color}1a`, color: meta.color }}>
            {t(`types.${getTypeKey(company.type)}`)}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[12.5px]">
          <span className="font-black" style={{ color: meta.color }}>{discount}</span>
          <span className="font-mono font-bold text-[var(--text-softer)]">{company.code}</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          onClick={copy}
          className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--color-ink-line)] text-[var(--text-softer)] transition-colors hover:text-[var(--accent-text)]"
          title={t("dashboard.customer.copy")}
        >
          {copied ? <Check size={15} className="text-[var(--color-lime)]" /> : <Copy size={15} />}
        </button>
        <button
          onClick={onRemove}
          className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--color-ink-line)] text-[var(--text-softer)] transition-colors hover:border-red-500/40 hover:text-red-400"
          title={t("dashboard.customer.remove")}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </motion.div>
  );
}

function EmptyFavorites() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center rounded-[var(--radius-card)] border border-[var(--color-ink-line)] bg-[var(--color-ink-card)] px-6 py-14 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[var(--fill)] text-[var(--color-mute)]">
        <Store size={28} />
      </div>
      <h3 className="mt-5 text-[17px] font-extrabold text-[var(--text)]">{t("dashboard.customer.emptyTitle")}</h3>
      <p className="mt-1.5 text-[14px] text-[var(--text-soft)]">
        {t("dashboard.customer.emptyDesc")}
      </p>
      <a
        href="/#stores"
        className="mt-6 rounded-xl px-5 py-2.5 text-[14px] font-extrabold text-[#0a0a0a]"
        style={{ background: "linear-gradient(135deg, var(--color-lime-soft), var(--color-lime-deep))" }}
      >
        {t("dashboard.customer.browse")}
      </a>
    </div>
  );
}
