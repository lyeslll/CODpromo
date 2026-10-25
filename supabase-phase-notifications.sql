-- ============================================================
--  CODpromo — phase "notifications": الإشعارات والتحديثات (جرس الهيدر، صفحة /new، Web Push)
--
--  جداول ودوال جديدة برك. ما يبدّل حتى عمود، حتى policy، ولا حتى دالة قديمة. الجديد على جداول
--  قديمة = زوج triggers AFTER (companies و nocode_deals) داخل begin … exception: أي خطأ = warning
--  برك، حفظ الشركة ولا العرض يكمّل.
--
--  1) public.notifications: كل تحديث = سطر. kind:
--       company (شركة جديدة) · code (كود جديد) · premium_code (كود Premium جديد) · deal (عرض بلا كود)
--       · feature (ميزة جديدة في الموقع) · announcement (إعلان).
--     النص: title / body (+ _en / _fr) اختياريين للشركات والعروض (فارغ = القالب المترجم في الواجهة
--     وفي send-push حسب kind)، إجباريين للميزة والإعلان.
--  2) أوتوماتيكي (بلا ما يدير الأدمين والو): شركة تتزاد (ماشي مخفية) ولا مخفية ترجع تبان أول مرة،
--     كود عادي يتبدّل، كود Premium يتزاد، عرض بلا كود يتزاد ولا يتشعل. الشركات المخفية: والو.
--     مرة وحدة لكل شركة / عرض (فهرس فريد)، والكود مرة كل 12 ساعة لكل شركة كأقصى.
--  3) "مقروء": notification_reads (المسجّل برك، عبر RPC) + read_all_before في notification_prefs.
--     الزائر: في المتصفّح (localStorage). حتى حساب ما يقرا "مقروء" تاع حساب آخر.
--  4) التفضيلات (notification_prefs.scope): all | categories | favorites — تفلتر الجرس والـ push
--     (الميزة والإعلان يوصلو ديما).
--  5) Web Push: push_subscriptions (endpoint من خدمات push المعروفة برك — ماشي أي رابط)، الإرسال
--     يدير غير send-push (Edge Function) برأس x-push-secret = private.app_secrets.push_hook_secret.
--     pg_cron كل دقيقة يجمع الإشعارات اللي حان وقتها (دقيقتين بعد الإنشاء) في دفعة وحدة
--     (push_batches): إشعار واحد ولا ملخّص "X تحديثات جديدة". 8 دفعات في 24 ساعة كأقصى.
--     السويتش private.app_secrets.push_mode: off | test (الأدمين برك — قبل الدمج) | live.
--  6) الجداول كاملة بلا أي صلاحية للعميل (RLS بلا سياسات): كلش عبر RPCs. صنع/تعديل/إخفاء = admin_assert.
--
--  idempotent، بلا DROP / DELETE / TRUNCATE. الرجوع: supabase-phase-notifications-rollback.sql
-- ============================================================

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- ===================== 0) الأسرار والسويتش (خارج الـ API) =====================
insert into private.app_secrets (key, value)
values ('push_hook_secret', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (key) do nothing;

-- test = الأدمين برك يوصلهم push (قبل الدمج). الدمج → 'live'.
insert into private.app_secrets (key, value)
values ('push_mode', 'test')
on conflict (key) do nothing;

-- ===================== 1) الجداول =====================
create table if not exists public.push_batches (
  id               bigint generated always as identity primary key,
  notification_ids bigint[] not null default '{}',
  test_user        uuid references auth.users (id) on delete cascade, -- تجربة الأدمين على أجهزتو برك
  mode             text not null check (mode in ('test', 'live', 'self')),
  state            text not null default 'pending' check (state in ('pending', 'sending', 'sent', 'failed')),
  targets          integer not null default 0,
  sent             integer not null default 0,
  failed           integer not null default 0,
  gone             integer not null default 0,
  last_error       text,
  created_at       timestamptz not null default now(),
  claimed_at       timestamptz,
  done_at          timestamptz
);
create index if not exists push_batches_recent on public.push_batches (created_at desc);

create table if not exists public.notifications (
  id            bigint generated always as identity primary key,
  kind          text not null check (kind in ('company', 'code', 'premium_code', 'deal', 'feature', 'announcement')),
  company_id    bigint references public.companies (id) on delete cascade,
  deal_id       bigint references public.nocode_deals (id) on delete cascade,
  title         text check (char_length(title) <= 140),
  title_en      text check (char_length(title_en) <= 140),
  title_fr      text check (char_length(title_fr) <= 140),
  body          text check (char_length(body) <= 300),
  body_en       text check (char_length(body_en) <= 300),
  body_fr       text check (char_length(body_fr) <= 300),
  -- رابط داخلي برك: يبدا بـ "/" (ماشي "//")، بلا "\" ولا فراغات (ما يخرجش للبرا)
  url           text check (url is null or (char_length(url) <= 300 and url ~ '^/([^/\\]|$)' and url !~ '[[:space:]\\<>"]')),
  is_auto       boolean not null default false,
  is_hidden     boolean not null default false,
  push          boolean not null default true,
  push_state    text not null default 'pending' check (push_state in ('pending', 'sending', 'sent', 'skipped', 'failed')),
  push_after    timestamptz not null default now(),
  push_batch_id bigint references public.push_batches (id) on delete set null,
  push_sent     integer not null default 0,
  push_done_at  timestamptz,
  published_at  timestamptz not null default now(),
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint notifications_target check (
    (kind in ('company', 'code', 'premium_code') and company_id is not null)
    or (kind = 'deal' and deal_id is not null)
    or (kind in ('feature', 'announcement') and title is not null and char_length(btrim(title)) > 0)
  )
);
-- مرة وحدة لكل شركة / عرض (الأوتوماتيكي)
create unique index if not exists notifications_auto_company on public.notifications (company_id) where is_auto and kind = 'company';
create unique index if not exists notifications_auto_deal on public.notifications (deal_id) where is_auto and kind = 'deal';
create index if not exists notifications_feed on public.notifications (published_at desc, id desc) where not is_hidden;
create index if not exists notifications_push_due on public.notifications (push_after) where push_state = 'pending';
create index if not exists notifications_company on public.notifications (company_id);
create index if not exists notifications_deal on public.notifications (deal_id);

create table if not exists public.notification_reads (
  user_id         uuid not null references auth.users (id) on delete cascade,
  notification_id bigint not null references public.notifications (id) on delete cascade,
  read_at         timestamptz not null default now(),
  primary key (user_id, notification_id)
);
create index if not exists notification_reads_notification on public.notification_reads (notification_id);

create table if not exists public.notification_prefs (
  user_id         uuid primary key references auth.users (id) on delete cascade,
  scope           text not null default 'all' check (scope in ('all', 'categories', 'favorites')),
  categories      uuid[] not null default '{}' check (cardinality(categories) <= 50),
  read_all_before timestamptz,
  updated_at      timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id           bigint generated always as identity primary key,
  endpoint     text not null unique check (char_length(endpoint) between 20 and 1000),
  p256dh       text not null check (char_length(p256dh) between 80 and 100),
  auth         text not null check (char_length(auth) between 16 and 32),
  user_id      uuid references auth.users (id) on delete cascade,
  lang         text not null default 'ar' check (lang in ('ar', 'en', 'fr')),
  active       boolean not null default true,
  ip_hash      text,
  fail_count   integer not null default 0,
  last_sent_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists push_subscriptions_user on public.push_subscriptions (user_id);
create index if not exists push_subscriptions_ip on public.push_subscriptions (ip_hash, created_at);
create index if not exists push_subscriptions_active on public.push_subscriptions (id) where active;

-- بلا أي صلاحية للعميل (RLS بلا سياسات)، كلش عبر الدوال
alter table public.notifications enable row level security;
alter table public.notification_reads enable row level security;
alter table public.notification_prefs enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.push_batches enable row level security;
revoke all on public.notifications, public.notification_reads, public.notification_prefs,
              public.push_subscriptions, public.push_batches from anon, authenticated;

-- ===================== 2) أدوات داخلية =====================
create or replace function public.push_mode()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case when s.value in ('off', 'test', 'live') then s.value else 'off' end
    from (select (select a.value from private.app_secrets a where a.key = 'push_mode') as value) s;
$$;

-- عرض بلا كود "حيّ" (نفس شرط القراءة العامة في phase29)
create or replace function public.notif_deal_live(p_deal bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.nocode_deals d
     where d.id = p_deal and d.is_active and d.starts_at <= now() and (d.ends_at is null or d.ends_at > now())
  );
$$;

-- الإشعار يبان للزائر؟ (ماشي مخفي، وقتو جا، شركتو ماشي مخفية، عرضو حيّ)
create or replace function public.notif_visible(n public.notifications)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not n.is_hidden
     and n.published_at <= now()
     and (n.company_id is null or exists (
           select 1 from public.companies c where c.id = n.company_id and coalesce(c.status, 'active') <> 'hidden'))
     and (n.deal_id is null or public.notif_deal_live(n.deal_id));
$$;

-- يطابق تفضيلات الحساب؟ (الميزة والإعلان ديما)
create or replace function public.notif_matches(n public.notifications, p_user uuid, p_scope text, p_categories uuid[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
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
$$;

-- طلب HTTP غير متزامن لـ send-push (pg_net يبعث بعد الـ commit؛ rollback = ما يتبعث والو)
create or replace function public.push_post(p_batch bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
begin
  select s.value into v_secret from private.app_secrets s where s.key = 'push_hook_secret';
  if v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := 'https://uulcgvdsqivgkiulurhk.supabase.co/functions/v1/send-push',
    body := jsonb_build_object('batch', p_batch),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
    timeout_milliseconds := 15000
  );
end;
$$;

-- بيانات الإشعار للعرض (الواجهة، الأدمين، send-push): النص + الشركة / العرض
create or replace function public.notif_json(n public.notifications)
returns json
language sql
stable
security definer
set search_path = public
as $$
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
$$;

-- ===================== 3) Triggers (ما يكسّرو حتى حفظ) =====================
create or replace function public.notify_on_company()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    if coalesce(new.status, 'active') = 'hidden' then
      return new; -- الشركات المخفية: حتى إشعار
    end if;

    -- شركة جديدة، ولا مخفية ترجع تبان (أول مرة برك: الفهرس الفريد)
    if tg_op = 'INSERT' or coalesce(old.status, 'active') = 'hidden' then
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
$$;

create or replace function public.notify_on_deal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_at timestamptz;
begin
  begin
    if not coalesce(new.is_active, false) or (new.ends_at is not null and new.ends_at <= now()) then
      return new;
    end if;
    if tg_op = 'INSERT' or not coalesce(old.is_active, false) then
      -- عرض مبرمج للمستقبل: الإشعار يبان (و push يخرج) كي يبدا
      v_at := greatest(now(), coalesce(new.starts_at, now()));
      insert into public.notifications (kind, deal_id, is_auto, published_at, push_after)
      values ('deal', new.id, true, v_at, v_at + interval '2 minutes')
      on conflict (deal_id) where is_auto and kind = 'deal' do nothing;
    end if;
  exception when others then
    raise warning 'notify_on_deal: %', sqlerrm;
  end;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'notify_company' and tgrelid = 'public.companies'::regclass) then
    create trigger notify_company
      after insert or update of status, code, premium_code on public.companies
      for each row execute function public.notify_on_company();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'notify_deal' and tgrelid = 'public.nocode_deals'::regclass) then
    create trigger notify_deal
      after insert or update of is_active on public.nocode_deals
      for each row execute function public.notify_on_deal();
  end if;
end $$;

-- ===================== 4) القراءة العامة + "مقروء" =====================
--  p_all = true: كل شي (صفحة /new)؛ false: حسب تفضيلات الحساب (الجرس). read = تاع صاحب الجلسة برك.
create or replace function public.notifications_feed(p_limit integer default 30, p_before timestamptz default null, p_all boolean default false)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
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
$$;

create or replace function public.notifications_mark_read(p_ids bigint[])
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_n   integer;
begin
  if v_uid is null then
    raise exception 'auth' using errcode = '42501';
  end if;
  if p_ids is null or cardinality(p_ids) = 0 then
    return 0;
  end if;
  if cardinality(p_ids) > 100 then
    raise exception 'too_many' using errcode = '22023';
  end if;
  insert into public.notification_reads (user_id, notification_id)
  select v_uid, n.id from public.notifications n where n.id = any(p_ids) and not n.is_hidden
  on conflict do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

create or replace function public.notifications_mark_all_read()
returns timestamptz
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_at  timestamptz := now();
begin
  if v_uid is null then
    raise exception 'auth' using errcode = '42501';
  end if;
  insert into public.notification_prefs (user_id, read_all_before, updated_at)
  values (v_uid, v_at, v_at)
  on conflict (user_id) do update set read_all_before = excluded.read_all_before, updated_at = excluded.updated_at;
  return v_at;
end;
$$;

-- ===================== 5) التفضيلات =====================
create or replace function public.my_notification_prefs()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_p public.notification_prefs;
begin
  if auth.uid() is null then
    raise exception 'auth' using errcode = '42501';
  end if;
  select * into v_p from public.notification_prefs p where p.user_id = auth.uid();
  return json_build_object('scope', coalesce(v_p.scope, 'all'), 'categories', coalesce(v_p.categories, '{}'));
end;
$$;

create or replace function public.set_notification_prefs(p_scope text, p_categories uuid[] default '{}')
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_cats uuid[];
begin
  if v_uid is null then
    raise exception 'auth' using errcode = '42501';
  end if;
  if p_scope is null or p_scope not in ('all', 'categories', 'favorites') then
    raise exception 'invalid_scope' using errcode = '22023';
  end if;
  if cardinality(coalesce(p_categories, '{}')) > 50 then
    raise exception 'too_many' using errcode = '22023';
  end if;
  -- الفئات الموجودة برك (بلا تكرار)
  select coalesce(array_agg(distinct c.id), '{}') into v_cats
    from public.categories c where c.id = any(coalesce(p_categories, '{}'));
  if p_scope = 'categories' and cardinality(v_cats) = 0 then
    raise exception 'no_categories' using errcode = '22023';
  end if;
  insert into public.notification_prefs (user_id, scope, categories, updated_at)
  values (v_uid, p_scope, v_cats, now())
  on conflict (user_id) do update set scope = excluded.scope, categories = excluded.categories, updated_at = excluded.updated_at;
  return json_build_object('scope', p_scope, 'categories', v_cats);
end;
$$;

-- ===================== 6) Web Push: الاشتراك =====================
--  status: ok | invalid | rate_limited. الزائر يقدر يشترك (بلا تفضيلات = كل الجديد).
--  endpoint من خدمات push المعروفة برك (Chrome/Edge/Samsung = FCM، Firefox، Safari، Windows):
--  ما نبعثوش طلبات لأي رابط آخر. حدّ: 10 أجهزة جديدة في الساعة لكل IP، و 10 في اليوم لكل حساب.
create or replace function public.push_subscribe(p_endpoint text, p_p256dh text, p_auth text, p_lang text default 'ar')
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_host text;
  v_ip   text;
  v_lang text := case when p_lang in ('ar', 'en', 'fr') then p_lang else 'ar' end;
  v_row  public.push_subscriptions;
begin
  if current_setting('transaction_read_only', true) = 'on' then
    raise exception 'read_only' using errcode = '25006';
  end if;
  if p_endpoint is null or char_length(p_endpoint) not between 20 and 1000
     or p_endpoint !~ '^https://[A-Za-z0-9.-]+(:443)?/[!-~]+$'
     or p_p256dh is null or p_p256dh !~ '^[A-Za-z0-9_-]{86,88}={0,2}$'
     or p_auth is null or p_auth !~ '^[A-Za-z0-9_-]{21,24}={0,2}$' then
    return json_build_object('status', 'invalid');
  end if;
  v_host := lower(substring(p_endpoint from '^https://([A-Za-z0-9.-]+)'));
  if not (v_host in ('fcm.googleapis.com', 'android.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com')
          or v_host ~ '^[a-z0-9-]+\.push\.apple\.com$'
          or v_host ~ '^[a-z0-9-]+\.notify\.windows\.com$') then
    return json_build_object('status', 'invalid');
  end if;

  select * into v_row from public.push_subscriptions s where s.endpoint = p_endpoint for update;
  if found then
    -- نفس الجهاز: نحدّثو المفاتيح واللغة. حساب مسجّل = يولّي تاعو (الـ endpoint سرّ الجهاز).
    update public.push_subscriptions
       set p256dh = p_p256dh, auth = p_auth, lang = v_lang, active = true, fail_count = 0,
           user_id = coalesce(v_uid, v_row.user_id), updated_at = now()
     where id = v_row.id;
    return json_build_object('status', 'ok');
  end if;

  v_ip := public.free_key_ip_hash();
  if v_uid is not null and (select count(*) from public.push_subscriptions s
                             where s.user_id = v_uid and s.created_at > now() - interval '1 day') >= 10 then
    return json_build_object('status', 'rate_limited');
  end if;
  if v_ip is not null and (select count(*) from public.push_subscriptions s
                            where s.ip_hash = v_ip and s.created_at > now() - interval '1 hour') >= 10 then
    return json_build_object('status', 'rate_limited');
  end if;
  -- حماية عامة (روبوتات بعناوين كثيرة): 300 جهاز جديد في 10 دقائق كأقصى
  if (select count(*) from public.push_subscriptions s where s.created_at > now() - interval '10 minutes') >= 300 then
    return json_build_object('status', 'rate_limited');
  end if;

  insert into public.push_subscriptions (endpoint, p256dh, auth, user_id, lang, ip_hash)
  values (p_endpoint, p_p256dh, p_auth, v_uid, v_lang, v_ip);
  return json_build_object('status', 'ok');
end;
$$;

-- إلغاء الاشتراك: اللي عندو الـ endpoint (الجهاز نفسو) برك يعرفو
create or replace function public.push_unsubscribe(p_endpoint text)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if current_setting('transaction_read_only', true) = 'on' then
    raise exception 'read_only' using errcode = '25006';
  end if;
  update public.push_subscriptions set active = false, updated_at = now()
   where endpoint = p_endpoint and active;
  return json_build_object('status', 'ok');
end;
$$;

-- ===================== 7) Web Push: الإرسال (cron + send-push) =====================
create or replace function public.push_dispatch_due()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mode   text := public.push_mode();
  v_ids    bigint[];
  v_batch  bigint;
begin
  -- دفعة طاحت (الدالة ما رجعتش) أكثر من 15 دقيقة → failed (بلا إعادة: خير من push مرّتين)
  update public.push_batches set state = 'failed', last_error = coalesce(last_error, 'timeout'), done_at = now()
   where state in ('pending', 'sending') and created_at < now() - interval '15 minutes';
  update public.notifications n set push_state = 'failed', push_done_at = now()
   where n.push_state = 'sending'
     and exists (select 1 from public.push_batches b where b.id = n.push_batch_id and b.state = 'failed');

  -- ما يستاهلش push: موقوف، مخفي، بلا push، قديم (> يوم)، شركتو مخفية، عرضو ماشي حيّ
  update public.notifications n
     set push_state = 'skipped', push_done_at = now()
   where n.push_state = 'pending' and n.push_after <= now() and n.published_at <= now()
     and (v_mode = 'off' or not n.push or n.published_at < now() - interval '1 day' or not public.notif_visible(n));

  select array_agg(x.id order by x.published_at, x.id) into v_ids
    from (select n.id, n.published_at from public.notifications n
           where n.push_state = 'pending' and n.push_after <= now() and n.published_at <= now()
           order by n.published_at, n.id limit 10) x;
  if v_ids is null then
    return 0;
  end if;

  -- 8 دفعات في 24 ساعة كأقصى (ماشي spam): الزايد يبقى في الجرس بلا push
  if (select count(*) from public.push_batches b where b.test_user is null and b.created_at > now() - interval '24 hours') >= 8 then
    update public.notifications set push_state = 'skipped', push_done_at = now() where id = any(v_ids);
    return 0;
  end if;

  insert into public.push_batches (notification_ids, mode) values (v_ids, v_mode) returning id into v_batch;
  update public.notifications set push_state = 'sending', push_batch_id = v_batch where id = any(v_ids);
  perform public.push_post(v_batch);
  return cardinality(v_ids);
end;
$$;

-- send-push يحجز الدفعة (pending → sending) ويقرا الإشعارات. null = محجوزة ولا مبعوثة.
create or replace function public.push_batch_claim(p_batch bigint)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  b public.push_batches;
begin
  update public.push_batches set state = 'sending', claimed_at = now()
   where id = p_batch and state = 'pending'
  returning * into b;
  if not found then
    return null;
  end if;
  return json_build_object(
    'id', b.id, 'mode', b.mode, 'self', b.test_user is not null,
    'notifications', coalesce((
      select json_agg(public.notif_json(n) order by n.published_at, n.id)
        from public.notifications n where n.id = any(b.notification_ids)), '[]'::json)
  );
end;
$$;

-- الأجهزة (صفحة بعد صفحة) + الإشعارات اللي تطابق كل جهاز (تفضيلات الحساب). mode test = الأدمين برك.
--  { last: آخر id تقرا في الصفحة (null = كمّلنا), items: الأجهزة اللي عندها حاجة تطابق }
create or replace function public.push_batch_targets(p_batch bigint, p_after bigint default 0, p_limit integer default 200)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
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
$$;

-- النتيجة: ok = وصلت، gone = الجهاز ما بقاش (404/410 → active = false)، failed = فشل مؤقت
create or replace function public.push_batch_done(p_batch bigint, p_ok bigint[], p_gone bigint[], p_failed bigint[], p_error text default null)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_ok     integer := cardinality(coalesce(p_ok, '{}'));
  v_gone   integer := cardinality(coalesce(p_gone, '{}'));
  v_failed integer := cardinality(coalesce(p_failed, '{}'));
  v_state  text;
begin
  update public.push_subscriptions set last_sent_at = now(), fail_count = 0 where id = any(coalesce(p_ok, '{}'));
  update public.push_subscriptions set active = false, updated_at = now() where id = any(coalesce(p_gone, '{}'));
  update public.push_subscriptions
     set fail_count = fail_count + 1, active = (fail_count + 1) < 5, updated_at = now()
   where id = any(coalesce(p_failed, '{}'));

  v_state := case when p_error is not null and v_ok = 0 then 'failed' else 'sent' end;
  update public.push_batches
     set state = v_state, targets = v_ok + v_gone + v_failed, sent = v_ok, gone = v_gone, failed = v_failed,
         last_error = left(p_error, 500), done_at = now()
   where id = p_batch and state = 'sending';
  update public.notifications
     set push_state = case when v_state = 'sent' then 'sent' else 'failed' end, push_sent = v_ok, push_done_at = now()
   where push_batch_id = p_batch and push_state = 'sending';
end;
$$;

select cron.schedule('codpromo-push-dispatch', '* * * * *', 'select public.push_dispatch_due()');

-- ===================== 8) الأدمين (admin_assert) =====================
create or replace function public.admin_notifications(p_limit integer default 100)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.admin_assert();
  return coalesce((
    select json_agg(x.j order by x.published_at desc, x.id desc)
      from (
        select n.id, n.published_at,
               (public.notif_json(n)::jsonb || jsonb_build_object(
                  'is_auto', n.is_auto, 'is_hidden', n.is_hidden, 'push', n.push, 'push_state', n.push_state,
                  'push_after', n.push_after, 'push_sent', n.push_sent, 'created_at', n.created_at,
                  'visible', public.notif_visible(n),
                  'company_hidden', exists (select 1 from public.companies c where c.id = n.company_id and coalesce(c.status, 'active') = 'hidden'),
                  'reads', (select count(*) from public.notification_reads r where r.notification_id = n.id)))::json as j
          from public.notifications n
         order by n.published_at desc, n.id desc
         limit least(greatest(coalesce(p_limit, 100), 1), 300)
      ) x), '[]'::json);
end;
$$;

-- إشعار يدوي (القوالب: شركة جديدة / كود جديد / ميزة جديدة / إعلان). push بعد دقيقة (وقت للتصحيح).
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
set search_path = public
as $$
declare
  v_id bigint;
begin
  perform public.admin_assert();
  if p_kind is null or p_kind not in ('company', 'code', 'premium_code', 'deal', 'feature', 'announcement') then
    return json_build_object('status', 'invalid');
  end if;
  if p_kind in ('company', 'code', 'premium_code') then
    if p_company_id is null or not exists (select 1 from public.companies c where c.id = p_company_id) then
      return json_build_object('status', 'invalid');
    end if;
    if exists (select 1 from public.companies c where c.id = p_company_id and coalesce(c.status, 'active') = 'hidden') then
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
$$;

-- تعديل النص والرابط (فارغ = القالب المترجم). ما يبدّلش النوع ولا الشركة.
create or replace function public.admin_update_notification(
  p_id bigint,
  p_title text default null, p_title_en text default null, p_title_fr text default null,
  p_body text default null, p_body_en text default null, p_body_fr text default null,
  p_url text default null
)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  perform public.admin_assert();
  update public.notifications
     set title = nullif(btrim(p_title), ''), title_en = nullif(btrim(p_title_en), ''), title_fr = nullif(btrim(p_title_fr), ''),
         body = nullif(btrim(p_body), ''), body_en = nullif(btrim(p_body_en), ''), body_fr = nullif(btrim(p_body_fr), ''),
         url = nullif(btrim(p_url), ''), updated_at = now()
   where id = p_id;
  if not found then
    return json_build_object('status', 'not_found');
  end if;
  return json_build_object('status', 'ok');
exception when check_violation then
  return json_build_object('status', 'invalid');
end;
$$;

-- إخفاء / إظهار (المخفي: ما يبانش، و push اللي مازال ما خرجش يتلغى)
create or replace function public.admin_set_notification_hidden(p_id bigint, p_hidden boolean)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  perform public.admin_assert();
  update public.notifications
     set is_hidden = coalesce(p_hidden, false),
         push_state = case when coalesce(p_hidden, false) and push_state = 'pending' then 'skipped' else push_state end,
         updated_at = now()
   where id = p_id;
  if not found then
    return json_build_object('status', 'not_found');
  end if;
  return json_build_object('status', 'ok');
end;
$$;

create or replace function public.admin_push_overview()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.admin_assert();
  return json_build_object(
    'mode', public.push_mode(),
    'devices', (select count(*) from public.push_subscriptions s where s.active),
    'devices_users', (select count(*) from public.push_subscriptions s where s.active and s.user_id is not null),
    'users', (select count(distinct s.user_id) from public.push_subscriptions s where s.active and s.user_id is not null),
    'by_lang', (select coalesce(json_object_agg(x.lang, x.n), '{}'::json)
                  from (select s.lang, count(*) n from public.push_subscriptions s where s.active group by s.lang) x),
    'my_devices', (select count(*) from public.push_subscriptions s where s.active and s.user_id = auth.uid()),
    'batches_24h', (select count(*) from public.push_batches b where b.test_user is null and b.created_at > now() - interval '24 hours'),
    'cap_24h', 8,
    'last', coalesce((select json_agg(row_to_json(b) order by b.id desc) from (
               select b.id, b.mode, b.state, b.sent, b.failed, b.gone, b.created_at, cardinality(b.notification_ids) as count
                 from public.push_batches b order by b.id desc limit 8) b), '[]'::json)
  );
end;
$$;

-- تجربة على أجهزة الأدمين نفسو برك (5 في الساعة)
create or replace function public.admin_push_test()
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_batch bigint;
  v_n     integer;
begin
  perform public.admin_assert();
  select count(*) into v_n from public.push_subscriptions s where s.active and s.user_id = auth.uid();
  if v_n = 0 then
    return json_build_object('status', 'no_device');
  end if;
  if (select count(*) from public.push_batches b where b.test_user = auth.uid() and b.created_at > now() - interval '1 hour') >= 5 then
    return json_build_object('status', 'rate_limited');
  end if;
  insert into public.push_batches (mode, test_user) values ('self', auth.uid()) returning id into v_batch;
  perform public.push_post(v_batch);
  return json_build_object('status', 'ok', 'devices', v_n);
end;
$$;

-- إيقاف / تشغيل الـ push (وضع التجربة يتبدّل من SQL برك، مع الدمج)
create or replace function public.admin_set_push_enabled(p_on boolean)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_mode text := public.push_mode();
begin
  perform public.admin_assert();
  if v_mode = 'test' then
    return json_build_object('status', 'test_mode', 'mode', v_mode);
  end if;
  update private.app_secrets set value = case when coalesce(p_on, false) then 'live' else 'off' end where key = 'push_mode';
  return json_build_object('status', 'ok', 'mode', public.push_mode());
end;
$$;

-- ===================== 9) أول إشعار: Sawa9ly (تزادت 24–25 أكتوبر 2026) =====================
--  بتاريخ إضافتها، بلا push (قبل الدمج ما كاين حتى جهاز).
insert into public.notifications (kind, company_id, is_auto, published_at, created_at, push_state, push_done_at)
select 'company', c.id, true, c.created_at, c.created_at, 'skipped', now()
  from public.companies c
 where c.slug = 'sawa9ly' and coalesce(c.status, 'active') <> 'hidden'
on conflict (company_id) where is_auto and kind = 'company' do nothing;

-- ===================== 10) الصلاحيات =====================
revoke all on function public.push_mode() from public, anon, authenticated;
revoke all on function public.notif_deal_live(bigint) from public, anon, authenticated;
revoke all on function public.notif_visible(public.notifications) from public, anon, authenticated;
revoke all on function public.notif_matches(public.notifications, uuid, text, uuid[]) from public, anon, authenticated;
revoke all on function public.notif_json(public.notifications) from public, anon, authenticated;
revoke all on function public.push_post(bigint) from public, anon, authenticated;
revoke all on function public.notify_on_company() from public, anon, authenticated;
revoke all on function public.notify_on_deal() from public, anon, authenticated;
revoke all on function public.push_dispatch_due() from public, anon, authenticated;
revoke all on function public.push_batch_claim(bigint) from public, anon, authenticated;
revoke all on function public.push_batch_targets(bigint, bigint, integer) from public, anon, authenticated;
revoke all on function public.push_batch_done(bigint, bigint[], bigint[], bigint[], text) from public, anon, authenticated;
grant execute on function public.push_batch_claim(bigint) to service_role;
grant execute on function public.push_batch_targets(bigint, bigint, integer) to service_role;
grant execute on function public.push_batch_done(bigint, bigint[], bigint[], bigint[], text) to service_role;

revoke all on function public.notifications_feed(integer, timestamptz, boolean) from public;
grant execute on function public.notifications_feed(integer, timestamptz, boolean) to anon, authenticated;
revoke all on function public.push_subscribe(text, text, text, text) from public;
grant execute on function public.push_subscribe(text, text, text, text) to anon, authenticated;
revoke all on function public.push_unsubscribe(text) from public;
grant execute on function public.push_unsubscribe(text) to anon, authenticated;

revoke all on function public.notifications_mark_read(bigint[]) from public, anon;
grant execute on function public.notifications_mark_read(bigint[]) to authenticated;
revoke all on function public.notifications_mark_all_read() from public, anon;
grant execute on function public.notifications_mark_all_read() to authenticated;
revoke all on function public.my_notification_prefs() from public, anon;
grant execute on function public.my_notification_prefs() to authenticated;
revoke all on function public.set_notification_prefs(text, uuid[]) from public, anon;
grant execute on function public.set_notification_prefs(text, uuid[]) to authenticated;

revoke all on function public.admin_notifications(integer) from public, anon;
revoke all on function public.admin_create_notification(text, bigint, bigint, text, text, text, text, text, text, text, boolean) from public, anon;
revoke all on function public.admin_update_notification(bigint, text, text, text, text, text, text, text) from public, anon;
revoke all on function public.admin_set_notification_hidden(bigint, boolean) from public, anon;
revoke all on function public.admin_push_overview() from public, anon;
revoke all on function public.admin_push_test() from public, anon;
revoke all on function public.admin_set_push_enabled(boolean) from public, anon;
grant execute on function public.admin_notifications(integer) to authenticated;
grant execute on function public.admin_create_notification(text, bigint, bigint, text, text, text, text, text, text, text, boolean) to authenticated;
grant execute on function public.admin_update_notification(bigint, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.admin_set_notification_hidden(bigint, boolean) to authenticated;
grant execute on function public.admin_push_overview() to authenticated;
grant execute on function public.admin_push_test() to authenticated;
grant execute on function public.admin_set_push_enabled(boolean) to authenticated;

notify pgrst, 'reload schema';
