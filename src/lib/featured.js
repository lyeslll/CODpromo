import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient.js";

// ============================================================
//  العروض المميّزة — جدول featured_offers (phase27)
//  القراءة العامة عبر RLS: العروض النشطة السارية فقط. الأدمن يرى كل السطور
//  (حتى الموقوفة)، لذا نفلتر هنا أيضاً حتى لا يرى الأدمن في الموقع ما ليس منشوراً.
//  الكتابة للأدمن فقط (is_admin() في القاعدة).
// ============================================================

/** هل السطر منشور الآن؟ (نفس شرط سياسة القراءة العامة) */
export function isLive(row, now = Date.now()) {
  if (!row?.is_active) return false;
  if (row.starts_at && new Date(row.starts_at).getTime() > now) return false;
  if (row.ends_at && new Date(row.ends_at).getTime() <= now) return false;
  return true;
}

let rowsPromise = null;

/** السطور المنشورة مرتّبة (طلب واحد مشترك في الجلسة). */
export function loadFeaturedRows() {
  if (!rowsPromise) {
    rowsPromise = supabase
      .from("featured_offers")
      .select("company_id,position,label,starts_at,ends_at,is_active")
      .order("position", { ascending: true })
      .then(({ data, error }) => (error ? [] : (data || []).filter((r) => isLive(r))))
      .catch(() => []);
  }
  return rowsPromise;
}

/** السطور المنشورة (null أثناء التحميل). */
export function useFeaturedRows() {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    let active = true;
    loadFeaturedRows().then((r) => active && setRows(r));
    return () => {
      active = false;
    };
  }, []);
  return rows;
}

/** يربط السطور بالشركات المحمّلة: [{ company, label }] بترتيب position. */
export function joinFeatured(rows, companies) {
  if (!rows?.length || !companies?.length) return [];
  const byId = new Map(companies.map((c) => [c.id, c]));
  const out = [];
  for (const r of rows) {
    const company = byId.get(r.company_id);
    if (company) out.push({ company, label: r.label === "sponsored" ? "sponsored" : "featured" });
  }
  return out;
}

// ===================== ترتيب "الأكثر استخداماً" =====================

let rankPromise = null;

/** Map(company_id → rank) من code_copies الحقيقية (RPC offers_usage_rank: عدد المستخدمين المختلفين، count دقيق). */
export function loadUsageRank() {
  if (!rankPromise) {
    rankPromise = supabase
      .rpc("offers_usage_rank")
      .then(({ data, error }) => {
        if (error) throw error;
        return new Map((data || []).map((r) => [Number(r.company_id), Number(r.rank)]));
      })
      .catch(() => {
        rankPromise = null;
        return new Map();
      });
  }
  return rankPromise;
}

// ===================== الأدمن =====================

/** كل السطور (الأدمن فقط عبر RLS)، مرتّبة. */
export async function fetchAllFeatured() {
  const { data, error } = await supabase.from("featured_offers").select("*").order("position", { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

/** نسخ الأكواد من القسم المميّز لكل عرض: Map(company_id → { d7, d30 }). */
export async function fetchFeaturedStats() {
  const { data, error } = await supabase.rpc("admin_featured_stats");
  if (error) throw new Error(error.message);
  return new Map((data || []).map((r) => [Number(r.company_id), { d7: Number(r.copies_7d), d30: Number(r.copies_30d) }]));
}

/**
 * يحفظ القائمة كما رتّبها الأدمن: يحذف ما أُزيل، يحدّث الموجود، ويضيف الجديد.
 * rows: [{ id?, company_id, label, starts_at, ends_at, is_active }] بالترتيب المطلوب.
 */
export async function saveFeatured(rows, removedIds) {
  if (removedIds.length) {
    const { error } = await supabase.from("featured_offers").delete().in("id", removedIds);
    if (error) throw new Error(error.message);
  }
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const body = {
      company_id: r.company_id,
      position: i + 1,
      label: r.label === "sponsored" ? "sponsored" : "featured",
      starts_at: r.starts_at || new Date().toISOString(),
      ends_at: r.ends_at || null,
      is_active: !!r.is_active,
    };
    const q = r.id ? supabase.from("featured_offers").update(body).eq("id", r.id) : supabase.from("featured_offers").insert(body);
    const { error } = await q;
    if (error) throw new Error(error.message);
  }
  rowsPromise = null;
}
