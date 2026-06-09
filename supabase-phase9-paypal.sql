-- ============================================================
--  CODpromo — المرحلة 9: دفع PayPal (دولي بالدولار) — شغّله مرة واحدة
--  Supabase → SQL Editor → الصق ثم Run (آمن لإعادة التشغيل / idempotent)
-- ============================================================

-- جدول طلبات PayPal = مصدر الربط الموثوق بين الطلب والمستخدم والباقة
-- (دالة الالتقاط تتأكد من ملكية الطلب هنا قبل تفعيل Premium)
create table if not exists public.paypal_orders (
  id           bigint generated always as identity primary key,
  order_id     text not null unique,                 -- معرّف الطلب من PayPal
  user_id      uuid not null references auth.users (id) on delete cascade,
  plan_type    text not null,                        -- month | quarter | year
  amount_usd   numeric not null,                     -- بالدولار
  status       text not null default 'pending',      -- pending | completed
  created_at   timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.paypal_orders enable row level security;

-- المستخدم يقرأ طلباته فقط؛ الكتابة محصورة بالخادم (service role يتجاوز RLS)
drop policy if exists "paypal select own" on public.paypal_orders;
create policy "paypal select own"
  on public.paypal_orders for select
  using (auth.uid() = user_id);

create index if not exists paypal_orders_user_idx
  on public.paypal_orders (user_id, created_at desc);

-- ملاحظة: أعمدة profiles (is_premium, premium_until, plan_type, payment_provider,
-- subscription_status) أُضيفت في مراحل سابقة — لا حاجة لتعديلها هنا.
