-- ============================================================
--  CODpromo — المرحلة 3: المفضّلة + طلبات الشركات — شغّله مرة واحدة
--  Supabase → SQL Editor → الصق ثم Run (آمن لإعادة التشغيل)
-- ============================================================

-- ===================== 1) المفضّلة =====================
create table if not exists public.favorites (
  id          bigint generated always as identity primary key,
  user_id     uuid   not null references auth.users (id) on delete cascade,
  company_id  bigint not null references public.companies (id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (user_id, company_id)
);

alter table public.favorites enable row level security;

drop policy if exists "favorites select own" on public.favorites;
drop policy if exists "favorites insert own" on public.favorites;
drop policy if exists "favorites delete own" on public.favorites;

create policy "favorites select own"
  on public.favorites for select using (auth.uid() = user_id);
create policy "favorites insert own"
  on public.favorites for insert with check (auth.uid() = user_id);
create policy "favorites delete own"
  on public.favorites for delete using (auth.uid() = user_id);

-- ===================== 2) طلبات الشركات =====================
create table if not exists public.company_requests (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users (id) on delete cascade,
  company_name  text,
  title         text not null,
  type          text not null default 'تخفيض',
  description   text,
  code          text,
  link          text,
  logo          text,
  status        text not null default 'pending',
  created_at    timestamptz not null default now(),
  constraint company_requests_status_chk check (status in ('pending','approved','rejected')),
  constraint company_requests_type_chk   check (type in ('تخفيض','كوبون','كاش باك'))
);

alter table public.company_requests enable row level security;

drop policy if exists "requests select own" on public.company_requests;
drop policy if exists "requests insert own" on public.company_requests;

create policy "requests select own"
  on public.company_requests for select using (auth.uid() = user_id);
create policy "requests insert own"
  on public.company_requests for insert with check (auth.uid() = user_id);

-- ملاحظة: الموافقة/الرفض تتم لاحقاً من جهة الأدمن (مفتاح خدمة) — لا سياسة تحديث للعميل هنا.
