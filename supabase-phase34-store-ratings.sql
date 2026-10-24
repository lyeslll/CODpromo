-- ============================================================
--  CODpromo — phase34: صفحة الشركة الجديدة + التقييم (نجوم + علامات سريعة)
--
--  1) أعمدة جديدة في companies (كلها nullable، بلا تبديل لأي عمود قديم):
--     about / features / usage_steps (+ _en / _fr)، store_kind، code_checked_at، logo_bg.
--     القراءة علنية (grant select عمود بعمود — قاعدة phase28) والكتابة للأدمن برك (RLS كيما راه).
--  2) جدول company_ratings: تقييم واحد لكل حساب لكل شركة (يتبدّل)، بلا تعليقات مكتوبة.
--     RLS مفعّل بلا أي سياسة + بلا صلاحيات للعميل: كل شي عبر RPCs.
--  3) RPCs:
--     rate_company(company, stars, tags)  — مسجّل برك، GET مرفوض، إيميل مؤكَّد (ولا Google)،
--                                           ماشي إيميل مؤقت، ماشي صاحب الشركة، حدّ للكتابة.
--     my_company_rating(company)          — تقييمي (للمسجّل).
--     company_rating_summary(company)     — عام: العدد + المعدّل + العلامات (بلا المخبّية).
--     company_rating_summaries()          — عام: نفس الشي لكل الشركات (القوائم و prerender).
--     admin_list_ratings / admin_set_rating_hidden — أدمن برك (admin_assert).
--  مراجعة أمان مستقلة قبل التطبيق (24 أكتوبر 2026): تقييم واحد لكل بريد حقيقي (بصمة phase31c) لكل شركة،
--  حساب شركة = صاحب شركة / عندو طلب شركة / account_type (ماشي account_type برك — العميل يقدر يبدّلو)،
--  الملخّص العام بلا معدّل ولا توزيع تحت 3 تقييمات، حدّ لحجم العلامات قبل أي حساب.
--  idempotent، بلا DROP / DELETE / TRUNCATE. الرجوع: supabase-phase34-rollback.sql.
-- ============================================================

-- ===================== 1) أعمدة صفحة الشركة =====================
alter table public.companies add column if not exists about text;
alter table public.companies add column if not exists about_en text;
alter table public.companies add column if not exists about_fr text;
alter table public.companies add column if not exists features text;        -- سطر = ميزة
alter table public.companies add column if not exists features_en text;
alter table public.companies add column if not exists features_fr text;
alter table public.companies add column if not exists usage_steps text;     -- سطر = خطوة (تعوّض الخطوات العامة)
alter table public.companies add column if not exists usage_steps_en text;
alter table public.companies add column if not exists usage_steps_fr text;
alter table public.companies add column if not exists store_kind text;      -- نوع الشركة (الخطوات + علامات التقييم)
alter table public.companies add column if not exists code_checked_at timestamptz; -- آخر تحقق من الكود (الأدمن)
alter table public.companies add column if not exists logo_bg text;         -- خلفية مربع اللوغو

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'companies_store_kind_check') then
    alter table public.companies add constraint companies_store_kind_check
      check (store_kind is null or store_kind in ('platform', 'delivery', 'store', 'tool', 'payment', 'service'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'companies_logo_bg_check') then
    alter table public.companies add constraint companies_logo_bg_check
      check (logo_bg is null or logo_bg ~ '^(white|dark|transparent|#[0-9a-fA-F]{6})$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'companies_about_len_check') then
    alter table public.companies add constraint companies_about_len_check check (
      coalesce(length(about), 0) <= 4000 and coalesce(length(about_en), 0) <= 4000 and coalesce(length(about_fr), 0) <= 4000
      and coalesce(length(features), 0) <= 3000 and coalesce(length(features_en), 0) <= 3000 and coalesce(length(features_fr), 0) <= 3000
      and coalesce(length(usage_steps), 0) <= 3000 and coalesce(length(usage_steps_en), 0) <= 3000 and coalesce(length(usage_steps_fr), 0) <= 3000
    );
  end if;
end $$;

-- قاعدة phase28: كل عمود جديد يحتاج grant select صريح (العمودين السرّيين يبقاو مقفولين).
grant select (about, about_en, about_fr, features, features_en, features_fr,
              usage_steps, usage_steps_en, usage_steps_fr, store_kind, code_checked_at, logo_bg)
  on public.companies to anon, authenticated;
-- الكتابة: نفس طريقة الأعمدة القديمة (صلاحية العمود + RLS is_admin() تقرّر) — للمسجّل برك.
grant insert (about, about_en, about_fr, features, features_en, features_fr,
              usage_steps, usage_steps_en, usage_steps_fr, store_kind, code_checked_at, logo_bg),
      update (about, about_en, about_fr, features, features_en, features_fr,
              usage_steps, usage_steps_en, usage_steps_fr, store_kind, code_checked_at, logo_bg)
  on public.companies to authenticated;

-- ===================== 2) جداول التقييم =====================
create table if not exists public.company_ratings (
  id          bigint generated always as identity primary key,
  company_id  bigint not null references public.companies (id) on delete cascade,
  user_id     uuid   not null references auth.users (id) on delete cascade,
  email_hash  text,                  -- بصمة البريد (phase31c): بريد واحد = تقييم واحد لكل شركة
  stars       smallint not null check (stars between 1 and 5),
  tags        text[] not null default '{}' check (cardinality(tags) <= 4),
  edits       integer not null default 0,
  hidden_at   timestamptz,           -- الأدمن خبّاه (ما يتحسبش وما يبانش)
  hidden_by   uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (company_id, user_id)
);
create unique index if not exists company_ratings_inbox_uniq on public.company_ratings (company_id, email_hash) where email_hash is not null;
create index if not exists company_ratings_company_idx on public.company_ratings (company_id) where hidden_at is null;
create index if not exists company_ratings_user_idx on public.company_ratings (user_id, updated_at desc);

-- سجلّ الكتابات (للحدّ): كل نداء ناجح لـ rate_company = سطر.
create table if not exists public.company_rating_log (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  company_id  bigint not null,
  created_at  timestamptz not null default now()
);
create index if not exists company_rating_log_user_idx on public.company_rating_log (user_id, created_at desc);

alter table public.company_ratings enable row level security;
alter table public.company_rating_log enable row level security;
revoke all on public.company_ratings from public, anon, authenticated;
revoke all on public.company_rating_log from public, anon, authenticated;

-- ===================== 3) العلامات المسموحة حسب نوع الشركة =====================
-- نفس القائمة في الواجهة: src/lib/ratings.js (RATING_TAGS). مفاتيح ثابتة، النص في الترجمة.
create or replace function public.rating_tags_for(p_kind text)
returns text[]
language sql
immutable
set search_path = public
as $$
  select case p_kind
    when 'platform' then array['easy_setup', 'many_features', 'fair_price', 'fast_support', 'stable']
    when 'delivery' then array['on_time', 'careful_handling', 'wide_coverage', 'fast_payout', 'fast_support', 'fair_price']
    when 'store'    then array['quality_products', 'fast_shipping', 'fair_price', 'fast_support', 'as_described']
    when 'tool'     then array['accurate_data', 'easy_to_use', 'time_saver', 'fair_price', 'fast_support']
    when 'payment'  then array['fast_activation', 'low_fees', 'reliable', 'fast_support', 'easy_to_use']
    when 'service'  then array['professional', 'good_results', 'fast_support', 'fair_price', 'on_time']
    else array['easy_to_use', 'fair_price', 'fast_support', 'reliable', 'good_value']
  end;
$$;

-- نوع الشركة: store_kind (الأدمن)، وإلا من الفئة (نفس الجدول في الواجهة: kindFromCategory).
create or replace function public.company_kind(p_company_id bigint)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(c.store_kind,
    case cat.slug
      when 'e-commerce-platform' then 'platform'
      when 'store-management-erp' then 'platform'
      when 'delivery-shipping' then 'delivery'
      when 'selling-in-tunisia' then 'delivery'
      when 'payment-cards' then 'payment'
      when 'media-buying-agencies' then 'service'
      when 'exhibitions-events' then 'service'
      when 'order-confirmation' then 'service'
      when 'spy-tools' then 'tool'
      when 'ai-tools' then 'tool'
      when 'ai-advertising' then 'tool'
      when 'profit-analysis' then 'tool'
      when 'sms-automation' then 'tool'
      else null
    end)
  from public.companies c
  left join public.categories cat on cat.id = c.category_id
  where c.id = p_company_id;
$$;

-- ===================== 4) الملخّص العام =====================
-- min_count = حدّ عرض المعدّل في الواجهة (3)، و JSON-LD AggregateRating من 5 (في prerender).
create or replace function public.company_rating_summary(p_company_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with r as (
    select stars, tags from public.company_ratings
     where company_id = p_company_id and hidden_at is null
  ),
  t as (
    select tag, count(*) as n from r, unnest(r.tags) as tag group by tag
  )
  -- تحت 3 تقييمات: العدد برك (بلا معدّل ولا توزيع ولا علامات — ما يتعرفش تقييم شخص واحد)
  , c as (select count(*) as n from r)
  select jsonb_build_object(
    'company_id', p_company_id,
    'count', c.n,
    'avg', case when c.n >= 3 then (select round(avg(stars)::numeric, 1) from r) end,
    'dist', case when c.n >= 3 then (select jsonb_object_agg(s, n) from (select stars as s, count(*) as n from r group by stars) d) end,
    'tags', case when c.n >= 3 then coalesce((select jsonb_agg(jsonb_build_object('tag', tag, 'n', n) order by n desc, tag) from t), '[]'::jsonb) else '[]'::jsonb end,
    'kind', public.company_kind(p_company_id)
  )
  from c;
$$;

create or replace function public.company_rating_summaries()
returns table (company_id bigint, rating_count bigint, rating_avg numeric)
language sql
stable
security definer
set search_path = public
as $$
  select company_id, count(*), case when count(*) >= 3 then round(avg(stars)::numeric, 1) end
    from public.company_ratings
   where hidden_at is null
   group by company_id;
$$;

-- ===================== 5) تقييمي =====================
create or replace function public.my_company_rating(p_company_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v jsonb;
begin
  if v_uid is null then
    return null;
  end if;
  select jsonb_build_object('stars', stars, 'tags', tags, 'updated_at', updated_at, 'hidden', hidden_at is not null)
    into v
    from public.company_ratings
   where company_id = p_company_id and user_id = v_uid;
  return v;
end;
$$;

-- ===================== 6) التقييم (الكتابة الوحيدة) =====================
create or replace function public.rate_company(p_company_id bigint, p_stars integer, p_tags text[] default '{}')
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_user auth.users%rowtype;
  v_google boolean;
  v_kind text;
  v_allowed text[];
  v_tags text[];
  v_hour int;
  v_day int;
  v_inbox text;
begin
  -- GET (معاملة قراءة برك في PostgREST) مرفوض: الكتابة POST برك.
  if current_setting('transaction_read_only', true) = 'on' then
    raise exception 'read_only' using errcode = '25006';
  end if;
  if v_uid is null then
    return jsonb_build_object('status', 'auth');
  end if;
  -- مصفوفة ضخمة = مرفوضة قبل أي حساب
  if cardinality(p_tags) > 10 then
    return jsonb_build_object('status', 'invalid');
  end if;

  select * into v_user from auth.users where id = v_uid;
  if not found then
    return jsonb_build_object('status', 'auth');
  end if;
  v_google := coalesce(v_user.raw_app_meta_data -> 'providers', '[]'::jsonb) ? 'google'
              or v_user.raw_app_meta_data ->> 'provider' = 'google';
  if v_user.email_confirmed_at is null and not v_google then
    return jsonb_build_object('status', 'unconfirmed');
  end if;
  if public.free_key_disposable(v_user.email) then
    return jsonb_build_object('status', 'disposable');
  end if;

  if not exists (select 1 from public.companies c where c.id = p_company_id and coalesce(c.status, 'active') = 'active') then
    return jsonb_build_object('status', 'unavailable');
  end if;
  -- صاحب الشركة (بوابة الشركات) ما يقيّمش شركتو، وحساب الشركة ما يقيّمش المنافسين (التقييم للزبائن برك)
  if exists (select 1 from public.company_owners o where o.company_id = p_company_id and o.user_id = v_uid) then
    return jsonb_build_object('status', 'owner');
  end if;
  -- account_type يتبدّل من العميل → نشوفو حتى الملكية وطلبات الشركات (الأدمن والـ trigger برك يكتبوهم)
  if exists (select 1 from public.profiles p where p.id = v_uid and p.account_type = 'company')
     or exists (select 1 from public.company_owners o where o.user_id = v_uid)
     or exists (select 1 from public.company_requests q where q.user_id = v_uid) then
    return jsonb_build_object('status', 'company_account');
  end if;

  if p_stars is null or p_stars < 1 or p_stars > 5 then
    return jsonb_build_object('status', 'invalid');
  end if;
  v_kind := public.company_kind(p_company_id);
  v_allowed := public.rating_tags_for(v_kind);
  select coalesce(array_agg(distinct t order by t), '{}') into v_tags
    from unnest(coalesce(p_tags, '{}'::text[])) as t
   where t is not null;
  if cardinality(v_tags) > 4 or not (v_tags <@ v_allowed) then
    return jsonb_build_object('status', 'invalid');
  end if;

  -- حدّ الكتابة: قفل لكل حساب (طلبات متزامنة تمرّ وحدة بوحدة)، 20 في الساعة، و 6 تبديلات في اليوم لنفس الشركة.
  perform pg_advisory_xact_lock(hashtextextended('company_rating:' || v_uid::text, 0));
  -- بريد واحد (Gmail بالنقاط و +، نفس قاعدة المفتاح الذهبي) = تقييم واحد لكل شركة، حتى بحسابات مختلفة
  v_inbox := public.free_key_email_hash(v_user.email);
  if v_inbox is not null then
    perform pg_advisory_xact_lock(hashtextextended('company_rating_inbox:' || v_inbox || ':' || p_company_id::text, 0));
    if exists (select 1 from public.company_ratings r
                where r.company_id = p_company_id and r.email_hash = v_inbox and r.user_id <> v_uid) then
      return jsonb_build_object('status', 'inbox_used');
    end if;
  end if;
  select count(*) into v_hour from public.company_rating_log where user_id = v_uid and created_at > now() - interval '1 hour';
  select count(*) into v_day from public.company_rating_log
   where user_id = v_uid and company_id = p_company_id and created_at > now() - interval '1 day';
  if v_hour >= 20 or v_day >= 6 then
    return jsonb_build_object('status', 'rate_limited');
  end if;

  insert into public.company_ratings (company_id, user_id, email_hash, stars, tags)
  values (p_company_id, v_uid, v_inbox, p_stars, v_tags)
  on conflict (company_id, user_id) do update
    set stars = excluded.stars,
        tags = excluded.tags,
        email_hash = excluded.email_hash,
        edits = public.company_ratings.edits + 1,
        updated_at = now();
  insert into public.company_rating_log (user_id, company_id) values (v_uid, p_company_id);

  return jsonb_build_object(
    'status', 'ok',
    'mine', public.my_company_rating(p_company_id),
    'summary', public.company_rating_summary(p_company_id)
  );
end;
$$;

-- ===================== 7) الأدمن =====================
create or replace function public.admin_list_ratings(p_company_id bigint default null, p_limit integer default 300)
returns table (
  id bigint, company_id bigint, company_name text, company_logo text, user_id uuid, email text, full_name text,
  stars smallint, tags text[], edits integer, hidden boolean, created_at timestamptz, updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.admin_assert();
  return query
    select r.id, r.company_id, c.name, c.logo, r.user_id, u.email::text,
           coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name')::text,
           r.stars, r.tags, r.edits, r.hidden_at is not null, r.created_at, r.updated_at
      from public.company_ratings r
      join public.companies c on c.id = r.company_id
      left join auth.users u on u.id = r.user_id
     where p_company_id is null or r.company_id = p_company_id
     order by r.updated_at desc
     limit greatest(1, least(coalesce(p_limit, 300), 1000));
end;
$$;

create or replace function public.admin_set_rating_hidden(p_id bigint, p_hidden boolean)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  perform public.admin_assert();
  if current_setting('transaction_read_only', true) = 'on' then
    raise exception 'read_only' using errcode = '25006';
  end if;
  if p_hidden is null then
    raise exception 'p_hidden is null' using errcode = '22004';
  end if;
  update public.company_ratings
     set hidden_at = case when p_hidden then coalesce(hidden_at, now()) else null end,
         hidden_by = case when p_hidden then auth.uid() else null end
   where id = p_id;
end;
$$;

-- ===================== 8) الصلاحيات =====================
-- الأدوات الداخلية ما تتناداش من المتصفّح.
revoke all on function public.rating_tags_for(text) from public, anon, authenticated;
revoke all on function public.company_kind(bigint) from public, anon, authenticated;
revoke all on function public.company_rating_summary(bigint) from public, anon, authenticated;
revoke all on function public.company_rating_summaries() from public, anon, authenticated;
revoke all on function public.my_company_rating(bigint) from public, anon, authenticated;
revoke all on function public.rate_company(bigint, integer, text[]) from public, anon, authenticated;
revoke all on function public.admin_list_ratings(bigint, integer) from public, anon, authenticated;
revoke all on function public.admin_set_rating_hidden(bigint, boolean) from public, anon, authenticated;

grant execute on function public.company_rating_summary(bigint) to anon, authenticated;
grant execute on function public.company_rating_summaries() to anon, authenticated;
grant execute on function public.my_company_rating(bigint) to authenticated;
grant execute on function public.rate_company(bigint, integer, text[]) to authenticated;
grant execute on function public.admin_list_ratings(bigint, integer) to authenticated;
grant execute on function public.admin_set_rating_hidden(bigint, boolean) to authenticated;

notify pgrst, 'reload schema';
