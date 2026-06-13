-- ============================================================
--  CODpromo — Phase 14: نظام تصنيفات حقيقي (جدول categories + category_id)
--  شغّله مرة واحدة في Supabase → SQL Editor → الصق ثم Run.
--  آمن لإعادة التشغيل (idempotent).
--
--  المتطلّب المسبق: يجب أن تكون Phase 13 قد شُغّلت (تُعرّف دالة public.slugify).
--
--  يضيف:
--   1) جدول categories (تصنيفات مستقلّة بأسماء مترجمة + أيقونة + ترتيب + تفعيل).
--   2) عمود companies.category_id (FK اختياري) — مع الإبقاء على عمود category النصي احتياطاً.
--   3) Backfill: إنشاء صف لكل قيمة category مميّزة، ثم ربط الشركات بها.
--   4) RLS: قراءة عامة + كتابة من اللوحة عبر المفتاح العام (نفس نمط companies).
-- ============================================================

-- gen_random_uuid() متاح افتراضياً في Supabase (امتداد pgcrypto). هذا السطر دفاعي وآمن لإعادة التشغيل.
create extension if not exists pgcrypto;

-- ===================== 1) جدول التصنيفات =====================
create table if not exists public.categories (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique not null,
  -- أسماء العرض (العربية هي المصدر/الـ fallback، والإنجليزية/الفرنسية ترجمة)
  name_ar         text,
  name_en         text,
  name_fr         text,
  -- أيقونة اختيارية (emoji أو اسم أيقونة)
  icon            text,
  -- أوصاف اختيارية لكل لغة (لرأس صفحة الفئة / السيو)
  description_ar  text,
  description_en  text,
  description_fr  text,
  sort_order      int  not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

create index if not exists categories_sort_idx   on public.categories (sort_order);
create index if not exists categories_active_idx  on public.categories (is_active);

-- ===================== 2) ربط الشركات بالتصنيفات =====================
-- عمود FK اختياري؛ عند حذف الفئة تُصبح قيمة الشركة null (لا تُحذف الشركة).
-- ملاحظة: عمود companies.category النصي يبقى كما هو احتياطاً (المصدر للـ backfill والـ fallback).
alter table public.companies
  add column if not exists category_id uuid references public.categories (id) on delete set null;

create index if not exists companies_category_id_idx on public.companies (category_id);

-- ===================== 3) Backfill من القيم النصية الحالية =====================
-- (أ) لكل قيمة category مميّزة وغير فارغة، أنشئ صفاً في categories.
--     slug = slugify(category_en) إن وُجد، وإلا slugify(category)،
--            وإلا (عربي بحت بلا إنجليزية) رمز فريد مشتقّ ليبقى الـ slug غير فارغ وفريداً.
--     نجمع حسب النص العربي (category) ونأخذ ترجمة تمثيلية واحدة لكل مجموعة.
with distinct_cats as (
  select
    c.category                       as name_ar,
    max(nullif(btrim(c.category_en), '')) as name_en,
    max(nullif(btrim(c.category_fr), '')) as name_fr
  from public.companies c
  where c.category is not null and btrim(c.category) <> ''
  group by c.category
),
with_slug as (
  select
    name_ar, name_en, name_fr,
    coalesce(
      nullif(public.slugify(name_en), ''),
      nullif(public.slugify(name_ar), ''),
      'cat-' || left(md5(name_ar), 8)
    ) as base_slug
  from distinct_cats
),
-- ضمان تفرّد الـ slug داخل الدفعة (لو أنتجت قيمتان عربيّتان مختلفتان نفس الـ slug)
ranked as (
  select
    name_ar, name_en, name_fr, base_slug,
    row_number() over (partition by base_slug order by name_ar) as rn
  from with_slug
)
insert into public.categories (slug, name_ar, name_en, name_fr)
select
  case when rn = 1 then base_slug else base_slug || '-' || rn end,
  name_ar, name_en, name_fr
from ranked
on conflict (slug) do nothing;  -- إعادة التشغيل: لا تُكرّر الموجود

-- (ب) اربط كل شركة بالفئة المطابقة عبر النص العربي (المصدر). نملأ الفارغ فقط (idempotent).
update public.companies c
set category_id = cat.id
from public.categories cat
where c.category_id is null
  and c.category is not null and btrim(c.category) <> ''
  and cat.name_ar = c.category;

-- ===================== 4) RLS لجدول categories =====================
-- نفس نمط جدول companies (راجع supabase-setup.sql): قراءة عامة + كتابة عبر المفتاح العام.
-- الكتابة عملياً مقصورة على لوحة /admin المحميّة برمز PIN في الواجهة (حماية خفيفة).
-- للأمان الحقيقي لاحقاً: استبدل using/with check (true) بشرط مبني على Supabase Auth، أو حوّل to authenticated.
alter table public.categories enable row level security;

drop policy if exists "categories public read" on public.categories;
drop policy if exists "categories anon insert" on public.categories;
drop policy if exists "categories anon update" on public.categories;
drop policy if exists "categories anon delete" on public.categories;

create policy "categories public read"
  on public.categories for select
  using (true);

create policy "categories anon insert"
  on public.categories for insert
  with check (true);

create policy "categories anon update"
  on public.categories for update
  using (true)
  with check (true);

create policy "categories anon delete"
  on public.categories for delete
  using (true);

-- ===================== 5) تحديث مخزّن مخطّط PostgREST =====================
-- مهم: كي يظهر الجدول/العمود الجديد فوراً لواجهة REST (وإلا تفشل القراءة/الكتابة بخطأ PGRST204/PGRST205).
notify pgrst, 'reload schema';
