-- ============================================================
--  CODpromo — إعداد Supabase (شغّله مرة واحدة)
--  افتح: Supabase Dashboard → SQL Editor → New query → الصق ثم Run
--  هذا الملف آمن لإعادة التشغيل (idempotent).
-- ============================================================

-- 1) حاوية التخزين العامة "logos" لرفع شعارات الشركات
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do update set public = true;

-- 2) سياسات التخزين على حاوية logos (قراءة عامة + كتابة للزائر anon)
drop policy if exists "logos public read"  on storage.objects;
drop policy if exists "logos anon insert"  on storage.objects;
drop policy if exists "logos anon update"  on storage.objects;
drop policy if exists "logos anon delete"  on storage.objects;

create policy "logos public read"
  on storage.objects for select
  using (bucket_id = 'logos');

create policy "logos anon insert"
  on storage.objects for insert
  with check (bucket_id = 'logos');

create policy "logos anon update"
  on storage.objects for update
  using (bucket_id = 'logos')
  with check (bucket_id = 'logos');

create policy "logos anon delete"
  on storage.objects for delete
  using (bucket_id = 'logos');

-- 3) تفعيل RLS على جدول الشركات + سياسات (قراءة عامة + كتابة من اللوحة)
alter table public.companies enable row level security;

drop policy if exists "companies public read" on public.companies;
drop policy if exists "companies anon insert" on public.companies;
drop policy if exists "companies anon update" on public.companies;
drop policy if exists "companies anon delete" on public.companies;

create policy "companies public read"
  on public.companies for select
  using (true);

create policy "companies anon insert"
  on public.companies for insert
  with check (true);

create policy "companies anon update"
  on public.companies for update
  using (true)
  with check (true);

create policy "companies anon delete"
  on public.companies for delete
  using (true);

-- ============================================================
--  ملاحظة أمان: هذه السياسات تسمح لأي زائر (anon) بالكتابة.
--  لوحة /admin محمية برمز PIN في الواجهة فقط (حماية خفيفة).
--  للنشر العام الآمن استخدم Supabase Auth وقيّد السياسات بـ:
--     to authenticated   بدل   to public
-- ============================================================
