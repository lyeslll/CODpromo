-- ============================================================
--  CODpromo — الرجوع من phase visible-counts (ما يتشغّلش إلا بطلب المالك).
--  يرجّع site_stats_auto() و admin_overview() كيما كانو حرف بحرف (يحسبو حتى المخفية)،
--  و policy الإخفاء بالشرط المكتوب داخلها. الدالة company_is_public تبقى (ما تأثّر على والو) — بلا DROP.
-- ============================================================

create or replace function public.site_stats_auto()
returns table (codes integer, partners integer)
language sql
security definer
stable
set search_path = public
as $$
  select
    (
      (select count(*) from public.companies c
         where c.code is not null and btrim(c.code) <> '')
      +
      (select count(*) from public.companies c
         where coalesce(c.supports_premium, true)
           and c.premium_code is not null and btrim(c.premium_code) <> '')
    )::integer,
    (select count(*) from public.companies)::integer;
$$;

revoke all on function public.site_stats_auto() from public;
grant execute on function public.site_stats_auto() to anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_overview(p_range text DEFAULT '7d'::text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    -- أعضاء Premium حقيقيين: بلا الأدمن، وبلا اللي Premium تاعهم جاي غير من شراء تجربة (tier = 'test')
    'premium_active', (
      select count(*) from public.profiles p
      where coalesce(p.is_admin, false) = false
        and p.is_premium = true and (p.premium_until is null or p.premium_until > now())
        and not (
          exists (select 1 from public.purchases pu
                   where pu.user_id = p.id and pu.refunded_at is null and pu.tier = 'test')
          and not exists (select 1 from public.purchases pu
                           where pu.user_id = p.id and pu.refunded_at is null and pu.tier <> 'test')
        )
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
$function$;

do $$
begin
  if exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'companies' and policyname = 'companies hidden from visitors'
  ) then
    alter policy "companies hidden from visitors" on public.companies
      using (coalesce(status, 'active') <> 'hidden' or (select public.is_admin()));
  end if;
end $$;

notify pgrst, 'reload schema';
