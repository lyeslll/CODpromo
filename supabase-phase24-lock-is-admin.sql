-- ============================================================
--  CODpromo — Phase 24: قفل profiles.is_admin
--  شغّله مرة واحدة: npx supabase db query --linked -f supabase-phase24-lock-is-admin.sql
--  آمن لإعادة التشغيل (idempotent). إضافي فقط.
--
--  الثغرة (موجودة قبل admin-v2): سياسة "profiles update own" تسمح للمستخدم بتعديل سطره
--  كاملاً، و trigger protect_premium_columns لا يحمي is_admin — فكان أي حساب مسجّل يقدر
--  يدير لروحو is_admin = true ويولّي أدمن.
--  الإصلاح: trigger يرفض أي تغيير لـ is_admin (تعديل أو إدراج بـ true) من دور العميل
--  (authenticated / anon). التعيين يبقى ممكن فقط من SQL Editor / CLI (دور postgres).
--  طريقة حماية اللوحة نفسها (is_admin() + PIN) ما تتبدّلش.
-- ============================================================

create or replace function public.protect_admin_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' and coalesce(new.is_admin, false) = true then
      raise exception 'تعيين is_admin غير مسموح من العميل' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and new.is_admin is distinct from old.is_admin then
      raise exception 'تعديل is_admin غير مسموح من العميل' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'protect_admin_column_trg') then
    create trigger protect_admin_column_trg
      before insert or update on public.profiles
      for each row execute function public.protect_admin_column();
  end if;
end $$;
