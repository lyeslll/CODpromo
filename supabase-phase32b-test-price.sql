-- ============================================================
--  CODpromo — Phase 32b: سعر التجربة لحساب واحد (30 دقيقة)
--  شغّله: supabase db query --linked -f supabase-phase32b-test-price.sql
--  آمن لإعادة التشغيل (idempotent). بلا DROP / DELETE / TRUNCATE.
--  ⚠️ tier = 'test' في purchases / الفواتير يحتاج phase32c (توسيع CHECK).
--
--  1) pricing_test_prices: حساب واحد ← مبلغ صغير (دج / $) حتى expires_at (30 دقيقة).
--     بلا أي صلاحية للعميل (RLS بلا سياسات)؛ الأدمن عبر RPCs برك.
--  2) pricing_for_user(uid) (service_role): السعر اللي يتقرّر في Edge Functions — سعر التجربة النشط
--     لهاد الحساب برك (tier = 'test')، وإلا pricing_public().
--     my_pricing(): نفس الشي للحساب اللي داخل (auth.uid()) — حتى واحد ما يشوف سعر تجربة حساب آخر.
--  3) grant_lifetime_purchase يقبل tier = 'test'.
--  4) المبيعات ومقاعد الإطلاق و"اشتروا بعد…" ما يحسبوش 'test' (المقاعد كانت tier = 'launch' برك).
-- ============================================================

-- ===================== 1) سعر التجربة =====================
create table if not exists public.pricing_test_prices (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  price_dzd  integer       not null check (price_dzd between 50 and 1000000),
  price_usd  numeric(10,2) not null check (price_usd between 0.50 and 100000),
  expires_at timestamptz   not null,
  created_by uuid,
  created_at timestamptz   not null default now()
);

alter table public.pricing_test_prices enable row level security;  -- بلا سياسات
revoke all on public.pricing_test_prices from anon, authenticated;

-- ===================== 2) السعر حسب الحساب =====================
create or replace function public.pricing_for_user(uid uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select case
           when t.user_id is null then public.pricing_public()
           else (public.pricing_public()::jsonb || jsonb_build_object(
                   'tier', 'test',
                   'price_usd', t.price_usd,
                   'price_dzd', t.price_dzd,
                   'test_expires_at', t.expires_at))::json
         end
  from (select 1) x
  left join public.pricing_test_prices t on t.user_id = uid and t.expires_at > now();
$$;

-- للواجهة: الحساب اللي داخل يشوف سعر تجربتو هو برك (الزائر = pricing_public)
create or replace function public.my_pricing()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select public.pricing_for_user(auth.uid());
$$;

-- ===================== 3) الأدمن: سعر التجربة =====================
-- يفعّل (ولا يجدّد) سعر تجربة لحساب واحد بالإيميل لمدة 30 دقيقة. ما يفوتش السعر العادي.
create or replace function public.admin_set_test_price(p_email text, p_dzd integer, p_usd numeric)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid;
  v_email text;
  s       public.pricing_settings%rowtype;
  v_until timestamptz := now() + interval '30 minutes';
begin
  perform public.admin_assert();
  select * into s from public.pricing_settings where id = 1;
  if p_dzd is null or p_dzd < 50 or p_dzd > s.regular_price_dzd
     or p_usd is null or p_usd < 0.50 or p_usd > s.regular_price_usd then
    raise exception 'invalid test price' using errcode = '22023';
  end if;

  select u.id, u.email::text into v_uid, v_email
    from auth.users u
   where lower(u.email) = lower(btrim(coalesce(p_email, '')))
   limit 1;
  if v_uid is null then
    raise exception 'user not found' using errcode = 'P0002';
  end if;

  insert into public.pricing_test_prices (user_id, price_dzd, price_usd, expires_at, created_by, created_at)
  values (v_uid, p_dzd, round(p_usd, 2), v_until, auth.uid(), now())
  on conflict (user_id) do update
     set price_dzd = excluded.price_dzd,
         price_usd = excluded.price_usd,
         expires_at = excluded.expires_at,
         created_by = excluded.created_by,
         created_at = excluded.created_at;

  return json_build_object(
    'user_id', v_uid,
    'email', v_email,
    'price_dzd', p_dzd,
    'price_usd', round(p_usd, 2),
    'expires_at', v_until,
    -- عندو Premium من قبل → الخادم يرفض الدفع (already_premium): نبّه الأدمن
    'already_premium', public.has_profile_premium(v_uid) or public.has_lifetime_purchase(v_uid)
  );
end;
$$;

-- إيقاف قبل الوقت: expires_at = الآن (بلا مسح)
create or replace function public.admin_stop_test_price(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.admin_assert();
  update public.pricing_test_prices set expires_at = now()
   where user_id = p_user and expires_at > now();
end;
$$;

-- أسعار التجربة النشطة
create or replace function public.admin_test_prices()
returns table (user_id uuid, email text, price_dzd integer, price_usd numeric, expires_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  perform public.admin_assert();
  return query
    select t.user_id, coalesce(u.email, p.email)::text, t.price_dzd, t.price_usd, t.expires_at
      from public.pricing_test_prices t
      left join auth.users u on u.id = t.user_id
      left join public.profiles p on p.id = t.user_id
     where t.expires_at > now()
     order by t.expires_at desc;
end;
$$;

-- ===================== 4) المنح يقبل tier = 'test' =====================
create or replace function public.grant_lifetime_purchase(
  p_provider    text,
  p_ref         text,
  p_user        uuid,
  p_amount      numeric,
  p_currency    text,
  p_tier        text,
  p_payment_ref text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id       bigint;
  v_cur      text := upper(btrim(coalesce(p_currency, '')));
  v_owner    uuid;
  v_inv      public.slickpay_invoices%rowtype;
  v_ord      public.paypal_orders%rowtype;
begin
  if p_provider is null or p_provider not in ('stripe', 'slickpay', 'paypal', 'google_play') then
    raise exception 'unknown provider';
  end if;
  if p_tier is null or p_tier not in ('launch', 'regular', 'test') then
    raise exception 'invalid tier';
  end if;
  if p_user is null or coalesce(btrim(p_ref), '') = '' then
    raise exception 'invalid reference';
  end if;
  if p_amount is null or p_amount < 0 or v_cur !~ '^[A-Z]{3}$' then
    raise exception 'invalid amount';
  end if;

  if p_provider = 'slickpay' then
    select * into v_inv from public.slickpay_invoices where invoice_id = p_ref for update;
    if not found then
      raise exception 'unknown invoice';
    end if;
    if v_inv.user_id is distinct from p_user or v_inv.tier is distinct from p_tier
       or v_inv.amount::numeric <> p_amount or v_cur <> 'DZD' then
      raise exception 'invoice mismatch';
    end if;
    update public.slickpay_invoices
       set status = 'completed', completed_at = coalesce(completed_at, now())
     where invoice_id = p_ref;
  elsif p_provider = 'paypal' then
    select * into v_ord from public.paypal_orders where order_id = p_ref for update;
    if not found then
      raise exception 'unknown order';
    end if;
    if v_ord.user_id is distinct from p_user or v_ord.tier is distinct from p_tier
       or v_ord.amount_usd <> p_amount or v_cur <> 'USD' then
      raise exception 'order mismatch';
    end if;
    update public.paypal_orders
       set status = 'completed', completed_at = coalesce(completed_at, now())
     where order_id = p_ref;
  end if;

  insert into public.purchases (user_id, provider, provider_ref, payment_ref, amount, currency, tier)
  values (p_user, p_provider, p_ref, nullif(btrim(coalesce(p_payment_ref, '')), ''), p_amount, v_cur, p_tier)
  on conflict (provider_ref) do nothing
  returning id into v_id;

  if v_id is null then
    select user_id into v_owner from public.purchases where provider_ref = p_ref;
    if v_owner is distinct from p_user then
      raise exception 'reference belongs to another account' using errcode = '42501';
    end if;
    return 'duplicate';
  end if;

  update public.profiles
     set is_premium = true,
         premium_until = null,
         plan_type = 'lifetime',
         payment_provider = p_provider,
         subscription_status = 'lifetime',
         slickpay_invoice_id = case when p_provider = 'slickpay' then p_ref else slickpay_invoice_id end
   where id = p_user;
  if not found then
    raise exception 'profile not found for %', p_user;  -- يلغي التسجيل أيضاً
  end if;
  return 'granted';
end;
$$;

-- ===================== 5) المبيعات بلا 'test' =====================
create or replace function public.admin_sales_stats()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  tz     constant text := 'Africa/Algiers';
  v_from timestamp := date_trunc('day', now() at time zone tz) - interval '29 days';
begin
  perform public.admin_assert();
  return (
    with sales as (
      select p.* from public.purchases p
       where p.tier <> 'test'
         and not exists (select 1 from public.profiles pr where pr.id = p.user_id and pr.is_admin = true)
    ),
    active as (select * from sales where refunded_at is null)
    select json_build_object(
      'buyers', (select count(distinct user_id) from active),
      'purchases', (select count(*) from active),
      'refunded', (select count(*) from sales where refunded_at is not null),
      'tests', (select count(*) from public.purchases where tier = 'test'),
      'revenue', coalesce((select json_agg(json_build_object('currency', currency, 'amount', amount, 'n', n) order by currency)
                             from (select currency, sum(amount) as amount, count(*) as n from active group by currency) r), '[]'::json),
      'refunded_amount', coalesce((select json_agg(json_build_object('currency', currency, 'amount', amount) order by currency)
                             from (select currency, sum(amount) as amount from sales where refunded_at is not null group by currency) r), '[]'::json),
      'by_provider', coalesce((select json_object_agg(provider, n)
                             from (select provider, count(*) as n from active group by provider) r), '{}'::json),
      'by_tier', coalesce((select json_object_agg(tier, n)
                             from (select tier, count(*) as n from active group by tier) r), '{}'::json),
      'after_gift', (
        select count(distinct g.user_id) from public.gift_redemptions g
         where g.user_id is not null
           and exists (select 1 from active a where a.user_id = g.user_id and a.purchased_at > g.redeemed_at)),
      'after_free_key', (
        select count(distinct r.user_id) from public.free_reveals r
         where r.user_id is not null
           and exists (select 1 from active a where a.user_id = r.user_id and a.purchased_at > r.created_at)),
      'series', coalesce((
        select json_agg(json_build_object(
                 't', to_char(g.b, 'YYYY-MM-DD"T"HH24:MI'),
                 'n', (select count(*) from active a where date_trunc('day', a.purchased_at at time zone tz) = g.b)
               ) order by g.b)
          from generate_series(v_from, date_trunc('day', now() at time zone tz), interval '1 day') as g(b)
      ), '[]'::json),
      'pricing', public.pricing_public()
    )
  );
end;
$$;

-- "اشتروا بعد المفتاح" بلا مشتريات التجربة
create or replace function public.admin_free_key_stats()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  tz      constant text := 'Africa/Algiers';
  v_today timestamptz := public.admin_range_start('today');
  v_7d    timestamptz := public.admin_range_start('7d');
  v_from  timestamp := date_trunc('day', now() at time zone tz) - interval '29 days';
begin
  perform public.admin_assert();
  return json_build_object(
    'enabled', public.free_key_enabled(),
    'today', (select count(*) from public.free_reveals where created_at >= v_today),
    'week', (select count(*) from public.free_reveals where created_at >= v_7d),
    'total', (select count(*) from public.free_reveals),
    'series_unit', 'day',
    'series', coalesce((
      select json_agg(json_build_object(
               't', to_char(g.b, 'YYYY-MM-DD"T"HH24:MI'),
               'reveals', (select count(*) from public.free_reveals r
                            where date_trunc('day', r.created_at at time zone tz) = g.b)
             ) order by g.b)
        from generate_series(v_from, date_trunc('day', now() at time zone tz), interval '1 day') as g(b)
    ), '[]'::json),
    'top_companies', coalesce((
      select json_agg(t) from (
        select c.id, c.name, c.logo, c.type, count(*) as n
          from public.free_reveals r join public.companies c on c.id = r.company_id
         group by c.id, c.name, c.logo, c.type
         order by n desc, c.name
         limit 8
      ) t
    ), '[]'::json),
    -- شراء Premium مدى الحياة (كل البوابات، غير مستردّ، ماشي تجربة) بعد تاريخ الكشف.
    'converted', (
      select count(*) from public.free_reveals r
       where r.user_id is not null
         and exists (select 1 from public.purchases pu
                      where pu.user_id = r.user_id and pu.refunded_at is null and pu.tier <> 'test'
                        and pu.purchased_at > r.created_at)
         and not exists (select 1 from public.profiles pr where pr.id = r.user_id and pr.is_admin = true)
    ),
    -- تنبيه برك (بلا حبس): أكثر من 5 كشوفات من نفس بصمة IP في نفس اليوم، آخر 30 يوم
    'ip_alerts', coalesce((
      select json_agg(t) from (
        select left(r.ip_hash, 12) as ip,
               to_char(date_trunc('day', r.created_at at time zone tz), 'YYYY-MM-DD') as day,
               count(*) as n,
               (array_agg(coalesce(u.email, p.email)::text order by r.created_at desc))[1:10] as emails
          from public.free_reveals r
          left join auth.users u on u.id = r.user_id
          left join public.profiles p on p.id = r.user_id
         where r.ip_hash is not null and r.created_at >= now() - interval '30 days'
         group by r.ip_hash, 2
        having count(*) > 5
         order by 2 desc, 3 desc
         limit 50
      ) t
    ), '[]'::json)
  );
end;
$$;

-- ===================== 6) الصلاحيات =====================
revoke all on function public.pricing_for_user(uuid) from public, anon, authenticated;
revoke all on function public.my_pricing() from public;
revoke all on function public.admin_set_test_price(text, integer, numeric) from public, anon;
revoke all on function public.admin_stop_test_price(uuid) from public, anon;
revoke all on function public.admin_test_prices() from public, anon;

grant execute on function public.pricing_for_user(uuid) to service_role;
grant execute on function public.my_pricing() to anon, authenticated, service_role;
grant execute on function public.admin_set_test_price(text, integer, numeric) to authenticated;
grant execute on function public.admin_stop_test_price(uuid) to authenticated;
grant execute on function public.admin_test_prices() to authenticated;

notify pgrst, 'reload schema';
