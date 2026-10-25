-- ============================================================
--  CODpromo — الرجوع من phase "app-push" (ما يتشغّلش إلا بطلب المالك).
--  ينحّي الـ cron، الدوال، والجداول الثلاثة (أجهزة التطبيق، الدفعات، السجلّ) + السرّين.
--  الإشعارات، Web Push والجرس ما يتمسّوش. التطبيق بلا هاد الدوال: التسجيل يفشل بصمت والجرس يخدم.
-- ============================================================
select cron.unschedule('codpromo-app-push-dispatch') where exists (select 1 from cron.job where jobname = 'codpromo-app-push-dispatch');

drop function if exists public.app_push_register(text, text, text);
drop function if exists public.app_push_unregister(text);
drop function if exists public.app_push_dispatch_due();
drop function if exists public.app_push_batch_claim(bigint);
drop function if exists public.app_push_batch_targets(bigint, bigint, integer);
drop function if exists public.app_push_batch_done(bigint, bigint[], bigint[], bigint[], text);
drop function if exists public.app_push_test_user(uuid);
drop function if exists public.app_push_post(bigint);
drop function if exists public.app_push_mode();

drop table if exists public.app_push_log;
drop table if exists public.app_push_batches;
drop table if exists public.app_push_tokens;

delete from private.app_secrets where key in ('app_push_hook_secret', 'app_push_mode');

notify pgrst, 'reload schema';
