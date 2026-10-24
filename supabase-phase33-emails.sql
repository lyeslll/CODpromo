-- ============================================================
--  CODpromo — phase33: إيميلات المعاملات (بلا ما نمسّو الدفع ولا الهدايا)
--
--  1) صندوق public.email_outbox: كل إيميل = سطر (kind + ref فريد → ما يتبعثش مرّتين).
--  2) Triggers (AFTER، كلها داخل begin … exception → أي خطأ = warning برك، المعاملة الأصلية تكمّل):
--     - auth.users: تأكيد البريد (ولا حساب Google مؤكَّد من الأول) → ترحيب بعد دقيقتين
--       (الواجهة تلحق تكتب user_metadata.lang).
--     - purchases INSERT → تأكيد الشراء. purchases.refunded_at يتعمّر وما بقالو حتى شراء نشط → إعلام السحب.
--     - gift_redemptions INSERT → إعلام تفعيل الهدية.
--  3) الإرسال: pg_net يبعث { id } لـ Edge Function send-email (رأس x-email-secret) بعد الـ commit
--     (غير متزامن: ما يبطّأش ولا يكسّر الشراء). الدالة تحجز المهمة وتقرا بياناتها عبر email_job_claim
--     (service_role برك) وتبعث عبر Resend، ثم email_job_done.
--  4) pg_cron كل دقيقة: الترحيب المؤجّل + إعادة المحاولة (5 مرات كأقصى، خلال يومين).
--  5) السويتش private.app_secrets.emails_enabled ('false' حتى يتأكّد Resend): موقوف → السطر
--     يتسجّل skipped ('disabled') وما يتبعث والو (ما يتجمّعوش إيميلات قديمة).
--  6) email_test_send(to, lang): معاينة كل القوالب (postgres برك، من SQL).
--  ما فيه حتى DELETE / DROP / TRUNCATE.
-- ============================================================

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- ===================== 1) الأسرار والسويتش (خارج الـ API) =====================
insert into private.app_secrets (key, value)
values ('email_hook_secret', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (key) do nothing;

insert into private.app_secrets (key, value)
values ('emails_enabled', 'false')
on conflict (key) do nothing;

-- ===================== 2) الصندوق =====================
create table if not exists public.email_outbox (
  id          bigint generated always as identity primary key,
  kind        text not null check (kind in ('welcome', 'purchase', 'revoked', 'gift', 'test')),
  user_id     uuid references auth.users (id) on delete set null,
  ref         text not null,
  payload     jsonb not null default '{}'::jsonb,
  status      text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'skipped')),
  attempts    integer not null default 0,
  last_error  text,
  provider_id text,
  send_after  timestamptz not null default now(),
  claimed_at  timestamptz,
  sent_at     timestamptz,
  created_at  timestamptz not null default now(),
  constraint email_outbox_kind_ref unique (kind, ref)
);
create index if not exists email_outbox_due on public.email_outbox (status, send_after) where status in ('pending', 'failed');
create index if not exists email_outbox_user on public.email_outbox (user_id);

-- بلا أي صلاحية للعميل (RLS بلا سياسات)، كلش عبر الدوال
alter table public.email_outbox enable row level security;
revoke all on public.email_outbox from anon, authenticated;

-- ===================== 3) أدوات داخلية =====================
create or replace function public.email_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select s.value = 'true' from private.app_secrets s where s.key = 'emails_enabled'), false);
$$;

-- طلب HTTP غير متزامن (pg_net يبعث بعد الـ commit؛ rollback = ما يتبعث والو)
create or replace function public.email_dispatch(p_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
begin
  select s.value into v_secret from private.app_secrets s where s.key = 'email_hook_secret';
  if v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := 'https://uulcgvdsqivgkiulurhk.supabase.co/functions/v1/send-email',
    body := jsonb_build_object('id', p_id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-email-secret', v_secret),
    timeout_milliseconds := 15000
  );
end;
$$;

-- يزيد إيميل للصندوق (kind + ref فريد = مرّة وحدة). بلا تأخير وشغّال → يتبعث في الحين.
create or replace function public.email_enqueue(p_kind text, p_user uuid, p_ref text, p_payload jsonb default '{}'::jsonb, p_delay interval default interval '0')
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_on boolean := public.email_enabled();
  v_delay interval := coalesce(p_delay, interval '0');
  v_id bigint;
begin
  insert into public.email_outbox (kind, user_id, ref, payload, send_after, status, last_error)
  values (p_kind, p_user, p_ref, coalesce(p_payload, '{}'::jsonb), now() + v_delay,
          case when v_on then 'pending' else 'skipped' end,
          case when v_on then null else 'disabled' end)
  on conflict (kind, ref) do nothing
  returning id into v_id;

  if v_id is not null and v_on and v_delay <= interval '0' then
    perform public.email_dispatch(v_id);
  end if;
  return v_id;
end;
$$;

-- ===================== 4) Triggers (ما يكسّرو حتى معاملة) =====================
create or replace function public.email_on_user_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    if new.email_confirmed_at is not null and new.email is not null
       and (tg_op = 'INSERT' or old.email_confirmed_at is null) then
      perform public.email_enqueue('welcome', new.id, new.id::text, '{}'::jsonb, interval '2 minutes');
    end if;
  exception when others then
    raise warning 'email_on_user_confirmed: %', sqlerrm;
  end;
  return new;
end;
$$;

create or replace trigger email_user_confirmed
  after insert or update of email_confirmed_at on auth.users
  for each row execute function public.email_on_user_confirmed();

create or replace function public.email_on_purchase()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    if tg_op = 'INSERT' then
      if new.refunded_at is null then
        perform public.email_enqueue('purchase', new.user_id, new.id::text);
      end if;
    elsif old.refunded_at is null and new.refunded_at is not null
          and not public.has_lifetime_purchase(new.user_id) then
      perform public.email_enqueue('revoked', new.user_id, new.id::text);
    end if;
  exception when others then
    raise warning 'email_on_purchase: %', sqlerrm;
  end;
  return null;
end;
$$;

create or replace trigger email_purchase
  after insert or update of refunded_at on public.purchases
  for each row execute function public.email_on_purchase();

create or replace function public.email_on_gift()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform public.email_enqueue('gift', new.user_id, new.id::text);
  exception when others then
    raise warning 'email_on_gift: %', sqlerrm;
  end;
  return null;
end;
$$;

create or replace trigger email_gift
  after insert on public.gift_redemptions
  for each row execute function public.email_on_gift();

-- ===================== 5) Edge Function: حجز المهمة + بياناتها =====================
-- pending/failed → sending (attempts + 1). null = مبعوثة / محجوزة / ما بقاتش صالحة (تتعلّم skipped).
create or replace function public.email_job_claim(p_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  j public.email_outbox;
  u record;
  v_to text;
  v_lang text;
  v_name text := '';
  v_tpl text;
  v_data jsonb := '{}'::jsonb;
begin
  update public.email_outbox o
     set status = 'sending', attempts = o.attempts + 1, claimed_at = now()
   where o.id = p_id
     and o.attempts < 5
     and ((o.status = 'pending' and o.send_after <= now()) or o.status = 'failed')
  returning o.* into j;
  if not found then
    return null;
  end if;

  if j.kind = 'test' then
    v_to := j.payload->>'to';
    v_lang := j.payload->>'lang';
    v_tpl := j.payload->>'template';
    v_data := coalesce(j.payload->'data', '{}'::jsonb);
    v_name := coalesce(v_data->>'name', '');
  else
    select au.email, au.raw_user_meta_data as meta, p.full_name, p.account_type
      into u
      from auth.users au
      left join public.profiles p on p.id = au.id
     where au.id = j.user_id;
    if not found or u.email is null then
      update public.email_outbox set status = 'skipped', last_error = 'no_user' where id = j.id;
      return null;
    end if;
    v_to := u.email;
    v_lang := u.meta->>'lang';
    v_name := coalesce(nullif(btrim(u.full_name), ''), nullif(btrim(u.meta->>'full_name'), ''), nullif(btrim(u.meta->>'name'), ''), '');
    v_tpl := j.kind;

    if j.kind = 'welcome' then
      -- المفتاح الذهبي يتذكر غير إذا هاد الحساب يقدر يستعملو فعلاً (نفس شروط claim_free_reveal)
      v_data := jsonb_build_object(
        'accountType', coalesce(u.account_type, u.meta->>'account_type', 'customer'),
        'freeKey', public.free_key_enabled()
          and not public.has_premium_access(j.user_id)
          and not public.free_key_disposable(u.email)
          and not exists (select 1 from public.free_reveals r where r.user_id = j.user_id)
          and not exists (select 1 from public.free_reveals r where r.email_hash = public.free_key_email_hash(u.email))
      );
    elsif j.kind in ('purchase', 'revoked') then
      select jsonb_build_object('amount', pu.amount, 'currency', pu.currency, 'provider', pu.provider, 'tier', pu.tier,
                                'purchasedAt', pu.purchased_at, 'refundedAt', pu.refunded_at)
        into v_data
        from public.purchases pu
       where pu.id = j.ref::bigint;
    elsif j.kind = 'gift' then
      select jsonb_build_object('premiumUntil', r.premium_until)
        into v_data
        from public.gift_redemptions r
       where r.id = j.ref::bigint and r.revoked_at is null;
    end if;

    if v_data is null then
      update public.email_outbox set status = 'skipped', last_error = 'no_data' where id = j.id;
      return null;
    end if;
  end if;

  if v_lang is null or v_lang not in ('ar', 'en', 'fr') then
    v_lang := 'ar';
  end if;
  return json_build_object('id', j.id, 'kind', j.kind, 'template', v_tpl, 'to', v_to, 'lang', v_lang,
                           'name', v_name, 'data', v_data, 'attempt', j.attempts);
end;
$$;

create or replace function public.email_job_done(p_id bigint, p_ok boolean, p_provider_id text default null, p_error text default null)
returns void
language sql
security definer
set search_path = public
as $$
  update public.email_outbox
     set status = case when p_ok then 'sent' else 'failed' end,
         sent_at = case when p_ok then now() else sent_at end,
         provider_id = coalesce(p_provider_id, provider_id),
         last_error = case when p_ok then null else left(p_error, 500) end
   where id = p_id and status = 'sending';
$$;

-- ===================== 6) cron: المؤجّلة + إعادة المحاولة =====================
create or replace function public.email_dispatch_due()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  n integer := 0;
begin
  if not public.email_enabled() then
    return 0;
  end if;
  -- محجوزة وما رجعتش (الدالة طاحت) أكثر من 10 دقائق → نعاودو
  update public.email_outbox
     set status = 'failed', last_error = coalesce(last_error, 'timeout')
   where status = 'sending' and claimed_at < now() - interval '10 minutes';

  for r in
    select o.id
      from public.email_outbox o
     where o.created_at > now() - interval '2 days'
       and o.attempts < 5
       and ((o.status = 'pending' and o.send_after <= now())
         or (o.status = 'failed' and o.claimed_at < now() - make_interval(mins => 5 * o.attempts)))
     order by o.id
     limit 25
  loop
    perform public.email_dispatch(r.id);
    n := n + 1;
  end loop;
  return n;
end;
$$;

select cron.schedule('codpromo-email-dispatch', '* * * * *', 'select public.email_dispatch_due()');

-- ===================== 7) معاينة كل القوالب (postgres برك) =====================
create or replace function public.email_test_send(p_to text, p_lang text default 'ar')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  t text;
  n integer := 0;
  v_id bigint;
  v_stamp text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_price numeric := coalesce((select s.launch_price_dzd from public.pricing_settings s where s.id = 1), 0);
  v_data jsonb;
begin
  foreach t in array array['auth_confirmation', 'auth_recovery', 'auth_email_change', 'auth_magic_link', 'auth_invite',
                           'auth_reauthentication', 'welcome', 'welcome_company', 'purchase', 'revoked', 'gift'] loop
    v_data := case t
      when 'welcome' then jsonb_build_object('accountType', 'customer', 'freeKey', true)
      when 'welcome_company' then jsonb_build_object('accountType', 'company')
      when 'purchase' then jsonb_build_object('amount', v_price, 'currency', 'DZD', 'provider', 'slickpay', 'tier', 'launch', 'purchasedAt', now())
      when 'revoked' then jsonb_build_object('amount', v_price, 'currency', 'DZD', 'provider', 'slickpay', 'refundedAt', now())
      when 'gift' then jsonb_build_object('premiumUntil', now() + interval '30 days')
      when 'auth_reauthentication' then jsonb_build_object('token', '123456')
      when 'auth_email_change' then jsonb_build_object('url', 'https://codpromo.com/', 'email', p_to, 'newEmail', p_to)
      else jsonb_build_object('url', 'https://codpromo.com/', 'email', p_to)
    end;
    insert into public.email_outbox (kind, user_id, ref, payload, status)
    values ('test', null, 'test:' || t || ':' || p_lang || ':' || v_stamp,
            jsonb_build_object('to', p_to, 'lang', p_lang,
                               'template', case when t = 'welcome_company' then 'welcome' else t end,
                               'data', v_data),
            'pending')
    returning id into v_id;
    perform public.email_dispatch(v_id);
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- ===================== 8) الصلاحيات =====================
-- الدوال الجديدة تتنفّذ افتراضياً من PUBLIC → نسحبو، والـ Edge Function (service_role) تاخذ غير الحجز والإنهاء.
revoke all on function public.email_enabled() from public, anon, authenticated;
revoke all on function public.email_dispatch(bigint) from public, anon, authenticated;
revoke all on function public.email_enqueue(text, uuid, text, jsonb, interval) from public, anon, authenticated;
revoke all on function public.email_on_user_confirmed() from public, anon, authenticated;
revoke all on function public.email_on_purchase() from public, anon, authenticated;
revoke all on function public.email_on_gift() from public, anon, authenticated;
revoke all on function public.email_job_claim(bigint) from public, anon, authenticated;
revoke all on function public.email_job_done(bigint, boolean, text, text) from public, anon, authenticated;
revoke all on function public.email_dispatch_due() from public, anon, authenticated;
revoke all on function public.email_test_send(text, text) from public, anon, authenticated;
grant execute on function public.email_job_claim(bigint) to service_role;
grant execute on function public.email_job_done(bigint, boolean, text, text) to service_role;
