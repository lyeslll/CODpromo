-- ============================================================
--  CODpromo — الرجوع من phase "coming-soon" (supabase-phase-coming-soon.sql)
--
--  ⚠️ رجّع الموقع قبل (git revert -m 1 <commit الدمج> ثم git push): الواجهة الجديدة تقرا coming_soon.
--
--  الجزء 1 (بلا DROP — آمن): يرجّع الدوال الخمسة كيما كانو في الإنتاج قبل هاد الـ phase
--  (pg_get_functiondef، 25 أكتوبر 2026) ويطفي الـ triggers الجداد. البيانات تبقى كيما راهي.
--  الجزء 2 (فيه DROP — بقرار المالك برك): ينحّي كل واش تزاد (الجدول، الدوال، القواعد، الأعمدة).
--  البطاقات القريبة تولّي شركات عادية بلا كود → بدّلها ولا خبّيها قبل الجزء 2.
-- ============================================================

-- ===================== الجزء 1: الدوال القديمة (بلا DROP) =====================

CREATE OR REPLACE FUNCTION public.site_stats_auto()
 RETURNS TABLE(codes integer, partners integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    (
      (select count(*) from public.companies c
         where public.company_is_public(c.status)
           and c.code is not null and btrim(c.code) <> '')
      +
      (select count(*) from public.companies c
         where public.company_is_public(c.status)
           and coalesce(c.supports_premium, true)
           and c.premium_code is not null and btrim(c.premium_code) <> '')
    )::integer,
    (select count(*) from public.companies c where public.company_is_public(c.status))::integer;
$function$;

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
    -- الشركات والعروض الظاهرة في الموقع برك (نفس site_stats_auto)، والمخفية وحدها
    'companies', (select count(*) from public.companies c where public.company_is_public(c.status)),
    'companies_hidden', (select count(*) from public.companies c where not public.company_is_public(c.status)),
    'offers', (
      (select count(*) from public.companies c
         where public.company_is_public(c.status) and coalesce(btrim(c.code), '') <> '')
      + (select count(*) from public.companies c
         where public.company_is_public(c.status)
           and coalesce(c.supports_premium, true) and coalesce(btrim(c.premium_code), '') <> '')
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

CREATE OR REPLACE FUNCTION public.notify_on_company()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  begin
    if not public.company_is_public(new.status) then
      return new; -- الشركات المخفية: حتى إشعار
    end if;

    -- شركة جديدة، ولا مخفية ترجع تبان (أول مرة برك: الفهرس الفريد)
    if tg_op = 'INSERT' or not public.company_is_public(old.status) then
      insert into public.notifications (kind, company_id, is_auto, push_after)
      values ('company', new.id, true, now() + interval '2 minutes')
      on conflict (company_id) where is_auto and kind = 'company' do nothing;
      return new;
    end if;

    -- كود عادي جديد (مرة كل 12 ساعة لكل شركة كأقصى — حتى إشعار "شركة جديدة" يحسب)
    if new.code is distinct from old.code and nullif(btrim(coalesce(new.code, '')), '') is not null
       and not exists (
         select 1 from public.notifications x
          where x.company_id = new.id and x.is_auto and x.kind in ('company', 'code')
            and x.created_at > now() - interval '12 hours') then
      insert into public.notifications (kind, company_id, is_auto, push_after)
      values ('code', new.id, true, now() + interval '2 minutes');
    end if;

    -- كود Premium تزاد (الكود نفسو ما يتقراش: الإشعار يقول "كاين" برك)
    if coalesce(new.has_premium_code, false) and not coalesce(old.has_premium_code, false)
       and not exists (
         select 1 from public.notifications x
          where x.company_id = new.id and x.is_auto and x.kind in ('company', 'premium_code')
            and x.created_at > now() - interval '12 hours') then
      insert into public.notifications (kind, company_id, is_auto, push_after)
      values ('premium_code', new.id, true, now() + interval '2 minutes');
    end if;
  exception when others then
    raise warning 'notify_on_company: %', sqlerrm;
  end;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.notifications_feed(p_limit integer DEFAULT 30, p_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_all boolean DEFAULT false)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid   uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 30), 1), 60);
  v_p     public.notification_prefs;
  v_items json;
begin
  if v_uid is not null then
    select * into v_p from public.notification_prefs p where p.user_id = v_uid;
  end if;

  select coalesce(json_agg(x.j order by x.published_at desc, x.id desc), '[]'::json) into v_items
    from (
      select n.id, n.published_at,
             (public.notif_json(n)::jsonb
               || jsonb_build_object('read', v_uid is not null and exists (
                    select 1 from public.notification_reads r where r.user_id = v_uid and r.notification_id = n.id)))::json as j
        from public.notifications n
       where public.notif_visible(n)
         and (p_before is null or n.published_at < p_before)
         and (coalesce(p_all, false) or public.notif_matches(n, v_uid, v_p.scope, v_p.categories))
       order by n.published_at desc, n.id desc
       limit v_limit
    ) x;

  return json_build_object(
    'items', v_items,
    'read_all_before', v_p.read_all_before,
    'scope', coalesce(v_p.scope, 'all')
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.push_batch_targets(p_batch bigint, p_after bigint DEFAULT 0, p_limit integer DEFAULT 200)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  b       public.push_batches;
  v_last  bigint;
  v_items json;
begin
  select * into b from public.push_batches where id = p_batch and state = 'sending';
  if not found then
    return json_build_object('last', null, 'items', '[]'::json);
  end if;
  select max(t.id),
         coalesce(json_agg(json_build_object('id', t.id, 'endpoint', t.endpoint, 'p256dh', t.p256dh, 'auth', t.auth,
                                             'lang', t.lang, 'ids', t.ids) order by t.id)
                    filter (where b.test_user is not null or cardinality(t.ids) > 0), '[]'::json)
    into v_last, v_items
    from (
      select s.id, s.endpoint, s.p256dh, s.auth, s.lang,
             case when b.test_user is not null then '{}'::bigint[]
                  else array(select n.id from public.notifications n
                              where n.id = any(b.notification_ids)
                                and public.notif_matches(n, s.user_id, p.scope, p.categories)
                              order by n.published_at, n.id) end as ids
        from public.push_subscriptions s
        left join public.notification_prefs p on p.user_id = s.user_id
       where s.active and s.id > coalesce(p_after, 0)
         and (b.test_user is null or s.user_id = b.test_user)
         and (b.mode <> 'test' or exists (select 1 from public.profiles pr where pr.id = s.user_id and pr.is_admin = true))
       order by s.id
       limit least(greatest(coalesce(p_limit, 200), 1), 500)
    ) t;
  return json_build_object('last', v_last, 'items', v_items);
end;
$function$;

alter table public.companies disable trigger notify_company_waiters;
alter table public.companies disable trigger coming_soon_guard;

-- ===================== الجزء 2: ينحّي الجديد (فيه DROP — بقرار المالك برك) =====================
-- begin;
-- drop trigger if exists notify_company_waiters on public.companies;
-- drop trigger if exists coming_soon_guard on public.companies;
-- drop function if exists public.coming_soon_went_live();
-- drop function if exists public.coming_soon_guard();
-- drop function if exists public.admin_coming_soon();
-- drop function if exists public.coming_soon_board();
-- drop function if exists public.my_coming_soon_waits();
-- drop function if exists public.coming_soon_wait(bigint, boolean);
-- drop function if exists public.coming_soon_count(bigint);
-- drop table if exists public.coming_soon_waits;
-- alter table public.companies drop constraint if exists companies_soon_no_codes;
-- alter table public.companies drop constraint if exists companies_premium_soon_needs_soon;
-- alter table public.companies drop column if exists coming_soon_since;
-- alter table public.companies drop column if exists premium_coming_soon;
-- alter table public.companies drop column if exists coming_soon;
-- commit;
