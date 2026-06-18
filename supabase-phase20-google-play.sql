-- ============================================================
--  CODpromo — المرحلة 20: دفع Google Play (داخل تطبيق TWA) — شغّله مرة واحدة
--  Supabase → SQL Editor → الصق ثم Run (آمن لإعادة التشغيل / idempotent)
-- ============================================================

-- جدول مشتريات Google Play = مصدر الربط الموثوق بين رمز الشراء والمستخدم.
-- دالة verify-play-purchase تتحقّق هنا أن الرمز لم يُعالَج لحساب آخر (منع
-- إعادة الاستخدام/الاحتيال)، وتمنح Premium خادمياً فقط بعد تحقّق Google.
create table if not exists public.google_play_purchases (
  id             bigint generated always as identity primary key,
  purchase_token text not null unique,                 -- رمز الشراء من Google Play
  user_id        uuid not null references auth.users (id) on delete cascade,
  product_id     text not null,                        -- premium_monthly | premium_quarterly | premium_yearly
  premium_until  timestamptz,                          -- تاريخ الانتهاء كما أرجعه Google
  status         text not null default 'active',       -- active | expired
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.google_play_purchases enable row level security;

-- المستخدم يقرأ مشترياته فقط؛ كل كتابة محصورة بالخادم (service role يتجاوز RLS)
drop policy if exists "play select own" on public.google_play_purchases;
create policy "play select own"
  on public.google_play_purchases for select
  using (auth.uid() = user_id);

create index if not exists google_play_purchases_user_idx
  on public.google_play_purchases (user_id, created_at desc);

-- ملاحظة: أعمدة profiles (is_premium, premium_until, plan_type, payment_provider,
-- subscription_status) أُضيفت في مراحل سابقة — لا حاجة لتعديلها هنا.
