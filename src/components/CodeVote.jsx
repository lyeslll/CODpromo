import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, animate } from "framer-motion";
import { ThumbsUp, ThumbsDown, CheckCircle2, Flame } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useVoteStats } from "../lib/voteStats.jsx";
import { castVote, getMyVote, setMyVote, relativeTime } from "../lib/votes.js";

// الحد الأدنى للأصوات لإظهار شارة النسبة + شارة "الأكثر نجاحاً"
const MIN_VOTES = 3;
// النسبة التي تُعتبر "نجاحاً عالياً" (شارة خضراء)
const HIGH_RATE = 70;

/**
 * قسم التصويت على الكود داخل البطاقة: "هل نجح هذا الكود معك؟" + 👍/👎،
 * شارة نسبة نجاح، آخر نجاح، وشارة "الأكثر نجاحاً". يعمل للزائر والمسجّل،
 * وللأكواد العادية و Premium (يأخذ لون البطاقة accent).
 */
export default function CodeVote({ companyId, accent, glow }) {
  const { t, i18n } = useTranslation();
  const { stats, topId, setCompanyCounts } = useVoteStats();
  const row = stats[companyId];

  const up = Number(row?.up_count) || 0;
  const down = Number(row?.down_count) || 0;
  const total = up + down;
  const rate = total ? Math.round((100 * up) / total) : 0;

  const [myVote, setMyVoteState] = useState(() => getMyVote(companyId));
  const [busy, setBusy] = useState(false);
  const [justVoted, setJustVoted] = useState(false);

  const isTop = topId != null && Number(topId) === Number(companyId) && total >= MIN_VOTES;
  const lastWin = relativeTime(row?.last_up_at, i18n.language);

  const vote = async (type) => {
    if (busy || myVote === type) return; // نفس الصوت → لا شيء
    const prev = myVote;

    // تحديث تفاؤلي للعدّادات
    let nUp = up;
    let nDown = down;
    if (prev === "up") nUp -= 1;
    if (prev === "down") nDown -= 1;
    if (type === "up") nUp += 1;
    else nDown += 1;
    nUp = Math.max(0, nUp);
    nDown = Math.max(0, nDown);

    setMyVoteState(type);
    setMyVote(companyId, type);
    setCompanyCounts(companyId, nUp, nDown);
    setJustVoted(true);
    setBusy(true);

    try {
      const r = await castVote(companyId, type);
      setCompanyCounts(companyId, r.up_count, r.down_count); // قيمة الخادم الموثوقة
    } catch {
      // تراجع عند الفشل
      setMyVoteState(prev);
      setMyVote(companyId, prev);
      setCompanyCounts(companyId, up, down);
    } finally {
      setBusy(false);
      setTimeout(() => setJustVoted(false), 1800);
    }
  };

  return (
    <div className="relative mt-4 border-t border-[var(--color-ink-line)] pt-3.5">
      {/* السؤال + شارة الأكثر نجاحاً */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-bold text-[var(--color-mute)]">
          {t("vote.question")}
        </span>
        {isTop && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-black text-orange-400">
            <Flame size={10} /> {t("vote.mostSuccessful")}
          </span>
        )}
      </div>

      {/* زرّا التصويت */}
      <div className="mt-2.5 flex items-stretch gap-2">
        <VoteButton
          active={myVote === "up"}
          disabled={busy}
          onClick={() => vote("up")}
          icon={ThumbsUp}
          label={t("vote.yes")}
          count={up}
          color={accent}
          glow={glow}
          positive
        />
        <VoteButton
          active={myVote === "down"}
          disabled={busy}
          onClick={() => vote("down")}
          icon={ThumbsDown}
          label={t("vote.no")}
          count={down}
        />
      </div>

      {/* شارة النسبة + آخر نجاح — ترندر شرطي: لا تحجز أي مساحة وهي فاضية
          (تظهر فقط بعد التصويت مباشرة، أو عند بلوغ حد أدنى من الأصوات). */}
      {(justVoted || total >= MIN_VOTES) && (
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <AnimatePresence mode="wait" initial={false}>
            {justVoted ? (
              <motion.span
                key="thanks"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="flex items-center gap-1 text-[11.5px] font-bold"
                style={{ color: accent }}
              >
                <CheckCircle2 size={13} /> {t("vote.thanks")}
              </motion.span>
            ) : rate >= HIGH_RATE ? (
              <motion.span
                key="high"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-1 rounded-full bg-[var(--color-lime)]/15 px-2 py-0.5 text-[11px] font-extrabold text-[var(--accent-text)]"
              >
                <CheckCircle2 size={12} /> {t("vote.successBadge", { rate, count: total })}
              </motion.span>
            ) : (
              <motion.span
                key="low"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-[11px] font-bold text-[var(--color-mute)]"
              >
                {t("vote.rateBadge", { rate, count: total })}
              </motion.span>
            )}
          </AnimatePresence>

          {!justVoted && lastWin && total >= MIN_VOTES && (
            <span className="text-[11px] font-medium text-[var(--color-mute)]">
              {t("vote.lastWin", { time: lastWin })}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* زر تصويت واحد مع عدّاد متحرّك (count-up) */
function VoteButton({ active, disabled, onClick, icon: Icon, label, count, color, glow, positive }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.95 }}
      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2 text-[12.5px] font-extrabold transition-colors disabled:opacity-70"
      style={
        active && positive
          ? { borderColor: `${color}88`, background: `${color}1a`, color: "var(--accent-text)", boxShadow: `0 6px 18px -12px ${glow}` }
          : active
          ? { borderColor: "rgba(248,113,113,0.55)", background: "rgba(248,113,113,0.12)", color: "#f87171" }
          : { borderColor: "var(--color-ink-line)", background: "var(--fill)", color: "var(--text-soft)" }
      }
    >
      <Icon size={14} />
      <span>{label}</span>
      <AnimatedCount value={count} />
    </motion.button>
  );
}

/* عدّاد رقمي متحرّك (count-up) عبر framer-motion */
function AnimatedCount({ value }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    const from = prev.current ?? value;
    const controls = animate(from, value, {
      duration: 0.5,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    prev.current = value;
    return () => controls.stop();
  }, [value]);

  return (
    <span className="min-w-[14px] text-center tabular-nums">{display}</span>
  );
}
