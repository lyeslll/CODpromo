-- ============================================================
--  CODpromo — Phase 37: المفاتيح الماسية (مفاتيح تتشرى)
--  شغّله: supabase db query --linked -f supabase-phase37-diamond-keys.sql
--  إضافي برك: جداول جديدة ودوال جديدة (أسماء جديدة). ما يبدّل حتى جدول ولا دالة ولا policy كاينة،
--  وبلا DROP / DELETE / TRUNCATE. idempotent. الرجوع: supabase-phase37-rollback.sql.
--
--  المفتاح الماسي يخدم كيما المفتاح الذهبي بالضبط: مفتاح واحد = كود Premium تاع شركة وحدة، مفتوح لهاد
--  الحساب للأبد (حتى كي تبدّل الشركة الكود). ما يعطيش Premium: ما يكتب حتى حاجة في profiles،
--  has_premium_access و get_premium_code و claim_free_reveal كيما راهم.
--
--  1) key_packs: الباقات (3 مفاتيح / 5 مفاتيح…) بالدينار والدولار + منتوج Google Play — تتبدّل من /admin/pricing.
--  2) key_orders: كل شراء باقة (stripe / slickpay / paypal / google_play) — المبلغ يتقرّر في الخادم.
--  3) key_ledger: دفتر الحركات (purchase / use / gift / refund) — ما يتبدّلش وما يتمسحش (trigger)،
--     و key_wallets = الرصيد (CHECK >= 0، يتحدّث من الدفتر برك بـ trigger): الرصيد ما يقدرش يولّي سالب.
--  4) use_diamond_key: قفل لكل حساب + قفل سطر الرصيد → نفس المفتاح ما يتستعملش زوج مرات حتى في نفس اللحظة.
--  5) النظام العادل: كل واش خلّصو في المفاتيح ينقص من سعر Premium (الموقع برك، الحساب هنا في الخادم)،
--     key_credit_uses يسجّل الرصيد اللي تحسب في Premium (دفع بالبوابة ولا تفعيل كامل بالرصيد).
--  6) الاسترداد: المفاتيح اللي ما تستعملوش خلال 7 أيام (يدوي من الأدمن، ولا وحدو من webhook Stripe / PayPal)،
--     والدراهم اللي تحسبت في Premium ما ترجعش.
--  7) إيميلات (key_emails، نفس طريقة phase33 بصندوق وحدو): تأكيد شراء المفاتيح + هدية مفاتيح.
--  8) الأدمن: الأرقام، الحسابات، التاريخ، الإهداء مع السبب، الباقات، الطلبات والاسترداد.
-- ============================================================

-- ===================== 0) الإعدادات (خارج الـ API) =====================
-- إيميلات المفاتيح موقوفة حتى تتنشر send-email الجديدة (مع الدمج)، ومن بعد: update … set value = 'true'
insert into private.app_secrets (key, value)
values ('keys_emails_enabled', 'false')
on conflict (key) do nothing;

-- ===================== 1) الباقات =====================
create table if not exists public.key_packs (
  id              text primary key check (id ~ '^[a-z0-9_]{2,40}$'),
  keys            integer not null check (keys between 2 and 50),          -- ما كاينش مفتاح واحد وحدو
  price_dzd       integer not null check (price_dzd between 50 and 1000000),
  price_usd       numeric(10,2) not null check (price_usd between 0.50 and 100000),
  play_product_id text not null unique check (play_product_id ~ '^[a-z0-9][a-z0-9_.]{0,99}$'),
  is_active       boolean not null default true,
  position        smallint not null default 0,
  updated_at      timestamptz not null default now()
);
-- بالدولار بنفس نسبة Premium (9,900 دج = 39$)، مقرّبة لدولار كامل: 900 دج ≈ 3.55$ → 4$، 1,400 دج ≈ 5.52$ → 6$
insert into public.key_packs (id, keys, price_dzd, price_usd, play_product_id, position) values
  ('pack3', 3, 900, 4, 'codpromo_keys_3', 1),
  ('pack5', 5, 1400, 6, 'codpromo_keys_5', 2)
on conflict (id) do nothing;

alter table public.key_packs enable row level security;  -- بلا سياسات: القراءة عبر my_key_packs()
revoke all on public.key_packs from public, anon, authenticated;

-- ===================== 2) الطلبات (شراء باقة) =====================
create table if not exists public.key_orders (
  id              bigint generated always as identity primary key,
  -- on delete set null: حذف الحساب ما يمسحش سجلّ المبيعات (نفس purchases)
  user_id         uuid references auth.users (id) on delete set null,
  pack_id         text not null references public.key_packs (id),
  keys            integer not null check (keys between 1 and 50),
  provider        text not null check (provider in ('stripe', 'slickpay', 'paypal', 'google_play')),
  provider_ref    text not null unique check (btrim(provider_ref) <> '' and length(provider_ref) <= 500),
  payment_ref     text check (payment_ref is null or length(payment_ref) <= 500),
  amount          numeric(12,2) not null check (amount >= 0),
  currency        text not null check (currency in ('DZD', 'USD')),
  tier            text not null check (tier in ('regular', 'test')),      -- test = سعر التجربة (ما يتحسبش)
  status          text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  created_at      timestamptz not null default now(),
  paid_at         timestamptz,
  refunded_at     timestamptz,
  refunded_amount numeric(12,2) not null default 0 check (refunded_amount >= 0 and refunded_amount <= amount)
);
create index if not exists key_orders_user_idx on public.key_orders (user_id, created_at desc);
create index if not exists key_orders_payment_ref_idx on public.key_orders (payment_ref) where payment_ref is not null;
create index if not exists key_orders_paid_idx on public.key_orders (paid_at) where status = 'paid';

alter table public.key_orders enable row level security;
revoke all on public.key_orders from public, anon, authenticated;

-- ===================== 3) دفتر الحركات + الرصيد =====================
create table if not exists public.key_ledger (
  id         bigint generated always as identity primary key,
  user_id    uuid references auth.users (id) on delete set null,
  kind       text not null check (kind in ('purchase', 'use', 'gift', 'refund')),
  delta      integer not null check (delta <> 0 and delta between -50 and 50),
  order_id   bigint references public.key_orders (id),
  company_id bigint references public.companies (id) on delete set null,
  source     text check (source is null or source in ('home', 'offers', 'featured', 'store', 'category', 'favorites', 'dashboard', 'other')),
  note       text check (note is null or length(note) <= 300),            -- سبب الهدية (للأدمن برك)
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint key_ledger_sign check ((kind in ('purchase', 'gift') and delta > 0) or (kind in ('use', 'refund') and delta < 0)),
  constraint key_ledger_use_one check (kind <> 'use' or delta = -1),
  constraint key_ledger_order check ((kind in ('purchase', 'refund')) = (order_id is not null))
);
-- الشراء يزيد المفاتيح مرة وحدة، والاسترداد مرة وحدة، ومفتاح واحد لكل شركة لكل حساب
create unique index if not exists key_ledger_purchase_once on public.key_ledger (order_id) where kind = 'purchase';
create unique index if not exists key_ledger_refund_once on public.key_ledger (order_id) where kind = 'refund';
create unique index if not exists key_ledger_use_once on public.key_ledger (user_id, company_id)
  where kind = 'use' and user_id is not null and company_id is not null;
create index if not exists key_ledger_user_idx on public.key_ledger (user_id, created_at desc, id desc);
create index if not exists key_ledger_created_idx on public.key_ledger (created_at);

alter table public.key_ledger enable row level security;
revoke all on public.key_ledger from public, anon, authenticated;
revoke all on sequence public.key_ledger_id_seq from public, anon, authenticated;

create table if not exists public.key_wallets (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  balance    integer not null default 0 check (balance >= 0),           -- ما يولّيش سالب أبداً
  updated_at timestamptz not null default now()
);
alter table public.key_wallets enable row level security;
revoke all on public.key_wallets from public, anon, authenticated;

-- كل حركة تبدّل الرصيد في نفس المعاملة (UPDATE يقفل السطر → المعاملات المتزامنة تمرّ وحدة بوحدة،
-- و CHECK يرفض أي حركة تخلّي الرصيد تحت الصفر → المعاملة كاملة تتلغى). UPDATE أولاً (ماشي upsert:
-- Postgres يفحص CHECK على سطر الـ INSERT المقترح قبل ما يشوف التعارض).
create or replace function public.key_ledger_apply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null then
    return null;
  end if;
  loop
    update public.key_wallets set balance = balance + new.delta, updated_at = now() where user_id = new.user_id;
    exit when found;
    begin
      insert into public.key_wallets (user_id, balance, updated_at) values (new.user_id, new.delta, now());
      exit;
    exception when unique_violation then
      null;  -- أول حركة متزامنة لنفس الحساب: نعاودو الـ UPDATE
    end;
  end loop;
  return null;
end;
$$;

create or replace trigger key_ledger_apply
  after insert on public.key_ledger
  for each row execute function public.key_ledger_apply();

-- الدفتر ما يتبدّلش وما يتمسحش (حتى بـ service_role). الاستثناء الوحيد: حذف الحساب / الشركة
-- (on delete set null) يفرّغ user_id / company_id برك.
create or replace function public.key_ledger_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and (new.user_id is null or new.user_id = old.user_id)
     and (new.company_id is null or new.company_id = old.company_id)
     and (new.id, new.kind, new.delta, new.order_id, new.source, new.note, new.created_by, new.created_at)
         is not distinct from (old.id, old.kind, old.delta, old.order_id, old.source, old.note, old.created_by, old.created_at) then
    return new;
  end if;
  raise exception 'key_ledger is append-only' using errcode = '42501';
end;
$$;

create or replace trigger key_ledger_guard
  before update or delete on public.key_ledger
  for each row execute function public.key_ledger_guard();

-- ===================== 4) الرصيد اللي تحسب في Premium =====================
create table if not exists public.key_credit_uses (
  id            bigint generated always as identity primary key,
  user_id       uuid references auth.users (id) on delete set null,
  kind          text not null check (kind in ('checkout', 'full')),   -- checkout = الباقي بالبوابة، full = بالرصيد كامل
  provider      text not null check (provider in ('stripe', 'slickpay', 'paypal', 'credit')),
  provider_ref  text not null unique check (btrim(provider_ref) <> '' and length(provider_ref) <= 500),
  currency      text not null check (currency in ('DZD', 'USD')),
  tier          text not null check (tier in ('launch', 'regular', 'test')),
  premium_price numeric(12,2) not null check (premium_price >= 0),
  credit        numeric(12,2) not null check (credit > 0),
  amount_due    numeric(12,2) not null check (amount_due >= 0),
  created_at    timestamptz not null default now(),
  revoked_at    timestamptz,                                           -- full برك: الأدمن رجّع التفعيل (تجربة مثلاً)
  constraint key_credit_full check ((kind = 'full') = (provider = 'credit')),
  constraint key_credit_due check (kind <> 'full' or amount_due = 0)
);
create index if not exists key_credit_uses_user_idx on public.key_credit_uses (user_id, created_at);

alter table public.key_credit_uses enable row level security;
revoke all on public.key_credit_uses from public, anon, authenticated;

-- ===================== 5) أدوات داخلية (ما تتناداش من المتصفّح) =====================
-- Premium "حقيقي" يخبّي الباقات ويمنع الشراء: مدفوع / Stork / أدمن (الملف) ولا شراء مدى الحياة.
-- الهدية المؤقتة ماشي هنا: مول الهدية يشوف الباقات ويقدر يثبّت أكواد للأبد.
create or replace function public.keys_premium_blocked(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_profile_premium(uid) or public.has_lifetime_purchase(uid);
$$;

-- شركة يخدم عليها المفتاح: عندها كود Premium (ماشي مجمّدة) وماهيش مخفية
create or replace function public.keys_company_ok(p_company bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.companies c
     where c.id = p_company
       and coalesce(c.has_premium_code, false)
       and c.supports_premium is not false
       and coalesce(c.status, 'active') <> 'hidden'
  );
$$;

-- الأكواد اللي مازالو مقفولين على هاد الحساب (بلا المفتوحة بالمفتاح الذهبي ولا الماسي)
create or replace function public.keys_locked_count(uid uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
    from public.companies c
   where coalesce(c.has_premium_code, false)
     and c.supports_premium is not false
     and coalesce(c.status, 'active') <> 'hidden'
     and not exists (select 1 from public.free_reveals r where r.user_id = uid and r.company_id = c.id)
     and not exists (select 1 from public.key_ledger l where l.user_id = uid and l.kind = 'use' and l.company_id = c.id);
$$;

create or replace function public.keys_balance(uid uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select w.balance from public.key_wallets w where w.user_id = uid), 0);
$$;

-- مفاتيح في طريقها (دفع بدا وما كملش، آخر 3 ساعات): تتحسب في حدّ الشراء
create or replace function public.keys_pending(uid uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(o.keys), 0)::int from public.key_orders o
   where o.user_id = uid and o.status = 'pending' and o.created_at > now() - interval '3 hours';
$$;

-- سعر باقة لهاد الحساب: سعر التجربة النشط (نفس pricing_test_prices تاع Premium) ولا سعر الباقة
create or replace function public.keys_pack_price(uid uuid, p_pack text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'id', k.id, 'keys', k.keys, 'active', k.is_active, 'play_product_id', k.play_product_id,
    'tier', case when t.user_id is null then 'regular' else 'test' end,
    'price_dzd', coalesce(t.price_dzd, k.price_dzd),
    'price_usd', coalesce(t.price_usd, k.price_usd))
    from public.key_packs k
    left join public.pricing_test_prices t on t.user_id = uid and t.expires_at > now()
   where k.id = p_pack;
$$;

-- مفاتيح طلب ما تستعملوش (FIFO: الأقدم يتستعمل أولاً — الشراء الجديد يبقى قابل للاسترداد).
-- قدرة كل سطر = المفاتيح ناقص المسترد منو؛ الاستعمالات تتوزّع على السطور بترتيب الوقت.
create or replace function public.key_order_unused(p_order bigint)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  with o as (select user_id from public.key_orders where id = p_order),
  credits as (
    select l.id, l.order_id, l.created_at,
           l.delta + coalesce((select sum(r.delta) from public.key_ledger r
                                where r.kind = 'refund' and r.order_id = l.order_id and l.kind = 'purchase'), 0) as cap
      from public.key_ledger l, o
     where l.user_id = o.user_id and l.kind in ('purchase', 'gift')
  ),
  cum as (select c.*, sum(c.cap) over (order by c.created_at, c.id) as upto from credits c),
  used as (select count(*)::int as n from public.key_ledger l, o where l.user_id = o.user_id and l.kind = 'use')
  select coalesce((select greatest(0, least(c.cap, c.upto - u.n))::int from cum c, used u where c.order_id = p_order), 0);
$$;

-- الرصيد (بالدينار وبالدولار) = كل واش خلّصو في المفاتيح ناقص المسترد. التحويل بين العملتين بنسبة سعر
-- Premium العام الحالي (pricing_public، مثلاً 9,900 دج = 39$). سعر Premium بعد الرصيد، والباقي الأدنى
-- (حدّ البوابات: 50 دج / 0.50$). covered = الرصيد يغطي Premium كامل (التفعيل بلا دفع).
create or replace function public.keys_credit_quote_for(uid uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  p        json := public.pricing_for_user(uid);
  pub      json := public.pricing_public();
  v_ratio  numeric;
  v_dzd    numeric;
  v_usd    numeric;
  c_dzd    numeric;
  c_usd    numeric;
  pr_dzd   numeric := (p->>'price_dzd')::numeric;
  pr_usd   numeric := (p->>'price_usd')::numeric;
  d_dzd    numeric;
  d_usd    numeric;
  v_cover  boolean;
begin
  if uid is null then
    return json_build_object('status', 'auth');
  end if;
  if public.keys_premium_blocked(uid) then
    return json_build_object('status', 'has_premium');
  end if;

  v_ratio := (pub->>'price_dzd')::numeric / nullif((pub->>'price_usd')::numeric, 0);
  select coalesce(sum(o.amount - o.refunded_amount) filter (where o.currency = 'DZD'), 0),
         coalesce(sum(o.amount - o.refunded_amount) filter (where o.currency = 'USD'), 0)
    into v_dzd, v_usd
    from public.key_orders o
   where o.user_id = uid and o.status = 'paid';

  c_dzd := floor(v_dzd + v_usd * coalesce(v_ratio, 0));
  c_usd := round(floor((v_usd + v_dzd / nullif(v_ratio, 0)) * 100) / 100, 2);
  c_usd := coalesce(c_usd, round(v_usd, 2));
  v_cover := (c_dzd > 0 and c_dzd >= pr_dzd) or (c_usd > 0 and c_usd >= pr_usd);

  d_dzd := case when v_cover then 0 else greatest(pr_dzd - c_dzd, 0) end;
  d_usd := round(case when v_cover then 0 else greatest(pr_usd - c_usd, 0) end, 2);
  if d_dzd > 0 and d_dzd < 50 then d_dzd := 50; end if;
  if d_usd > 0 and d_usd < 0.50 then d_usd := 0.50; end if;

  return json_build_object(
    'status', 'ok',
    'tier', p->>'tier',
    'price_dzd', pr_dzd,
    'price_usd', pr_usd,
    'paid_dzd', v_dzd,
    'paid_usd', v_usd,
    'credit_dzd', c_dzd,
    'credit_usd', c_usd,
    'applied_dzd', least(c_dzd, pr_dzd) ,
    'applied_usd', least(c_usd, pr_usd),
    'due_dzd', d_dzd,
    'due_usd', d_usd,
    'covered', v_cover
  );
end;
$$;

-- الرصيد تحسب في Premium (شراء Premium بالرصيد غير مستردّ، ولا تفعيل كامل بالرصيد)؟
-- reserved = دفع Premium بالرصيد بدا في آخر 24 ساعة (يمنع استرداد المفاتيح قبل ما يكمل).
create or replace function public.keys_credit_state(uid uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'applied_at', (select min(c.created_at) from public.key_credit_uses c
                    where c.user_id = uid
                      and ((c.kind = 'full' and c.revoked_at is null)
                           or exists (select 1 from public.purchases pu
                                       where pu.provider_ref = c.provider_ref and pu.refunded_at is null))),
    'reserved_at', (select max(c.created_at) from public.key_credit_uses c
                     where c.user_id = uid and c.kind = 'checkout' and c.created_at > now() - interval '24 hours'
                       and not exists (select 1 from public.purchases pu where pu.provider_ref = c.provider_ref))
  );
$$;

-- أهلية استرداد طلب: مدفوع، ماشي مسترد، خلال 7 أيام، فيه مفاتيح ما تستعملوش، والرصيد ما تحسبش في Premium
create or replace function public.key_order_refund_info(p_order bigint)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  o       public.key_orders%rowtype;
  v_un    integer;
  v_st    json;
  v_amt   numeric;
  v_why   text := null;
begin
  select * into o from public.key_orders where id = p_order;
  if not found then
    return json_build_object('eligible', false, 'reason', 'not_found');
  end if;
  v_un := case when o.status = 'paid' and o.refunded_at is null then public.key_order_unused(o.id) else 0 end;
  v_st := public.keys_credit_state(o.user_id);
  v_amt := case when o.keys > 0 then o.amount * v_un / o.keys else 0 end;
  v_amt := case when o.currency = 'DZD' then round(v_amt) else round(v_amt, 2) end;

  if o.status <> 'paid' then v_why := 'not_paid';
  elsif o.refunded_at is not null then v_why := 'refunded';
  elsif v_un = 0 then v_why := 'all_used';
  elsif (v_st->>'applied_at') is not null and (v_st->>'applied_at')::timestamptz >= o.paid_at then v_why := 'in_premium';
  elsif (v_st->>'reserved_at') is not null and (v_st->>'reserved_at')::timestamptz >= o.paid_at then v_why := 'premium_pending';
  elsif now() > o.paid_at + interval '7 days' then v_why := 'expired';
  end if;

  return json_build_object(
    'eligible', v_why is null,
    'reason', v_why,
    'unused', v_un,
    'amount', v_amt,
    'currency', o.currency,
    'refund_until', o.paid_at + interval '7 days'
  );
end;
$$;

-- يزيد إيميل لصندوق المفاتيح (kind + ref فريد = مرّة وحدة). نفس سويتش phase33 + سويتش خاص بالمفاتيح.
create or replace function public.key_email_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.email_enabled()
     and coalesce((select s.value = 'true' from private.app_secrets s where s.key = 'keys_emails_enabled'), false);
$$;

-- pg_net بعد الـ commit. الجسم { keys_id } (ماشي { id }): send-email القديمة ترفضو (bad id)، ما تخلطش الصندوقين.
create or replace function public.key_email_dispatch(p_id bigint)
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
    body := jsonb_build_object('keys_id', p_id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-email-secret', v_secret),
    timeout_milliseconds := 15000
  );
end;
$$;

create table if not exists public.key_emails (
  id          bigint generated always as identity primary key,
  kind        text not null check (kind in ('keys_purchase', 'keys_gift', 'test')),
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
  constraint key_emails_kind_ref unique (kind, ref)
);
create index if not exists key_emails_due on public.key_emails (status, send_after) where status in ('pending', 'failed');

alter table public.key_emails enable row level security;
revoke all on public.key_emails from public, anon, authenticated;

create or replace function public.key_email_enqueue(p_kind text, p_user uuid, p_ref text, p_payload jsonb default '{}'::jsonb)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_on boolean := public.key_email_enabled();
  v_id bigint;
begin
  insert into public.key_emails (kind, user_id, ref, payload, status, last_error)
  values (p_kind, p_user, p_ref, coalesce(p_payload, '{}'::jsonb),
          case when v_on then 'pending' else 'skipped' end,
          case when v_on then null else 'disabled' end)
  on conflict (kind, ref) do nothing
  returning id into v_id;
  if v_id is not null and v_on then
    perform public.key_email_dispatch(v_id);
  end if;
  return v_id;
end;
$$;

-- ===================== 6) Triggers الإيميلات (ما يكسّرو حتى معاملة) =====================
create or replace function public.key_email_on_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    if new.status = 'paid' and new.user_id is not null and (tg_op = 'INSERT' or old.status is distinct from 'paid') then
      perform public.key_email_enqueue('keys_purchase', new.user_id, new.id::text);
    end if;
  exception when others then
    raise warning 'key_email_on_order: %', sqlerrm;
  end;
  return null;
end;
$$;

create or replace trigger key_email_order
  after insert or update of status on public.key_orders
  for each row execute function public.key_email_on_order();

create or replace function public.key_email_on_gift()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    if new.kind = 'gift' and new.user_id is not null then
      perform public.key_email_enqueue('keys_gift', new.user_id, new.id::text);
    end if;
  exception when others then
    raise warning 'key_email_on_gift: %', sqlerrm;
  end;
  return null;
end;
$$;

create or replace trigger key_email_gift
  after insert on public.key_ledger
  for each row execute function public.key_email_on_gift();

-- send-email: حجز المهمة + بياناتها (service_role برك). null = مبعوثة / محجوزة / ما بقاتش صالحة.
create or replace function public.key_email_claim(p_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  j      public.key_emails;
  u      record;
  v_to   text;
  v_lang text;
  v_name text := '';
  v_tpl  text;
  v_data jsonb;
begin
  update public.key_emails e
     set status = 'sending', attempts = e.attempts + 1, claimed_at = now()
   where e.id = p_id
     and e.attempts < 5
     and ((e.status = 'pending' and e.send_after <= now()) or e.status = 'failed')
  returning e.* into j;
  if not found then
    return null;
  end if;

  if j.kind = 'test' then
    v_to := j.payload->>'to';
    v_lang := j.payload->>'lang';
    v_tpl := j.payload->>'template';
    v_data := coalesce(j.payload->'data', '{}'::jsonb);
  else
    select au.email, au.raw_user_meta_data as meta, p.full_name
      into u
      from auth.users au
      left join public.profiles p on p.id = au.id
     where au.id = j.user_id;
    if not found or u.email is null then
      update public.key_emails set status = 'skipped', last_error = 'no_user' where id = j.id;
      return null;
    end if;
    v_to := u.email;
    v_lang := u.meta->>'lang';
    v_name := coalesce(nullif(btrim(u.full_name), ''), nullif(btrim(u.meta->>'full_name'), ''), nullif(btrim(u.meta->>'name'), ''), '');
    v_tpl := j.kind;

    if j.kind = 'keys_purchase' then
      select jsonb_build_object('keys', o.keys, 'amount', o.amount, 'currency', o.currency, 'provider', o.provider,
                                'tier', o.tier, 'paidAt', o.paid_at, 'balance', public.keys_balance(o.user_id),
                                'refundUntil', o.paid_at + interval '7 days')
        into v_data
        from public.key_orders o
       where o.id = j.ref::bigint and o.status = 'paid';
    elsif j.kind = 'keys_gift' then
      select jsonb_build_object('keys', l.delta, 'balance', public.keys_balance(l.user_id), 'giftedAt', l.created_at)
        into v_data
        from public.key_ledger l
       where l.id = j.ref::bigint and l.kind = 'gift';
    end if;
    if v_data is null then
      update public.key_emails set status = 'skipped', last_error = 'no_data' where id = j.id;
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

create or replace function public.key_email_done(p_id bigint, p_ok boolean, p_provider_id text default null, p_error text default null)
returns void
language sql
security definer
set search_path = public
as $$
  update public.key_emails
     set status = case when p_ok then 'sent' else 'failed' end,
         sent_at = case when p_ok then now() else sent_at end,
         provider_id = coalesce(p_provider_id, provider_id),
         last_error = case when p_ok then null else left(p_error, 500) end
   where id = p_id and status = 'sending';
$$;

-- cron: إعادة المحاولة (5 مرات، خلال يومين) — نفس email_dispatch_due
create or replace function public.key_email_dispatch_due()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  n integer := 0;
begin
  if not public.key_email_enabled() then
    return 0;
  end if;
  update public.key_emails
     set status = 'failed', last_error = coalesce(last_error, 'timeout')
   where status = 'sending' and claimed_at < now() - interval '10 minutes';
  for r in
    select e.id from public.key_emails e
     where e.created_at > now() - interval '2 days'
       and e.attempts < 5
       and ((e.status = 'pending' and e.send_after <= now())
         or (e.status = 'failed' and e.claimed_at < now() - make_interval(mins => 5 * e.attempts)))
     order by e.id
     limit 25
  loop
    perform public.key_email_dispatch(r.id);
    n := n + 1;
  end loop;
  return n;
end;
$$;

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'codpromo-keys-email-dispatch') then
    perform cron.schedule('codpromo-keys-email-dispatch', '* * * * *', 'select public.key_email_dispatch_due()');
  end if;
end;
$$;

-- معاينة القالبين (postgres برك، من SQL): select public.keys_email_test_send('<email>', 'ar');
create or replace function public.keys_email_test_send(p_to text, p_lang text default 'ar')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  t       text;
  n       integer := 0;
  v_id    bigint;
  v_stamp text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
begin
  foreach t in array array['keys_purchase', 'keys_gift'] loop
    insert into public.key_emails (kind, user_id, ref, payload, status)
    values ('test', null, 'test:' || t || ':' || p_lang || ':' || v_stamp,
            jsonb_build_object('to', p_to, 'lang', p_lang, 'template', t,
              'data', case t
                when 'keys_purchase' then jsonb_build_object('keys', 3, 'amount', 900, 'currency', 'DZD', 'provider', 'slickpay',
                                                             'tier', 'regular', 'paidAt', now(), 'balance', 3, 'refundUntil', now() + interval '7 days')
                else jsonb_build_object('keys', 2, 'balance', 2, 'giftedAt', now()) end),
            'pending')
    returning id into v_id;
    perform public.key_email_dispatch(v_id);
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- ===================== 7) المستخدم =====================
-- الباقات بسعر هاد الحساب (سعر التجربة إذا نشط) + حدّ الشراء: ما نبيعوش مفاتيح أكثر من الأكواد المقفولة.
-- max_keys = المقفولة − الرصيد − اللي في الطريق. blocked = Premium حقيقي (ما يشوفش الباقات).
create or replace function public.my_key_packs()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_locked  integer;
  v_balance integer;
  v_pending integer;
  v_max     integer;
begin
  if v_uid is not null then
    v_locked := public.keys_locked_count(v_uid);
    v_balance := public.keys_balance(v_uid);
    v_pending := public.keys_pending(v_uid);
    v_max := greatest(v_locked - v_balance - v_pending, 0);
  end if;
  return json_build_object(
    'blocked', v_uid is not null and public.keys_premium_blocked(v_uid),
    'locked', v_locked,
    'balance', v_balance,
    'pending', v_pending,
    'max_keys', v_max,
    'test_expires_at', (select t.expires_at from public.pricing_test_prices t where t.user_id = v_uid and t.expires_at > now()),
    'packs', coalesce((
      select json_agg(json_build_object(
               'id', k.id, 'keys', k.keys, 'play_product_id', k.play_product_id,
               'price_dzd', (pp->>'price_dzd')::numeric, 'price_usd', (pp->>'price_usd')::numeric,
               'tier', pp->>'tier',
               'fits', v_max is null or k.keys <= v_max
             ) order by k.position, k.keys)
        from public.key_packs k, lateral (select public.keys_pack_price(v_uid, k.id) as pp) x
       where k.is_active
    ), '[]'::json)
  );
end;
$$;

-- حالة مفاتيحي: الرصيد، الشركات المفتوحة بالماسي، التاريخ (آخر 50)، الرصيد اللي ينقص من Premium (الموقع برك).
create or replace function public.my_keys()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return json_build_object('status', 'guest');
  end if;
  return json_build_object(
    'status', 'ok',
    'balance', public.keys_balance(v_uid),
    'blocked', public.keys_premium_blocked(v_uid),
    'locked', public.keys_locked_count(v_uid),
    'pending', public.keys_pending(v_uid),
    'unlocked', coalesce((select json_agg(l.company_id order by l.created_at)
                            from public.key_ledger l
                           where l.user_id = v_uid and l.kind = 'use' and l.company_id is not null), '[]'::json),
    'history', coalesce((
      select json_agg(h order by h.created_at desc, h.id desc) from (
        select l.id, l.kind, l.delta, l.created_at, o.provider, o.keys as order_keys,
               case when c.id is null then null
                    else json_build_object('id', c.id, 'name', c.name, 'slug', c.slug, 'logo', c.logo, 'type', c.type) end as company
          from public.key_ledger l
          left join public.key_orders o on o.id = l.order_id
          left join public.companies c on c.id = l.company_id
         where l.user_id = v_uid
         order by l.created_at desc, l.id desc
         limit 50
      ) h
    ), '[]'::json),
    'credit', public.keys_credit_quote_for(v_uid)
  );
end;
$$;

-- للواجهة (الموقع): الرصيد وسعر Premium بعدو — للعرض برك، الخادم يعاود يحسب عند الدفع
create or replace function public.keys_credit_quote()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select public.keys_credit_quote_for(auth.uid());
$$;

-- استعمال مفتاح ماسي على شركة (مسجّل برك، GET مرفوض). ذرّي: قفل استشاري لكل حساب، والرصيد يتحدّث
-- بقفل سطرو + CHECK >= 0، ومفتاح واحد لكل شركة (فهرس فريد).
--  status: ok | yours | free_key | no_keys | has_premium | unavailable | auth
--  ok / yours / free_key يرجّعو premium_code و premium_url (free_key = مفتوحة أصلاً بالمفتاح الذهبي، بلا مفتاح ماسي).
create or replace function public.use_diamond_key(p_company_id bigint, p_source text default null)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_source text := case when p_source in ('home', 'offers', 'featured', 'store', 'category', 'favorites', 'dashboard', 'other')
                        then p_source else 'other' end;
  v_bal    integer;
  c        public.companies%rowtype;
  u        auth.users%rowtype;
begin
  if current_setting('transaction_read_only') = 'on' then
    raise exception 'POST only' using errcode = '25006';
  end if;
  if v_uid is null then
    return json_build_object('status', 'auth');
  end if;
  select * into u from auth.users au where au.id = v_uid;
  if not found or coalesce(u.is_anonymous, false) then
    return json_build_object('status', 'auth');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('diamond_key:' || v_uid::text, 0));

  if exists (select 1 from public.key_ledger l where l.user_id = v_uid and l.kind = 'use' and l.company_id = p_company_id) then
    select * into c from public.companies co where co.id = p_company_id;
    return json_build_object('status', 'yours', 'company_id', p_company_id, 'balance', public.keys_balance(v_uid),
                             'premium_code', c.premium_code, 'premium_url', c.premium_url);
  end if;

  if public.keys_premium_blocked(v_uid) then
    return json_build_object('status', 'has_premium');
  end if;
  if not public.keys_company_ok(p_company_id) then
    return json_build_object('status', 'unavailable');
  end if;
  select * into c from public.companies co where co.id = p_company_id;

  -- مفتوحة أصلاً بالمفتاح الذهبي: ما نحرقوش مفتاح ماسي
  if exists (select 1 from public.free_reveals r where r.user_id = v_uid and r.company_id = p_company_id) then
    return json_build_object('status', 'free_key', 'company_id', p_company_id, 'balance', public.keys_balance(v_uid),
                             'premium_code', c.premium_code, 'premium_url', c.premium_url);
  end if;

  select w.balance into v_bal from public.key_wallets w where w.user_id = v_uid for update;
  if coalesce(v_bal, 0) < 1 then
    return json_build_object('status', 'no_keys', 'balance', coalesce(v_bal, 0));
  end if;

  begin
    insert into public.key_ledger (user_id, kind, delta, company_id, source)
    values (v_uid, 'use', -1, p_company_id, v_source);
  exception when unique_violation then
    return json_build_object('status', 'yours', 'company_id', p_company_id, 'balance', public.keys_balance(v_uid),
                             'premium_code', c.premium_code, 'premium_url', c.premium_url);
  end;

  return json_build_object('status', 'ok', 'company_id', p_company_id, 'balance', public.keys_balance(v_uid),
                           'premium_code', c.premium_code, 'premium_url', c.premium_url);
end;
$$;

-- الكود تاع شركة فتحها المستخدم بمفتاح ماسي (هي برك). حتى كي تبدّل الشركة الكود: يرجّع الكود الحالي.
create or replace function public.get_diamond_code(p_company_id bigint)
returns table (premium_code text, premium_url text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  if not exists (select 1 from public.key_ledger l
                  where l.user_id = auth.uid() and l.kind = 'use' and l.company_id = p_company_id) then
    return;
  end if;
  return query select c.premium_code, c.premium_url from public.companies c where c.id = p_company_id;
end;
$$;

-- Premium بالرصيد كامل (الموقع برك): الرصيد يغطي سعر Premium → Premium مدى الحياة بلا دفع.
-- نفس حقول grant_lifetime_purchase في profiles (payment_provider = 'keys')، والسجلّ في key_credit_uses.
--  status: ok | not_covered | has_premium | auth
create or replace function public.keys_premium_redeem()
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  q     json;
begin
  if current_setting('transaction_read_only') = 'on' then
    raise exception 'POST only' using errcode = '25006';
  end if;
  if v_uid is null then
    return json_build_object('status', 'auth');
  end if;
  perform pg_advisory_xact_lock(hashtextextended('diamond_key:' || v_uid::text, 0));

  q := public.keys_credit_quote_for(v_uid);
  if q->>'status' = 'has_premium' then
    return json_build_object('status', 'has_premium');
  end if;
  if q->>'status' <> 'ok' then
    return json_build_object('status', 'auth');
  end if;
  if not (q->>'covered')::boolean then
    return json_build_object('status', 'not_covered');
  end if;

  insert into public.key_credit_uses (user_id, kind, provider, provider_ref, currency, tier, premium_price, credit, amount_due)
  values (v_uid, 'full', 'credit', 'credit:' || gen_random_uuid()::text, 'DZD', q->>'tier',
          (q->>'price_dzd')::numeric, greatest((q->>'applied_dzd')::numeric, 1), 0);

  update public.profiles
     set is_premium = true,
         premium_until = null,
         plan_type = 'lifetime',
         payment_provider = 'keys',
         subscription_status = 'lifetime'
   where id = v_uid;
  if not found then
    raise exception 'profile not found';
  end if;
  return json_build_object('status', 'ok');
end;
$$;

-- آخر تفعيل Premium بالرصيد كامل (صفحة النجاح)
create or replace function public.my_credit_upgrade()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select (select json_build_object('tier', c.tier, 'credit', c.credit, 'currency', c.currency,
                                   'premium_price', c.premium_price, 'created_at', c.created_at)
            from public.key_credit_uses c
           where c.user_id = auth.uid() and c.kind = 'full' and c.revoked_at is null
           order by c.created_at desc limit 1);
$$;

-- ===================== 8) الخادم (Edge Functions، service_role برك) =====================
-- عرض سعر باقة قبل ما نصنعو الدفع. status: ok | has_premium | inactive | limit | auth
create or replace function public.keys_order_quote(p_uid uuid, p_pack text)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  pp    json := public.keys_pack_price(p_uid, p_pack);
  v_max integer;
begin
  if p_uid is null then
    return json_build_object('status', 'auth');
  end if;
  if pp is null or not (pp->>'active')::boolean then
    return json_build_object('status', 'inactive');
  end if;
  if public.keys_premium_blocked(p_uid) then
    return json_build_object('status', 'has_premium');
  end if;
  v_max := greatest(public.keys_locked_count(p_uid) - public.keys_balance(p_uid) - public.keys_pending(p_uid), 0);
  if (pp->>'keys')::int > v_max then
    return json_build_object('status', 'limit', 'max_keys', v_max);
  end if;
  return json_build_object('status', 'ok', 'keys', (pp->>'keys')::int, 'tier', pp->>'tier',
                           'price_dzd', (pp->>'price_dzd')::numeric, 'price_usd', (pp->>'price_usd')::numeric);
end;
$$;

-- طلب مفتوح (pending) بعد ما البوابة صنعت الدفع. يعاود يتحقق (قفل لكل حساب): الحدّ، Premium، والمبلغ
-- لازم يطابق السعر اللي يتقرّر هنا. أي اختلاف → خطأ (الدالة ما تعطيش رابط الدفع).
create or replace function public.keys_order_open(
  p_uid uuid, p_pack text, p_provider text, p_ref text, p_amount numeric, p_currency text, p_tier text
)
returns bigint
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  q    json;
  v_id bigint;
  v_exp numeric;
begin
  if p_provider not in ('stripe', 'slickpay', 'paypal') or p_currency not in ('DZD', 'USD') then
    raise exception 'invalid provider' using errcode = '22023';
  end if;
  if (p_provider = 'slickpay') <> (p_currency = 'DZD') then
    raise exception 'invalid currency' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('diamond_key:' || p_uid::text, 0));
  q := public.keys_order_quote(p_uid, p_pack);
  if q->>'status' <> 'ok' then
    raise exception 'quote: %', q->>'status' using errcode = '22023';
  end if;
  v_exp := case when p_currency = 'DZD' then (q->>'price_dzd')::numeric else (q->>'price_usd')::numeric end;
  if round(coalesce(p_amount, -1) * 100) <> round(v_exp * 100) or p_tier is distinct from q->>'tier' then
    raise exception 'amount mismatch' using errcode = '22023';
  end if;
  insert into public.key_orders (user_id, pack_id, keys, provider, provider_ref, amount, currency, tier, status)
  values (p_uid, p_pack, (q->>'keys')::int, p_provider, btrim(p_ref), v_exp, p_currency, p_tier, 'pending')
  returning id into v_id;
  return v_id;
end;
$$;

-- الطلب تخلّص (بعد التحقق عند البوابة): المبلغ والعملة لازم يطابقو الطلب، ثم المفاتيح تتزاد (مرة وحدة).
--  'granted' | 'duplicate' | 'mismatch' | 'not_found' | 'no_user'
create or replace function public.keys_order_paid(
  p_provider text, p_ref text, p_amount numeric, p_currency text, p_payment_ref text default null
)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  o public.key_orders%rowtype;
begin
  select * into o from public.key_orders where provider = p_provider and provider_ref = p_ref for update;
  if not found then
    return 'not_found';
  end if;
  if o.status = 'paid' then
    return 'duplicate';
  end if;
  if upper(coalesce(p_currency, '')) <> o.currency or round(coalesce(p_amount, -1) * 100) <> round(o.amount * 100) then
    return 'mismatch';
  end if;
  update public.key_orders
     set status = 'paid', paid_at = now(), payment_ref = nullif(btrim(coalesce(p_payment_ref, '')), '')
   where id = o.id;
  if o.user_id is null then
    return 'no_user';
  end if;
  insert into public.key_ledger (user_id, kind, delta, order_id) values (o.user_id, 'purchase', o.keys, o.id);
  return 'granted';
end;
$$;

-- فشل / إلغاء (لا نلمس المفاتيح)
create or replace function public.keys_order_failed(p_provider text, p_ref text)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update public.key_orders set status = 'failed'
   where provider = p_provider and provider_ref = p_ref and status = 'pending';
$$;

-- Google Play (منتوج consumable): بعد التحقق عند Google. نفس الرمز مرّتين = duplicate، رمز حساب آخر = other_user.
-- المبلغ = سعر الباقة بالدولار (Google ما يعطيش المدفوع، نفس Premium)، والشراء التجريبي بـ 0 و tier = test.
--  'granted' | 'duplicate' | 'other_user' | 'invalid_product'
create or replace function public.keys_play_grant(
  p_uid uuid, p_product text, p_token text, p_order_ref text, p_test boolean
)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  k    public.key_packs%rowtype;
  o    public.key_orders%rowtype;
  v_id bigint;
begin
  if p_uid is null or coalesce(btrim(p_token), '') = '' then
    raise exception 'invalid' using errcode = '22023';
  end if;
  select * into k from public.key_packs where play_product_id = p_product;
  if not found then
    return 'invalid_product';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('diamond_key:' || p_uid::text, 0));

  select * into o from public.key_orders
   where (provider = 'google_play' and provider_ref = p_token)
      or (provider = 'google_play' and p_order_ref is not null and payment_ref = p_order_ref)
   limit 1;
  if found then
    return case when o.user_id = p_uid then 'duplicate' else 'other_user' end;
  end if;

  insert into public.key_orders (user_id, pack_id, keys, provider, provider_ref, payment_ref, amount, currency, tier, status, paid_at)
  values (p_uid, k.id, k.keys, 'google_play', btrim(p_token), nullif(btrim(coalesce(p_order_ref, '')), ''),
          case when coalesce(p_test, false) then 0 else k.price_usd end, 'USD',
          case when coalesce(p_test, false) then 'test' else 'regular' end, 'paid', now())
  returning id into v_id;
  insert into public.key_ledger (user_id, kind, delta, order_id) values (p_uid, 'purchase', k.keys, v_id);
  return 'granted';
end;
$$;

-- الاسترداد (داخلي): المفاتيح اللي ما تستعملوش من هاد الطلب تتنحّى، والطلب يتعلّم مسترد.
create or replace function public.key_order_refund_apply(p_order bigint, p_refunded numeric, p_by uuid)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  o     public.key_orders%rowtype;
  v_un  integer;
begin
  select * into o from public.key_orders where id = p_order;
  if not found or o.status <> 'paid' then
    return json_build_object('status', 'not_found');
  end if;
  if o.user_id is not null then
    perform pg_advisory_xact_lock(hashtextextended('diamond_key:' || o.user_id::text, 0));
    perform 1 from public.key_wallets w where w.user_id = o.user_id for update;
  end if;
  select * into o from public.key_orders where id = p_order for update;
  if o.refunded_at is not null then
    update public.key_orders
       set refunded_amount = greatest(refunded_amount, least(coalesce(p_refunded, 0), amount))
     where id = o.id;
    return json_build_object('status', 'already');
  end if;
  v_un := public.key_order_unused(o.id);
  if v_un > 0 and o.user_id is not null then
    insert into public.key_ledger (user_id, kind, delta, order_id, created_by) values (o.user_id, 'refund', -v_un, o.id, p_by);
  end if;
  update public.key_orders
     set refunded_at = now(), refunded_amount = least(greatest(coalesce(p_refunded, o.amount), 0), o.amount)
   where id = o.id;
  return json_build_object('status', 'refunded', 'removed', v_un);
end;
$$;

-- من webhook Stripe (payment_intent) / PayPal (capture): أي استرداد (كامل ولا جزئي) على طلب مفاتيح.
-- ref مجهول (شراء Premium، Kajabi…) → not_found بلا أي أثر.
create or replace function public.keys_order_refund_gateway(p_provider text, p_ref text, p_refunded numeric)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  select id into v_id from public.key_orders
   where provider = p_provider and status = 'paid' and (payment_ref = p_ref or provider_ref = p_ref)
   order by id limit 1;
  if v_id is null then
    return 'not_found';
  end if;
  return public.key_order_refund_apply(v_id, p_refunded, null)->>'status';
end;
$$;

-- Premium بالرصيد عبر البوابة (الباقي برك): يعاود يحسب الرصيد هنا (قفل لكل حساب)، الباقي والـ tier لازم
-- يطابقو اللي صنعت بيه البوابة، يسجّل key_credit_uses، ويحطّ الفاتورة / الطلب في جداول Premium الكاينة
-- (slickpay_invoices / paypal_orders) باش الدوال الكاينة (slickpay-invoice-status، paypal-capture-order،
-- stripe-webhook) يكمّلو الشراء كيما Premium العادي بالمبلغ المحفوظ.
create or replace function public.keys_credit_open(
  p_uid uuid, p_provider text, p_ref text, p_currency text, p_due numeric, p_tier text
)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  q     json;
  v_due numeric;
  v_pr  numeric;
  v_cr  numeric;
begin
  if p_provider not in ('stripe', 'slickpay', 'paypal') or (p_provider = 'slickpay') <> (p_currency = 'DZD')
     or p_currency not in ('DZD', 'USD') or coalesce(btrim(p_ref), '') = '' then
    raise exception 'invalid' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('diamond_key:' || p_uid::text, 0));
  q := public.keys_credit_quote_for(p_uid);
  if q->>'status' <> 'ok' or (q->>'covered')::boolean then
    raise exception 'quote: %', coalesce(q->>'status', 'none') using errcode = '22023';
  end if;
  v_due := case when p_currency = 'DZD' then (q->>'due_dzd')::numeric else (q->>'due_usd')::numeric end;
  v_pr := case when p_currency = 'DZD' then (q->>'price_dzd')::numeric else (q->>'price_usd')::numeric end;
  v_cr := case when p_currency = 'DZD' then (q->>'applied_dzd')::numeric else (q->>'applied_usd')::numeric end;
  if v_cr <= 0 then
    raise exception 'no credit' using errcode = '22023';
  end if;
  if round(coalesce(p_due, -1) * 100) <> round(v_due * 100) or p_tier is distinct from q->>'tier' then
    raise exception 'amount mismatch' using errcode = '22023';
  end if;

  insert into public.key_credit_uses (user_id, kind, provider, provider_ref, currency, tier, premium_price, credit, amount_due)
  values (p_uid, 'checkout', p_provider, btrim(p_ref), p_currency, p_tier, v_pr, v_cr, v_due);

  if p_provider = 'slickpay' then
    insert into public.slickpay_invoices (invoice_id, user_id, plan_type, tier, amount, status)
    values (btrim(p_ref), p_uid, 'lifetime', p_tier, v_due::integer, 'pending');
  elsif p_provider = 'paypal' then
    insert into public.paypal_orders (order_id, user_id, plan_type, tier, amount_usd, status)
    values (btrim(p_ref), p_uid, 'lifetime', p_tier, v_due, 'pending');
  end if;
  return json_build_object('due', v_due, 'credit', v_cr, 'price', v_pr, 'tier', p_tier);
end;
$$;

-- ===================== 9) الأدمن (كلها admin_assert) =====================
create or replace function public.admin_key_packs()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.admin_assert();
  return json_build_object(
    'packs', coalesce((select json_agg(json_build_object('id', k.id, 'keys', k.keys, 'price_dzd', k.price_dzd,
                                 'price_usd', k.price_usd, 'play_product_id', k.play_product_id, 'is_active', k.is_active,
                                 'position', k.position, 'updated_at', k.updated_at) order by k.position, k.keys)
                         from public.key_packs k), '[]'::json),
    'pricing', public.pricing_public()
  );
end;
$$;

create or replace function public.admin_save_key_pack(
  p_id text, p_keys integer, p_dzd integer, p_usd numeric, p_active boolean, p_position integer
)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  perform public.admin_assert();
  if p_keys is null or p_keys < 2 or p_keys > 50 or p_dzd is null or p_dzd < 50 or p_dzd > 1000000
     or p_usd is null or p_usd < 0.5 or p_usd > 100000 then
    raise exception 'invalid pack' using errcode = '22023';
  end if;
  update public.key_packs
     set keys = p_keys, price_dzd = p_dzd, price_usd = round(p_usd, 2), is_active = coalesce(p_active, true),
         position = coalesce(p_position, position)::smallint, updated_at = now()
   where id = p_id;
  if not found then
    raise exception 'pack not found' using errcode = 'P0002';
  end if;
  return public.admin_key_packs();
end;
$$;

-- إهداء مفاتيح لأي حساب (بالإيميل) مع السبب: 1–20 مفتاح، السبب 3–300 حرف
create or replace function public.admin_gift_keys(p_email text, p_count integer, p_reason text)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid   uuid;
  v_email text;
  v_note  text := btrim(coalesce(p_reason, ''));
begin
  perform public.admin_assert();
  if current_setting('transaction_read_only') = 'on' then
    raise exception 'POST only' using errcode = '25006';
  end if;
  if p_count is null or p_count < 1 or p_count > 20 or length(v_note) < 3 or length(v_note) > 300 then
    raise exception 'invalid gift' using errcode = '22023';
  end if;
  select u.id, u.email::text into v_uid, v_email
    from auth.users u where lower(u.email) = lower(btrim(coalesce(p_email, ''))) limit 1;
  if v_uid is null then
    raise exception 'user not found' using errcode = 'P0002';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('diamond_key:' || v_uid::text, 0));
  insert into public.key_ledger (user_id, kind, delta, note, created_by) values (v_uid, 'gift', p_count, v_note, auth.uid());
  return json_build_object('user_id', v_uid, 'email', v_email, 'keys', p_count, 'balance', public.keys_balance(v_uid),
                           'premium', public.keys_premium_blocked(v_uid));
end;
$$;

-- الأرقام: المباعة (بلا التجربة ولا الأدمن)، المستعملة، المهداة، المستردّة، الرصيد الباقي، المداخيل حسب العملة،
-- الزبائن، "شراو مفاتيح ومن بعد طلعو لـ Premium"، التفعيل بالرصيد، ومنحنى 30 يوم.
create or replace function public.admin_keys_stats()
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
      select o.* from public.key_orders o
       where o.status = 'paid' and o.tier <> 'test'
         and not exists (select 1 from public.profiles pr where pr.id = o.user_id and pr.is_admin = true)
    )
    select json_build_object(
      'orders', (select count(*) from sales),
      'keys_sold', (select coalesce(sum(keys), 0) from sales),
      'buyers', (select count(distinct user_id) from sales),
      'refunded_orders', (select count(*) from sales where refunded_at is not null),
      'tests', (select count(*) from public.key_orders where status = 'paid' and tier = 'test'),
      'keys_used', (select count(*) from public.key_ledger where kind = 'use'),
      'keys_gifted', (select coalesce(sum(delta), 0) from public.key_ledger where kind = 'gift'),
      'keys_removed', (select coalesce(-sum(delta), 0) from public.key_ledger where kind = 'refund'),
      'keys_outstanding', (select coalesce(sum(balance), 0) from public.key_wallets),
      'revenue', coalesce((select json_agg(json_build_object('currency', currency, 'amount', amount, 'n', n) order by currency)
                             from (select currency, sum(amount - refunded_amount) as amount, count(*) as n from sales group by currency) r), '[]'::json),
      'by_pack', coalesce((select json_object_agg(pack_id, n) from (select pack_id, count(*) as n from sales group by pack_id) r), '{}'::json),
      'by_provider', coalesce((select json_object_agg(provider, n) from (select provider, count(*) as n from sales group by provider) r), '{}'::json),
      -- شرى مفاتيح ومن بعد طلع لـ Premium (شراء غير مستردّ ماشي تجربة بعد أول طلب مفاتيح، ولا تفعيل بالرصيد)
      'upgraded', (
        select count(distinct s.user_id) from sales s
         where exists (select 1 from public.purchases pu
                        where pu.user_id = s.user_id and pu.refunded_at is null and pu.tier <> 'test' and pu.purchased_at > s.paid_at)
            or exists (select 1 from public.key_credit_uses c where c.user_id = s.user_id and c.kind = 'full'
                        and c.revoked_at is null and c.created_at > s.paid_at)),
      'credit_full', (select count(*) from public.key_credit_uses where kind = 'full' and revoked_at is null),
      'credit_checkout', (select count(*) from public.key_credit_uses c
                           where c.kind = 'checkout'
                             and exists (select 1 from public.purchases pu where pu.provider_ref = c.provider_ref and pu.refunded_at is null)),
      'series', coalesce((
        select json_agg(json_build_object(
                 't', to_char(g.b, 'YYYY-MM-DD"T"HH24:MI'),
                 'sold', (select coalesce(sum(s.keys), 0) from sales s where date_trunc('day', s.paid_at at time zone tz) = g.b),
                 'used', (select count(*) from public.key_ledger l where l.kind = 'use' and date_trunc('day', l.created_at at time zone tz) = g.b)
               ) order by g.b)
          from generate_series(v_from, date_trunc('day', now() at time zone tz), interval '1 day') as g(b)
      ), '[]'::json),
      'packs', (select json_agg(json_build_object('id', id, 'keys', keys) order by position) from public.key_packs)
    )
  );
end;
$$;

-- الحسابات اللي عندهم حركة مفاتيح: الرصيد، المشترى، المستعمل، المهدى (بحث بالإيميل)
create or replace function public.admin_keys_accounts(p_search text default null, p_limit integer default 50, p_offset integer default 0)
returns table (
  user_id uuid, email text, full_name text, balance integer, bought bigint, used bigint, gifted bigint,
  removed bigint, premium boolean, last_at timestamptz, total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_q text := nullif(lower(btrim(coalesce(p_search, ''))), '');
begin
  perform public.admin_assert();
  p_limit := least(greatest(coalesce(p_limit, 50), 1), 500);
  p_offset := greatest(coalesce(p_offset, 0), 0);
  return query
    with a as (
      select l.user_id,
             sum(l.delta) filter (where l.kind = 'purchase') as bought,
             -sum(l.delta) filter (where l.kind = 'use') as used,
             sum(l.delta) filter (where l.kind = 'gift') as gifted,
             -sum(l.delta) filter (where l.kind = 'refund') as removed,
             max(l.created_at) as last_at
        from public.key_ledger l
       where l.user_id is not null
       group by l.user_id
    )
    select a.user_id, coalesce(u.email, p.email)::text, p.full_name::text, public.keys_balance(a.user_id),
           coalesce(a.bought, 0)::bigint, coalesce(a.used, 0)::bigint, coalesce(a.gifted, 0)::bigint, coalesce(a.removed, 0)::bigint,
           public.keys_premium_blocked(a.user_id), a.last_at, count(*) over ()
      from a
      left join auth.users u on u.id = a.user_id
      left join public.profiles p on p.id = a.user_id
     where v_q is null or lower(coalesce(u.email, p.email, '')) like '%' || v_q || '%'
        or lower(coalesce(p.full_name, '')) like '%' || v_q || '%'
     order by a.last_at desc
     limit p_limit offset p_offset;
end;
$$;

-- تاريخ حساب واحد (الحركات + السبب + الطلب)
create or replace function public.admin_keys_history(p_user uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.admin_assert();
  return json_build_object(
    'balance', public.keys_balance(p_user),
    'locked', public.keys_locked_count(p_user),
    'credit', public.keys_credit_quote_for(p_user),
    'rows', coalesce((
      select json_agg(json_build_object(
               'id', l.id, 'kind', l.kind, 'delta', l.delta, 'created_at', l.created_at, 'note', l.note, 'source', l.source,
               'by', coalesce(ub.email, '')::text,
               'company', case when c.id is null then null else json_build_object('id', c.id, 'name', c.name, 'logo', c.logo) end,
               'order', case when o.id is null then null else json_build_object('id', o.id, 'provider', o.provider, 'amount', o.amount,
                                                                                  'currency', o.currency, 'tier', o.tier, 'keys', o.keys) end
             ) order by l.created_at desc, l.id desc)
        from public.key_ledger l
        left join public.companies c on c.id = l.company_id
        left join public.key_orders o on o.id = l.order_id
        left join auth.users ub on ub.id = l.created_by
       where l.user_id = p_user
    ), '[]'::json)
  );
end;
$$;

-- طلبات المفاتيح لـ /admin/sales (الكل / مدفوعة / مؤهّلة للاسترداد / مستردّة / معلّقة)
create or replace function public.admin_list_key_orders(p_filter text default 'all', p_limit integer default 50, p_offset integer default 0)
returns table (
  id bigint, user_id uuid, email text, full_name text, is_admin boolean, pack_id text, keys integer, provider text,
  provider_ref text, payment_ref text, amount numeric, currency text, tier text, status text, created_at timestamptz,
  paid_at timestamptz, refunded_at timestamptz, refunded_amount numeric, refund json, total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  perform public.admin_assert();
  p_limit := least(greatest(coalesce(p_limit, 50), 1), 500);
  p_offset := greatest(coalesce(p_offset, 0), 0);
  return query
    with base as (
      select o.*, coalesce(u.email, pr.email)::text as email, pr.full_name::text as full_name,
             coalesce(pr.is_admin, false) as is_admin, public.key_order_refund_info(o.id) as refund
        from public.key_orders o
        left join auth.users u on u.id = o.user_id
        left join public.profiles pr on pr.id = o.user_id
       where case coalesce(p_filter, 'all')
               when 'paid' then o.status = 'paid' and o.refunded_at is null
               when 'refunded' then o.refunded_at is not null
               when 'pending' then o.status <> 'paid'
               when 'eligible' then o.status = 'paid' and o.refunded_at is null and o.paid_at > now() - interval '7 days'
               else o.status = 'paid'
             end
    )
    select b.id, b.user_id, b.email, b.full_name, b.is_admin, b.pack_id, b.keys, b.provider, b.provider_ref, b.payment_ref,
           b.amount, b.currency, b.tier, b.status, b.created_at, b.paid_at, b.refunded_at, b.refunded_amount, b.refund,
           count(*) over ()
      from base b
     where coalesce(p_filter, 'all') <> 'eligible' or (b.refund->>'eligible')::boolean
     order by coalesce(b.paid_at, b.created_at) desc, b.id desc
     limit p_limit offset p_offset;
end;
$$;

-- "سجّل الاسترداد" (بعد ما رجّعت الدراهم في البوابة): المفاتيح اللي ما تستعملوش تتنحّى، والمبلغ = حصّتها.
create or replace function public.admin_refund_key_order(p_id bigint)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  info json;
  r    json;
begin
  perform public.admin_assert();
  if current_setting('transaction_read_only') = 'on' then
    raise exception 'POST only' using errcode = '25006';
  end if;
  info := public.key_order_refund_info(p_id);
  if (info->>'reason') in ('not_found', 'not_paid') then
    return json_build_object('status', 'not_found');
  end if;
  if (info->>'reason') = 'refunded' then
    return json_build_object('status', 'already');
  end if;
  if coalesce((info->>'unused')::int, 0) = 0 then
    return json_build_object('status', 'all_used');
  end if;
  r := public.key_order_refund_apply(p_id, (info->>'amount')::numeric, auth.uid());
  return json_build_object('status', r->>'status', 'removed', r->'removed', 'amount', info->'amount', 'currency', info->'currency');
end;
$$;

-- شراءات Premium اللي تحسب فيها رصيد المفاتيح (شارة "بالرصيد" في /admin/sales)
create or replace function public.admin_credit_uses()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.admin_assert();
  return coalesce((
    select json_agg(json_build_object('kind', c.kind, 'provider', c.provider, 'provider_ref', c.provider_ref,
                                      'currency', c.currency, 'credit', c.credit, 'amount_due', c.amount_due,
                                      'premium_price', c.premium_price, 'tier', c.tier, 'created_at', c.created_at,
                                      'email', coalesce(u.email, p.email)::text, 'user_id', c.user_id, 'id', c.id,
                                      'revoked_at', c.revoked_at,
                                      'applied', (c.kind = 'full' and c.revoked_at is null) or exists (select 1 from public.purchases pu
                                                   where pu.provider_ref = c.provider_ref and pu.refunded_at is null))
             order by c.created_at desc)
      from public.key_credit_uses c
      left join auth.users u on u.id = c.user_id
      left join public.profiles p on p.id = c.user_id
  ), '[]'::json);
end;
$$;

-- رجوع تفعيل Premium بالرصيد كامل (مثلاً بعد تجربة بسعر التجربة): revoked_at + حقول profiles ترجع عادي
-- إذا Premium تاعو جاي من الرصيد برك (payment_provider = 'keys' وبلا شراء مدى الحياة). بلا مسح.
create or replace function public.admin_revoke_credit_upgrade(p_id bigint)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_user uuid;
begin
  perform public.admin_assert();
  if current_setting('transaction_read_only') = 'on' then
    raise exception 'POST only' using errcode = '25006';
  end if;
  update public.key_credit_uses set revoked_at = now()
   where id = p_id and kind = 'full' and revoked_at is null
   returning user_id into v_user;
  if not found then
    return 'not_found';
  end if;
  if v_user is not null and not public.has_lifetime_purchase(v_user)
     and not exists (select 1 from public.key_credit_uses c where c.user_id = v_user and c.kind = 'full' and c.revoked_at is null) then
    update public.profiles
       set is_premium = false, premium_until = null, plan_type = null, subscription_status = 'refunded'
     where id = v_user and payment_provider = 'keys' and plan_type = 'lifetime' and premium_until is null;
  end if;
  return 'revoked';
end;
$$;

-- ===================== 10) الصلاحيات =====================
-- Supabase يعطي EXECUTE افتراضياً لـ PUBLIC: نسحبو من كل دالة، ونعطيو اللي لازم برك.
revoke all on function public.key_ledger_apply() from public, anon, authenticated;
revoke all on function public.key_ledger_guard() from public, anon, authenticated;
revoke all on function public.keys_premium_blocked(uuid) from public, anon, authenticated;
revoke all on function public.keys_company_ok(bigint) from public, anon, authenticated;
revoke all on function public.keys_locked_count(uuid) from public, anon, authenticated;
revoke all on function public.keys_balance(uuid) from public, anon, authenticated;
revoke all on function public.keys_pending(uuid) from public, anon, authenticated;
revoke all on function public.keys_pack_price(uuid, text) from public, anon, authenticated;
revoke all on function public.key_order_unused(bigint) from public, anon, authenticated;
revoke all on function public.keys_credit_quote_for(uuid) from public, anon, authenticated;
revoke all on function public.keys_credit_state(uuid) from public, anon, authenticated;
revoke all on function public.key_order_refund_info(bigint) from public, anon, authenticated;
revoke all on function public.key_email_enabled() from public, anon, authenticated;
revoke all on function public.key_email_dispatch(bigint) from public, anon, authenticated;
revoke all on function public.key_email_enqueue(text, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.key_email_on_order() from public, anon, authenticated;
revoke all on function public.key_email_on_gift() from public, anon, authenticated;
revoke all on function public.key_email_claim(bigint) from public, anon, authenticated;
revoke all on function public.key_email_done(bigint, boolean, text, text) from public, anon, authenticated;
revoke all on function public.key_email_dispatch_due() from public, anon, authenticated;
revoke all on function public.keys_email_test_send(text, text) from public, anon, authenticated;
revoke all on function public.my_key_packs() from public;
revoke all on function public.my_keys() from public, anon;
revoke all on function public.keys_credit_quote() from public, anon;
revoke all on function public.use_diamond_key(bigint, text) from public, anon;
revoke all on function public.get_diamond_code(bigint) from public, anon;
revoke all on function public.keys_premium_redeem() from public, anon;
revoke all on function public.my_credit_upgrade() from public, anon;
revoke all on function public.keys_order_quote(uuid, text) from public, anon, authenticated;
revoke all on function public.keys_order_open(uuid, text, text, text, numeric, text, text) from public, anon, authenticated;
revoke all on function public.keys_order_paid(text, text, numeric, text, text) from public, anon, authenticated;
revoke all on function public.keys_order_failed(text, text) from public, anon, authenticated;
revoke all on function public.keys_play_grant(uuid, text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.key_order_refund_apply(bigint, numeric, uuid) from public, anon, authenticated;
revoke all on function public.keys_order_refund_gateway(text, text, numeric) from public, anon, authenticated;
revoke all on function public.keys_credit_open(uuid, text, text, text, numeric, text) from public, anon, authenticated;
revoke all on function public.admin_key_packs() from public, anon;
revoke all on function public.admin_save_key_pack(text, integer, integer, numeric, boolean, integer) from public, anon;
revoke all on function public.admin_gift_keys(text, integer, text) from public, anon;
revoke all on function public.admin_keys_stats() from public, anon;
revoke all on function public.admin_keys_accounts(text, integer, integer) from public, anon;
revoke all on function public.admin_keys_history(uuid) from public, anon;
revoke all on function public.admin_list_key_orders(text, integer, integer) from public, anon;
revoke all on function public.admin_refund_key_order(bigint) from public, anon;
revoke all on function public.admin_credit_uses() from public, anon;
revoke all on function public.admin_revoke_credit_upgrade(bigint) from public, anon;

grant execute on function public.my_key_packs() to anon, authenticated;
grant execute on function public.my_keys() to authenticated;
grant execute on function public.keys_credit_quote() to authenticated;
grant execute on function public.use_diamond_key(bigint, text) to authenticated;
grant execute on function public.get_diamond_code(bigint) to authenticated;
grant execute on function public.keys_premium_redeem() to authenticated;
grant execute on function public.my_credit_upgrade() to authenticated;

grant execute on function public.keys_order_quote(uuid, text) to service_role;
grant execute on function public.keys_order_open(uuid, text, text, text, numeric, text, text) to service_role;
grant execute on function public.keys_order_paid(text, text, numeric, text, text) to service_role;
grant execute on function public.keys_order_failed(text, text) to service_role;
grant execute on function public.keys_play_grant(uuid, text, text, text, boolean) to service_role;
grant execute on function public.keys_order_refund_gateway(text, text, numeric) to service_role;
grant execute on function public.keys_credit_quote_for(uuid) to service_role;
grant execute on function public.keys_credit_open(uuid, text, text, text, numeric, text) to service_role;
grant execute on function public.key_email_claim(bigint) to service_role;
grant execute on function public.key_email_done(bigint, boolean, text, text) to service_role;

grant execute on function public.admin_key_packs() to authenticated;
grant execute on function public.admin_save_key_pack(text, integer, integer, numeric, boolean, integer) to authenticated;
grant execute on function public.admin_gift_keys(text, integer, text) to authenticated;
grant execute on function public.admin_keys_stats() to authenticated;
grant execute on function public.admin_keys_accounts(text, integer, integer) to authenticated;
grant execute on function public.admin_keys_history(uuid) to authenticated;
grant execute on function public.admin_list_key_orders(text, integer, integer) to authenticated;
grant execute on function public.admin_refund_key_order(bigint) to authenticated;
grant execute on function public.admin_credit_uses() to authenticated;
grant execute on function public.admin_revoke_credit_upgrade(bigint) to authenticated;

notify pgrst, 'reload schema';
