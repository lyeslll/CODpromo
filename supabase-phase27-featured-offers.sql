-- ============================================================
--  CODpromo — Phase 27: العروض المميّزة (Featured offers)
--  شغّله مرة واحدة: npx supabase db query --linked -f supabase-phase27-featured-offers.sql
--  آمن لإعادة التشغيل (idempotent). إضافي فقط: لا حذف ولا إعادة تسمية.
--
--  1) جدول featured_offers: شركة + ترتيب + وسم (featured = مميّز / sponsored = مُموَّل)
--     + بداية/نهاية اختيارية + تشغيل/إيقاف. القراءة العامة للعروض النشطة السارية فقط،
--     والكتابة للأدمن فقط (is_admin() في القاعدة).
--  2) code_copies.source: من أين نُسخ الكود ('featured' / 'offers' / 'home' / …).
--  3) RPCs: admin_featured_stats() (نسخ من القسم المميّز في 7 و30 يوماً — للأدمن)،
--     offers_usage_rank() (ترتيب "الأكثر استخداماً" من code_copies — ترتيب فقط، بلا أرقام،
--     حسب عدد المستخدمين المختلفين حتى لا يرفع حساب واحد عرضاً للمرتبة الأولى).
--  4) تعمير أوّلي: JustSell ← RedotPay Virtual ← SpyBox (وسم featured).
--  5) سلامة أرقام النسخ: العميل يكتب 4 أعمدة فقط في code_copies (created_at للقاعدة —
--     لا نسخ بتاريخ مستقبلي تبقى "في آخر 7 أيام").
-- ============================================================

-- ===================== 1) العروض المميّزة =====================
create table if not exists public.featured_offers (
  id         bigint generated always as identity primary key,
  company_id bigint not null references public.companies (id) on delete cascade,
  position   integer not null default 0,
  label      text not null default 'featured',
  starts_at  timestamptz not null default now(),
  ends_at    timestamptz,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'featured_offers_company_key') then
    alter table public.featured_offers add constraint featured_offers_company_key unique (company_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'featured_offers_label_chk') then
    alter table public.featured_offers add constraint featured_offers_label_chk check (label in ('featured', 'sponsored'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'featured_offers_dates_chk') then
    alter table public.featured_offers add constraint featured_offers_dates_chk check (ends_at is null or ends_at > starts_at);
  end if;
end $$;

create index if not exists featured_offers_position_idx on public.featured_offers (position);

alter table public.featured_offers enable row level security;

do $$
begin
  -- الزوّار والمسجّلون: العروض النشطة التي بدأت ولم تنتهِ فقط
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'featured_offers' and policyname = 'featured public read live') then
    create policy "featured public read live" on public.featured_offers
      for select to anon, authenticated
      using (is_active and starts_at <= now() and (ends_at is null or ends_at > now()));
  end if;
  -- الأدمن: كل العروض (حتى الموقوفة والمنتهية) + الكتابة
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'featured_offers' and policyname = 'featured admin all') then
    create policy "featured admin all" on public.featured_offers
      for all to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

revoke all on public.featured_offers from anon;
grant select on public.featured_offers to anon;
grant select, insert, update, delete on public.featured_offers to authenticated;

create or replace function public.touch_featured_offers()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'featured_offers_touch') then
    create trigger featured_offers_touch
      before update on public.featured_offers
      for each row execute function public.touch_featured_offers();
  end if;
end $$;

-- ===================== 2) مصدر النسخ =====================
alter table public.code_copies add column if not exists source text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'code_copies_source_chk') then
    alter table public.code_copies add constraint code_copies_source_chk
      check (source is null or source in ('featured', 'offers', 'home', 'store', 'category', 'favorites', 'dashboard', 'other'));
  end if;
end $$;

create index if not exists code_copies_source_created_idx on public.code_copies (source, created_at desc);
create index if not exists code_copies_company_idx on public.code_copies (company_id);

-- ===================== 3) الدوال =====================
-- نسخ الأكواد من القسم المميّز لكل عرض مميّز (count دقيق) — للأدمن فقط
create or replace function public.admin_featured_stats()
returns table (company_id bigint, copies_7d bigint, copies_30d bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  perform public.admin_assert();
  return query
    select f.company_id,
           (select count(*) from public.code_copies c
              where c.company_id = f.company_id and c.source = 'featured' and c.created_at >= now() - interval '7 days'),
           (select count(*) from public.code_copies c
              where c.company_id = f.company_id and c.source = 'featured' and c.created_at >= now() - interval '30 days')
    from public.featured_offers f;
end;
$$;

-- ترتيب "الأكثر استخداماً" في /offers: الشركات حسب عدد المستخدمين المختلفين الذين نسخوا كودها
-- (count دقيق من code_copies الحقيقية؛ حساب واحد يُحسب مرة واحدة مهما كرّر النسخ).
-- يُرجع الترتيب فقط (لا الأعداد) حتى لا تنكشف أرقام كل شريك للعموم.
create or replace function public.offers_usage_rank()
returns table (company_id bigint, rank bigint)
language sql
stable
security definer
set search_path = public
as $$
  select c.company_id, row_number() over (order by count(distinct c.user_id) desc, c.company_id) as rank
  from public.code_copies c
  join public.companies co on co.id = c.company_id
  group by c.company_id;
$$;

revoke all on function public.admin_featured_stats() from public, anon;
grant execute on function public.admin_featured_stats() to authenticated;
revoke all on function public.offers_usage_rank() from public;
grant execute on function public.offers_usage_rank() to anon, authenticated;

-- ===================== 4) تعمير أوّلي =====================
do $$
declare
  v_just bigint := (select id from public.companies where name = 'JustSell' limit 1);
  v_redot bigint := (select id from public.companies where name = 'RedotPay Virtual' limit 1);
  v_spy bigint := (select id from public.companies where name = 'SpyBox' limit 1);
begin
  if v_just is null or v_redot is null or v_spy is null then
    raise exception 'featured seed: company not found (JustSell=%, RedotPay Virtual=%, SpyBox=%)', v_just, v_redot, v_spy;
  end if;
  insert into public.featured_offers (company_id, position, label) values
    (v_just, 1, 'featured'),
    (v_redot, 2, 'featured'),
    (v_spy, 3, 'featured')
  on conflict (company_id) do nothing;
end $$;

-- ===================== 5) سلامة أرقام النسخ =====================
-- كانت صلاحيات Supabase الافتراضية تسمح للعميل بتحديد created_at (وid). RLS باقية كما هي
-- (كل مستخدم يضيف نسخه هو فقط)؛ هنا نقصر الإدخال على الأعمدة التي يرسلها logCodeCopy.
revoke insert on public.code_copies from anon, authenticated;
grant insert (user_id, company_id, premium, source) on public.code_copies to authenticated;

notify pgrst, 'reload schema';
