import { supabase } from "./supabaseClient.js";

// ============================================================
//  طلبات الشركات (company_requests) — يقدّمها حساب الشركة/المورّد
// ============================================================

const ALLOWED = ["company_name", "title", "type", "description", "code", "link", "logo"];

function clean(payload) {
  const out = {};
  for (const k of ALLOWED) {
    const v = typeof payload[k] === "string" ? payload[k].trim() : payload[k];
    if (v !== undefined && v !== "") out[k] = v;
  }
  return out;
}

/** يجلب طلبات الشركة الحالية مرتبة من الأحدث. */
export async function fetchMyRequests(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from("company_requests")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

/** ينشئ طلب عرض جديد بحالة pending. */
export async function createRequest(userId, payload) {
  const body = { user_id: userId, status: "pending", ...clean(payload) };
  const { data, error } = await supabase
    .from("company_requests")
    .insert(body)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}
