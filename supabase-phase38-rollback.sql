-- ============================================================
--  CODpromo — رجوع phase38 (حجز Premium بالرصيد + التسكير عند البوابة)
--  ⚠️ فيه DROP (جدول key_credit_gate والدوال الجديدة): بقرار المالك برك.
--  يرجّع الدوال الأربعة تاع phase37 كيما كانت (منسوخة حرفياً من supabase-phase37-diamond-keys.sql).
--  قبل: رجّع keys-credit-close و paypal-capture-order للنسخة القديمة (ولا خلّيهم — بلا phase38 ما يلقاوش خدمة).
-- ============================================================
begin;

update private.app_secrets set value = 'false' where key = 'keys_credit_gate_enabled';
do $$
begin
  if exists (select 1 from cron.job where jobname = 'codpromo-keys-credit-gate') then
    perform cron.unschedule('codpromo-keys-credit-gate');
  end if;
end;
$$;

-- الدوال الأربعة تاع phase37
create or replace function public.key_credit_void(p_id bigint)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  c public.key_credit_uses%rowtype;
begin
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
  return 'voided';
end;
$$;

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
    -- دفع الباقي اللي ما كملش والرصيد اللي تحسب فيه ما بقاش مغطّى: يتلغى (الفاتورة القديمة ما تعطيش Premium)
    perform public.key_credit_void(c.id)
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
                                                   where pu.provider_ref = c.provider_ref and pu.refunded_at is null))
             order by c.created_at desc)
      from public.key_credit_uses c
      left join auth.users u on u.id = c.user_id
      left join public.profiles p on p.id = c.user_id
  ), '[]'::json);
end;
$$;

revoke all on function public.key_credit_void(bigint) from public, anon, authenticated;
revoke all on function public.key_order_refund_apply(bigint, numeric, uuid) from public, anon, authenticated;
revoke all on function public.keys_credit_open(uuid, text, text, text, numeric, text) from public, anon, authenticated;
grant execute on function public.keys_credit_open(uuid, text, text, text, numeric, text) to service_role;
revoke all on function public.admin_credit_uses() from public, anon;
grant execute on function public.admin_credit_uses() to authenticated;

-- الجديد تاع phase38
drop function if exists public.admin_credit_alert_resolve(bigint, text);
drop function if exists public.admin_credit_alerts();
drop function if exists public.keys_credit_gate_kick();
drop function if exists public.keys_credit_gate_done(bigint, text, text);
drop function if exists public.keys_credit_gate_claim(integer);
drop function if exists public.keys_credit_settle_late(text, text, numeric, text, text);
drop function if exists public.keys_credit_cancel(bigint, text);
drop function if exists public.keys_credit_ttl(text);
drop function if exists public.keys_credit_gate_on();
drop table if exists public.key_credit_gate;
delete from private.app_secrets where key = 'keys_credit_gate_enabled';

commit;
