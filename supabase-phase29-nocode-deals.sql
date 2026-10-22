-- ============================================================
--  CODpromo — Phase 29: عروض بلا كود (No-code deals)
--  شغّله مرة واحدة: npx supabase db query --linked -f supabase-phase29-nocode-deals.sql
--  آمن لإعادة التشغيل (idempotent). إضافي فقط: لا حذف ولا إعادة تسمية.
--
--  عرض بلا كود: الزائر يضغط زراً فيمرّ عبر /go/<slug> إلى الشركة برابط خاص، ويأخذ ميزة
--  مقابل شرط (مثال: "8$ رصيد مجاني" عند شحن 2$).
--  1) nocode_deals: الاسم واللوغو خاصّان بالعرض (لا شركات فارغة في قائمة الأكواد)، الفئة،
--     ربط اختياري بشركة، الميزة/الشرط/الوصف (+ en/fr)، ونسخة Premium اختيارية.
--     الرابط العادي url لا يُقرأ من الجدول أبداً (صلاحيات الأعمدة) — فقط عبر RPC nocode_go.
--  2) nocode_deal_premium: رابط Premium في جدول منفصل، RLS للأدمن فقط. has_premium (علني)
--     يُحدَّث آلياً منه، فتعرف الواجهة "هل يوجد عرض Premium؟" دون رؤية الرابط.
--  3) deal_clicks: تسجيل الضغطات عبر RPC فقط؛ زائر واحد = ضغطة واحدة في اليوم لكل عرض
--     (بصمة مجزّأة بمفتاح سرّي: المعرّف للمسجّل، عنوان IP للزائر — لا IP صريح في القاعدة).
--  4) RPCs: nocode_go (التحويل + التسجيل)، admin_nocode_stats، admin_nocode_links.
-- ============================================================

-- ===================== 0) مفتاح البصمة (خارج الـ API) =====================
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.app_secrets (
  key   text primary key,
  value text not null
);
revoke all on private.app_secrets from public, anon, authenticated;

insert into private.app_secrets (key, value)
values ('deal_click_pepper', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (key) do nothing;

-- ===================== 1) العروض =====================
create table if not exists public.nocode_deals (
  id                   bigint generated always as identity primary key,
  slug                 text not null,
  name                 text not null,
  logo_url             text,
  category_id          uuid references public.categories (id) on delete set null,
  company_id           bigint references public.companies (id) on delete set null,
  reward               text not null,
  reward_en            text,
  reward_fr            text,
  condition            text,
  condition_en         text,
  condition_fr         text,
  description          text,
  description_en       text,
  description_fr       text,
  url                  text not null,
  premium_reward       text,
  premium_reward_en    text,
  premium_reward_fr    text,
  premium_condition    text,
  premium_condition_en text,
  premium_condition_fr text,
  has_premium          boolean not null default false,
  position             integer not null default 0,
  starts_at            timestamptz not null default now(),
  ends_at              timestamptz,
  is_active            boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'nocode_deals_slug_key') then
    alter table public.nocode_deals add constraint nocode_deals_slug_key unique (slug);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'nocode_deals_slug_chk') then
    alter table public.nocode_deals add constraint nocode_deals_slug_chk
      check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 80);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'nocode_deals_url_chk') then
    alter table public.nocode_deals add constraint nocode_deals_url_chk check (url ~* '^https?://');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'nocode_deals_logo_chk') then
    alter table public.nocode_deals add constraint nocode_deals_logo_chk check (logo_url is null or logo_url ~* '^https?://');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'nocode_deals_dates_chk') then
    alter table public.nocode_deals add constraint nocode_deals_dates_chk check (ends_at is null or ends_at > starts_at);
  end if;
end $$;

create index if not exists nocode_deals_position_idx on public.nocode_deals (position);

alter table public.nocode_deals enable row level security;

do $$
begin
  -- الزوار والمسجّلون: العروض النشطة التي بدأت ولم تنتهِ فقط
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'nocode_deals' and policyname = 'nocode public read live') then
    create policy "nocode public read live" on public.nocode_deals
      for select to anon, authenticated
      using (is_active and starts_at <= now() and (ends_at is null or ends_at > now()));
  end if;
  -- الأدمن: كل العروض + الكتابة
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'nocode_deals' and policyname = 'nocode admin all') then
    create policy "nocode admin all" on public.nocode_deals
      for all to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

-- صلاحيات الأعمدة: url لا يُقرأ أبداً من العميل (حتى الأدمن يقرأه عبر admin_nocode_links)،
-- و has_premium / created_at / updated_at لا يكتبها العميل.
do $$
declare
  readable text;
  writable text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into readable
    from information_schema.columns
   where table_schema = 'public' and table_name = 'nocode_deals' and column_name <> 'url';
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into writable
    from information_schema.columns
   where table_schema = 'public' and table_name = 'nocode_deals'
     and column_name not in ('id', 'has_premium', 'created_at', 'updated_at');
  execute 'revoke all on public.nocode_deals from anon, authenticated';
  execute format('grant select (%s) on public.nocode_deals to anon, authenticated', readable);
  execute format('grant insert (%s), update (%s) on public.nocode_deals to authenticated', writable, writable);
  execute 'grant delete on public.nocode_deals to authenticated';
end $$;

create or replace function public.touch_nocode_deals()
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
  if not exists (select 1 from pg_trigger where tgname = 'nocode_deals_touch') then
    create trigger nocode_deals_touch
      before update on public.nocode_deals
      for each row execute function public.touch_nocode_deals();
  end if;
end $$;

-- ===================== 2) رابط Premium (الأدمن فقط) =====================
create table if not exists public.nocode_deal_premium (
  deal_id     bigint primary key references public.nocode_deals (id) on delete cascade,
  premium_url text not null,
  updated_at  timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'nocode_deal_premium_url_chk') then
    alter table public.nocode_deal_premium add constraint nocode_deal_premium_url_chk check (premium_url ~* '^https?://');
  end if;
end $$;

alter table public.nocode_deal_premium enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'nocode_deal_premium' and policyname = 'nocode premium admin all') then
    create policy "nocode premium admin all" on public.nocode_deal_premium
      for all to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

revoke all on public.nocode_deal_premium from anon, authenticated;
grant select, insert, update, delete on public.nocode_deal_premium to authenticated;

-- has_premium يتبع جدول الروابط (SECURITY DEFINER: العميل لا يملك كتابة هذا العمود)
create or replace function public.sync_nocode_has_premium()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids bigint[];
begin
  if tg_op = 'DELETE' then
    v_ids := array[old.deal_id];
  elsif tg_op = 'UPDATE' then
    v_ids := array[old.deal_id, new.deal_id];
  else
    v_ids := array[new.deal_id];
  end if;
  update public.nocode_deals d
     set has_premium = exists (
           select 1 from public.nocode_deal_premium p
            where p.deal_id = d.id and btrim(p.premium_url) <> '')
   where d.id = any (v_ids);
  return null;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'nocode_deal_premium_sync') then
    create trigger nocode_deal_premium_sync
      after insert or update or delete on public.nocode_deal_premium
      for each row execute function public.sync_nocode_has_premium();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'nocode_deal_premium_touch') then
    create trigger nocode_deal_premium_touch
      before update on public.nocode_deal_premium
      for each row execute function public.touch_nocode_deals();
  end if;
end $$;

-- ===================== 3) الضغطات =====================
create table if not exists public.deal_clicks (
  id         bigint generated always as identity primary key,
  deal_id    bigint not null references public.nocode_deals (id) on delete cascade,
  user_id    uuid references auth.users (id) on delete set null,
  is_premium boolean not null default false,
  visitor    text not null,
  day        date not null default ((now() at time zone 'utc')::date),
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'deal_clicks_once_per_day') then
    alter table public.deal_clicks add constraint deal_clicks_once_per_day unique (deal_id, is_premium, visitor, day);
  end if;
end $$;

create index if not exists deal_clicks_deal_day_idx on public.deal_clicks (deal_id, day);

-- لا قراءة ولا كتابة مباشرة: التسجيل عبر nocode_go والإحصائيات عبر admin_nocode_stats
alter table public.deal_clicks enable row level security;
revoke all on public.deal_clicks from anon, authenticated;

-- ===================== 4) الدوال =====================
-- التحويل: يجد العرض الساري، يتحقق من Premium خادمياً، يسجّل الضغطة، ويُرجع الرابط.
--  status: ok | not_found | no_premium | premium_required
create or replace function public.nocode_go(p_slug text, p_premium boolean default false)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  d        record;
  v_url    text;
  v_uid    uuid := auth.uid();
  v_prem   boolean := coalesce(p_premium, false);
  v_day    date := (now() at time zone 'utc')::date;
  v_hdr    json;
  v_ip     text;
  v_pepper text;
begin
  select n.id, n.name, n.url into d
    from public.nocode_deals n
   where n.slug = lower(btrim(coalesce(p_slug, '')))
     and n.is_active and n.starts_at <= now() and (n.ends_at is null or n.ends_at > now());
  if not found then
    return json_build_object('status', 'not_found');
  end if;

  if v_prem then
    select p.premium_url into v_url
      from public.nocode_deal_premium p
     where p.deal_id = d.id and btrim(p.premium_url) <> '';
    if v_url is null then
      return json_build_object('status', 'no_premium', 'name', d.name);
    end if;
    if v_uid is null or not public.has_premium_access(v_uid) then
      return json_build_object('status', 'premium_required', 'name', d.name);
    end if;
  else
    v_url := d.url;
  end if;

  -- بصمة اليوم: المسجّل بمعرّفه، والزائر بعنوان IP كما يراه Cloudflare (cf-connecting-ip)
  begin
    v_hdr := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    v_hdr := null;
  end;
  -- cf-connecting-ip يضعه Cloudflare (لا يستطيع العميل تزويره). احتياطاً: آخر عنوان في
  -- x-forwarded-for (يضيفه أقرب وسيط موثوق؛ الأول يرسله العميل نفسه فلا نعتمد عليه).
  v_ip := nullif(btrim(v_hdr ->> 'cf-connecting-ip'), '');
  if v_ip is null then
    v_ip := nullif(btrim(regexp_replace(coalesce(v_hdr ->> 'x-forwarded-for', ''), '^.*,', '')), '');
  end if;
  -- IPv6: جهاز واحد يملك شبكة /64 كاملة → نعدّها زائراً واحداً
  begin
    if v_ip is not null and family(v_ip::inet) = 6 then
      v_ip := host(network(set_masklen(v_ip::inet, 64)));
    end if;
  exception when others then
    null;
  end;
  v_ip := coalesce(v_ip, 'unknown');
  select s.value into v_pepper from private.app_secrets s where s.key = 'deal_click_pepper';

  insert into public.deal_clicks (deal_id, user_id, is_premium, visitor, day)
  values (
    d.id, v_uid, v_prem,
    encode(sha256(convert_to(coalesce(v_pepper, '') || '|' || v_day::text || '|' ||
      case when v_uid is not null then 'u:' || v_uid::text else 'ip:' || v_ip end, 'UTF8')), 'hex'),
    v_day)
  on conflict on constraint deal_clicks_once_per_day do nothing;

  return json_build_object('status', 'ok', 'url', v_url, 'name', d.name);
end;
$$;

-- الضغطات لكل عرض في 7 و30 يوماً، عادي و Premium (count دقيق؛ زائر واحد = ضغطة في اليوم)
create or replace function public.admin_nocode_stats()
returns table (deal_id bigint, normal_7d bigint, normal_30d bigint, premium_7d bigint, premium_30d bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_today date := (now() at time zone 'utc')::date;
begin
  perform public.admin_assert();
  return query
    select n.id,
           count(c.id) filter (where not c.is_premium and c.day > v_today - 7),
           count(c.id) filter (where not c.is_premium and c.day > v_today - 30),
           count(c.id) filter (where c.is_premium and c.day > v_today - 7),
           count(c.id) filter (where c.is_premium and c.day > v_today - 30)
      from public.nocode_deals n
      left join public.deal_clicks c on c.deal_id = n.id
     group by n.id;
end;
$$;

-- الرابطان لفورم الأدمن (url لا يُقرأ من الجدول مباشرة)
create or replace function public.admin_nocode_links(p_id bigint)
returns table (url text, premium_url text)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  perform public.admin_assert();
  return query
    select n.url, p.premium_url
      from public.nocode_deals n
      left join public.nocode_deal_premium p on p.deal_id = n.id
     where n.id = p_id;
end;
$$;

revoke all on function public.nocode_go(text, boolean) from public;
grant execute on function public.nocode_go(text, boolean) to anon, authenticated;
revoke all on function public.admin_nocode_stats() from public, anon;
grant execute on function public.admin_nocode_stats() to authenticated;
revoke all on function public.admin_nocode_links(bigint) from public, anon;
grant execute on function public.admin_nocode_links(bigint) to authenticated;
revoke all on function public.sync_nocode_has_premium() from public, anon, authenticated;

notify pgrst, 'reload schema';
