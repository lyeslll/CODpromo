-- ============================================================
--  CODpromo — Phase 25: تقوية حماية Premium (بعد حادثة سبتمبر 2026)
--  شغّله مرة واحدة: npx supabase db query --linked -f supabase-phase25-premium-hardening.sql
--  آمن لإعادة التشغيل (idempotent).
--
--  1) protect_premium_columns يغطي INSERT أيضاً (كان UPDATE فقط)، ويحمي
--     stripe_customer_id و payment_provider مثل is_premium / premium_until / subscription_status.
--     العميل (authenticated / anon) ما يقدرش يكتبهم؛ الكتابة تبقى للـ Edge Functions
--     (service_role) والدوال الخادمية (SECURITY DEFINER) و SQL Editor.
--  2) stork_codes: لا صلاحيات إطلاقاً لـ anon (RLS كان يمنع أصلاً — هذا حماية إضافية).
--     التفعيل يبقى عبر redeem_stork_code (SECURITY DEFINER).
--  3) activate_paid_premium(provider, ref, days): حجز الفاتورة ومنح Premium في معاملة وحدة
--     (SlickPay / PayPal) — service_role فقط.
-- ============================================================

-- ===================== 1) حماية حقول Premium =====================
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
         or new.payment_provider is not null then
        raise exception 'تعيين حقول Premium غير مسموح من العميل' using errcode = '42501';
      end if;
    elsif new.is_premium          is distinct from old.is_premium
       or new.premium_until       is distinct from old.premium_until
       or new.subscription_status is distinct from old.subscription_status
       or new.stripe_customer_id  is distinct from old.stripe_customer_id
       or new.payment_provider    is distinct from old.payment_provider then
      raise exception 'تعديل حقول Premium غير مسموح من العميل (is_premium/premium_until/subscription_status/stripe_customer_id/payment_provider)'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- نفس الاسم، أحداث أوسع (INSERT أو UPDATE)
create or replace trigger protect_premium_columns_trg
  before insert or update on public.profiles
  for each row execute function public.protect_premium_columns();

-- ===================== 2) stork_codes: لا شيء لـ anon =====================
revoke all on public.stork_codes from anon;

-- ===================== 3) تفعيل Premium بعد الدفع في معاملة وحدة =====================
-- حجز الفاتورة/الطلب (status ≠ completed) + منح Premium في نفس المعاملة:
--  - طلبان متزامنان: الثاني يلقى الفاتورة completed فيرجع false (بلا منح مزدوج).
--  - إن فشل المنح يُلغى الحجز تلقائياً (rollback) — ما يبقاش زبون دفع بلا Premium.
--  - المدة تُحسب في القاعدة: greatest(premium_until, now()) + الأيام (لا ضياع تمديد).
-- تُنادى من Edge Functions فقط (service_role)، بعد تأكيد الدفع عند المزوّد.
create or replace function public.activate_paid_premium(p_provider text, p_ref text, p_days integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_plan text;
begin
  if p_days is null or p_days <= 0 or p_days > 400 then
    raise exception 'invalid days';
  end if;

  if p_provider = 'slickpay' then
    update public.slickpay_invoices
      set status = 'completed', completed_at = now()
      where invoice_id = p_ref and status is distinct from 'completed'
      returning user_id, plan_type into v_user, v_plan;
  elsif p_provider = 'paypal' then
    update public.paypal_orders
      set status = 'completed', completed_at = now()
      where order_id = p_ref and status is distinct from 'completed'
      returning user_id, plan_type into v_user, v_plan;
  else
    raise exception 'unknown provider';
  end if;

  -- مفعّلة مسبقاً (أو مرجع غير موجود)
  if v_user is null then
    return false;
  end if;

  update public.profiles
    set is_premium = true,
        premium_until = greatest(coalesce(premium_until, now()), now()) + make_interval(days => p_days),
        plan_type = v_plan,
        payment_provider = p_provider,
        subscription_status = 'active',
        slickpay_invoice_id = case when p_provider = 'slickpay' then p_ref else slickpay_invoice_id end
    where id = v_user;
  if not found then
    raise exception 'profile not found for %', v_user;  -- يلغي الحجز أيضاً
  end if;
  return true;
end;
$$;

revoke all on function public.activate_paid_premium(text, text, integer) from public, anon, authenticated;
grant execute on function public.activate_paid_premium(text, text, integer) to service_role;
