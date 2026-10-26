-- ============================================================
--  CODpromo — phase "soon-notify" (2/2): إشعار "قريباً على CODpromo" في الجرس لبطاقات "العرض قريباً"
--
--  1) بطاقة "قريباً" تتزاد (ولا شركة تولّي "قريباً"، ولا قريبة مخفية ترجع تبان) → إشعار تلقائي في الجرس برك
--     (kind = coming_soon، بلا هاتف أبداً: CHECK notifications_soon_no_push). مرة وحدة في حياة البطاقة
--     (coming_soon_notice_cards). الشركات المخفية: والو (والإشعار يختفي كي ما تبقى حتى بطاقة قريبة ظاهرة فيه).
--  2) البطاقات اللي عندهم نفس "رابط الموقع الرسمي" (company_private.website_url، نفس الدومين مع فروعه) =
--     إشعار واحد بالاسم المشترك (مثلاً "MDM Express")؛ بطاقة جديدة لنفس الشركة في 24 ساعة = تتزاد للإشعار
--     اللي كاين (ماشي إشعار جديد). الرابط: بطاقة وحدة = صفحتها، عدّة = /offers?soon=1&q=<الاسم المشترك>.
--     الدومين نفسو ما يخرجش للعموم (company_private للأدمين برك): الاسم المشترك برك.
--  3) cron كل دقيقة (codpromo-soon-notices → coming_soon_notices_due): البطاقة تتعالج دقيقتين بعد ما ولّات
--     "قريباً" — الأدمين يحفظ الشركة ومن بعد company_private، هكذا الدومين معروف وقت التجميع.
--  4) التفعيل (قريباً ← عرض) ما تبدّلش: إشعار "شركة جديدة" واحد للكل (الجرس + الهاتف، 8 دفعات / 24 ساعة)،
--     واللي ضغطو "أعلمني" مربوطين بنفس الإشعار ("العرض الذي كنت تنتظره هنا") = push واحد. وزيد: اللي وصلو
--     push "كنت تنتظره" على بطاقة من نفس الشركة في 24 ساعة ما يوصلوش push آخر على بطاقة أخرى منها (الجرس يبقى).
--  5) الأدمين: admin_create_notification يقبل coming_soon (بطاقة قريبة ظاهرة برك، بلا هاتف ديما).
--
--  جديد: جدول + 9 دوال + CHECK + cron. create or replace لـ 6 دوال موجودة بنفس التوقيع (notif_visible،
--  notif_matches، notif_json، push_batch_targets، app_push_batch_targets، admin_create_notification).
--  حتى دالة تاع "أعلمني" ولا عدّادو ولا حدّ الـ 8 ما تبدّلت. بلا DROP / DELETE / TRUNCATE.
--  يتشغّل بعد supabase-phase-soon-notify-kind.sql (النوع coming_soon) و phase-app-push. idempotent.
--  الرجوع: supabase-phase-soon-notify-rollback.sql
-- ============================================================

-- ===================== 1) البطاقات اللي تعالجت =====================
--  سطر لكل بطاقة قريبة تعالجت (مرة وحدة في حياتها). notification_id = الإشعار اللي فيه (null = بلا إشعار).
--  grp = مجموعة "الموقع الرسمي" وقت المعالجة (site:<دومين> / host:<دومين كامل> / card:<id> = وحدها).
create table if not exists public.coming_soon_notice_cards (
  company_id      bigint primary key references public.companies (id) on delete cascade,
  notification_id bigint references public.notifications (id) on delete set null,
  grp             text not null,
  added_at        timestamptz not null default now()
);
create index if not exists coming_soon_notice_cards_notification on public.coming_soon_notice_cards (notification_id) where notification_id is not null;
create index if not exists coming_soon_notice_cards_grp on public.coming_soon_notice_cards (grp, added_at desc);

alter table public.coming_soon_notice_cards enable row level security;
revoke all on public.coming_soon_notice_cards from anon, authenticated;

-- "قريباً" = الجرس برك: حتى push (Web ولا التطبيق) ما يقدر يخرج، حتى بخطأ في دالة
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.notifications'::regclass and conname = 'notifications_soon_no_push') then
    alter table public.notifications add constraint notifications_soon_no_push
      check (kind <> 'coming_soon' or (not push and push_state = 'skipped'));
  end if;
end $$;

-- ===================== 2) أدوات =====================
-- مجموعة "الموقع الرسمي" لبطاقة: الدومين مع فروعه (app.mdm.express = mdm.express). بلا رابط، رابط غريب،
-- ولا شبكة اجتماعية / رابط مختصر (كل واحد عندو صفحة فيها) = البطاقة وحدها. منصّات المتاجر (x.myshopify.com…)
-- = الدومين الكامل (كل متجر وحدو).
create or replace function public.coming_soon_group(p_company bigint)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
           when y.h is null or y.h !~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$' then 'card:' || p_company
           when public.coming_soon_domain_group(y.h) = any (array[
             'facebook.com', 'fb.com', 'fb.me', 'instagram.com', 'tiktok.com', 'youtube.com', 'youtu.be', 'x.com',
             'twitter.com', 'linkedin.com', 't.me', 'telegram.me', 'telegram.org', 'wa.me', 'whatsapp.com', 'linktr.ee',
             'beacons.ai', 'bio.link', 'google.com', 'apple.com', 'bit.ly', 'tinyurl.com', 'goo.gl', 'snapchat.com',
             'pinterest.com', 'threads.net']) then 'card:' || p_company
           when public.coming_soon_domain_group(y.h) = any (array[
             'myshopify.com', 'youcan.shop', 'wixsite.com', 'blogspot.com', 'wordpress.com', 'github.io', 'vercel.app',
             'netlify.app', 'pages.dev', 'web.app', 'firebaseapp.com', 'herokuapp.com', 'webflow.io', 'square.site',
             'mystrikingly.com', 'carrd.co', 'odoo.com', 'lightfunnels.com', 'storeino.com', 'zid.store', 'expandcart.com',
             'notion.site', 'framer.website']) then 'host:' || y.h
           else 'site:' || public.coming_soon_domain_group(y.h)
         end
    from (select rtrim(regexp_replace(substring(x.u from '^[a-z][a-z0-9+.-]*://(?:[^/?#@]*@)?([^/:?#]+)'), '^www\.', ''), '.') as h
            from (select case when btrim(coalesce(p.website_url, '')) = '' then null
                              when lower(btrim(p.website_url)) ~ '^[a-z][a-z0-9+.-]*://' then lower(btrim(p.website_url))
                              else 'https://' || lower(btrim(p.website_url)) end as u
                    from (select 1) one
                    left join public.company_private p on p.company_id = p_company) x) y;
$$;

-- الاسم المشترك: الكلمات الأولى اللي يتشاركو فيهم الأسماء الكل (بلا فرق الحروف الكبيرة)، بلا فاصل في الآخر.
-- "MDM Express Libya" + "MDM Express Iraq" = "MDM Express". اسم واحد = هو. بلا كلمة مشتركة = null.
create or replace function public.coming_soon_common_name(p_names text[])
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_names text[];
  v_first text[];
  v_words text[];
  v_name  text;
  v_k     integer;
  v_i     integer;
  v_out   text;
begin
  select array_agg(btrim(x)) into v_names from unnest(coalesce(p_names, '{}'::text[])) x where nullif(btrim(x), '') is not null;
  if v_names is null then
    return null;
  end if;
  if cardinality(v_names) = 1 then
    return v_names[1];
  end if;
  v_first := regexp_split_to_array(v_names[1], '\s+');
  v_k := cardinality(v_first);
  foreach v_name in array v_names[2:] loop
    v_words := regexp_split_to_array(v_name, '\s+');
    v_i := 0;
    while v_i < v_k and v_i < cardinality(v_words) and lower(v_first[v_i + 1]) = lower(v_words[v_i + 1]) loop
      v_i := v_i + 1;
    end loop;
    v_k := v_i;
  end loop;
  if v_k = 0 then
    return null;
  end if;
  v_out := btrim(regexp_replace(array_to_string(v_first[1:v_k], ' '), '[[:space:][:punct:]–—·]+$', ''));
  return case when char_length(v_out) >= 2 then v_out end;
end;
$$;

-- قيمة آمنة في الرابط (?q=): كل بايت ماشي حرف / رقم / - . _ ~ = %XX
create or replace function public.coming_soon_url_q(p_text text)
returns text
language sql
immutable
set search_path = public
as $$
  select coalesce(string_agg(case when b between 48 and 57 or b between 65 and 90 or b between 97 and 122 or b in (45, 46, 95, 126)
                                  then chr(b) else '%' || lpad(upper(to_hex(b)), 2, '0') end, '' order by i), '')
    from (select i, get_byte(v.bytes, i) as b
            from (select convert_to(coalesce(p_text, ''), 'UTF8') as bytes) v,
                 generate_series(0, length(v.bytes) - 1) i) x;
$$;

-- بطاقات إشعار "قريباً": المربوطة بيه + البطاقة الأولى (company_id)
create or replace function public.coming_soon_notice_members(p_notification bigint)
returns setof bigint
language sql
stable
security definer
set search_path = public
as $$
  select x.company_id from public.coming_soon_notice_cards x where x.notification_id = p_notification
  union
  select n.company_id from public.notifications n where n.id = p_notification and n.company_id is not null;
$$;

-- العرض: البطاقة اللي تبان (أول بطاقة قريبة ظاهرة)، عدد البطاقات القريبة الظاهرة، والاسم = من الظاهرة برك
-- (المشترك، وإلا اسم أول بطاقة ظاهرة). كي ما تبقى حتى وحدة ظاهرة (الإشعار ما يبانش للعموم، الأدمين برك): من الكل.
create or replace function public.coming_soon_notice_view(p_notification bigint)
returns table (card_id bigint, cards integer, name text)
language sql
stable
security definer
set search_path = public
as $$
  with m as (
    select c.id, c.name, (public.company_is_public(c.status) and coalesce(c.coming_soon, false)) as soon,
           coalesce(x.added_at, '-infinity'::timestamptz) as at
      from public.companies c
      left join public.coming_soon_notice_cards x on x.company_id = c.id and x.notification_id = p_notification
     where c.id in (select public.coming_soon_notice_members(p_notification))
  )
  select (select m.id from m where m.soon order by m.at, m.id limit 1),
         (select count(*) from m where m.soon)::integer,
         case when exists (select 1 from m where m.soon)
              then coalesce(public.coming_soon_common_name((select array_agg(m.name order by m.at, m.id) from m where m.soon)),
                            (select m.name from m where m.soon order by m.at, m.id limit 1))
              else coalesce(public.coming_soon_common_name((select array_agg(m.name order by m.at, m.id) from m)),
                            (select m.name from m order by m.at, m.id limit 1))
         end;
$$;

-- ===================== 3) الإنشاء التلقائي (cron كل دقيقة) =====================
--  البطاقات القريبة الظاهرة اللي مازال ما تعالجوش، دقيقتين بعد ما ولّاو "قريباً". نفس المجموعة + إشعار تلقائي
--  تصنع في آخر 24 ساعة (ماشي مخفي) + الاسم يبقى مشترك → تتزاد ليه؛ وإلا إشعار جديد. بلا push ديما.
--  كل بطاقة داخل begin … exception (خطأ = warning، تتعاود في الدقيقة الجاية).
create or replace function public.coming_soon_notices_due()
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  r     record;
  v_grp text;
  v_nid bigint;
  v_n   integer := 0;
begin
  -- جوج cron في نفس الوقت ما يعالجوش نفس البطاقة
  if not pg_try_advisory_xact_lock(hashtextextended('codpromo:coming_soon_notices', 0)) then
    return 0;
  end if;

  for r in
    select c.id, c.name
      from public.companies c
     where coalesce(c.coming_soon, false) and public.company_is_public(c.status)
       and coalesce(c.coming_soon_since, c.created_at) <= now() - interval '2 minutes'
       and not exists (select 1 from public.coming_soon_notice_cards x where x.company_id = c.id)
     order by coalesce(c.coming_soon_since, c.created_at), c.id
     limit 50
  loop
    begin
      v_grp := public.coming_soon_group(r.id);
      v_nid := null;
      if v_grp not like 'card:%' then
        select n.id into v_nid
          from public.notifications n
         where n.kind = 'coming_soon' and n.is_auto and not n.is_hidden
           and n.created_at > now() - interval '24 hours'
           and exists (select 1 from public.coming_soon_notice_cards x where x.notification_id = n.id and x.grp = v_grp)
           and public.coming_soon_common_name(array[(select v.name from public.coming_soon_notice_view(n.id) v), r.name]) is not null
         order by n.created_at desc, n.id desc
         limit 1;
      end if;

      if v_nid is null then
        insert into public.notifications (kind, company_id, is_auto, push, push_state, push_after, push_done_at)
        values ('coming_soon', r.id, true, false, 'skipped', now(), now())
        returning id into v_nid;
      else
        update public.notifications set updated_at = now() where id = v_nid;
      end if;

      insert into public.coming_soon_notice_cards (company_id, notification_id, grp)
      values (r.id, v_nid, v_grp)
      on conflict (company_id) do nothing;
      v_n := v_n + 1;
    exception when others then
      raise warning 'coming_soon_notices_due(%): %', r.id, sqlerrm;
    end;
  end loop;
  return v_n;
end;
$$;

-- ===================== 4) القراءة: نفس الدوال + "قريباً" =====================
-- نفس الدالة (phase-notifications) + "قريباً": يبان كي تكون فيه بطاقة قريبة ظاهرة وحدة على الأقل
-- (مخفية ولا تفعّلت = يختفي؛ بلاصتو إشعار "شركة جديدة" عند التفعيل)
create or replace function public.notif_visible(n public.notifications)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select not n.is_hidden
     and n.published_at <= now()
     and case
           when n.kind = 'coming_soon' then exists (
             select 1 from public.companies c
              where c.id in (select public.coming_soon_notice_members(n.id))
                and public.company_is_public(c.status) and coalesce(c.coming_soon, false))
           else (n.company_id is null or exists (
                   select 1 from public.companies c where c.id = n.company_id and public.company_is_public(c.status)))
                and (n.deal_id is null or public.notif_deal_live(n.deal_id))
         end;
$function$;

-- نفس الدالة + "قريباً": الفئات / المفضّلة على أي بطاقة من بطاقاتو
create or replace function public.notif_matches(n public.notifications, p_user uuid, p_scope text, p_categories uuid[])
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select case
    when n.kind in ('feature', 'announcement') or p_user is null or coalesce(p_scope, 'all') = 'all' then true
    when n.kind = 'coming_soon' then case
      when p_scope = 'categories' then exists (
        select 1 from public.companies c
         where c.id in (select public.coming_soon_notice_members(n.id))
           and c.category_id = any(coalesce(p_categories, '{}')))
      when p_scope = 'favorites' then exists (
        select 1 from public.favorites f
         where f.user_id = p_user and f.company_id in (select public.coming_soon_notice_members(n.id)))
      else true
    end
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
$function$;

-- نفس الدالة + "قريباً": company = البطاقة القريبة اللي تبان، soon = { name (الاسم المشترك), cards }،
-- والرابط: بطاقة وحدة = صفحتها، عدّة = /offers?soon=1&q=<الاسم>. الأنواع الأخرى: soon = null (نفس الباقي).
create or replace function public.notif_json(n public.notifications)
returns json
language sql
stable
security definer
set search_path to 'public'
as $function$
  select json_build_object(
    'id', n.id, 'kind', n.kind, 'published_at', n.published_at,
    'title', n.title, 'title_en', n.title_en, 'title_fr', n.title_fr,
    'body', n.body, 'body_en', n.body_en, 'body_fr', n.body_fr,
    'url', coalesce(n.url,
                    case when s.cards > 1 then '/offers?soon=1&q=' || public.coming_soon_url_q(s.name)
                         when c.slug is not null then '/store/' || c.slug
                         when n.deal_id is not null then '/offers?kind=nocode'
                         else '/new' end),
    'company', case when c.id is null then null else json_build_object(
      'id', c.id, 'name', c.name, 'slug', c.slug, 'logo', c.logo, 'logo_bg', c.logo_bg, 'type', c.type,
      'discount', c.discount, 'discount_en', c.discount_en, 'discount_fr', c.discount_fr,
      'premium_discount', c.premium_discount, 'premium_discount_en', c.premium_discount_en,
      'premium_discount_fr', c.premium_discount_fr) end,
    'deal', case when d.id is null then null else json_build_object(
      'id', d.id, 'name', d.name, 'slug', d.slug, 'logo', d.logo_url,
      'reward', d.reward, 'reward_en', d.reward_en, 'reward_fr', d.reward_fr) end,
    'soon', case when n.kind = 'coming_soon' then json_build_object('name', coalesce(s.name, c.name), 'cards', coalesce(s.cards, 0)) end
  )
  from (select 1) one
  left join lateral (select v.card_id, v.cards, v.name from public.coming_soon_notice_view(n.id) v where n.kind = 'coming_soon') s on true
  left join public.companies c on c.id = coalesce(s.card_id, n.company_id)
  left join public.nocode_deals d on d.id = n.deal_id;
$function$;

-- ===================== 5) الهاتف: push واحد على نفس الشركة للّي كانو يستناو =====================
--  إشعار تفعيل (company / code) لبطاقة C ما يخرجش لهاتف صاحب الحساب إذا وصلو (ولا راهو يوصلو في نفس الدفعة)
--  push "العرض الذي كنت تنتظره" على بطاقة أخرى من نفس "الموقع الرسمي"، تصنع قبلو في آخر 24 ساعة. الجرس يبقى.
--  p_app: سجلّ التطبيق (app_push_log) بلاصة Web Push (push_state).
create or replace function public.coming_soon_push_muted(n public.notifications, p_user uuid, p_app boolean default false)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user is not null and n.kind in ('company', 'code') and n.company_id is not null
     and exists (
       select 1
         from public.coming_soon_waits w
         join public.notifications m on m.id = w.notification_id
        where w.user_id = p_user
          and m.id <> n.id and m.kind in ('company', 'code')
          and m.company_id is not null and m.company_id <> n.company_id
          and (m.created_at, m.id) < (n.created_at, n.id)
          and m.created_at > n.created_at - interval '24 hours'
          and case when coalesce(p_app, false)
                   then exists (select 1 from public.app_push_log l where l.notification_id = m.id and l.state in ('sending', 'sent'))
                   else m.push_state in ('sending', 'sent') end
          and public.coming_soon_group(m.company_id) = public.coming_soon_group(n.company_id));
$$;

-- نفس الدالة (phase-coming-soon) + coming_soon_push_muted
create or replace function public.push_batch_targets(p_batch bigint, p_after bigint default 0, p_limit integer default 200)
returns json
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
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
                                and not public.coming_soon_push_muted(n, s.user_id, false)
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
$function$;

-- نفس الدالة (phase-app-push) + coming_soon_push_muted (سجلّ التطبيق)
create or replace function public.app_push_batch_targets(p_batch bigint, p_after bigint default 0, p_limit integer default 200)
returns json
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
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
                                and not public.coming_soon_push_muted(n, s.user_id, true)
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
$function$;

-- ===================== 6) الأدمين: قالب "قريباً" =====================
-- نفس الدالة (phase-notifications) + coming_soon: بطاقة قريبة ظاهرة برك (not_soon / hidden)، بلا هاتف ديما.
-- بطاقة مازال ما تعالجتش = تتسجّل بهاد الإشعار (الأوتوماتيكي ما يعاودش).
create or replace function public.admin_create_notification(
  p_kind text,
  p_company_id bigint default null,
  p_deal_id bigint default null,
  p_title text default null, p_title_en text default null, p_title_fr text default null,
  p_body text default null, p_body_en text default null, p_body_fr text default null,
  p_url text default null,
  p_push boolean default true
)
returns json
language plpgsql
volatile
security definer
set search_path to 'public'
as $function$
declare
  v_id   bigint;
  v_soon boolean := p_kind = 'coming_soon';
begin
  perform public.admin_assert();
  if p_kind is null or p_kind not in ('company', 'code', 'premium_code', 'deal', 'feature', 'announcement', 'coming_soon') then
    return json_build_object('status', 'invalid');
  end if;
  -- فوق CHECK الجدول: بلا ' ولا ` في الرابط (حتى بلاصة تقبلهم)
  if coalesce(p_url, '') ~ '[''`]' then
    return json_build_object('status', 'invalid');
  end if;
  if p_kind in ('company', 'code', 'premium_code', 'coming_soon') then
    if p_company_id is null or not exists (select 1 from public.companies c where c.id = p_company_id) then
      return json_build_object('status', 'invalid');
    end if;
    if exists (select 1 from public.companies c where c.id = p_company_id and not public.company_is_public(c.status)) then
      return json_build_object('status', 'hidden');
    end if;
  end if;
  if v_soon and not exists (select 1 from public.companies c where c.id = p_company_id and coalesce(c.coming_soon, false)) then
    return json_build_object('status', 'not_soon');
  end if;
  if p_kind = 'deal' and (p_deal_id is null or not exists (select 1 from public.nocode_deals d where d.id = p_deal_id)) then
    return json_build_object('status', 'invalid');
  end if;
  if (select count(*) from public.notifications n where not n.is_auto and n.created_at > now() - interval '1 hour') >= 30 then
    return json_build_object('status', 'rate_limited');
  end if;

  insert into public.notifications (kind, company_id, deal_id, title, title_en, title_fr, body, body_en, body_fr,
                                    url, is_auto, push, push_state, push_after, push_done_at, created_by)
  values (p_kind,
          case when p_kind in ('company', 'code', 'premium_code', 'coming_soon') then p_company_id end,
          case when p_kind = 'deal' then p_deal_id end,
          nullif(btrim(p_title), ''), nullif(btrim(p_title_en), ''), nullif(btrim(p_title_fr), ''),
          nullif(btrim(p_body), ''), nullif(btrim(p_body_en), ''), nullif(btrim(p_body_fr), ''),
          nullif(btrim(p_url), ''), false,
          case when v_soon then false else coalesce(p_push, true) end,
          case when v_soon then 'skipped' else 'pending' end,
          now() + interval '1 minute',
          case when v_soon then now() end,
          auth.uid())
  returning id into v_id;
  if v_soon then
    insert into public.coming_soon_notice_cards (company_id, notification_id, grp)
    values (p_company_id, v_id, public.coming_soon_group(p_company_id))
    on conflict (company_id) do nothing;
  end if;
  return json_build_object('status', 'ok', 'id', v_id);
exception when check_violation then
  return json_build_object('status', 'invalid');
end;
$function$;

-- ===================== 7) cron =====================
select cron.schedule('codpromo-soon-notices', '* * * * *', 'select public.coming_soon_notices_due()');

-- ===================== 8) الصلاحيات =====================
-- كلش داخلي (الواجهة تقرا عبر notifications_feed / admin_notifications كيما قبل)
revoke all on function public.coming_soon_group(bigint) from public, anon, authenticated;
revoke all on function public.coming_soon_common_name(text[]) from public, anon, authenticated;
revoke all on function public.coming_soon_url_q(text) from public, anon, authenticated;
revoke all on function public.coming_soon_notice_members(bigint) from public, anon, authenticated;
revoke all on function public.coming_soon_notice_view(bigint) from public, anon, authenticated;
revoke all on function public.coming_soon_notices_due() from public, anon, authenticated;
revoke all on function public.coming_soon_push_muted(public.notifications, uuid, boolean) from public, anon, authenticated;
-- الدوال المبدّلة: نفس الصلاحيات (create or replace يخلّيهم، هادي للتأكيد)
revoke all on function public.notif_visible(public.notifications) from public, anon, authenticated;
revoke all on function public.notif_matches(public.notifications, uuid, text, uuid[]) from public, anon, authenticated;
revoke all on function public.notif_json(public.notifications) from public, anon, authenticated;
revoke all on function public.push_batch_targets(bigint, bigint, integer) from public, anon, authenticated;
grant execute on function public.push_batch_targets(bigint, bigint, integer) to service_role;
revoke all on function public.app_push_batch_targets(bigint, bigint, integer) from public, anon, authenticated;
grant execute on function public.app_push_batch_targets(bigint, bigint, integer) to service_role;
revoke all on function public.admin_create_notification(text, bigint, bigint, text, text, text, text, text, text, text, boolean) from public, anon;
grant execute on function public.admin_create_notification(text, bigint, bigint, text, text, text, text, text, text, text, boolean) to authenticated;

-- ===================== 9) البطاقات الموجودة (مرة وحدة) =====================
--  26 أكتوبر 2026: البطاقات القريبة الموجودة = MDM Express (ليبيا، العراق، الجزائر، لبنان — نفس mdm.express)
--  → إشعار واحد مجمّع "قريباً على CODpromo: MDM Express" في الجرس برك. أي حاجة أخرى = نوقفو (rollback كامل).
do $$
declare
  v_notices integer;
  v_cards   integer;
begin
  if exists (select 1 from public.notifications n where n.kind = 'coming_soon') then
    return; -- مطبّقة من قبل
  end if;
  perform public.coming_soon_notices_due();
  select count(*) into v_notices from public.notifications n where n.kind = 'coming_soon';
  select count(*) into v_cards from public.coming_soon_notice_cards x
    join public.notifications n on n.id = x.notification_id where n.kind = 'coming_soon';
  if v_notices <> 1 or v_cards <> 4
     or (select v.name from public.notifications n, public.coming_soon_notice_view(n.id) v where n.kind = 'coming_soon') is distinct from 'MDM Express' then
    raise exception 'soon-notify backfill: expected 1 notice (MDM Express, 4 cards), got % notices / % cards', v_notices, v_cards;
  end if;
end $$;

notify pgrst, 'reload schema';
