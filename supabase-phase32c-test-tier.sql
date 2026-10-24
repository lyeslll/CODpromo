-- ============================================================
--  CODpromo — Phase 32c: tier = 'test' (سعر التجربة) — ⚠️ فيه DROP CONSTRAINT
--  CHECK ما يتبدّلش في بلاصتو: نحيّو القديم ونزيدو الجديد (نفس الاسم) في معاملة وحدة،
--  باش ما يبقاش حتى لحظة بلا تحقق. ما يمسح حتى سطر. idempotent.
--  شغّله بعد phase32b: supabase db query --linked -f supabase-phase32c-test-tier.sql
-- ============================================================
begin;

alter table public.purchases drop constraint if exists purchases_tier_check;
alter table public.purchases add constraint purchases_tier_check
  check (tier in ('launch', 'regular', 'test'));

alter table public.slickpay_invoices drop constraint if exists slickpay_invoices_tier_check;
alter table public.slickpay_invoices add constraint slickpay_invoices_tier_check
  check (tier in ('launch', 'regular', 'test'));

alter table public.paypal_orders drop constraint if exists paypal_orders_tier_check;
alter table public.paypal_orders add constraint paypal_orders_tier_check
  check (tier in ('launch', 'regular', 'test'));

commit;
