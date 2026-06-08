-- ============================================================
--  CODpromo — المرحلة 7: أعمدة اشتراك Stripe في profiles — شغّله مرة واحدة
--  Supabase → SQL Editor → الصق ثم Run (آمن لإعادة التشغيل / idempotent)
-- ============================================================

-- معرّف عميل Stripe المرتبط بالحساب (مصدر الربط بين Supabase و Stripe)
alter table public.profiles add column if not exists stripe_customer_id text;

-- حالة الاشتراك كما في Stripe: active / trialing / past_due / canceled ...
alter table public.profiles add column if not exists subscription_status text;

-- تاريخ انتهاء صلاحية Premium (موجود مسبقاً من المرحلة 6أ — يُضاف بأمان إن لم يوجد)
alter table public.profiles add column if not exists premium_until timestamptz;

-- فهرس لتسريع البحث عبر معرّف عميل Stripe داخل الـ webhook
create index if not exists profiles_stripe_customer_idx
  on public.profiles (stripe_customer_id);

-- ملاحظة: لا حاجة لسياسات RLS جديدة — الـ webhook يكتب عبر service role
-- (يتجاوز RLS)، والمستخدم يقرأ is_premium/premium_until ضمن سياسة "select own".
