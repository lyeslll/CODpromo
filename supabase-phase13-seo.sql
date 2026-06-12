-- ============================================================
--  CODpromo — Phase 13: منظومة SEO (slug + حقول SEO + الأسئلة الشائعة + إعدادات الموقع)
--  شغّله مرة واحدة في Supabase → SQL Editor → الصق ثم Run.
--  آمن لإعادة التشغيل (idempotent).
--
--  يضيف:
--   1) دالة slugify لتوليد روابط لاتينية نظيفة من اسم الشركة.
--   2) عمود slug (فريد) على companies + توليد تلقائي للموجود (backfill).
--   3) حقول SEO لكل شركة (عنوان/وصف/كلمات مفتاحية) + ترجماتها en/fr.
--   4) جدول company_faqs (سؤال/جواب) + ترجماته + ترتيب.
--   5) جدول site_settings (عنوان/وصف الصفحة الرئيسية لكل لغة).
--  RLS: نفس نمط جدول companies (قراءة عامة + كتابة من اللوحة عبر المفتاح العام).
-- ============================================================

-- ===================== 0) دالة توليد الـ slug =====================
-- تحوّل النص إلى أحرف لاتينية صغيرة وشرطات: "YouCan Store" → "youcan-store".
-- الأحرف العربية وأي رمز غير [a-z0-9] تتحوّل إلى شرطة، ثم تُنظَّف الشرطات المكرّرة والطرفية.
create or replace function public.slugify(v text)
returns text
language sql
immutable
as $$
  select trim(both '-' from
    regexp_replace(
      regexp_replace(lower(coalesce(v, '')), '[^a-z0-9]+', '-', 'g'),
      '-{2,}', '-', 'g'
    )
  );
$$;

-- ===================== 1) أعمدة جديدة على companies =====================
alter table public.companies
  add column if not exists slug                text,
  -- عنوان SEO (يظهر في تبويب المتصفّح ونتائج جوجل)
  add column if not exists seo_title           text,
  add column if not exists seo_title_en        text,
  add column if not exists seo_title_fr        text,
  -- وصف SEO (meta description)
  add column if not exists seo_description      text,
  add column if not exists seo_description_en   text,
  add column if not exists seo_description_fr   text,
  -- الكلمات المفتاحية (نص حر مفصول بفواصل)
  add column if not exists seo_keywords         text,
  add column if not exists seo_keywords_en      text,
  add column if not exists seo_keywords_fr      text;

-- ===================== 2) توليد الـ slug للشركات الموجودة =====================
-- نملأ فقط ما هو فارغ. الأسماء اللاتينية تُسلَّج مباشرة؛ والأسماء العربية البحتة
-- (التي ينتج عنها slug فارغ) تأخذ "store-<id>" مؤقتاً — يمكن تعديلها يدوياً من الأدمن.
update public.companies c
set slug = case
  when nullif(public.slugify(c.name), '') is null then 'store-' || c.id
  else public.slugify(c.name)
end
where c.slug is null or c.slug = '';

-- ضمان التفرّد: أي slug مكرّر يُلحق به id الشركة ليصبح فريداً.
update public.companies c
set slug = c.slug || '-' || c.id
where exists (
  select 1 from public.companies d
  where d.slug = c.slug and d.id <> c.id
);

-- فهرس فريد على slug (بعد التعبئة كي لا يفشل).
create unique index if not exists companies_slug_key on public.companies (slug);

-- ===================== 3) جدول الأسئلة الشائعة لكل شركة =====================
create table if not exists public.company_faqs (
  id          bigint generated always as identity primary key,
  company_id  bigint not null references public.companies (id) on delete cascade,
  question     text not null,
  answer       text not null,
  question_en  text,
  question_fr  text,
  answer_en    text,
  answer_fr    text,
  sort_order   int  not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists company_faqs_company_idx on public.company_faqs (company_id);

alter table public.company_faqs enable row level security;

drop policy if exists "faqs public read"  on public.company_faqs;
drop policy if exists "faqs anon insert"  on public.company_faqs;
drop policy if exists "faqs anon update"  on public.company_faqs;
drop policy if exists "faqs anon delete"  on public.company_faqs;

create policy "faqs public read"
  on public.company_faqs for select using (true);
create policy "faqs anon insert"
  on public.company_faqs for insert with check (true);
create policy "faqs anon update"
  on public.company_faqs for update using (true) with check (true);
create policy "faqs anon delete"
  on public.company_faqs for delete using (true);

-- ===================== 4) إعدادات SEO العامة للموقع =====================
-- جدول بصف واحد (id = 1) يحمل عنوان/وصف الصفحة الرئيسية بالثلاث لغات.
create table if not exists public.site_settings (
  id                   int primary key default 1,
  home_title           text,
  home_title_en        text,
  home_title_fr        text,
  home_description     text,
  home_description_en  text,
  home_description_fr  text,
  updated_at           timestamptz not null default now(),
  constraint site_settings_singleton check (id = 1)
);

insert into public.site_settings (id) values (1) on conflict (id) do nothing;

alter table public.site_settings enable row level security;

drop policy if exists "settings public read"  on public.site_settings;
drop policy if exists "settings anon insert"  on public.site_settings;
drop policy if exists "settings anon update"  on public.site_settings;

create policy "settings public read"
  on public.site_settings for select using (true);
create policy "settings anon insert"
  on public.site_settings for insert with check (true);
create policy "settings anon update"
  on public.site_settings for update using (true) with check (true);

-- ===================== 5) تحديث مخزّن مخطّط PostgREST =====================
-- مهم: كي تظهر الأعمدة/الجداول الجديدة فوراً لواجهة REST (وإلا تفشل الكتابة بخطأ PGRST204).
notify pgrst, 'reload schema';
