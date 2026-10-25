-- ============================================================
--  الرجوع لـ supabase-phase-companies-anon-writes.sql: يرجّع لـ anon نفس الصلاحيات اللي كانت قبل
--  (INSERT / UPDATE / DELETE / TRUNCATE على companies — RLS يبقى يرفض الكتابة كيما قبل).
-- ============================================================
grant insert, update, delete, truncate on public.companies to anon;
