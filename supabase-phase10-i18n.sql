-- ============================================================
--  CODpromo — Phase 10: ترجمة محتوى الشركات (i18n للحقول الديناميكية)
--  شغّله مرة واحدة في Supabase SQL Editor (آمن لإعادة التشغيل).
--
--  العمود العربي الأصلي (description / category) يبقى كما هو:
--  هو المصدر للترجمة و fallback عند غياب الترجمة.
--  الترجمة تُولّد تلقائياً عبر Edge Function "translate-company" وقت الحفظ.
-- ============================================================

alter table public.companies
  add column if not exists description_en text,
  add column if not exists description_fr text,
  add column if not exists category_en   text,
  add column if not exists category_fr   text;

-- ملاحظة: لا حاجة لتعديل سياسات RLS — الأعمدة الجديدة تتبع سياسات الجدول نفسها
-- (قراءة عامة + كتابة من اللوحة) المعرّفة في supabase-setup.sql.
