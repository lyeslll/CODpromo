-- ============================================================
--  CODpromo — Phase 31b: code_copies.source يقبل 'free_key' (النسخ من كشف المفتاح الذهبي)
--  شغّله مرة واحدة بعد phase31: npx supabase db query --linked -f supabase-phase31b-free-key-copies.sql
--  آمن لإعادة التشغيل (idempotent).
--
--  ⚠️ فيه DROP CONSTRAINT: الـ CHECK في Postgres ما يتوسّعش بلا ما ينحّى ويتعاود.
--     ما يمسح حتى سطر: القيد الجديد = نفس القيم القديمة + 'free_key'، والكل في معاملة وحدة
--     (إذا فشل الثاني يرجع الأول كيما كان). السطور الموجودة تتفحص من جديد وكلها تفوت.
-- ============================================================

begin;

alter table public.code_copies drop constraint if exists code_copies_source_chk;
alter table public.code_copies add constraint code_copies_source_chk
  check (source is null or source in ('featured', 'offers', 'home', 'store', 'category', 'favorites', 'dashboard', 'other', 'free_key'));

commit;

notify pgrst, 'reload schema';
