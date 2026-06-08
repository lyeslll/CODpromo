-- ============================================================
--  CODpromo — المرحلة 8: دفع SlickPay (البطاقة الجزائرية) — شغّله مرة واحدة
--  Supabase → SQL Editor → الصق ثم Run (آمن لإعادة التشغيل / idempotent)
-- ============================================================

-- 1) أعمدة مساعدة في profiles (للعرض وآخر فاتورة وطريقة الدفع)
alter table public.profiles add column if not exists slickpay_invoice_id text;
alter table public.profiles add column if not exists plan_type text;            -- month | quarter | year | stripe
alter table public.profiles add column if not exists payment_provider text;     -- stripe | slickpay

-- 2) جدول فواتير SlickPay = مصدر الربط الموثوق بين الفاتورة والمستخدم والباقة
--    (الـ webhook يبحث هنا عن صاحب الفاتورة بدل الوثوق ببيانات الإشعار)
create table if not exists public.slickpay_invoices (
  id           bigint generated always as identity primary key,
  invoice_id   text not null unique,                 -- معرّف الفاتورة من SlickPay
  user_id      uuid not null references auth.users (id) on delete cascade,
  plan_type    text not null,                        -- month | quarter | year
  amount       integer not null,                     -- بالدينار الجزائري
  status       text not null default 'pending',      -- pending | completed | failed
  created_at   timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.slickpay_invoices enable row level security;

-- المستخدم يقرأ فواتيره فقط؛ الكتابة محصورة بالخادم (service role يتجاوز RLS)
drop policy if exists "slickpay select own" on public.slickpay_invoices;
create policy "slickpay select own"
  on public.slickpay_invoices for select
  using (auth.uid() = user_id);

create index if not exists slickpay_invoices_user_idx
  on public.slickpay_invoices (user_id, created_at desc);

-- ملاحظة: لا سياسات insert/update للعميل — فقط الـ Edge Functions (service role)
-- تنشئ/تحدّث الفواتير وتفعّل Premium. هذا يمنع أي تلاعب من المتصفّح.
