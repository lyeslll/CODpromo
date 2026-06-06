-- ============================================================
--  CODpromo — المرحلة 2: نوع الحساب وحقول الشركة — شغّله مرة واحدة
--  Supabase → SQL Editor → الصق ثم Run (آمن لإعادة التشغيل)
--  يفترض أنك شغّلت supabase-auth-setup.sql سابقاً.
-- ============================================================

-- 1) أعمدة جديدة في جدول profiles
alter table public.profiles add column if not exists account_type text not null default 'customer';
alter table public.profiles add column if not exists company_name text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists website text;

-- قيد على القيم المسموحة لنوع الحساب
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_account_type_chk'
  ) then
    alter table public.profiles
      add constraint profiles_account_type_chk
      check (account_type in ('customer', 'company'));
  end if;
end $$;

-- 2) تحديث الدالة لنسخ نوع الحساب وبيانات الشركة من الميتاداتا
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, account_type, company_name, phone, website)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    coalesce(new.raw_user_meta_data->>'account_type', 'customer'),
    new.raw_user_meta_data->>'company_name',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'website'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- (الـ trigger on_auth_user_created موجود من المرحلة السابقة ولا حاجة لإعادته)
