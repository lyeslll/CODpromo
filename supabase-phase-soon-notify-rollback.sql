-- ============================================================
--  CODpromo — الرجوع من phase "soon-notify" (إشعار "قريباً على CODpromo" في الجرس)
--
--  الجزء 1 (بلا DROP / DELETE): يوقّف الـ cron، يخبّي إشعارات "قريباً" (ما يتمسحوش)، ويرجّع الدوال الستة
--  كيما كانو قبل (نسخة حرفية من الإنتاج، 26 أكتوبر 2026). الجدول الجديد والدوال الجداد يبقاو (ما يضرّوش:
--  حتى واحد ما ينادي عليهم من بعد). الواجهة القديمة (git revert) تخدم مع هادي.
--  الجزء 2 (فيه DELETE / DROP — بقرار المالك برك، بعد الجزء 1): في تعليق تحت.
-- ============================================================

begin;

-- 1) الـ cron
do $$
begin
  if exists (select 1 from cron.job where jobname = 'codpromo-soon-notices') then
    perform cron.unschedule('codpromo-soon-notices');
  end if;
end $$;

-- 2) إشعارات "قريباً": مخفية (الجرس و /new ما يبيّنوهمش)
update public.notifications set is_hidden = true, updated_at = now() where kind = 'coming_soon' and not is_hidden;

-- 3) الدوال كيما كانو قبل phase soon-notify
-- notif_visible(notifications)
CREATE OR REPLACE FUNCTION public.notif_visible(n notifications)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select not n.is_hidden
     and n.published_at <= now()
     and (n.company_id is null or exists (
           select 1 from public.companies c where c.id = n.company_id and public.company_is_public(c.status)))
     and (n.deal_id is null or public.notif_deal_live(n.deal_id));
$function$
;

-- notif_matches(notifications,uuid,text,uuid[])
CREATE OR REPLACE FUNCTION public.notif_matches(n notifications, p_user uuid, p_scope text, p_categories uuid[])
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case
    when n.kind in ('feature', 'announcement') or p_user is null or coalesce(p_scope, 'all') = 'all' then true
    when p_scope = 'categories' then coalesce((
      select coalesce(c.category_id, d.category_id) = any(coalesce(p_categories, '{}'))
        from (select 1) one
        left join public.companies c on c.id = n.company_id
        left join public.nocode_deals d on d.id = n.deal_id), false)
    when p_scope = 'favorites' then exists (
      select 1 from public.favorites f
       where f.user_id = p_user
         and f.company_id = coalesce(n.company_id, (select d.company_id from public.nocode_deals d where d.id = n.deal_id)))
    else true
  end;
$function$
;

-- notif_json(notifications)
CREATE OR REPLACE FUNCTION public.notif_json(n notifications)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select json_build_object(
    'id', n.id, 'kind', n.kind, 'published_at', n.published_at,
    'title', n.title, 'title_en', n.title_en, 'title_fr', n.title_fr,
    'body', n.body, 'body_en', n.body_en, 'body_fr', n.body_fr,
    'url', coalesce(n.url,
                    case when c.slug is not null then '/store/' || c.slug
                         when n.deal_id is not null then '/offers?kind=nocode'
                         else '/new' end),
    'company', case when c.id is null then null else json_build_object(
      'id', c.id, 'name', c.name, 'slug', c.slug, 'logo', c.logo, 'logo_bg', c.logo_bg, 'type', c.type,
      'discount', c.discount, 'discount_en', c.discount_en, 'discount_fr', c.discount_fr,
      'premium_discount', c.premium_discount, 'premium_discount_en', c.premium_discount_en,
      'premium_discount_fr', c.premium_discount_fr) end,
    'deal', case when d.id is null then null else json_build_object(
      'id', d.id, 'name', d.name, 'slug', d.slug, 'logo', d.logo_url,
      'reward', d.reward, 'reward_en', d.reward_en, 'reward_fr', d.reward_fr) end
  )
  from (select 1) one
  left join public.companies c on c.id = n.company_id
  left join public.nocode_deals d on d.id = n.deal_id;
$function$
;

-- push_batch_targets(bigint,bigint,integer)
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
                                             'lang', t.lang, 'ids', t.ids, 'waited', t.waited) order by t.id)
                    filter (where b.test_user is not null or cardinality(t.ids) > 0), '[]'::json)
    into v_last, v_items
    from (
      select s.id, s.endpoint, s.p256dh, s.auth, s.lang,
             case when b.test_user is not null then '{}'::bigint[]
                  else array(select n.id from public.notifications n
                              where n.id = any(b.notification_ids)
                                and public.notif_visible(n)
                                and (public.notif_matches(n, s.user_id, p.scope, p.categories)
                                     or (s.user_id is not null and exists (
                                           select 1 from public.coming_soon_waits w
                                            where w.user_id = s.user_id and w.notification_id = n.id)))
                              order by n.published_at, n.id) end as ids,
             case when b.test_user is not null or s.user_id is null then '{}'::bigint[]
                  else array(select w.notification_id from public.coming_soon_waits w
                               join public.notifications n on n.id = w.notification_id
                              where w.user_id = s.user_id and w.notification_id = any(b.notification_ids)
                                and public.notif_visible(n)
                              order by w.notification_id) end as waited
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
$function$
;

-- app_push_batch_targets(bigint,bigint,integer)
CREATE OR REPLACE FUNCTION public.app_push_batch_targets(p_batch bigint, p_after bigint DEFAULT 0, p_limit integer DEFAULT 200)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  b       public.app_push_batches;
  v_last  bigint;
  v_items json;
begin
  select * into b from public.app_push_batches where id = p_batch and state = 'sending';
  if not found then
    return json_build_object('last', null, 'items', '[]'::json);
  end if;
  select max(t.id),
         coalesce(json_agg(json_build_object('id', t.id, 'token', t.token, 'lang', t.lang, 'ids', t.ids, 'waited', t.waited) order by t.id)
                    filter (where b.test_user is not null or cardinality(t.ids) > 0), '[]'::json)
    into v_last, v_items
    from (
      select s.id, s.token, s.lang,
             case when b.test_user is not null then '{}'::bigint[]
                  else array(select n.id from public.notifications n
                              where n.id = any(b.notification_ids)
                                and public.notif_visible(n)
                                and (public.notif_matches(n, s.user_id, p.scope, p.categories)
                                     or (s.user_id is not null and exists (
                                           select 1 from public.coming_soon_waits w
                                            where w.user_id = s.user_id and w.notification_id = n.id)))
                              order by n.published_at, n.id) end as ids,
             case when b.test_user is not null or s.user_id is null then '{}'::bigint[]
                  else array(select w.notification_id from public.coming_soon_waits w
                               join public.notifications n on n.id = w.notification_id
                              where w.user_id = s.user_id and w.notification_id = any(b.notification_ids)
                                and public.notif_visible(n)
                              order by w.notification_id) end as waited
        from public.app_push_tokens s
        left join public.notification_prefs p on p.user_id = s.user_id
       where s.active and s.id > coalesce(p_after, 0)
         and (b.test_user is null or s.user_id = b.test_user)
         and (b.mode <> 'test' or exists (select 1 from public.profiles pr where pr.id = s.user_id and pr.is_admin = true))
       order by s.id
       limit least(greatest(coalesce(p_limit, 200), 1), 500)
    ) t;
  return json_build_object('last', v_last, 'items', v_items);
end;
$function$
;

-- admin_create_notification(text,bigint,bigint,text,text,text,text,text,text,text,boolean)
CREATE OR REPLACE FUNCTION public.admin_create_notification(p_kind text, p_company_id bigint DEFAULT NULL::bigint, p_deal_id bigint DEFAULT NULL::bigint, p_title text DEFAULT NULL::text, p_title_en text DEFAULT NULL::text, p_title_fr text DEFAULT NULL::text, p_body text DEFAULT NULL::text, p_body_en text DEFAULT NULL::text, p_body_fr text DEFAULT NULL::text, p_url text DEFAULT NULL::text, p_push boolean DEFAULT true)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id bigint;
begin
  perform public.admin_assert();
  if p_kind is null or p_kind not in ('company', 'code', 'premium_code', 'deal', 'feature', 'announcement') then
    return json_build_object('status', 'invalid');
  end if;
  -- فوق CHECK الجدول: بلا ' ولا ` في الرابط (حتى بلاصة تقبلهم)
  if coalesce(p_url, '') ~ '[''`]' then
    return json_build_object('status', 'invalid');
  end if;
  if p_kind in ('company', 'code', 'premium_code') then
    if p_company_id is null or not exists (select 1 from public.companies c where c.id = p_company_id) then
      return json_build_object('status', 'invalid');
    end if;
    if exists (select 1 from public.companies c where c.id = p_company_id and not public.company_is_public(c.status)) then
      return json_build_object('status', 'hidden');
    end if;
  end if;
  if p_kind = 'deal' and (p_deal_id is null or not exists (select 1 from public.nocode_deals d where d.id = p_deal_id)) then
    return json_build_object('status', 'invalid');
  end if;
  if (select count(*) from public.notifications n where not n.is_auto and n.created_at > now() - interval '1 hour') >= 30 then
    return json_build_object('status', 'rate_limited');
  end if;

  insert into public.notifications (kind, company_id, deal_id, title, title_en, title_fr, body, body_en, body_fr,
                                    url, is_auto, push, push_after, created_by)
  values (p_kind,
          case when p_kind in ('company', 'code', 'premium_code') then p_company_id end,
          case when p_kind = 'deal' then p_deal_id end,
          nullif(btrim(p_title), ''), nullif(btrim(p_title_en), ''), nullif(btrim(p_title_fr), ''),
          nullif(btrim(p_body), ''), nullif(btrim(p_body_en), ''), nullif(btrim(p_body_fr), ''),
          nullif(btrim(p_url), ''), false, coalesce(p_push, true), now() + interval '1 minute', auth.uid())
  returning id into v_id;
  return json_build_object('status', 'ok', 'id', v_id);
exception when check_violation then
  return json_build_object('status', 'invalid');
end;
$function$
;

revoke all on function public.notif_visible(public.notifications) from public, anon, authenticated;
revoke all on function public.notif_matches(public.notifications, uuid, text, uuid[]) from public, anon, authenticated;
revoke all on function public.notif_json(public.notifications) from public, anon, authenticated;
revoke all on function public.push_batch_targets(bigint, bigint, integer) from public, anon, authenticated;
grant execute on function public.push_batch_targets(bigint, bigint, integer) to service_role;
revoke all on function public.app_push_batch_targets(bigint, bigint, integer) from public, anon, authenticated;
grant execute on function public.app_push_batch_targets(bigint, bigint, integer) to service_role;
revoke all on function public.admin_create_notification(text, bigint, bigint, text, text, text, text, text, text, text, boolean) from public, anon;
grant execute on function public.admin_create_notification(text, bigint, bigint, text, text, text, text, text, text, text, boolean) to authenticated;

commit;

notify pgrst, 'reload schema';

-- ===================== الجزء 2 — بقرار المالك برك (فيه DELETE / DROP) =====================
-- begin;
-- delete from public.notifications where kind = 'coming_soon';
-- drop table if exists public.coming_soon_notice_cards;
-- drop function if exists public.coming_soon_notices_due();
-- drop function if exists public.coming_soon_push_muted(public.notifications, uuid, boolean);
-- drop function if exists public.coming_soon_notice_view(bigint);
-- drop function if exists public.coming_soon_notice_members(bigint);
-- drop function if exists public.coming_soon_url_q(text);
-- drop function if exists public.coming_soon_common_name(text[]);
-- drop function if exists public.coming_soon_group(bigint);
-- alter table public.notifications drop constraint if exists notifications_soon_no_push;
-- alter table public.notifications drop constraint if exists notifications_kind_check;
-- alter table public.notifications add constraint notifications_kind_check
--   check (kind in ('company', 'code', 'premium_code', 'deal', 'feature', 'announcement'));
-- alter table public.notifications drop constraint if exists notifications_target;
-- alter table public.notifications add constraint notifications_target check (
--   (kind in ('company', 'code', 'premium_code') and company_id is not null)
--   or (kind = 'deal' and deal_id is not null)
--   or (kind in ('feature', 'announcement') and title is not null and char_length(btrim(title)) > 0));
-- commit;
