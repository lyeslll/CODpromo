-- ============================================================
--  CODpromo — Phase 11: ترجمة قيمة العرض (discount / premium_discount)
--  شغّله مرة واحدة في Supabase SQL Editor (آمن لإعادة التشغيل).
--
--  قيمة العرض تحتوي أحياناً كلمات/وحدات عربية (مثل "5$ هدية"، "500 دج")
--  يجب أن تُترجَم وتُنسّق حسب اللغة ($5 gift / 500 DZD). العربي يبقى المصدر/fallback.
-- ============================================================

alter table public.companies
  add column if not exists discount_en         text,
  add column if not exists discount_fr         text,
  add column if not exists premium_discount_en text,
  add column if not exists premium_discount_fr text;

-- أعد تحميل مخزّن مخطّط PostgREST كي تظهر الأعمدة الجديدة فوراً لواجهة REST
-- (وإلا تفشل الكتابة بخطأ PGRST204).
notify pgrst, 'reload schema';
