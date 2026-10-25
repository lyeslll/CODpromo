-- ============================================================
--  CODpromo — رجوع phase37 (المفاتيح الماسية) — ⚠️ فيه DROP: ما يتشغّلش غير بقرار المالك.
--  ينحّي كل واش زادو phase37 برك (جداول ودوال جديدة + مهمة cron + سويتش الإيميلات).
--  ما يمسّ حتى جدول ولا دالة كاينة قبل phase37. Premium والمفتاح الذهبي والهدايا يبقاو كيما راهم.
--  ⚠️ تاريخ المفاتيح (key_orders / key_ledger) يروح معاه: خوذ نسخة قبل (select … to CSV) إذا كاين مبيعات.
--  ملاحظة: Premium اللي تفعّل بالرصيد كامل (payment_provider = 'keys') يبقى في profiles كيما هو.
--  الفواتير / الطلبات اللي زادها keys_credit_open في slickpay_invoices / paypal_orders تبقى (شراءات Premium عادية).
--  شغّله: supabase db query --linked -f supabase-phase37-rollback.sql
-- ============================================================
begin;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'codpromo-keys-email-dispatch') then
    perform cron.unschedule('codpromo-keys-email-dispatch');
  end if;
end;
$$;

drop function if exists public.admin_revoke_credit_upgrade(bigint);
drop function if exists public.admin_credit_uses();
drop function if exists public.admin_refund_key_order(bigint);
drop function if exists public.admin_list_key_orders(text, integer, integer);
drop function if exists public.admin_keys_history(uuid);
drop function if exists public.admin_keys_accounts(text, integer, integer);
drop function if exists public.admin_keys_stats();
drop function if exists public.admin_gift_keys(text, integer, text);
drop function if exists public.admin_save_key_pack(text, integer, integer, numeric, boolean, integer);
drop function if exists public.admin_key_packs();
drop function if exists public.keys_credit_open(uuid, text, text, text, numeric, text);
drop function if exists public.keys_order_refund_gateway(text, text, numeric);
drop function if exists public.key_order_refund_apply(bigint, numeric, uuid);
drop function if exists public.keys_play_grant(uuid, text, text, text, boolean);
drop function if exists public.keys_order_failed(text, text);
drop function if exists public.keys_order_paid(text, text, numeric, text, text);
drop function if exists public.keys_order_open(uuid, text, text, text, numeric, text, text);
drop function if exists public.keys_order_quote(uuid, text);
drop function if exists public.my_credit_upgrade();
drop function if exists public.keys_premium_redeem();
drop function if exists public.get_diamond_code(bigint);
drop function if exists public.use_diamond_key(bigint, text);
drop function if exists public.keys_credit_quote();
drop function if exists public.my_keys();
drop function if exists public.my_key_packs();
drop function if exists public.keys_email_test_send(text, text);
drop function if exists public.key_email_dispatch_due();
drop function if exists public.key_email_done(bigint, boolean, text, text);
drop function if exists public.key_email_claim(bigint);

drop table if exists public.key_emails;
drop table if exists public.key_credit_uses;
drop table if exists public.key_wallets;
drop table if exists public.key_ledger;   -- triggers key_ledger_apply / key_ledger_guard / key_email_gift يروحو معاه
drop table if exists public.key_orders;   -- trigger key_email_order يروح معاه
drop table if exists public.key_packs;

drop function if exists public.key_email_on_gift();
drop function if exists public.key_email_on_order();
drop function if exists public.key_email_enqueue(text, uuid, text, jsonb);
drop function if exists public.key_email_dispatch(bigint);
drop function if exists public.key_email_enabled();
drop function if exists public.key_order_refund_info(bigint);
drop function if exists public.keys_credit_state(uuid);
drop function if exists public.keys_credit_quote_for(uuid);
drop function if exists public.keys_credit_backed(uuid, text, numeric);
drop function if exists public.keys_credit_amounts(uuid);
drop function if exists public.key_order_unused(bigint);
drop function if exists public.keys_pack_price(uuid, text);
drop function if exists public.keys_pending(uuid);
drop function if exists public.keys_balance(uuid);
drop function if exists public.keys_locked_count(uuid);
drop function if exists public.keys_company_ok(bigint);
drop function if exists public.keys_premium_blocked(uuid);
drop function if exists public.key_ledger_guard();
drop function if exists public.key_ledger_apply();

delete from private.app_secrets where key = 'keys_emails_enabled';

commit;

notify pgrst, 'reload schema';
