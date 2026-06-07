-- ============================================================
--  CODpromo — المرحلة 5: مشتركو النشرة البريدية — شغّله مرة واحدة
--  Supabase → SQL Editor → الصق ثم Run (آمن لإعادة التشغيل)
-- ============================================================

create table if not exists public.email_subscribers (
  id          bigint generated always as identity primary key,
  email       text not null unique,            -- يمنع تكرار نفس الإيميل
  consent     boolean not null default false,  -- موافقة استلام العروض
  source      text default 'popup',
  created_at  timestamptz not null default now()
);

alter table public.email_subscribers enable row level security;

drop policy if exists "subscribers anon insert" on public.email_subscribers;
drop policy if exists "subscribers admin read"  on public.email_subscribers;

-- اشتراك الزوّار (إدراج فقط)
create policy "subscribers anon insert"
  on public.email_subscribers for insert with check (true);

-- قراءة من لوحة الأدمن
create policy "subscribers admin read"
  on public.email_subscribers for select using (true);

-- ============================================================
--  ⚠️ ملاحظة أمنية: سياسة القراءة تسمح لأي مالك للمفتاح العام
--  بقراءة قائمة الإيميلات. لوحة /admin محمية برمز PIN في الواجهة
--  فقط. للأمان الحقيقي لاحقاً: قيّد القراءة بدور admin عبر Supabase Auth.
-- ============================================================
