-- ============================================================
--  CODpromo — Phase 15 (S1): هوية أدمن حقيقية (الأساس فقط)
--  شغّله مرة واحدة في Supabase → SQL Editor → الصق ثم Run.
--  آمن لإعادة التشغيل (idempotent).
--
--  ⚠️ هذه المرحلة إضافية تماماً — لا تُغيّر أي سياسة RLS ولا تكسر اللوحة:
--     * تضيف عمود profiles.is_admin (افتراضي false).
--     * تضيف دالة public.is_admin() لاستعمالها لاحقاً في سياسات RLS.
--     * تُعلّم حسابك أنت كأدمن (عدّل الإيميل في السطر أدناه).
--  لا تُفرَض is_admin() كحاجز كتابة الآن — تبقى السياسات الحالية كما هي.
-- ============================================================

-- ===================== 1) عمود is_admin على profiles =====================
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- ===================== 2) دالة is_admin() (security definer) =====================
-- تُرجع true إذا كان للمستخدم المُصادَق حالياً (auth.uid()) صف في profiles بـ is_admin = true.
-- security definer + search_path ثابت: تتجاوز RLS لقراءة العلم بأمان (نمط آمن قياسي).
-- جاهزة للاستعمال لاحقاً في سياسات RLS، لكنها لا تُفرَض على أي جدول الآن.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  );
$$;

-- السماح للأدوار العامة باستدعاء الدالة (لتعمل داخل سياسات RLS مستقبلاً).
grant execute on function public.is_admin() to anon, authenticated;

-- ===================== 3) placeholder: اجعل حسابك أدمن =====================
-- استبدل ADMIN_EMAIL_HERE بإيميلك ثم شغّل (الإيميل: 01lyeslll@gmail.com).
update public.profiles set is_admin = true where email = 'ADMIN_EMAIL_HERE';

-- ===================== 4) تحديث مخزّن مخطّط PostgREST =====================
notify pgrst, 'reload schema';
