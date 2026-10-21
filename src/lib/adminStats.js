import { supabase } from "./supabaseClient.js";

// ============================================================
//  لوحة الأدمن v2 — دوال خادمية (phase23). كل دالة تتحقق من is_admin() في القاعدة.
//  الأرقام تُحسب في قاعدة البيانات (count دقيق)، لا في المتصفّح (PostgREST يقصّ عند 1000 سطر).
// ============================================================

/** أرقام "نظرة عامة" لفترة: today | 7d | 30d | all. */
export async function fetchAdminOverview(range = "7d") {
  const { data, error } = await supabase.rpc("admin_overview", { p_range: range });
  if (error) throw new Error(error.message);
  return data;
}

/**
 * صفحة من المستخدمين: { rows, total }.
 * filters: { search, plan, type, range, sort, desc, limit, offset }
 */
export async function listAdminUsers({ search = "", plan = "", type = "", range = "all", sort = "created_at", desc = true, limit = 25, offset = 0 } = {}) {
  const { data, error } = await supabase.rpc("admin_list_users", {
    p_search: search || null,
    p_plan: plan || null,
    p_type: type || null,
    p_range: range,
    p_sort: sort,
    p_desc: desc,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw new Error(error.message);
  const rows = data || [];
  return { rows, total: rows.length ? Number(rows[0].total_count) : offset > 0 ? null : 0 };
}

/** كل المستخدمين المطابقين للفلاتر (للتصدير CSV) — صفحات من 1000. */
export async function listAllAdminUsers(filters) {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const { rows } = await listAdminUsers({ ...filters, limit: 1000, offset });
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

/** آخر الأكواد التي نسخها مستخدم. */
export async function fetchUserCopies(userId, limit = 10) {
  const { data, error } = await supabase.rpc("admin_user_copies", { p_user: userId, p_limit: limit });
  if (error) throw new Error(error.message);
  return data || [];
}

// ===================== معلومات الشركة الداخلية (company_private) =====================

export const PRIVATE_FIELDS = ["website_url", "contact_name", "whatsapp", "email", "commission_pct", "affiliate_dashboard_url", "affiliate_url", "notes"];

/** المعلومات الداخلية لشركة (أو null). */
export async function fetchCompanyPrivate(companyId) {
  if (!companyId) return null;
  const { data, error } = await supabase.from("company_private").select("*").eq("company_id", companyId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** يحفظ المعلومات الداخلية (upsert). النصوص الفارغة → null، والنسبة رقم. */
export async function saveCompanyPrivate(companyId, values) {
  const row = { company_id: companyId };
  for (const k of PRIVATE_FIELDS) {
    let v = values?.[k];
    if (typeof v === "string") v = v.trim();
    if (k === "commission_pct") v = v === "" || v == null ? null : Number(v);
    row[k] = v === "" ? null : v ?? null;
  }
  const { error } = await supabase.from("company_private").upsert(row, { onConflict: "company_id" });
  if (error) throw new Error(error.message);
}
