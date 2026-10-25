import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Key, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../lib/auth.jsx";
import { useKeys } from "../../lib/keysContext.jsx";
import { useFreeKey } from "../../lib/freeKeyContext.jsx";
import { premiumPath } from "../../lib/seo.js";
import { DiamondGlyph } from "../keys/DiamondKey.jsx";
import { DIA_BG, DIA_DEEP, DIA_INK, DIA_SOFT } from "../keys/diamond.js";

const GOLD = "#f0c63c";
const GOLD_SOFT = "#ffe486";
const GOLD_BG = "linear-gradient(135deg, #ffe486, #f0c63c 55%, #cf9a1e)";

/**
 * بطاقة "مفاتيحك" في أول قائمة الهاتف (بلاصة عدّاد المفاتيح اللي كان في هيدر الهاتف):
 *  - حساب يشوف المفاتيح (keys.status = ok — ماشي Premium / Stork / الأدمين، كيما الباقات): شحال من مفتاح ماسي،
 *    حالة المفتاح الذهبي، والضغط يحلّ لوحة الرصيد والتاريخ (KeysPanel) + رابط "باقات المفاتيح" (/premium#keys).
 *  - زائر والمفتاح الذهبي مشعول: دعوة "أنشئ حسابك وخذ مفتاحاً ذهبياً مجاناً".
 * بلا ذكر للموقع ولا للخصم من سعر Premium ولا لطرق الدفع (نفس النص داخل تطبيق Android). المنطق تاع المفاتيح ما تبدّلش:
 * البطاقة تقرا useKeys / useFreeKey برك.
 */
export default function KeysMenuCard({ variants, onClose }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { user } = useAuth();
  const keys = useKeys();
  const fk = useFreeKey();

  if (keys.status === "ok") {
    const golden = fk.status === "available" ? "on" : fk.status === "used" ? "used" : null;
    return (
      <motion.div
        variants={variants}
        data-keys-card="keys"
        className="mb-3 rounded-2xl border p-2"
        style={{ borderColor: `${DIA_DEEP}66`, background: "linear-gradient(160deg, rgba(169,205,255,0.11), rgba(169,205,255,0.02) 70%)" }}
      >
        <button
          type="button"
          onClick={() => {
            onClose();
            keys.openPanel();
          }}
          aria-haspopup="dialog"
          title={t("header.keysCard.details")}
          className="flex min-h-[52px] w-full items-center gap-3 rounded-xl px-1.5 py-1 text-start transition-colors hover:bg-white/[0.04] active:bg-white/[0.06]"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: DIA_BG }}>
            <DiamondGlyph size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14.5px] font-extrabold text-[var(--text)]">{t("keys.panel.title")}</span>
            {/* سطر للماسي وسطر للذهبي (بلا فاصل يبقى وحدو في آخر السطر كي يتقسم) */}
            <span className="mt-0.5 flex items-center gap-1 text-[12.5px] font-bold tabular-nums" style={{ color: DIA_SOFT }}>
              <DiamondGlyph size={12} />
              {t("keys.count", { count: keys.balance })}
            </span>
            {golden && (
              <span className="mt-0.5 flex items-center gap-1 text-[12.5px] font-bold" style={{ color: golden === "on" ? GOLD : "var(--color-mute)" }}>
                <Key size={12} aria-hidden />
                {t("header.keysCard.golden", { state: golden === "on" ? t("keys.counter.goldenOn") : t("keys.counter.goldenUsed") })}
              </span>
            )}
          </span>
          <ArrowLeft size={16} aria-hidden className="shrink-0 text-[var(--color-mute)] ltr:rotate-180" />
        </button>
        <Link
          to={`${premiumPath(lang)}#keys`}
          onClick={onClose}
          className="mt-1.5 flex min-h-[44px] items-center justify-center gap-2 rounded-xl text-[13.5px] font-extrabold"
          style={{ background: DIA_BG, color: DIA_INK }}
        >
          <DiamondGlyph size={16} /> {t("header.keysCard.packs")}
        </Link>
      </motion.div>
    );
  }

  if (!user && fk.status === "guest") {
    return (
      <motion.div
        variants={variants}
        data-keys-card="invite"
        className="mb-3 rounded-2xl border p-3"
        style={{ borderColor: `${GOLD}4d`, background: "linear-gradient(160deg, rgba(240,198,60,0.10), rgba(240,198,60,0.02) 70%)" }}
      >
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[#1d1403]" style={{ background: GOLD_BG }}>
            <Key size={18} aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-[14.5px] font-extrabold leading-snug text-[var(--text)]">{t("header.keysCard.inviteTitle")}</span>
            <span className="mt-0.5 block text-[12.5px] leading-snug text-[var(--text-soft)]">{t("header.keysCard.inviteSub")}</span>
          </span>
        </div>
        <Link
          to="/signup"
          onClick={onClose}
          className="mt-2.5 flex min-h-[44px] items-center justify-center gap-2 rounded-xl border text-[13.5px] font-extrabold transition-colors hover:bg-[#f0c63c]/10"
          style={{ borderColor: `${GOLD}8c`, color: GOLD_SOFT }}
        >
          <UserPlus size={16} aria-hidden /> {t("header.keysCard.inviteCta")}
        </Link>
      </motion.div>
    );
  }

  return null;
}
