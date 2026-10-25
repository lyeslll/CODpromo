-- ============================================================
--  CODpromo — phase38: حجز "Premium بالرصيد" يتحرّر وحدو + الفاتورة القديمة تتسكّر عند البوابة
--  فوق phase37: جدول جديد (key_credit_gate) + دوال جديدة + تبديل 4 دوال تاع phase37 برك
--  (key_credit_void، key_order_refund_apply، keys_credit_open، admin_credit_uses). ما يمسّ حتى جدول ولا دالة
--  تاع Premium (purchases / slickpay_invoices / paypal_orders: نفس الكتابة اللي كانت في phase37 — tier برك).
--
--  1) دفع الباقي اللي بدا وما كملش يتلغى وحدو: بعد وقتو (Stripe 75 دقيقة — الجلسة تنتهي بعد ساعة؛ SlickPay /
--     PayPal 3 ساعات)، كي يفتح الزبون دفع جديد بالرصيد، ولا كي يولّي Premium بطريق آخر. الإلغاء = revoked_at
--     + الفاتورة / الطلب بلا tier (activateInvoice / activateOrder يرجّعو "legacy") + سطر في key_credit_gate.
--  2) Edge Function keys-credit-close (cron كل دقيقة عبر pg_net، نفس السرّ تاع الإيميلات) تسكّر عند البوابة:
--     Stripe → expire، SlickPay → DELETE الفاتورة، PayPal → ما نلتقطوش (paypal-capture-order يرفض الطلب بلا tier)،
--     وتبقى تراقب حتى تتأكّد (الدفعة اللي جات في نفس اللحظة تتشاف).
--  3) دفعة وصلت رغم الإلغاء (keys_credit_settle_late): الرصيد مازال مغطّي والحساب ماهوش Premium → Premium يتفعّل
--     وحدو بنفس grant_lifetime_purchase (granted)؛ وإلا → تنبيه "يلزم قرار" في /admin/sales (استرداد ولا منح
--     Premium). دراهم الزبون ما تضيعش بلا ما يشوفها الأدمن.
--  السويتش private.app_secrets.keys_credit_gate_enabled = 'false' حتى تتنشر الدوال مع الدمج. موقوف: حتى إلغاء
--  وحدو، وحتى نداء للبوابة (إلغاء الأدمن والاسترداد يخدمو كيما phase37 + سطر ينتظر في key_credit_gate).
--  Idempotent. الرجوع: supabase-phase38-rollback.sql.
-- ============================================================

insert into private.app_secrets (key, value) values ('keys_credit_gate_enabled', 'false')
on conflict (key) do nothing;

-- ===================== 1) الجدول =====================
-- سطر لكل دفع باقي تلغى: التسكير عند البوابة + الدفعة اللي وصلت من بعد + قرار الأدمن.
create table if not exists public.key_credit_gate (
  credit_use_id    bigint primary key references public.key_credit_uses (id) on delete cascade,
  reason           text not null check (reason in ('timeout', 'admin', 'refund', 'replaced', 'premium')),
  status           text not null default 'pending' check (status in ('pending', 'watch', 'closed')),
  attempts         integer not null default 0,
  next_at          timestamptz not null default now(),
  closed_at        timestamptz,
  last_error       text,
  late_status      text check (late_status in ('granted', 'uncovered', 'refund_needed')),
  late_note        text,
  late_paid_at     timestamptz,
  late_amount      numeric(12,2),
  late_currency    text,
  late_payment_ref text,
  resolved_at      timestamptz,
  resolved_by      uuid,
  resolution       text check (resolution in ('refunded', 'granted', 'kept')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists key_credit_gate_due_idx on public.key_credit_gate (next_at) where status <> 'closed';

alter table public.key_credit_gate enable row level security;
revoke all on public.key_credit_gate from public, anon, authenticated;

-- ===================== 2) أدوات داخلية =====================
create or replace function public.keys_credit_gate_on()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select s.value = 'true' from private.app_secrets s where s.key = 'keys_credit_gate_enabled'), false);
$$;

-- قدّاش يبقى دفع الباقي محجوز: Stripe الجلسة تنتهي بعد ساعة (+ ربع ساعة للـ webhook)، الباقي 3 ساعات
-- (كيما طلبات المفاتيح المعلّقة، ونفس مهلة PayPal للطلب المقبول).
create or replace function public.keys_credit_ttl(p_provider text)
returns interval
language sql
immutable
set search_path = public
as $$
  select case when p_provider = 'stripe' then interval '75 minutes' else interval '3 hours' end;
$$;

-- الإلغاء (داخلي): revoked_at + الفاتورة / الطلب بلا tier + سطر التسكير. 'voided' | 'completed' | 'not_found'
create or replace function public.keys_credit_cancel(p_id bigint, p_reason text)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  c public.key_credit_uses%rowtype;
begin
  if p_reason not in ('timeout', 'admin', 'refund', 'replaced', 'premium') then
    raise exception 'invalid reason' using errcode = '22023';
  end if;
  select * into c from public.key_credit_uses where id = p_id and kind = 'checkout' for update;
  if not found or c.revoked_at is not null then
    return 'not_found';
  end if;
  if exists (select 1 from public.purchases pu where pu.provider_ref = c.provider_ref) then
    return 'completed';
  end if;
  update public.key_credit_uses set revoked_at = now() where id = c.id;
  if c.provider = 'slickpay' then
    update public.slickpay_invoices set tier = null where invoice_id = c.provider_ref and status <> 'completed';
  elsif c.provider = 'paypal' then
    update public.paypal_orders set tier = null where order_id = c.provider_ref and status <> 'completed';
  end if;
  insert into public.key_credit_gate (credit_use_id, reason)
  values (c.id, p_reason)
  on conflict (credit_use_id) do update
    set reason = excluded.reason, status = 'pending', next_at = now(), closed_at = null, updated_at = now();
  return 'voided';
end;
$$;

-- phase37: نفس الدالة (الأدمن "إلغاء الحجز")، دروك تسكّر حتى عند البوابة
create or replace function public.key_credit_void(p_id bigint)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  return public.keys_credit_cancel(p_id, 'admin');
end;
$$;

-- ===================== 3) الاسترداد (phase37 + سبب الإلغاء 'refund') =====================
create or replace function public.key_order_refund_apply(p_order bigint, p_refunded numeric, p_by uuid)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  o        public.key_orders%rowtype;
  v_un     integer := 0;
  v_status text;
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
       set refunded_amount = greatest(refunded_amount, least(greatest(coalesce(p_refunded, 0), 0), amount))
     where id = o.id;
    v_status := 'already';
  else
    v_un := public.key_order_unused(o.id);
    if v_un > 0 and o.user_id is not null then
      insert into public.key_ledger (user_id, kind, delta, order_id, created_by) values (o.user_id, 'refund', -v_un, o.id, p_by);
    end if;
    update public.key_orders
       set refunded_at = now(), refunded_amount = least(greatest(coalesce(p_refunded, o.amount), 0), o.amount)
     where id = o.id;
    v_status := 'refunded';
  end if;

  -- الدراهم اللي تحسبت في Premium رجعت (استرداد من البوابة، اعتراض…): تفعيل Premium بالرصيد كامل اللي ما بقاش
  -- مغطّى يتنحّى. شراء Premium بالباقي (checkout) يبان "غير مغطّى" في الأدمن والقرار ليه.
  if o.user_id is not null then
    -- دفع الباقي اللي ما كملش والرصيد اللي تحسب فيه ما بقاش مغطّى: يتلغى ويتسكّر عند البوابة
    perform public.keys_credit_cancel(c.id, 'refund')
       from public.key_credit_uses c
      where c.user_id = o.user_id and c.kind = 'checkout' and c.revoked_at is null
        and not exists (select 1 from public.purchases pu where pu.provider_ref = c.provider_ref)
        and not public.keys_credit_backed(o.user_id, c.currency, c.credit);
    update public.key_credit_uses c set revoked_at = now()
     where c.user_id = o.user_id and c.kind = 'full' and c.revoked_at is null
       and not public.keys_credit_backed(o.user_id, c.currency, c.credit);
    if found and not public.has_lifetime_purchase(o.user_id)
       and not exists (select 1 from public.key_credit_uses c where c.user_id = o.user_id and c.kind = 'full' and c.revoked_at is null) then
      update public.profiles
         set is_premium = false, premium_until = null, plan_type = null, subscription_status = 'refunded'
       where id = o.user_id and payment_provider = 'keys' and plan_type = 'lifetime' and premium_until is null;
    end if;
  end if;
  return json_build_object('status', v_status, 'removed', v_un);
end;
$$;

-- ===================== 4) فتح دفع الباقي (phase37 + دفع جديد يلغي القديم) =====================
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

  -- دفع جديد بالرصيد: القديم اللي ما كملش ما بقاش يلزم (ما يتخلّصش زوج مرات) → يتلغى ويتسكّر عند البوابة
  if public.keys_credit_gate_on() then
    perform public.keys_credit_cancel(c.id, 'replaced')
       from public.key_credit_uses c
      where c.user_id = p_uid and c.kind = 'checkout' and c.revoked_at is null
        and not exists (select 1 from public.purchases pu where pu.provider_ref = c.provider_ref);
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

-- ===================== 5) دفعة وصلت بعد الإلغاء =====================
-- keys-credit-close ينادي هنا كي البوابة تأكّد بلي دفع باقي ملغى تخلّص (المبلغ والمرجع من البوابة، بمفتاحنا).
-- 'granted' (Premium تفعّل: الرصيد مازال مغطّي) | 'uncovered' (تفعّل بالطريق الكاين والرصيد ما بقاش)
-- | 'refund_needed' (الأدمن يقرّر) | 'open' (ماشي ملغى: الطريق العادي يكمّل) | 'not_found'
create or replace function public.keys_credit_settle_late(
  p_provider text, p_ref text, p_amount numeric, p_currency text, p_payment_ref text
)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  c        public.key_credit_uses%rowtype;
  v_status text;
  v_note   text;
  v_grant  text;
  v_cur    text := upper(btrim(coalesce(p_currency, '')));
begin
  select * into c from public.key_credit_uses
   where provider_ref = btrim(coalesce(p_ref, '')) and provider = p_provider and kind = 'checkout';
  if not found then
    return 'not_found';
  end if;
  if c.user_id is not null then
    perform pg_advisory_xact_lock(hashtextextended('diamond_key:' || c.user_id::text, 0));
  end if;
  select * into c from public.key_credit_uses where id = c.id for update;

  if exists (select 1 from public.purchases pu where pu.provider_ref = c.provider_ref) then
    -- الطريق الكاين سجّل الشراء (Stripe بالـ metadata): الرصيد يتحسب مستعمل
    update public.key_credit_uses set revoked_at = null where id = c.id and revoked_at is not null;
    v_status := case when c.user_id is null or public.keys_credit_backed(c.user_id, c.currency, c.credit)
                     then 'granted' else 'uncovered' end;
  elsif c.revoked_at is null then
    return 'open';
  elsif c.user_id is null then
    v_status := 'refund_needed'; v_note := 'no_account';
  elsif v_cur <> c.currency or round(coalesce(p_amount, -1) * 100) <> round(c.amount_due * 100) then
    v_status := 'refund_needed'; v_note := 'amount';
  elsif public.keys_premium_blocked(c.user_id) then
    v_status := 'refund_needed'; v_note := 'already_premium';
  elsif exists (select 1 from public.key_credit_uses f where f.user_id = c.user_id and f.kind = 'full' and f.revoked_at is not null) then
    -- نفس قاعدة keys_credit_quote_for: الأدمن رجّع Premium بالرصيد لهاد الحساب → الرصيد ما يعطيش Premium وحدو
    v_status := 'refund_needed'; v_note := 'credit_revoked';
  elsif not public.keys_credit_backed(c.user_id, c.currency, c.credit) then
    v_status := 'refund_needed'; v_note := 'credit_refunded';
  else
    -- الرصيد مازال مغطّي: نكمّلو كيما لو ما تلغاش (نفس دالة Premium، المبلغ والـ tier المحفوظين)
    if c.provider = 'slickpay' then
      update public.slickpay_invoices set tier = c.tier where invoice_id = c.provider_ref and status <> 'completed';
    elsif c.provider = 'paypal' then
      update public.paypal_orders set tier = c.tier where order_id = c.provider_ref and status <> 'completed';
    end if;
    begin
      v_grant := public.grant_lifetime_purchase(c.provider, c.provider_ref, c.user_id, c.amount_due, c.currency,
                                                c.tier, nullif(btrim(coalesce(p_payment_ref, '')), ''));
    exception when others then
      v_grant := null;
      v_note := left('grant: ' || sqlerrm, 200);
    end;
    if v_grant in ('granted', 'duplicate') then
      update public.key_credit_uses set revoked_at = null where id = c.id;
      v_status := 'granted';
      -- دفع آخر بالرصيد مازال مفتوح: ما بقاش يلزم
      perform public.keys_credit_cancel(o.id, 'premium')
         from public.key_credit_uses o
        where o.user_id = c.user_id and o.kind = 'checkout' and o.revoked_at is null and o.id <> c.id
          and not exists (select 1 from public.purchases pu where pu.provider_ref = o.provider_ref);
    else
      if c.provider = 'slickpay' then
        update public.slickpay_invoices set tier = null where invoice_id = c.provider_ref and status <> 'completed';
      elsif c.provider = 'paypal' then
        update public.paypal_orders set tier = null where order_id = c.provider_ref and status <> 'completed';
      end if;
      v_status := 'refund_needed';
      v_note := coalesce(v_note, 'grant');
    end if;
  end if;

  insert into public.key_credit_gate (credit_use_id, reason, status, closed_at, late_status, late_note,
                                      late_paid_at, late_amount, late_currency, late_payment_ref)
  values (c.id, 'timeout', 'closed', now(), v_status, v_note, now(), p_amount, nullif(v_cur, ''),
          nullif(btrim(coalesce(p_payment_ref, '')), ''))
  on conflict (credit_use_id) do update
    set status = 'closed', closed_at = coalesce(key_credit_gate.closed_at, now()),
        late_status = excluded.late_status, late_note = excluded.late_note,
        late_paid_at = coalesce(key_credit_gate.late_paid_at, now()),
        late_amount = excluded.late_amount, late_currency = excluded.late_currency,
        late_payment_ref = coalesce(excluded.late_payment_ref, key_credit_gate.late_payment_ref),
        updated_at = now();
  return v_status;
end;
$$;

-- ===================== 6) العامل (keys-credit-close، service_role برك) =====================
-- حجز الخدمة: السطور اللي وقتها جا (مهلة 3 دقائق باش عامل ثاني ما يعاودهاش في نفس الوقت).
create or replace function public.keys_credit_gate_claim(p_limit integer default 10)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v json;
begin
  with due as (
    select g.credit_use_id from public.key_credit_gate g
     where g.status <> 'closed' and g.next_at <= now()
     order by g.next_at
     limit greatest(1, least(coalesce(p_limit, 10), 25))
     for update skip locked
  ), upd as (
    update public.key_credit_gate g
       set attempts = g.attempts + 1, next_at = now() + interval '3 minutes', updated_at = now()
      from due where g.credit_use_id = due.credit_use_id
    returning g.credit_use_id, g.status, g.attempts, g.created_at
  )
  select coalesce(json_agg(json_build_object(
           'id', c.id, 'provider', c.provider, 'ref', c.provider_ref, 'currency', c.currency,
           'amount_due', c.amount_due, 'voided_at', c.revoked_at, 'gate_status', u.status, 'attempts', u.attempts,
           'since', u.created_at)), '[]'::json)
    into v
    from upd u join public.key_credit_uses c on c.id = u.credit_use_id;
  return v;
end;
$$;

-- النتيجة: 'closed' (البوابة ما تقدرش تخلّص) | 'watch' (مازال ما تأكّدش: نعاودو نشوفو، أبطأ مع الوقت)
create or replace function public.keys_credit_gate_done(p_id bigint, p_result text, p_error text default null)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  g public.key_credit_gate%rowtype;
begin
  select * into g from public.key_credit_gate where credit_use_id = p_id for update;
  if not found or g.status = 'closed' then
    return;
  end if;
  if p_result = 'closed' then
    update public.key_credit_gate
       set status = 'closed', closed_at = now(), last_error = null, updated_at = now()
     where credit_use_id = p_id;
  elsif g.created_at < now() - interval '30 days' then
    -- 30 يوم بلا ما تتأكّد: نحبسو (الأدمن يشوف last_error)
    update public.key_credit_gate
       set status = 'closed', closed_at = now(), last_error = left(coalesce(p_error, 'gave_up'), 300), updated_at = now()
     where credit_use_id = p_id;
  else
    update public.key_credit_gate
       set status = 'watch', last_error = left(p_error, 300), updated_at = now(),
           next_at = now() + case when g.created_at > now() - interval '1 day' then interval '10 minutes'
                                  when g.created_at > now() - interval '7 days' then interval '1 hour'
                                  else interval '6 hours' end
     where credit_use_id = p_id;
  end if;
end;
$$;

-- cron كل دقيقة: الإلغاء بعد الوقت (ولا الحساب ولّى Premium بطريق آخر) + نداء keys-credit-close كي كاين خدمة.
create or replace function public.keys_credit_gate_kick()
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  r        record;
  n        integer := 0;
  v_secret text;
begin
  if not public.keys_credit_gate_on() then
    return 0;
  end if;
  for r in
    select c.id, case when c.user_id is not null and public.keys_premium_blocked(c.user_id) then 'premium' else 'timeout' end as why
      from public.key_credit_uses c
     where c.kind = 'checkout' and c.revoked_at is null
       and not exists (select 1 from public.purchases pu where pu.provider_ref = c.provider_ref)
       and (c.created_at < now() - public.keys_credit_ttl(c.provider)
            or (c.user_id is not null and public.keys_premium_blocked(c.user_id)))
  loop
    if public.keys_credit_cancel(r.id, r.why) = 'voided' then
      n := n + 1;
    end if;
  end loop;
  if exists (select 1 from public.key_credit_gate g where g.status <> 'closed' and g.next_at <= now()) then
    select s.value into v_secret from private.app_secrets s where s.key = 'email_hook_secret';
    if v_secret is not null then
      perform net.http_post(
        url := 'https://uulcgvdsqivgkiulurhk.supabase.co/functions/v1/keys-credit-close',
        body := '{}'::jsonb,
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-email-secret', v_secret),
        timeout_milliseconds := 30000
      );
    end if;
  end if;
  return n;
end;
$$;

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'codpromo-keys-credit-gate') then
    perform cron.schedule('codpromo-keys-credit-gate', '* * * * *', 'select public.keys_credit_gate_kick()');
  end if;
end;
$$;

-- ===================== 7) الأدمن =====================
-- phase37 + حالة التسكير والدفعة المتأخّرة
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
                                      'backed', c.user_id is null or public.keys_credit_backed(c.user_id, c.currency, c.credit),
                                      'voidable', c.kind = 'checkout' and c.revoked_at is null
                                                  and not exists (select 1 from public.purchases pu where pu.provider_ref = c.provider_ref),
                                      'applied', (c.kind = 'full' and c.revoked_at is null) or exists (select 1 from public.purchases pu
                                                   where pu.provider_ref = c.provider_ref and pu.refunded_at is null),
                                      'gate_status', g.status, 'gate_reason', g.reason, 'late_status', g.late_status,
                                      'resolution', g.resolution, 'gate_error', g.last_error)
             order by c.created_at desc)
      from public.key_credit_uses c
      left join auth.users u on u.id = c.user_id
      left join public.profiles p on p.id = c.user_id
      left join public.key_credit_gate g on g.credit_use_id = c.id
  ), '[]'::json);
end;
$$;

-- تنبيهات /admin/sales: open = يلزم قرار (دفعة بعد الإلغاء بلا Premium، ولا Premium بالباقي والرصيد ما بقاش)،
-- granted = دفعات وصلت بعد الإلغاء وتفعّل بيها Premium وحدو (آخر 30 يوم، للمعلومة).
create or replace function public.admin_credit_alerts()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.admin_assert();
  return json_build_object(
    'open', coalesce((
      select json_agg(row_to_json(x) order by x.at desc) from (
        select c.id, 'refund_needed'::text as kind, g.late_note as note, c.provider, c.provider_ref,
               g.late_amount as amount, coalesce(g.late_currency, c.currency) as currency, g.late_paid_at as at,
               c.user_id, coalesce(u.email, p.email)::text as email, g.late_payment_ref as payment_ref,
               c.amount_due, c.credit, c.premium_price
          from public.key_credit_gate g
          join public.key_credit_uses c on c.id = g.credit_use_id
          left join auth.users u on u.id = c.user_id
          left join public.profiles p on p.id = c.user_id
         where g.late_status = 'refund_needed' and g.resolved_at is null
        union all
        select c.id, 'uncovered'::text, null::text, c.provider, c.provider_ref,
               pu.amount, pu.currency, pu.purchased_at,
               c.user_id, coalesce(u.email, p.email)::text, pu.payment_ref,
               c.amount_due, c.credit, c.premium_price
          from public.key_credit_uses c
          join public.purchases pu on pu.provider_ref = c.provider_ref and pu.refunded_at is null
          left join public.key_credit_gate g on g.credit_use_id = c.id
          left join auth.users u on u.id = c.user_id
          left join public.profiles p on p.id = c.user_id
         where c.kind = 'checkout' and c.user_id is not null
           and not public.keys_credit_backed(c.user_id, c.currency, c.credit)
           and g.resolved_at is null
      ) x), '[]'::json),
    'granted', coalesce((
      select json_agg(json_build_object('id', c.id, 'provider', c.provider, 'amount', g.late_amount,
                                        'currency', coalesce(g.late_currency, c.currency), 'at', g.late_paid_at,
                                        'email', coalesce(u.email, p.email)::text) order by g.late_paid_at desc)
        from public.key_credit_gate g
        join public.key_credit_uses c on c.id = g.credit_use_id
        left join auth.users u on u.id = c.user_id
        left join public.profiles p on p.id = c.user_id
       where g.late_status = 'granted' and g.late_paid_at > now() - interval '30 days'
    ), '[]'::json)
  );
end;
$$;

-- قرار الأدمن: 'refunded' (رجّع الدفعة عند البوابة) | 'grant' (يمنح Premium بالدفعة) | 'keep' (Premium بالباقي
-- يبقى رغم استرداد المفاتيح). يرجّع 'refunded' | 'granted' | 'kept' | 'has_premium' | 'amount' | 'failed' | 'not_found'
create or replace function public.admin_credit_alert_resolve(p_id bigint, p_action text)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  c       public.key_credit_uses%rowtype;
  g       public.key_credit_gate%rowtype;
  v_grant text;
begin
  perform public.admin_assert();
  if current_setting('transaction_read_only') = 'on' then
    raise exception 'POST only' using errcode = '25006';
  end if;
  if p_action is null or p_action not in ('refunded', 'grant', 'keep') then
    raise exception 'invalid action' using errcode = '22023';
  end if;
  select * into c from public.key_credit_uses where id = p_id and kind = 'checkout';
  if not found then
    return 'not_found';
  end if;
  if c.user_id is not null then
    perform pg_advisory_xact_lock(hashtextextended('diamond_key:' || c.user_id::text, 0));
  end if;
  select * into c from public.key_credit_uses where id = p_id for update;

  if p_action = 'keep' then
    if c.user_id is null
       or not exists (select 1 from public.purchases pu where pu.provider_ref = c.provider_ref and pu.refunded_at is null)
       or public.keys_credit_backed(c.user_id, c.currency, c.credit) then
      return 'not_found';
    end if;
    insert into public.key_credit_gate (credit_use_id, reason, status, closed_at, late_status, resolved_at, resolved_by, resolution)
    values (c.id, 'refund', 'closed', now(), 'uncovered', now(), auth.uid(), 'kept')
    on conflict (credit_use_id) do update
      set resolved_at = now(), resolved_by = auth.uid(), resolution = 'kept', updated_at = now()
      where key_credit_gate.resolved_at is null;
    return 'kept';
  end if;

  select * into g from public.key_credit_gate where credit_use_id = c.id for update;
  if not found or g.late_status is distinct from 'refund_needed' or g.resolved_at is not null then
    return 'not_found';
  end if;

  if p_action = 'refunded' then
    update public.key_credit_gate
       set resolved_at = now(), resolved_by = auth.uid(), resolution = 'refunded', updated_at = now()
     where credit_use_id = c.id;
    return 'refunded';
  end if;

  -- grant: الأدمن يقبل الدفعة كشراء Premium (بنفس المبلغ المحفوظ، ونفس دالة Premium)
  if not exists (select 1 from public.purchases pu where pu.provider_ref = c.provider_ref) then
    if c.user_id is null or public.keys_premium_blocked(c.user_id) then
      return 'has_premium';
    end if;
    if g.late_currency is distinct from c.currency or round(coalesce(g.late_amount, -1) * 100) <> round(c.amount_due * 100) then
      return 'amount';
    end if;
    if c.provider = 'slickpay' then
      update public.slickpay_invoices set tier = c.tier where invoice_id = c.provider_ref and status <> 'completed';
    elsif c.provider = 'paypal' then
      update public.paypal_orders set tier = c.tier where order_id = c.provider_ref and status <> 'completed';
    end if;
    begin
      v_grant := public.grant_lifetime_purchase(c.provider, c.provider_ref, c.user_id, c.amount_due, c.currency,
                                                c.tier, g.late_payment_ref);
    exception when others then
      v_grant := null;
    end;
    if v_grant is null or v_grant not in ('granted', 'duplicate') then
      if c.provider = 'slickpay' then
        update public.slickpay_invoices set tier = null where invoice_id = c.provider_ref and status <> 'completed';
      elsif c.provider = 'paypal' then
        update public.paypal_orders set tier = null where order_id = c.provider_ref and status <> 'completed';
      end if;
      return 'failed';
    end if;
  end if;
  update public.key_credit_uses set revoked_at = null where id = c.id;
  update public.key_credit_gate
     set resolved_at = now(), resolved_by = auth.uid(), resolution = 'granted', updated_at = now()
   where credit_use_id = c.id;
  return 'granted';
end;
$$;

-- ===================== 8) الصلاحيات =====================
revoke all on function public.keys_credit_gate_on() from public, anon, authenticated;
revoke all on function public.keys_credit_ttl(text) from public, anon, authenticated;
revoke all on function public.keys_credit_cancel(bigint, text) from public, anon, authenticated;
revoke all on function public.keys_credit_settle_late(text, text, numeric, text, text) from public, anon, authenticated;
revoke all on function public.keys_credit_gate_claim(integer) from public, anon, authenticated;
revoke all on function public.keys_credit_gate_done(bigint, text, text) from public, anon, authenticated;
revoke all on function public.keys_credit_gate_kick() from public, anon, authenticated;
revoke all on function public.admin_credit_alerts() from public, anon;
revoke all on function public.admin_credit_alert_resolve(bigint, text) from public, anon;
-- نفس صلاحيات phase37 للدوال اللي تبدّلت (create or replace يخلّيها، نعاودوها للأمان)
revoke all on function public.key_credit_void(bigint) from public, anon, authenticated;
revoke all on function public.key_order_refund_apply(bigint, numeric, uuid) from public, anon, authenticated;
revoke all on function public.keys_credit_open(uuid, text, text, text, numeric, text) from public, anon, authenticated;
revoke all on function public.admin_credit_uses() from public, anon;

grant execute on function public.keys_credit_settle_late(text, text, numeric, text, text) to service_role;
grant execute on function public.keys_credit_gate_claim(integer) to service_role;
grant execute on function public.keys_credit_gate_done(bigint, text, text) to service_role;
grant execute on function public.keys_credit_open(uuid, text, text, text, numeric, text) to service_role;
grant execute on function public.admin_credit_alerts() to authenticated;
grant execute on function public.admin_credit_alert_resolve(bigint, text) to authenticated;
grant execute on function public.admin_credit_uses() to authenticated;
