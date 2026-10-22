import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient.js";
import { translateCompanyFields } from "./supabase.js";
import { slugify } from "./slug.js";

// ============================================================
//  عروض بلا كود — جداول nocode_deals / nocode_deal_premium / deal_clicks (phase29)
//  القراءة العامة: العروض النشطة السارية فقط، **بلا روابط** (url مقفول بصلاحيات الأعمدة،
//  ورابط Premium في جدول للأدمن فقط). الرابط لا يصل للواجهة إلا عبر RPC nocode_go
//  في صفحة /go/<slug> (تسجّل الضغطة ثم تحوّل).
// ============================================================

// كل الأعمدة العلنية (بلا url)
export const NOCODE_PUBLIC_COLUMNS =
  "id,slug,name,logo_url,category_id,company_id," +
  "reward,reward_en,reward_fr,condition,condition_en,condition_fr," +
  "description,description_en,description_fr," +
  "premium_reward,premium_reward_en,premium_reward_fr," +
  "premium_condition,premium_condition_en,premium_condition_fr," +
  "has_premium,position,starts_at,ends_at,is_active,created_at";

// الحقول المترجَمة تلقائياً (العربية هي المصدر/الـ fallback)
const I18N_DEAL_FIELDS = ["reward", "condition", "description", "premium_reward", "premium_condition"];

/** هل العرض منشور الآن؟ (نفس شرط سياسة القراءة العامة — الأدمن يرى كل السطور) */
export function isDealLive(d, now = Date.now()) {
  if (!d?.is_active) return false;
  if (d.starts_at && new Date(d.starts_at).getTime() > now) return false;
  if (d.ends_at && new Date(d.ends_at).getTime() <= now) return false;
  return true;
}

/** نص الحقل بلغة الواجهة مع fallback للعربية. */
export const dealText = (deal, field, lang) => (lang !== "ar" && deal?.[`${field}_${lang}`]) || deal?.[field] || "";

/** رابط التحويل النظيف (لا يحمل رابط الشركة الحقيقي أبداً). */
export const goPath = (deal, premium = false) => `/go/${deal.slug}${premium ? "?premium=1" : ""}`;

let dealsPromise = null;

/** العروض المنشورة مرتّبة حسب position (طلب واحد مشترك في الجلسة). */
export function loadNocodeDeals() {
  if (!dealsPromise) {
    dealsPromise = supabase
      .from("nocode_deals")
      .select(NOCODE_PUBLIC_COLUMNS)
      .order("position", { ascending: true })
      .order("created_at", { ascending: false })
      .then(({ data, error }) => (error ? [] : (data || []).filter((d) => isDealLive(d))))
      .catch(() => []);
  }
  return dealsPromise;
}

/** العروض المنشورة (null أثناء التحميل). */
export function useNocodeDeals() {
  const [deals, setDeals] = useState(null);
  useEffect(() => {
    let active = true;
    loadNocodeDeals().then((d) => active && setDeals(d));
    return () => {
      active = false;
    };
  }, []);
  return deals;
}

/**
 * يسجّل الضغطة ويجلب رابط التحويل (RPC nocode_go — Premium يُتحقَّق منه خادمياً).
 * @returns {Promise<{status:"ok"|"not_found"|"no_premium"|"premium_required", url?:string, name?:string}>}
 */
export async function goToDeal(slug, premium = false) {
  const { data, error } = await supabase.rpc("nocode_go", { p_slug: slug, p_premium: !!premium });
  if (error) throw new Error(error.message);
  return data || { status: "not_found" };
}

/** يطابق البحث: الاسم والميزة والشرط والوصف (كل اللغات). */
export function dealMatches(deal, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  const hay = [deal.name, ...["reward", "condition", "description"].flatMap((f) => [deal[f], deal[`${f}_en`], deal[`${f}_fr`]])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

// ===================== الأدمن =====================

/** slug من الاسم (لاتيني فقط)، وإلا deal-<عشوائي>. */
export const suggestDealSlug = (name) => slugify(name) || `deal-${Math.random().toString(36).slice(2, 7)}`;

/** كل العروض (الأدمن فقط عبر RLS)، مرتّبة. */
export async function fetchAllDeals() {
  const { data, error } = await supabase
    .from("nocode_deals")
    .select(`${NOCODE_PUBLIC_COLUMNS},updated_at`)
    .order("position", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

/** الرابطان لفورم الأدمن (RPC admin_nocode_links — url لا يُقرأ من الجدول). */
export async function fetchDealLinks(id) {
  const { data, error } = await supabase.rpc("admin_nocode_links", { p_id: id });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return { url: row?.url || "", premium_url: row?.premium_url || "" };
}

/** الضغطات: Map(deal_id → { n7, n30, p7, p30 }) — زائر واحد = ضغطة واحدة في اليوم. */
export async function fetchDealStats() {
  const { data, error } = await supabase.rpc("admin_nocode_stats");
  if (error) throw new Error(error.message);
  return new Map(
    (data || []).map((r) => [
      Number(r.deal_id),
      { n7: Number(r.normal_7d), n30: Number(r.normal_30d), p7: Number(r.premium_7d), p30: Number(r.premium_30d) },
    ])
  );
}

const WRITABLE = [
  "slug", "name", "logo_url", "category_id", "company_id",
  "reward", "condition", "description", "url", "premium_reward", "premium_condition",
  "reward_en", "reward_fr", "condition_en", "condition_fr", "description_en", "description_fr",
  "premium_reward_en", "premium_reward_fr", "premium_condition_en", "premium_condition_fr",
  "position", "starts_at", "ends_at", "is_active",
];

function cleanDeal(input) {
  const out = {};
  for (const k of WRITABLE) {
    if (input[k] === undefined) continue;
    const v = typeof input[k] === "string" ? input[k].trim() : input[k];
    out[k] = v === "" ? null : v;
  }
  return out;
}

/** ترجمة تلقائية en/fr عبر translate-company (نفس دالة الشركات). الفشل لا يمنع الحفظ. */
async function withDealTranslations(body) {
  const src = {};
  for (const f of I18N_DEAL_FIELDS) if (typeof body[f] === "string" && body[f].trim()) src[f] = body[f].trim();
  const out = { ...body };
  for (const f of I18N_DEAL_FIELDS) {
    if (!src[f]) {
      out[`${f}_en`] = null;
      out[`${f}_fr`] = null;
    }
  }
  if (!Object.keys(src).length) return { body: out, translated: true };
  try {
    const { en = {}, fr = {} } = await translateCompanyFields(src);
    for (const f of Object.keys(src)) {
      out[`${f}_en`] = en[f] ?? null;
      out[`${f}_fr`] = fr[f] ?? null;
    }
    return { body: out, translated: true };
  } catch (e) {
    console.warn("translate-company failed, saving Arabic only:", e?.message);
    return { body: out, translated: false };
  }
}

/**
 * يحفظ عرضاً (جديد أو تعديل) + رابط Premium في جدوله الخاص.
 * input: حقول الفورم بالعربية + premium_url. يعيد { deal, translated }.
 */
export async function saveDeal(input, id = null) {
  const { premium_url, ...rest } = input;
  const { body, translated } = await withDealTranslations(cleanDeal(rest));
  const q = id
    ? supabase.from("nocode_deals").update(body).eq("id", id)
    : supabase.from("nocode_deals").insert(body);
  const { data, error } = await q.select(NOCODE_PUBLIC_COLUMNS).single();
  if (error) throw new Error(error.code === "23505" ? "slug_taken" : error.message);

  const link = String(premium_url || "").trim();
  const { error: pErr } = link
    ? await supabase.from("nocode_deal_premium").upsert({ deal_id: data.id, premium_url: link }, { onConflict: "deal_id" })
    : await supabase.from("nocode_deal_premium").delete().eq("deal_id", data.id);
  if (pErr) throw new Error(pErr.message);

  dealsPromise = null;
  return { deal: { ...data, has_premium: !!link }, translated };
}

export async function deleteDeal(id) {
  const { error } = await supabase.from("nocode_deals").delete().eq("id", id);
  if (error) throw new Error(error.message);
  dealsPromise = null;
}

/** يحفظ الترتيب كما رتّبه الأدمن (position = 1..n). */
export async function saveDealOrder(ids) {
  for (let i = 0; i < ids.length; i++) {
    const { error } = await supabase.from("nocode_deals").update({ position: i + 1 }).eq("id", ids[i]);
    if (error) throw new Error(error.message);
  }
  dealsPromise = null;
}

/** تشغيل/إيقاف سريع من القائمة. */
export async function setDealActive(id, isActive) {
  const { error } = await supabase.from("nocode_deals").update({ is_active: !!isActive }).eq("id", id);
  if (error) throw new Error(error.message);
  dealsPromise = null;
}
