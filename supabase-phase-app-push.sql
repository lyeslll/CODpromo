-- ============================================================
--  CODpromo — phase "app-push": إشعارات الهاتف لتطبيق Android (Firebase Cloud Messaging).
--  زيادة برك: جداول ودوال جداد، حتى دالة ولا جدول كاين ما يتبدّل (الإشعارات، Web Push، الجرس كيما راهم).
--
--  1) app_push_tokens: token تاع الجهاز (FCM) لزائر ولا حساب، مع لغة الواجهة. الكتابة غير عبر
--     app_push_register / app_push_unregister (RLS بلا سياسات + بلا صلاحيات للعميل).
--  2) الإرسال: نفس الإشعارات اللي يبعثهم Web Push (public.notifications)، بسجلّ تاعو (app_push_log)
--     باش ما نزيدوش أعمدة لجدول الإشعارات. cron كل دقيقة → app_push_dispatch_due → دفعة
--     (app_push_batches) → send-app-push (Edge Function) برأس x-push-secret = app_push_hook_secret.
--  3) السويتش private.app_secrets.app_push_mode: off (الافتراضي) | test (الأدمين برك) | live.
--     off = الدالة ترجع في الحين، والو ما يتبعث. التشغيل: update private.app_secrets set value = 'test' …
--  4) غير الإشعارات الجداد (وقتها جا في آخر 30 دقيقة): كي يتشعّل ما يخرجش كلش القديم مرة وحدة.
--     8 دفعات في 24 ساعة كأقصى (نفس حدّ Web Push).
--  idempotent، بلا DROP / DELETE / TRUNCATE (الرجوع في supabase-phase-app-push-rollback.sql).
-- ============================================================

-- ===================== 0) الأسرار والسويتش =====================
insert into private.app_secrets (key, value)
values ('app_push_hook_secret', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (key) do nothing;

insert into private.app_secrets (key, value)
values ('app_push_mode', 'off')
on conflict (key) do nothing;

-- ===================== 1) الجداول =====================
create table if not exists public.app_push_tokens (
  id           bigint generated always as identity primary key,
  token        text not null unique check (char_length(token) between 100 and 4096 and token ~ '^[A-Za-z0-9_:-]+$'),
  platform     text not null default 'android' check (platform in ('android')),
  user_id      uuid references auth.users (id) on delete cascade,
  lang         text not null default 'ar' check (lang in ('ar', 'en', 'fr')),
  active       boolean not null default true,
  ip_hash      text,
  fail_count   integer not null default 0,
  last_sent_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists app_push_tokens_user on public.app_push_tokens (user_id);
create index if not exists app_push_tokens_ip on public.app_push_tokens (ip_hash, created_at);
create index if not exists app_push_tokens_active on public.app_push_tokens (id) where active;

create table if not exists public.app_push_batches (
  id               bigint generated always as identity primary key,
  notification_ids bigint[] not null default '{}',
  mode             text not null check (mode in ('test', 'live', 'self')),
  test_user        uuid references auth.users (id) on delete cascade,
  state            text not null default 'pending' check (state in ('pending', 'sending', 'sent', 'failed')),
  targets          integer not null default 0,
  sent             integer not null default 0,
  gone             integer not null default 0,
  failed           integer not null default 0,
  last_error       text,
  created_at       timestamptz not null default now(),
  claimed_at       timestamptz,
  done_at          timestamptz
);
create index if not exists app_push_batches_recent on public.app_push_batches (created_at desc);

-- إشعار تعالج للتطبيق (مرة وحدة): sending → sent | failed، ولا skipped (الحدّ اليومي)
create table if not exists public.app_push_log (
  notification_id bigint primary key references public.notifications (id) on delete cascade,
  batch_id        bigint references public.app_push_batches (id) on delete set null,
  state           text not null default 'sending' check (state in ('sending', 'sent', 'failed', 'skipped')),
  sent            integer not null default 0,
  created_at      timestamptz not null default now(),
  done_at         timestamptz
);
create index if not exists app_push_log_batch on public.app_push_log (batch_id);

alter table public.app_push_tokens enable row level security;
alter table public.app_push_batches enable row level security;
alter table public.app_push_log enable row level security;
revoke all on public.app_push_tokens, public.app_push_batches, public.app_push_log from anon, authenticated;

-- ===================== 2) أدوات داخلية =====================
create or replace function public.app_push_mode()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case when s.value in ('off', 'test', 'live') then s.value else 'off' end
    from (select (select a.value from private.app_secrets a where a.key = 'app_push_mode') as value) s;
$$;

-- طلب HTTP غير متزامن لـ send-app-push (pg_net يبعث بعد الـ commit؛ rollback = ما يتبعث والو)
create or replace function public.app_push_post(p_batch bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
begin
  select s.value into v_secret from private.app_secrets s where s.key = 'app_push_hook_secret';
  if v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := 'https://uulcgvdsqivgkiulurhk.supabase.co/functions/v1/send-app-push',
    body := jsonb_build_object('batch', p_batch),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
    timeout_milliseconds := 15000
  );
end;
$$;

-- ===================== 3) التسجيل (التطبيق) =====================
--  status: ok | invalid | rate_limited. الزائر يقدر (بلا تفضيلات = كل الجديد).
--  حدّ: 10 أجهزة جديدة في الساعة لكل IP، 10 في اليوم لكل حساب، و 500 جهاز زائر في 10 دقائق للكل.
create or replace function public.app_push_register(p_token text, p_platform text default 'android', p_lang text default 'ar')
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_ip   text;
  v_lang text := case when p_lang in ('ar', 'en', 'fr') then p_lang else 'ar' end;
  v_row  public.app_push_tokens;
begin
  if current_setting('transaction_read_only', true) = 'on' then
    raise exception 'read_only' using errcode = '25006';
  end if;
  if p_token is null or char_length(p_token) not between 100 and 4096 or p_token !~ '^[A-Za-z0-9_:-]+$'
     or coalesce(p_platform, 'android') <> 'android' then
    return json_build_object('status', 'invalid');
  end if;

  select * into v_row from public.app_push_tokens t where t.token = p_token for update;
  if found then
    -- نفس الجهاز يرجع (تبديل اللغة، دخول لحساب): حساب مسجّل = يولّي تاعو؛ زائر = يبقى كيما راه
    update public.app_push_tokens
       set lang = v_lang, active = true, fail_count = 0, user_id = coalesce(v_uid, v_row.user_id), updated_at = now()
     where id = v_row.id;
    return json_build_object('status', 'ok');
  end if;

  v_ip := public.free_key_ip_hash();
  if v_uid is null and v_ip is null then
    return json_build_object('status', 'rate_limited');
  end if;
  if v_uid is not null and (select count(*) from public.app_push_tokens t
                             where t.user_id = v_uid and t.created_at > now() - interval '1 day') >= 10 then
    return json_build_object('status', 'rate_limited');
  end if;
  if v_ip is not null and (select count(*) from public.app_push_tokens t
                            where t.ip_hash = v_ip and t.created_at > now() - interval '1 hour') >= 10 then
    return json_build_object('status', 'rate_limited');
  end if;
  if v_uid is null and (select count(*) from public.app_push_tokens t
                         where t.user_id is null and t.created_at > now() - interval '10 minutes') >= 500 then
    return json_build_object('status', 'rate_limited');
  end if;

  insert into public.app_push_tokens (token, platform, user_id, lang, ip_hash)
  values (p_token, 'android', v_uid, v_lang, v_ip);
  return json_build_object('status', 'ok');
end;
$$;

-- إيقاف: اللي يعرف الـ token برك (الجهاز نفسو). ما يمسحش، يطفي.
create or replace function public.app_push_unregister(p_token text)
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
  update public.app_push_tokens set active = false, updated_at = now()
   where token = p_token and active;
  return json_build_object('status', 'ok');
end;
$$;

-- ===================== 4) الإرسال (cron + send-app-push) =====================
create or replace function public.app_push_dispatch_due()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mode  text := public.app_push_mode();
  v_ids   bigint[];
  v_batch bigint;
begin
  if v_mode = 'off' then
    return 0;
  end if;

  -- دفعة طاحت (الدالة ما رجعتش) أكثر من 15 دقيقة → failed (بلا إعادة: خير من إشعار مرّتين)
  update public.app_push_batches set state = 'failed', last_error = coalesce(last_error, 'timeout'), done_at = now()
   where state in ('pending', 'sending') and created_at < now() - interval '15 minutes';
  update public.app_push_log l set state = 'failed', done_at = now()
   where l.state = 'sending'
     and exists (select 1 from public.app_push_batches b where b.id = l.batch_id and b.state = 'failed');

  select array_agg(x.id order by x.published_at, x.id) into v_ids
    from (select n.id, n.published_at from public.notifications n
           where n.push and n.published_at <= now() and n.push_after <= now()
             and n.push_after > now() - interval '30 minutes'
             and n.published_at > now() - interval '1 day'
             and not exists (select 1 from public.app_push_log l where l.notification_id = n.id)
             and public.notif_visible(n)
           order by n.published_at, n.id limit 10) x;
  if v_ids is null then
    return 0;
  end if;

  if (select count(*) from public.app_push_batches b where b.test_user is null and b.created_at > now() - interval '24 hours') >= 8 then
    insert into public.app_push_log (notification_id, state, done_at)
    select unnest(v_ids), 'skipped', now()
    on conflict (notification_id) do nothing;
    return 0;
  end if;

  insert into public.app_push_batches (notification_ids, mode) values (v_ids, v_mode) returning id into v_batch;
  insert into public.app_push_log (notification_id, batch_id, state)
  select unnest(v_ids), v_batch, 'sending'
  on conflict (notification_id) do nothing;
  perform public.app_push_post(v_batch);
  return cardinality(v_ids);
end;
$$;

-- send-app-push يحجز الدفعة (pending → sending) ويقرا الإشعارات. null = محجوزة ولا مبعوثة.
create or replace function public.app_push_batch_claim(p_batch bigint)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  b public.app_push_batches;
begin
  update public.app_push_batches set state = 'sending', claimed_at = now()
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

-- الأجهزة (صفحة بعد صفحة) + الإشعارات اللي تطابق كل جهاز (نفس قاعدة push_batch_targets: التفضيلات،
-- و"أعلمني" تاع "قريباً"). mode test = أجهزة الأدمين برك.
create or replace function public.app_push_batch_targets(p_batch bigint, p_after bigint default 0, p_limit integer default 200)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
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
$$;

-- النتيجة: ok = وصلت، gone = الـ token ما بقاش (UNREGISTERED → active = false)، failed = فشل مؤقت
create or replace function public.app_push_batch_done(p_batch bigint, p_ok bigint[], p_gone bigint[], p_failed bigint[], p_error text default null)
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
  update public.app_push_tokens set last_sent_at = now(), fail_count = 0 where id = any(coalesce(p_ok, '{}'));
  update public.app_push_tokens set active = false, updated_at = now() where id = any(coalesce(p_gone, '{}'));
  update public.app_push_tokens
     set fail_count = fail_count + 1, active = (fail_count + 1) < 5, updated_at = now()
   where id = any(coalesce(p_failed, '{}'));

  v_state := case when p_error is not null and v_ok = 0 then 'failed' else 'sent' end;
  update public.app_push_batches
     set state = v_state, targets = v_ok + v_gone + v_failed, sent = v_ok, gone = v_gone, failed = v_failed,
         last_error = left(p_error, 500), done_at = now()
   where id = p_batch and state = 'sending';
  update public.app_push_log
     set state = v_state, sent = v_ok, done_at = now()
   where batch_id = p_batch and state = 'sending';
end;
$$;

-- تجربة المالك (SQL برك، ماشي من التطبيق): رسالة تجربة لأجهزة حساب واحد، حتى والسويتش off.
--  select public.app_push_test_user((select id from auth.users where email = '…'));
create or replace function public.app_push_test_user(p_user uuid)
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
  select count(*) into v_n from public.app_push_tokens t where t.active and t.user_id = p_user;
  if v_n = 0 then
    return json_build_object('status', 'no_device');
  end if;
  if (select count(*) from public.app_push_batches b where b.test_user = p_user and b.created_at > now() - interval '1 hour') >= 5 then
    return json_build_object('status', 'rate_limited');
  end if;
  insert into public.app_push_batches (mode, test_user) values ('self', p_user) returning id into v_batch;
  perform public.app_push_post(v_batch);
  return json_build_object('status', 'ok', 'devices', v_n, 'batch', v_batch);
end;
$$;

select cron.schedule('codpromo-app-push-dispatch', '* * * * *', 'select public.app_push_dispatch_due()');

-- ===================== 5) الصلاحيات =====================
revoke all on function public.app_push_mode() from public, anon, authenticated;
revoke all on function public.app_push_post(bigint) from public, anon, authenticated;
revoke all on function public.app_push_dispatch_due() from public, anon, authenticated;
revoke all on function public.app_push_batch_claim(bigint) from public, anon, authenticated;
revoke all on function public.app_push_batch_targets(bigint, bigint, integer) from public, anon, authenticated;
revoke all on function public.app_push_batch_done(bigint, bigint[], bigint[], bigint[], text) from public, anon, authenticated;
revoke all on function public.app_push_test_user(uuid) from public, anon, authenticated;
grant execute on function public.app_push_batch_claim(bigint) to service_role;
grant execute on function public.app_push_batch_targets(bigint, bigint, integer) to service_role;
grant execute on function public.app_push_batch_done(bigint, bigint[], bigint[], bigint[], text) to service_role;

revoke all on function public.app_push_register(text, text, text) from public;
grant execute on function public.app_push_register(text, text, text) to anon, authenticated;
revoke all on function public.app_push_unregister(text) from public;
grant execute on function public.app_push_unregister(text) to anon, authenticated;

notify pgrst, 'reload schema';
