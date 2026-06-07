-- ============================================================
--  CODpromo — المرحلة 6أ: نظام Premium + أكواد Stork — شغّله مرة واحدة
--  Supabase → SQL Editor → الصق ثم Run (آمن لإعادة التشغيل)
-- ============================================================

-- 1) أعمدة Premium في profiles
alter table public.profiles add column if not exists is_premium boolean not null default false;
alter table public.profiles add column if not exists premium_until timestamptz;

-- 2) خصم Premium الأقوى في companies
alter table public.companies add column if not exists premium_discount text;

-- 3) أكواد Stork
create table if not exists public.stork_codes (
  id          bigint generated always as identity primary key,
  code        text not null unique,
  is_used     boolean not null default false,
  used_by     uuid references auth.users (id) on delete set null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

alter table public.stork_codes enable row level security;

drop policy if exists "stork select"  on public.stork_codes;
drop policy if exists "stork insert"  on public.stork_codes;
drop policy if exists "stork update"  on public.stork_codes;

create policy "stork select" on public.stork_codes for select using (true);
create policy "stork insert" on public.stork_codes for insert with check (true);
create policy "stork update" on public.stork_codes for update using (true) with check (true);

-- 4) أكواد تجريبية
insert into public.stork_codes (code) values
  ('STORK-VIP-001'),
  ('STORK-VIP-002'),
  ('STORK-GOLD-777'),
  ('STORK-TEST-2026')
on conflict (code) do nothing;

-- ============================================================
--  ⚠️ ملاحظة: سياسات stork_codes مفتوحة (anon) ليعمل التفعيل
--  والإدارة عبر المفتاح العام. هذا بوّابة تسويقية ناعمة وليست حماية
--  صارمة. للأمان الحقيقي لاحقاً: انقل التفعيل إلى دالة RPC (security
--  definer) وقيّد الإدارة بدور admin عبر Supabase Auth.
-- ============================================================
