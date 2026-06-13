-- ============================================================
--  CODpromo — Phase 17b: قفل Premium الخادمي
--  ⚠️ شغّله **بعد** نشر الواجهة الجديدة (التي تستعمل RPC) والتأكد من عملها،
--     ولا تشغّله قبل Phase 17a. آمن لإعادة التشغيل (idempotent).
--
--  يفعل ثلاثة أشياء:
--   1) يمنع قراءة premium_code/premium_url عن anon و authenticated (column-level).
--      الكشف يصبح حصراً عبر RPC get_premium_code (التي تتحقق من الاشتراك).
--   2) trigger يمنع تعديل is_premium/premium_until/subscription_status إلا من
--      دور مرتفع (service_role للـ webhooks، والدوال SECURITY DEFINER).
--   3) يقفل stork_codes: لا قراءة/كتابة عامة (الإدارة للأدمن، التفعيل عبر RPC).
-- ============================================================

-- ===================== 1) منع قراءة الأعمدة السرّية =====================
-- ملاحظة: الكتابة (INSERT/UPDATE) على هذه الأعمدة تبقى ممكنة للأدمن عبر سياسات
-- S2 (companies admin insert/update) — هذا المنع للقراءة فقط (SELECT). الواجهة
-- الجديدة لا تطلب هذين العمودين في أي select عام، وكتابات الأدمن تُرجع أعمدة آمنة.
revoke select (premium_code, premium_url) on public.companies from anon;
revoke select (premium_code, premium_url) on public.companies from authenticated;

-- ===================== 2) حماية حقول Premium في profiles =====================
-- يمنع أي مستخدم (authenticated/anon) من تعديل حقول الاشتراك مباشرةً على صفّه.
-- الأدوار المرتفعة تمرّ: service_role (الـ webhooks للدفع) و current_user للدوال
-- SECURITY DEFINER (مثل redeem_stork_code، تعمل بهوية مالكها لا بدور العميل).
create or replace function public.protect_premium_columns()
returns trigger
language plpgsql
as $$
begin
  if (
       new.is_premium          is distinct from old.is_premium
    or new.premium_until       is distinct from old.premium_until
    or new.subscription_status is distinct from old.subscription_status
  )
  and current_user in ('authenticated', 'anon') then
    raise exception
      'تعديل حقول Premium غير مسموح من العميل (is_premium/premium_until/subscription_status)';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_premium_columns_trg on public.profiles;
create trigger protect_premium_columns_trg
  before update on public.profiles
  for each row execute function public.protect_premium_columns();

-- ===================== 3) قفل stork_codes =====================
-- لا قراءة/كتابة عامة. الإدارة (عرض/إضافة من اللوحة) للأدمن فقط، والتفعيل للمستخدم
-- يمرّ عبر RPC redeem_stork_code (SECURITY DEFINER تتجاوز RLS بأمان).
alter table public.stork_codes enable row level security;

drop policy if exists "stork select"        on public.stork_codes;  -- كانت using(true)
drop policy if exists "stork insert"        on public.stork_codes;  -- كانت with check(true)
drop policy if exists "stork update"        on public.stork_codes;  -- كانت using(true)
drop policy if exists "stork admin select"  on public.stork_codes;
drop policy if exists "stork admin insert"  on public.stork_codes;
drop policy if exists "stork admin update"  on public.stork_codes;
drop policy if exists "stork admin delete"  on public.stork_codes;

create policy "stork admin select"
  on public.stork_codes for select
  using (public.is_admin());
create policy "stork admin insert"
  on public.stork_codes for insert
  with check (public.is_admin());
create policy "stork admin update"
  on public.stork_codes for update
  using (public.is_admin())
  with check (public.is_admin());
create policy "stork admin delete"
  on public.stork_codes for delete
  using (public.is_admin());

-- ===================== 4) تحديث مخزّن مخطّط PostgREST =====================
notify pgrst, 'reload schema';
