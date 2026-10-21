-- ============================================================
--  CODpromo — Phase 23: لوحة الأدمن v2
--  شغّله مرة واحدة: npx supabase db query --linked -f supabase-phase23-admin-v2.sql
--  آمن لإعادة التشغيل (idempotent). إضافي فقط: لا حذف لأي جدول/عمود/سطر.
--
--  يضيف:
--   1) admin_assert(): يرفض الطلب إن لم يكن صاحب الجلسة أدمن (is_admin()).
--   2) admin_range_start(range): بداية الفترة (today / 7d / 30d / all) بتوقيت الجزائر.
--   3) admin_overview(range): كل أرقام "نظرة عامة" محسوبة خادمياً (count دقيق، بلا حدّ 1000 سطر).
--   4) admin_list_users(...): جدول المستخدمين (بحث/فلاتر/ترتيب/صفحات) مع الإيميل وآخر دخول
--      وطريقة الدخول من auth.users.
--   5) admin_user_copies(user): آخر الأكواد التي نسخها مستخدم (للوحة الجانبية).
--   6) جدول company_private: معلومات داخلية للشركة (الأدمن فقط، RLS) — بلا أي كلمة سر.
--  كل الدوال SECURITY DEFINER وتبدأ بـ admin_assert() — الحماية في القاعدة لا في الواجهة.
-- ============================================================

-- ===================== 1) حارس الأدمن =====================
create or replace function public.admin_assert()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;

-- ===================== 2) بداية الفترة =====================
-- today = بداية اليوم بتوقيت الجزائر، 7d/30d = بداية اليوم قبل 6/29 يوماً، all = بلا حدّ.
create or replace function public.admin_range_start(p_range text)
returns timestamptz
language sql
stable
set search_path = public
as $$
  select case coalesce(p_range, 'all')
    when 'today' then date_trunc('day', now() at time zone 'Africa/Algiers') at time zone 'Africa/Algiers'
    when '7d'    then (date_trunc('day', now() at time zone 'Africa/Algiers') - interval '6 days') at time zone 'Africa/Algiers'
    when '30d'   then (date_trunc('day', now() at time zone 'Africa/Algiers') - interval '29 days') at time zone 'Africa/Algiers'
    else '-infinity'::timestamptz
  end;
$$;

-- ===================== 3) نظرة عامة =====================
create or replace function public.admin_overview(p_range text default '7d')
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  tz       constant text := 'Africa/Algiers';
  v_since  timestamptz := public.admin_range_start(p_range);
  v_today  timestamptz := public.admin_range_start('today');
  v_7d     timestamptz := public.admin_range_start('7d');
  v_unit   text;
  v_step   interval;
  v_from   timestamp;
  v_to     timestamp;
  v_series json;
begin
  perform public.admin_assert();

  -- دقّة المنحنى حسب الفترة: ساعة لليوم، يوم لـ 7/30 يوماً، شهر للكل (36 شهراً كحدّ أقصى)
  if p_range = 'today' then
    v_unit := 'hour'; v_step := interval '1 hour';
    v_from := date_trunc('day', now() at time zone tz);
    v_to   := date_trunc('hour', now() at time zone tz);
  elsif p_range in ('7d', '30d') then
    v_unit := 'day'; v_step := interval '1 day';
    v_from := v_since at time zone tz;
    v_to   := date_trunc('day', now() at time zone tz);
  else
    v_unit := 'month'; v_step := interval '1 month';
    v_to   := date_trunc('month', now() at time zone tz);
    v_from := greatest(
      coalesce((select date_trunc('month', min(p.created_at) at time zone tz) from public.profiles p), v_to),
      v_to - interval '35 months'
    );
  end if;

  select json_agg(json_build_object(
           't', to_char(g.b, 'YYYY-MM-DD"T"HH24:MI'),
           'signups', (select count(*) from public.profiles p where date_trunc(v_unit, p.created_at at time zone tz) = g.b),
           'copies',  (select count(*) from public.code_copies c where date_trunc(v_unit, c.created_at at time zone tz) = g.b)
         ) order by g.b)
    into v_series
  from generate_series(v_from, v_to, v_step) as g(b);

  return json_build_object(
    'range', coalesce(p_range, 'all'),
    'users_total', (select count(*) from public.profiles),
    'users_today', (select count(*) from public.profiles where created_at >= v_today),
    'users_7d',    (select count(*) from public.profiles where created_at >= v_7d),
    'users_range', (select count(*) from public.profiles where created_at >= v_since),
    'premium_active', (
      select count(*) from public.profiles
      where coalesce(is_admin, false) = false
        and is_premium = true and (premium_until is null or premium_until > now())
    ),
    'companies', (select count(*) from public.companies),
    'offers', (
      (select count(*) from public.companies c where coalesce(btrim(c.code), '') <> '')
      + (select count(*) from public.companies c
         where coalesce(c.supports_premium, true) and coalesce(btrim(c.premium_code), '') <> '')
    ),
    'requests_pending', (select count(*) from public.company_requests where status = 'pending'),
    'copies_range', (select count(*) from public.code_copies where created_at >= v_since),
    'votes_range', (select count(*) from public.code_votes where updated_at >= v_since),
    'votes_up_range', (select count(*) from public.code_votes where updated_at >= v_since and vote_type = 'up'),
    'subscribers_total', (select count(*) from public.email_subscribers),
    'subscribers_range', (select count(*) from public.email_subscribers where created_at >= v_since),
    'series_unit', v_unit,
    'series', coalesce(v_series, '[]'::json),
    'top_copied', coalesce((
      select json_agg(t) from (
        select c.id, c.name, c.logo, c.type, count(*) as n
        from public.code_copies cc join public.companies c on c.id = cc.company_id
        where cc.created_at >= v_since
        group by c.id, c.name, c.logo, c.type
        order by n desc, c.name
        limit 5
      ) t
    ), '[]'::json),
    'top_voted', coalesce((
      select json_agg(t) from (
        select c.id, c.name, c.logo, c.type, count(*) as n,
               count(*) filter (where v.vote_type = 'up') as up
        from public.code_votes v join public.companies c on c.id = v.company_id
        where v.updated_at >= v_since
        group by c.id, c.name, c.logo, c.type
        order by n desc, c.name
        limit 5
      ) t
    ), '[]'::json)
  );
end;
$$;

-- ===================== 4) جدول المستخدمين =====================
create or replace function public.admin_list_users(
  p_search text default null,
  p_plan   text default null,      -- free | premium | lifetime
  p_type   text default null,      -- customer | company
  p_range  text default 'all',
  p_sort   text default 'created_at', -- created_at | last_sign_in | name | email | favorites | copies
  p_desc   boolean default true,
  p_limit  integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  full_name text,
  email text,
  account_type text,
  company_name text,
  plan text,
  premium_until timestamptz,
  plan_type text,
  payment_provider text,
  provider text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  favorites_count bigint,
  copies_count bigint,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_q text := nullif(btrim(coalesce(p_search, '')), '');
  v_since timestamptz := public.admin_range_start(p_range);
begin
  perform public.admin_assert();
  p_limit  := least(greatest(coalesce(p_limit, 25), 1), 1000);
  p_offset := greatest(coalesce(p_offset, 0), 0);
  -- نهرب رموز ILIKE حتى يُبحث عن النص حرفياً
  if v_q is not null then
    v_q := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  return query
  with base as (
    select
      p.id,
      p.full_name,
      coalesce(u.email, p.email)::text as email,
      p.account_type,
      p.company_name,
      case
        when p.is_admin = true then 'lifetime'
        when p.is_premium = true and (p.premium_until is null or p.premium_until > now()) then 'premium'
        else 'free'
      end as plan,
      p.premium_until,
      p.plan_type,
      p.payment_provider,
      coalesce(
        (select string_agg(x, ',' order by x) from jsonb_array_elements_text(u.raw_app_meta_data -> 'providers') as x),
        u.raw_app_meta_data ->> 'provider',
        'email'
      )::text as provider,
      p.created_at,
      u.last_sign_in_at,
      (select count(*) from public.favorites f where f.user_id = p.id) as favorites_count,
      (select count(*) from public.code_copies cc where cc.user_id = p.id) as copies_count
    from public.profiles p
    left join auth.users u on u.id = p.id
  )
  select b.id, b.full_name, b.email, b.account_type, b.company_name, b.plan, b.premium_until,
         b.plan_type, b.payment_provider, b.provider, b.created_at, b.last_sign_in_at,
         b.favorites_count, b.copies_count, count(*) over () as total_count
  from base b
  where (v_q is null or b.full_name ilike v_q or b.email ilike v_q)
    and (nullif(p_plan, '') is null or b.plan = p_plan)
    and (nullif(p_type, '') is null or b.account_type = p_type)
    and b.created_at >= v_since
  order by
    case when p_sort = 'created_at'   and p_desc     then b.created_at end desc nulls last,
    case when p_sort = 'created_at'   and not p_desc then b.created_at end asc  nulls last,
    case when p_sort = 'last_sign_in' and p_desc     then b.last_sign_in_at end desc nulls last,
    case when p_sort = 'last_sign_in' and not p_desc then b.last_sign_in_at end asc  nulls last,
    case when p_sort = 'name'         and p_desc     then lower(b.full_name) end desc nulls last,
    case when p_sort = 'name'         and not p_desc then lower(b.full_name) end asc  nulls last,
    case when p_sort = 'email'        and p_desc     then lower(b.email) end desc nulls last,
    case when p_sort = 'email'        and not p_desc then lower(b.email) end asc  nulls last,
    case when p_sort = 'favorites'    and p_desc     then b.favorites_count end desc nulls last,
    case when p_sort = 'favorites'    and not p_desc then b.favorites_count end asc  nulls last,
    case when p_sort = 'copies'       and p_desc     then b.copies_count end desc nulls last,
    case when p_sort = 'copies'       and not p_desc then b.copies_count end asc  nulls last,
    b.created_at desc, b.id
  limit p_limit offset p_offset;
end;
$$;

-- ===================== 5) آخر الأكواد المنسوخة لمستخدم =====================
create or replace function public.admin_user_copies(p_user uuid, p_limit integer default 10)
returns table (company_id bigint, name text, logo text, type text, premium boolean, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  perform public.admin_assert();
  return query
    select c.id, c.name, c.logo, c.type, cc.premium, cc.created_at
    from public.code_copies cc join public.companies c on c.id = cc.company_id
    where cc.user_id = p_user
    order by cc.created_at desc
    limit least(greatest(coalesce(p_limit, 10), 1), 50);
end;
$$;

-- صلاحيات التنفيذ: المسجّلون فقط (والدالة نفسها ترفض غير الأدمن)
revoke all on function public.admin_assert() from public, anon;
revoke all on function public.admin_overview(text) from public, anon;
revoke all on function public.admin_list_users(text, text, text, text, text, boolean, integer, integer) from public, anon;
revoke all on function public.admin_user_copies(uuid, integer) from public, anon;
grant execute on function public.admin_overview(text) to authenticated;
grant execute on function public.admin_list_users(text, text, text, text, text, boolean, integer, integer) to authenticated;
grant execute on function public.admin_user_copies(uuid, integer) to authenticated;

-- ===================== 6) معلومات الشركة الداخلية =====================
-- جدول companies يُقرأ علنياً، لذا المعلومات الداخلية في جدول منفصل مقفول للأدمن.
-- ممنوع تخزين أي كلمة سر هنا (ولا لحسابات الإحالة) — روابط ومعلومات تواصل فقط.
create table if not exists public.company_private (
  company_id              bigint primary key references public.companies (id) on delete cascade,
  website_url             text,
  contact_name            text,
  whatsapp                text,
  email                   text,
  commission_pct          numeric(5, 2) check (commission_pct is null or (commission_pct >= 0 and commission_pct <= 100)),
  affiliate_dashboard_url text,
  notes                   text,
  updated_at              timestamptz not null default now(),
  updated_by              uuid default auth.uid()
);

alter table public.company_private enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'company_private' and policyname = 'company_private admin only') then
    create policy "company_private admin only" on public.company_private
      for all to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

-- لا صلاحيات لـ anon إطلاقاً؛ المسجّل يمرّ عبر سياسة is_admin() فقط.
revoke all on public.company_private from anon;
grant select, insert, update on public.company_private to authenticated;

create or replace function public.touch_company_private()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'company_private_touch') then
    create trigger company_private_touch
      before update on public.company_private
      for each row execute function public.touch_company_private();
  end if;
end $$;
