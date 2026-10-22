-- ============================================================
--  CODpromo — Phase 28: قفل أعمدة Premium فعلياً + has_premium_code
--  شغّله مرة واحدة: npx supabase db query --linked -f supabase-phase28-premium-lock.sql
--  آمن لإعادة التشغيل (idempotent). لا حذف ولا إعادة تسمية.
--
--  1) companies.has_premium_code (علني، محسوب آلياً): هل للشركة كود Premium؟
--     الواجهة تعرف منه إن كانت البطاقة "مجمّدة" في وضع Premium، دون قراءة الكود نفسه.
--  2) إصلاح أمني: phase17b سحب SELECT على العمودين premium_code / premium_url فقط،
--     لكن صلاحية SELECT على الجدول كاملاً بقيت لـ anon و authenticated، وهي تغلب
--     سحب العمود (في Postgres لا يُلغي سحبُ صلاحية العمود صلاحيةَ الجدول). النتيجة: كان
--     أي زائر يقرأ أكواد وروابط Premium مباشرة من الـ API. هنا نسحب SELECT على الجدول
--     ونمنحه عموداً عموداً لكل الأعمدة ما عدا premium_code و premium_url.
--     ⚠️ أي عمود جديد يُضاف لـ companies لاحقاً يحتاج grant select صريحاً (أو إعادة تشغيل هذا الملف).
--     الكشف يبقى حصراً عبر RPC get_premium_code (SECURITY DEFINER، تتحقق من has_premium_access).
-- ============================================================

-- ===================== 1) has_premium_code =====================
alter table public.companies
  add column if not exists has_premium_code boolean
  generated always as (coalesce(btrim(premium_code), '') <> '') stored;

-- ===================== 2) القفل الحقيقي =====================
do $$
declare
  cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into cols
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'companies'
     and column_name not in ('premium_code', 'premium_url');

  -- سحب SELECT على الجدول يسحب معه صلاحيات الأعمدة، ثم نمنح الأعمدة الآمنة فقط
  execute 'revoke select on public.companies from anon, authenticated';
  execute format('grant select (%s) on public.companies to anon, authenticated', cols);
end $$;

notify pgrst, 'reload schema';
