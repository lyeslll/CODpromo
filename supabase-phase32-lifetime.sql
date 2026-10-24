-- ============================================================
--  CODpromo — Phase 32: دفعة وحدة · Premium مدى الحياة
--  شغّله: supabase db query --linked -f supabase-phase32-lifetime.sql
--  آمن لإعادة التشغيل (idempotent). بلا DROP / DELETE / TRUNCATE.
--
--  1) pricing_settings (سطر واحد): سعر الإطلاق والسعر العادي (دج / $) وعدد مقاعد الإطلاق.
--     بلا أي صلاحية للعميل: القراءة عبر pricing_public()، والتعديل عبر admin_update_pricing().
--  2) purchases: كل شراء في كل البوابات (stripe / slickpay / paypal / google_play) بتاريخو.
--     provider_ref فريد = نفس الدفعة ما تتسجّلش مرّتين. المستخدم يقرا مشترياتو برك، والكتابة
--     عبر grant_lifetime_purchase / revoke_lifetime_purchase (service_role برك، من Edge Functions).
--  3) premium_reveals: كل كشف لكود Premium (مين، أي شركة / عرض بلا كود، وقتاش) — للاسترداد.
--  4) has_premium_access: + شراء مدى الحياة غير مستردّ (الطرق القديمة كيما راهي).
--  5) protect_premium_columns: + plan_type (تقوية: كان العميل يقدر يكتبو).
--  6) get_premium_code و nocode_go: نفس المنطق + تسجيل الكشف؛ get_premium_code يرفض GET.
--  7) redeem_stork_code: حساب مدى الحياة ما يحرقش كود Stork (كان يحوّل premium_until لـ 30 يوم).
--  8) RPCs الأدمن: الأسعار، المبيعات، قائمة المشتريات مع أهلية الاسترداد، سحب Premium بعد الاسترداد.
--  9) admin_free_key_stats.converted: دقيق بتاريخ الشراء (من purchases).
-- ============================================================

-- ===================== 1) الأسعار =====================
create table if not exists public.pricing_settings (
  id                smallint primary key default 1 check (id = 1),
  launch_price_dzd  integer       not null default 9900  check (launch_price_dzd > 0),
  launch_price_usd  numeric(10,2) not null default 39    check (launch_price_usd > 0),
  regular_price_dzd integer       not null default 14900 check (regular_price_dzd > 0),
  regular_price_usd numeric(10,2) not null default 59    check (regular_price_usd > 0),
  launch_seats      integer       not null default 200   check (launch_seats between 0 and 100000),
  updated_at        timestamptz   not null default now()
);
insert into public.pricing_settings (id) values (1) on conflict (id) do nothing;

alter table public.pricing_settings enable row level security;
revoke all on public.pricing_settings from anon, authenticated;

-- ===================== 2) المشتريات =====================
create table if not exists public.purchases (
  id           bigint generated always as identity primary key,
  -- on delete set null: حذف الحساب ما يمسحش سجلّ المبيعات
  user_id      uuid references auth.users (id) on delete set null,
  provider     text not null check (provider in ('stripe', 'slickpay', 'paypal', 'google_play')),
  provider_ref text not null unique check (btrim(provider_ref) <> ''),  -- Stripe session / فاتورة SlickPay / طلب PayPal / رمز Play
  payment_ref  text,                                                    -- Stripe payment_intent / PayPal capture / Play orderId
  amount       numeric(12,2) not null check (amount >= 0),
  currency     text not null check (currency ~ '^[A-Z]{3}$'),
  tier         text not null check (tier in ('launch', 'regular')),
  purchased_at timestamptz not null default now(),
  refunded_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists purchases_user_idx on public.purchases (user_id, purchased_at desc);
create index if not exists purchases_payment_ref_idx on public.purchases (payment_ref) where payment_ref is not null;
create index if not exists purchases_launch_idx on public.purchases (purchased_at, id) where tier = 'launch' and refunded_at is null;

alter table public.purchases enable row level security;
revoke all on public.purchases from anon, authenticated;
grant select on public.purchases to authenticated;
revoke all on sequence public.purchases_id_seq from anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'purchases'
                  and policyname = 'purchases select own') then
    create policy "purchases select own" on public.purchases for select using (auth.uid() = user_id);
  end if;
end;
$$;

-- الفاتورة / الطلب يحفظ السعر اللي بدا بيه الدفع (launch / regular)
alter table public.slickpay_invoices add column if not exists tier text check (tier in ('launch', 'regular'));
alter table public.paypal_orders     add column if not exists tier text check (tier in ('launch', 'regular'));

-- ===================== 3) سجلّ كشف أكواد Premium =====================
create table if not exists public.premium_reveals (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  company_id bigint references public.companies (id) on delete set null,
  deal_id    bigint references public.nocode_deals (id) on delete set null,
  via        text not null check (via in ('premium', 'free_key', 'nocode')),
  created_at timestamptz not null default now()
);
create index if not exists premium_reveals_user_idx on public.premium_reveals (user_id, created_at);

alter table public.premium_reveals enable row level security;  -- بلا سياسات: حتى واحد ما يقرا مباشرة
revoke all on public.premium_reveals from anon, authenticated;
revoke all on sequence public.premium_reveals_id_seq from anon, authenticated;

-- ===================== 4) السعر الحالي =====================
-- مقاعد الإطلاق = مشتريات launch غير مستردّة. كي يكمّلو، السعر يطلع وحدو للعادي.
create or replace function public.pricing_public()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'tier',        case when x.sold < s.launch_seats then 'launch' else 'regular' end,
    'price_usd',   case when x.sold < s.launch_seats then s.launch_price_usd  else s.regular_price_usd end,
    'price_dzd',   case when x.sold < s.launch_seats then s.launch_price_dzd  else s.regular_price_dzd end,
    'launch_usd',  s.launch_price_usd,
    'launch_dzd',  s.launch_price_dzd,
    'regular_usd', s.regular_price_usd,
    'regular_dzd', s.regular_price_dzd,
    'seats_total', s.launch_seats,
    'seats_left',  greatest(s.launch_seats - x.sold, 0)
  )
  from public.pricing_settings s,
       lateral (select count(*)::int as sold from public.purchases p
                 where p.tier = 'launch' and p.refunded_at is null) x
  where s.id = 1;
$$;

-- وقتاش تكمّلو مقاعد الإطلاق (تاريخ آخر مقعد)، null = مازال مفتوح. لـ Google Play: سعر المنتوج
-- يقرّرو Google، فشراء codpromo_lifetime_launch يتقبل غير إذا صرا قبل ما يتسكّر الإطلاق بشوية.
create or replace function public.pricing_launch_closed_at()
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select case
           when s.launch_seats = 0 then '-infinity'::timestamptz
           else (select p.purchased_at from public.purchases p
                  where p.tier = 'launch' and p.refunded_at is null
                  order by p.purchased_at, p.id
                  offset s.launch_seats - 1 limit 1)
         end
  from public.pricing_settings s
  where s.id = 1;
$$;

-- ===================== 5) Premium مدى الحياة =====================
create or replace function public.has_lifetime_purchase(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.purchases p where p.user_id = uid and p.refunded_at is null);
$$;

-- القاعدة الواحدة "من يرى Premium؟": Premium من الملف (مدفوع / Stork / مدى الحياة) أو أدمن،
-- أو هدية نشطة، أو شراء مدى الحياة غير مستردّ (حتى لو تبدّلو حقول الملف).
create or replace function public.has_premium_access(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_profile_premium(uid) or public.has_active_gift(uid) or public.has_lifetime_purchase(uid);
$$;

-- تسجيل الشراء + منح Premium مدى الحياة في معاملة وحدة (service_role برك، بعد التحقق عند البوابة).
--  - provider_ref فريد: نفس الدفعة مرّتين → 'duplicate' بلا منح ثاني.
--  - SlickPay / PayPal: الفاتورة / الطلب هو المرجع الموثوق: نفس الحساب، نفس tier، ونفس المبلغ المنتظر.
--  - المنح يمرّ عبر SECURITY DEFINER → protect_premium_columns كيما راه.
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
  if p_tier is null or p_tier not in ('launch', 'regular') then
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

-- الاسترداد (داخلي): refunded_at = الآن، وإذا ما بقالو حتى شراء نشط → Premium يتنحّى في الحين.
create or replace function public.lifetime_revoke(p_id bigint)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
begin
  update public.purchases set refunded_at = now()
   where id = p_id and refunded_at is null
   returning user_id into v_user;
  if not found then
    return case when exists (select 1 from public.purchases where id = p_id) then 'already' else 'not_found' end;
  end if;

  if v_user is not null and not public.has_lifetime_purchase(v_user) then
    update public.profiles
       set is_premium = false,
           premium_until = null,
           plan_type = null,
           subscription_status = 'refunded'
     where id = v_user and (plan_type = 'lifetime' or premium_until is null);
  end if;
  return 'revoked';
end;
$$;

-- من الـ webhooks (Stripe charge.refunded / PayPal PAYMENT.CAPTURE.REFUNDED): بالمرجع ولا بمرجع الدفعة.
create or replace function public.revoke_lifetime_purchase(p_provider text, p_ref text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  select id into v_id from public.purchases
   where provider = p_provider and (provider_ref = p_ref or payment_ref = p_ref)
   order by id limit 1;
  if v_id is null then
    return 'not_found';
  end if;
  return public.lifetime_revoke(v_id);
end;
$$;

-- ===================== 6) حماية حقول الدفع (+ plan_type) =====================
create or replace function public.protect_premium_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      if coalesce(new.is_premium, false) = true
         or new.premium_until is not null
         or new.subscription_status is not null
         or new.stripe_customer_id is not null
         or new.payment_provider is not null
         or new.plan_type is not null then
        raise exception 'تعيين حقول Premium غير مسموح من العميل' using errcode = '42501';
      end if;
    elsif new.is_premium          is distinct from old.is_premium
       or new.premium_until       is distinct from old.premium_until
       or new.subscription_status is distinct from old.subscription_status
       or new.stripe_customer_id  is distinct from old.stripe_customer_id
       or new.payment_provider    is distinct from old.payment_provider
       or new.plan_type           is distinct from old.plan_type then
      raise exception 'تعديل حقول Premium غير مسموح من العميل (is_premium/premium_until/subscription_status/stripe_customer_id/payment_provider/plan_type)'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- ===================== 7) كشف كود Premium + التسجيل =====================
-- نفس القاعدة (Premium → كل الشركات، وإلا الشركة اللي كشفها بالمفتاح الذهبي برك) + سطر في premium_reveals.
-- via = 'free_key' إذا الشركة هي شركة مفتاحو (كانت مكشوفة عندو من قبل)، وإلا 'premium'.
-- GET مرفوض (معاملة قراءة برك = كشف بلا تسجيل). الأدمن ما يتسجّلش. نفس الكشف في أقل من دقيقة = سطر واحد.
create or replace function public.get_premium_code(company_id bigint)
returns table (premium_code text, premium_url text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_key boolean;
  v_via text;
begin
  if v_uid is null then
    return;
  end if;
  v_key := exists (select 1 from public.free_reveals r
                    where r.user_id = v_uid and r.company_id = get_premium_code.company_id);
  if not public.has_premium_access(v_uid) and not v_key then
    return;
  end if;
  v_via := case when v_key then 'free_key' else 'premium' end;

  if not public.is_admin()
     and exists (select 1 from public.companies c
                  where c.id = get_premium_code.company_id
                    and (coalesce(btrim(c.premium_code), '') <> '' or coalesce(btrim(c.premium_url), '') <> '')) then
    if current_setting('transaction_read_only', true) = 'on' then
      raise exception 'use POST' using errcode = '25006';
    end if;
    insert into public.premium_reveals (user_id, company_id, via)
    select v_uid, get_premium_code.company_id, v_via
     where not exists (select 1 from public.premium_reveals x
                        where x.user_id = v_uid and x.company_id = get_premium_code.company_id
                          and x.via = v_via and x.created_at > now() - interval '1 minute');
  end if;

  return query
    select c.premium_code, c.premium_url
    from public.companies c
    where c.id = get_premium_code.company_id;
end;
$$;

-- عروض بلا كود: نفس nocode_go (phase29) + تسجيل فتح رابط Premium (via = 'nocode').
create or replace function public.nocode_go(p_slug text, p_premium boolean default false)
returns json
language plpgsql
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

  -- كشف رابط Premium (للاسترداد): مين، أي عرض، وقتاش
  if v_prem and not public.is_admin() then
    insert into public.premium_reveals (user_id, deal_id, via)
    select v_uid, d.id, 'nocode'
     where not exists (select 1 from public.premium_reveals x
                        where x.user_id = v_uid and x.deal_id = d.id and x.via = 'nocode'
                          and x.created_at > now() - interval '1 minute');
  end if;

  return json_build_object('status', 'ok', 'url', v_url, 'name', d.name);
end;
$$;

-- ===================== 8) Stork: مدى الحياة ما يحرقش الكود =====================
-- قبل: premium_until = now() + 30 يوم كان يحوّل حساب مدى الحياة لاشتراك 30 يوم.
create or replace function public.redeem_stork_code(code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_id   bigint;
  v_norm text;
begin
  if v_uid is null then
    return 'auth';
  end if;

  v_norm := upper(btrim(coalesce(code, '')));
  if v_norm = '' then
    return 'enter';
  end if;

  -- عندو Premium مدى الحياة: ما نحرقوش الكود (يقدر يستافد منو واحد آخر)
  if public.has_lifetime_purchase(v_uid) then
    return 'lifetime';
  end if;

  -- اقفل صف الكود غير المستخدم ذرّياً (يمنع سباق الاستخدام المزدوج)
  select s.id into v_id
  from public.stork_codes s
  where s.code = v_norm and s.is_used = false
  for update;

  if v_id is null then
    -- ميّز بين "مستخدم مسبقاً" و"غير موجود" لرسالة أوضح
    if exists (select 1 from public.stork_codes s where s.code = v_norm) then
      return 'used';
    end if;
    return 'invalid';
  end if;

  update public.stork_codes
    set is_used = true, used_by = v_uid, used_at = now()
    where id = v_id;

  -- منح 30 يوماً. نستعمل greatest حتى لا نقصّ مدّة مشترك دافع موجودة (أمان للموقع الحيّ).
  update public.profiles
    set is_premium = true,
        premium_until = greatest(coalesce(premium_until, now()), now()) + interval '30 days'
    where id = v_uid;

  return 'ok';
end;
$$;

-- ===================== 9) الأدمن: الأسعار =====================
create or replace function public.admin_pricing()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s public.pricing_settings%rowtype;
  v_sold integer;
begin
  perform public.admin_assert();
  select * into s from public.pricing_settings where id = 1;
  select count(*) into v_sold from public.purchases where tier = 'launch' and refunded_at is null;
  return json_build_object(
    'launch_price_dzd', s.launch_price_dzd,
    'launch_price_usd', s.launch_price_usd,
    'regular_price_dzd', s.regular_price_dzd,
    'regular_price_usd', s.regular_price_usd,
    'launch_seats', s.launch_seats,
    'updated_at', s.updated_at,
    'seats_sold', v_sold,
    'seats_left', greatest(s.launch_seats - v_sold, 0),
    'tier', case when v_sold < s.launch_seats then 'launch' else 'regular' end,
    'launch_closed_at', public.pricing_launch_closed_at()
  );
end;
$$;

create or replace function public.admin_update_pricing(
  p_launch_dzd  integer,
  p_launch_usd  numeric,
  p_regular_dzd integer,
  p_regular_usd numeric,
  p_seats       integer
)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.admin_assert();
  if coalesce(p_launch_dzd, 0) <= 0 or coalesce(p_launch_usd, 0) <= 0
     or coalesce(p_regular_dzd, 0) <= 0 or coalesce(p_regular_usd, 0) <= 0
     or p_seats is null or p_seats < 0 or p_seats > 100000 then
    raise exception 'invalid pricing' using errcode = '22023';
  end if;
  update public.pricing_settings
     set launch_price_dzd = p_launch_dzd,
         launch_price_usd = round(p_launch_usd, 2),
         regular_price_dzd = p_regular_dzd,
         regular_price_usd = round(p_regular_usd, 2),
         launch_seats = p_seats,
         updated_at = now()
   where id = 1;
  return public.admin_pricing();
end;
$$;

-- ===================== 10) الأدمن: المبيعات =====================
-- المبيعات = جدول purchases برك (الهدايا والمفتاح الذهبي ما يكتبوش فيه)، بلا حسابات الأدمن.
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
       where not exists (select 1 from public.profiles pr where pr.id = p.user_id and pr.is_admin = true)
    ),
    active as (select * from sales where refunded_at is null)
    select json_build_object(
      'buyers', (select count(distinct user_id) from active),
      'purchases', (select count(*) from active),
      'refunded', (select count(*) from sales where refunded_at is not null),
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

-- قائمة المشتريات + أهلية الاسترداد: خلال 7 أيام من الشراء وبلا أي كشف جديد لكود Premium بعد الشراء.
-- "جديد" = شركة / عرض ما كانش مكشوف عندو قبل الشراء (مثلاً أيام الهدية) حسب premium_reveals برك —
-- جدول يكتبو الخادم وحدو. code_copies ما يتحسبش: العميل يكتبو بنفسو (كان يقدر يزوّر "نسخ قبل الشراء").
-- شركة المفتاح الذهبي تتسجّل via = 'free_key' فما تتحسبش.
-- p_filter: all | active | refunded | eligible
create or replace function public.admin_list_purchases(
  p_filter text default 'all',
  p_limit  integer default 50,
  p_offset integer default 0
)
returns table (
  id              bigint,
  user_id         uuid,
  full_name       text,
  email           text,
  is_admin        boolean,
  provider        text,
  provider_ref    text,
  payment_ref     text,
  amount          numeric,
  currency        text,
  tier            text,
  purchased_at    timestamptz,
  refunded_at     timestamptz,
  reveals_after   bigint,
  first_reveal_at timestamptz,
  refund_until    timestamptz,
  eligible        boolean,
  total_count     bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  perform public.admin_assert();
  p_limit  := least(greatest(coalesce(p_limit, 50), 1), 500);
  p_offset := greatest(coalesce(p_offset, 0), 0);

  return query
  with base as (
    select p.id, p.user_id, pr.full_name, coalesce(u.email, pr.email)::text as email,
           coalesce(pr.is_admin, false) as is_admin,
           p.provider, p.provider_ref, p.payment_ref, p.amount, p.currency, p.tier,
           p.purchased_at, p.refunded_at,
           rv.n as reveals_after, rv.first_at as first_reveal_at,
           p.purchased_at + interval '7 days' as refund_until
      from public.purchases p
      left join public.profiles pr on pr.id = p.user_id
      left join auth.users u on u.id = p.user_id
      left join lateral (
        select count(*) as n, min(r.created_at) as first_at
          from public.premium_reveals r
         where r.user_id = p.user_id
           and r.created_at >= p.purchased_at
           and r.via in ('premium', 'nocode')
           and not exists (select 1 from public.premium_reveals r0
                            where r0.user_id = r.user_id and r0.created_at < p.purchased_at
                              and r0.company_id is not distinct from r.company_id
                              and r0.deal_id is not distinct from r.deal_id)
      ) rv on true
  ),
  marked as (
    select b.*, (b.refunded_at is null and now() < b.refund_until and b.reveals_after = 0) as eligible
      from base b
  )
  select m.id, m.user_id, m.full_name, m.email, m.is_admin, m.provider, m.provider_ref, m.payment_ref,
         m.amount, m.currency, m.tier, m.purchased_at, m.refunded_at, m.reveals_after, m.first_reveal_at,
         m.refund_until, m.eligible, count(*) over () as total_count
    from marked m
   where case coalesce(p_filter, 'all')
           when 'active'   then m.refunded_at is null
           when 'refunded' then m.refunded_at is not null
           when 'eligible' then m.eligible
           else true
         end
   order by m.purchased_at desc, m.id desc
   limit p_limit offset p_offset;
end;
$$;

-- "سحب Premium بعد الاسترداد" (SlickPay و Google Play؛ Stripe و PayPal يديرها الـ webhook وحدو)
create or replace function public.admin_revoke_purchase(p_id bigint)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.admin_assert();
  return public.lifetime_revoke(p_id);
end;
$$;

-- ===================== 11) المفتاح الذهبي: "اشتركوا بعد المفتاح" دقيق بتاريخ الشراء =====================
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
    -- شراء Premium مدى الحياة (كل البوابات، غير مستردّ) بعد تاريخ الكشف. Stork والهدايا ماشي دفع.
    'converted', (
      select count(*) from public.free_reveals r
       where r.user_id is not null
         and exists (select 1 from public.purchases pu
                      where pu.user_id = r.user_id and pu.refunded_at is null and pu.purchased_at > r.created_at)
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

-- ===================== 12) الصلاحيات =====================
-- الدوال الجديدة تتنفّذ افتراضياً من PUBLIC → نسحبو، ونعطيو اللي لازم برك.
revoke all on function public.pricing_public() from public, anon, authenticated;
revoke all on function public.pricing_launch_closed_at() from public, anon, authenticated;
revoke all on function public.has_lifetime_purchase(uuid) from public, anon, authenticated;
revoke all on function public.has_premium_access(uuid) from public, anon, authenticated;
revoke all on function public.grant_lifetime_purchase(text, text, uuid, numeric, text, text, text) from public, anon, authenticated;
revoke all on function public.lifetime_revoke(bigint) from public, anon, authenticated;
revoke all on function public.revoke_lifetime_purchase(text, text) from public, anon, authenticated;
revoke all on function public.admin_pricing() from public, anon;
revoke all on function public.admin_update_pricing(integer, numeric, integer, numeric, integer) from public, anon;
revoke all on function public.admin_sales_stats() from public, anon;
revoke all on function public.admin_list_purchases(text, integer, integer) from public, anon;
revoke all on function public.admin_revoke_purchase(bigint) from public, anon;

grant execute on function public.pricing_public() to anon, authenticated, service_role;
grant execute on function public.pricing_launch_closed_at() to service_role;
grant execute on function public.grant_lifetime_purchase(text, text, uuid, numeric, text, text, text) to service_role;
grant execute on function public.revoke_lifetime_purchase(text, text) to service_role;
grant execute on function public.admin_pricing() to authenticated;
grant execute on function public.admin_update_pricing(integer, numeric, integer, numeric, integer) to authenticated;
grant execute on function public.admin_sales_stats() to authenticated;
grant execute on function public.admin_list_purchases(text, integer, integer) to authenticated;
grant execute on function public.admin_revoke_purchase(bigint) to authenticated;
grant execute on function public.get_premium_code(bigint) to authenticated;

notify pgrst, 'reload schema';
