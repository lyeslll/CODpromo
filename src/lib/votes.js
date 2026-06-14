import { supabase } from "./supabaseClient.js";

// ============================================================
//  التصويت على الأكواد — طبقة بيانات (جدول code_votes + RPC cast_vote)
//  القراءة عبر view code_vote_stats (إحصائيات مجمّعة عامة).
//  الكتابة عبر RPC cast_vote حصراً (ذرّية + تربط هوية المسجّل خادمياً).
// ============================================================

const VOTER_KEY = "codpromo:voter-id"; // معرّف الزائر الثابت (لغير المسجّلين)
const VOTES_KEY = "codpromo:votes"; // خريطة { [companyId]: 'up' | 'down' } لصوت الزائر الحالي

/** معرّف زائر ثابت في localStorage (لمنع تكرار التصويت لغير المسجّلين). */
export function getVoterId() {
  try {
    let id = localStorage.getItem(VOTER_KEY);
    if (!id) {
      id = crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(VOTER_KEY, id);
    }
    return id;
  } catch {
    return "anon"; // وضع خاص/التخزين محجوب
  }
}

/** خريطة أصوات الزائر المحفوظة محلياً (معالجة آمنة لأي تلف). */
function readVotes() {
  try {
    const v = JSON.parse(localStorage.getItem(VOTES_KEY) || "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

/** صوت الزائر الحالي على شركة ('up' | 'down' | null). */
export function getMyVote(companyId) {
  return readVotes()[companyId] || null;
}

/** يحفظ/يحذف صوت الزائر على شركة محلياً (vote = null للحذف). */
export function setMyVote(companyId, vote) {
  try {
    const m = readVotes();
    if (vote) m[companyId] = vote;
    else delete m[companyId];
    localStorage.setItem(VOTES_KEY, JSON.stringify(m));
  } catch {
    /* تجاهل — التخزين اختياري */
  }
}

/** يجلب إحصائيات التصويت لكل الشركات دفعة واحدة → خريطة company_id → صف. */
export async function fetchVoteStats() {
  const { data, error } = await supabase.from("code_vote_stats").select("*");
  if (error) return {};
  const map = {};
  for (const r of data || []) {
    map[r.company_id] = {
      up_count: Number(r.up_count) || 0,
      down_count: Number(r.down_count) || 0,
      total_count: Number(r.total_count) || 0,
      success_rate: Number(r.success_rate) || 0,
      last_up_at: r.last_up_at || null,
    };
  }
  return map;
}

/** يصوّت/يغيّر الصوت عبر RPC ذرّية، ويعيد العدّادات المحدّثة { up_count, down_count }. */
export async function castVote(companyId, voteType) {
  const { data, error } = await supabase.rpc("cast_vote", {
    p_company_id: companyId,
    p_vote_type: voteType,
    p_voter_id: getVoterId(),
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return {
    up_count: Number(row?.up_count) || 0,
    down_count: Number(row?.down_count) || 0,
  };
}

/**
 * معرّف الشركة الأعلى نسبة نجاح (بحد أدنى أصوات) — لشارة "🔥 الأكثر نجاحاً".
 * يفضّل النسبة الأعلى، وعند التعادل عدد الأصوات الأكبر.
 */
export function topSuccessId(statsMap, minVotes = 3) {
  let best = null;
  for (const id in statsMap) {
    const s = statsMap[id];
    if ((s.total_count || 0) < minVotes) continue;
    if (
      !best ||
      s.success_rate > best.rate ||
      (s.success_rate === best.rate && s.total_count > best.total)
    ) {
      best = { id: Number(id), rate: s.success_rate, total: s.total_count };
    }
  }
  return best?.id ?? null;
}

/** وقت نسبي مترجم ("قبل ساعتين"، "il y a 2 heures"، "2 hours ago"). */
export function relativeTime(dateStr, lang = "ar") {
  if (!dateStr) return null;
  const ms = new Date(dateStr).getTime();
  if (Number.isNaN(ms)) return null;
  const diff = (ms - Date.now()) / 1000; // سالب = في الماضي
  let rtf;
  try {
    rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
  } catch {
    rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  }
  const units = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  const abs = Math.abs(diff);
  for (const [unit, sec] of units) {
    if (abs >= sec) return rtf.format(Math.round(diff / sec), unit);
  }
  return rtf.format(Math.round(diff / 60) || 0, "minute");
}
