import { motion, useReducedMotion } from "framer-motion";
import { Building2, Users } from "lucide-react";
import { useTranslation } from "react-i18next";

const LIME = "#a6f000";

/**
 * كوبون "يُصدَر" مرّة واحدة عند فتح الصفحة: خانات فارغة مثقّبة، ثم يتعمّر
 * (اسم شركتك ← قيمة الخصم ← الكود)، وفي الكعب حجم الجمهور الحقيقي.
 * هي الحركة الوحيدة غير التفاعلية في الصفحة.
 */
export default function IssuingCoupon({ audience }) {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const step = (i) => (reduced ? { initial: false } : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.5 + i * 0.45, duration: 0.45, ease: [0.2, 0.8, 0.2, 1] } });

  return (
    <motion.div
      className="ticket relative w-full max-w-[400px]"
      style={{ "--edge-base": `${LIME}66`, "--edge-strong": `${LIME}aa`, "--perf": `${LIME}99`, filter: `drop-shadow(0 30px 60px ${LIME}26)` }}
      initial={reduced ? false : { opacity: 0, rotate: -4, y: 18 }}
      animate={{ opacity: 1, rotate: -2, y: 0 }}
      transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
      aria-hidden="true"
    >
      <div className="ticket-top relative p-6" style={{ background: `linear-gradient(160deg, ${LIME}1f, transparent 60%), var(--color-ink-card)` }}>
        <div className="flex items-center gap-3">
          <span className="grid h-14 w-14 place-items-center rounded-2xl border border-dashed border-white/20 bg-white/[0.03] text-[var(--color-mute)]">
            <Building2 size={24} />
          </span>
          <motion.div {...step(0)} className="min-w-0">
            <div className="text-[19px] font-black text-[var(--text)]">{t("partners.coupon.company")}</div>
            <div className="text-[12.5px] text-[var(--color-mute)]">{t("partners.coupon.category")}</div>
          </motion.div>
        </div>
        <div className="mt-6 flex items-end justify-between gap-3">
          <div>
            <div className="text-[12px] font-bold text-[var(--color-mute)]">{t("partners.coupon.value")}</div>
            <motion.div {...step(1)} className="text-[44px] font-black leading-none tabular-nums" style={{ color: LIME }}>
              20%
            </motion.div>
          </div>
          <motion.span {...step(1)} className="rounded-full border px-2.5 py-1 text-[12px] font-extrabold" style={{ borderColor: `${LIME}55`, color: LIME }}>
            {t("partners.coupon.exclusive")}
          </motion.span>
        </div>
      </div>
      <div className="ticket-stub relative p-6" style={{ background: `${LIME}0d` }}>
        <span className="ticket-ring ticket-ring-l" />
        <span className="ticket-ring ticket-ring-r" />
        <span className="ticket-perf" />
        <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed px-4 py-3" style={{ borderColor: `${LIME}66` }}>
          <span className="text-[12px] font-bold text-[var(--color-mute)]">{t("partners.coupon.code")}</span>
          <motion.span {...step(2)} className="font-mono text-[20px] font-black tracking-[0.12em] text-[var(--text)]" dir="ltr">
            ILYES10
          </motion.span>
        </div>
        {audience && (
          <motion.div {...step(3)} className="mt-4 flex items-center gap-2 text-[13px] text-[var(--text-soft)]">
            <Users size={15} style={{ color: LIME }} />
            {t("partners.coupon.reach", { value: audience })}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
