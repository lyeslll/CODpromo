// ============================================================
//  CODpromo — "العرض قريباً" (phase coming-soon): البطاقات القريبة + "أعلمني عند التفعيل"
//  - البطاقة القريبة = companies.coming_soon (علني). Premium القريب = premium_coming_soon (غير مع coming_soon).
//    القاعدة في القاعدة (CHECK): بلا كود عادي ولا Premium ولا رابط Premium → has_premium_code = false
//    (المفاتيح والبيع والعدّادات ما يشوفوهاش).
//  - القوائم: fetchCompanies() = العروض اللي تخدم برك؛ القريبة وحدها (fetchComingSoon) وتجي بعدهم ديما.
//  - العدّاد (coming_soon_board): رقم برك (بريد حقيقي = شخص)، null تحت 3 → "كن من الأوائل".
//  - "أعلمني": coming_soon_wait (مسجّل برك، POST). الزائر → الدخول، ويرجع لنفس الصفحة بـ ?notify=<id>
//    (returnTo): البطاقة تجي قدامو والتنبيه يتسجّل وحدو — المخزن والـ hook في comingSoonStore.js (chunk البطاقة القريبة).
// ============================================================
import { SUPABASE_URL, SUPABASE_KEY, COMPANY_PUBLIC_COLUMNS } from "./supabase.js";
import { supabase } from "./supabaseClient.js";

const anon = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

export const isComingSoon = (c) => c?.coming_soon === true;

/** البطاقات القريبة الظاهرة (الأحدث أولاً) — نفس أعمدة القوائم. */
export async function fetchComingSoon() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/companies?select=${COMPANY_PUBLIC_COLUMNS}&coming_soon=eq.true&order=created_at.desc`, { headers: anon });
  if (!res.ok) throw new Error("coming_soon");
  return res.json();
}

/** { total, items: [{ id, waiting }] } — waiting = null تحت 3. */
export async function fetchComingSoonBoard() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/coming_soon_board`, { method: "POST", headers: { ...anon, "Content-Type": "application/json" }, body: "{}" });
  if (!res.ok) throw new Error("coming_soon_board");
  return res.json();
}

/** الأدمين: كل البطاقات القريبة (حتى المخفية) + عدد اللي يستناو + الأيام. */
export async function fetchAdminComingSoon() {
  const { data, error } = await supabase.rpc("admin_coming_soon");
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? data : [];
}
