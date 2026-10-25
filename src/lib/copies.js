import { supabase } from "./supabaseClient.js";
import { COMPANY_PUBLIC_COLUMNS } from "./supabase.js";

// ============================================================
//  الأكواد المنسوخة — جدول code_copies (phase22)
//  كل نسخة من مستخدم مسجّل تُسجَّل (الشركة + هل هو كود Premium). نصّ الكود لا يُخزَّن.
//  RLS: كل مستخدم يقرأ ويُدرج سطوره فقط.
// ============================================================

export const COPY_EVENT = "codpromo:code-copied";

/** مصدر النسخ من المسار الحالي (featured يُمرَّر صراحةً من القسم المميّز). */
export function copySourceFromPath(pathname = typeof window !== "undefined" ? window.location.pathname : "/") {
  const p = pathname.replace(/^\/(en|fr)(?=\/|$)/, "") || "/";
  if (p === "/") return "home";
  if (p.startsWith("/offers")) return "offers";
  if (p.startsWith("/store/")) return "store";
  if (p.startsWith("/category/")) return "category";
  if (p.startsWith("/favorites")) return "favorites";
  if (p.startsWith("/dashboard")) return "dashboard";
  return "other";
}

/** يسجّل نسخة كود للمستخدم المسجّل (الزائر لا شيء). يفشل بصمت — لا يكسر النسخ. */
export async function logCodeCopy(companyId, premium = false, source) {
  try {
    const { data } = await supabase.auth.getSession();
    const uid = data?.session?.user?.id;
    if (!uid || !companyId) return;
    const { error } = await supabase
      .from("code_copies")
      .insert({ user_id: uid, company_id: companyId, premium: !!premium, source: source || copySourceFromPath() });
    // الداشبورد يستمع لهذا الحدث ليحدّث "آخر الأكواد اللي نسختها" فوراً
    if (!error) window.dispatchEvent(new Event(COPY_EVENT));
  } catch {
    /* تجاهل */
  }
}

/** آخر الأكواد المنسوخة (بلا تكرار لنفس الكود)، مع بيانات الشركة. */
export async function fetchRecentCopies(userId, limit = 10) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from("code_copies")
    .select(`id, company_id, premium, created_at, companies(${COMPANY_PUBLIC_COLUMNS})`)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit * 5);
  if (error) throw new Error(error.message);
  const seen = new Set();
  const out = [];
  for (const r of data || []) {
    const key = `${r.company_id}:${r.premium}`;
    // "العرض قريباً" (رجعت قريباً من بعد ما تنسخت): الكود ماشي متاح دروك
    if (!r.companies || r.companies.coming_soon === true || seen.has(key)) continue;
    seen.add(key);
    out.push(r);
    if (out.length === limit) break;
  }
  return out;
}

/** عدد الأكواد المختلفة التي نسخها المستخدم (نفس الكود مرّتين = كود واحد). */
export async function countCopiedCodes(userId) {
  if (!userId) return 0;
  const { data, error } = await supabase.from("code_copies").select("company_id, premium").eq("user_id", userId).limit(5000);
  if (error) throw new Error(error.message);
  return new Set((data || []).map((r) => `${r.company_id}:${r.premium}`)).size;
}
