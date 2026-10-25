-- ============================================================
--  CODpromo — الرجوع من phase "notifications" (ما يتشغّلش إلا بطلب المالك).
--  ينحّي الـ cron، الـ triggers، الدوال، والجداول الخمسة (الإشعارات، "مقروء"، التفضيلات، أجهزة push،
--  الدفعات) + السرّين. الشركات والعروض ما يتمسّوش. الواجهة القديمة (main قبل الدمج) ما تستعمل حتى حاجة منهم.
-- ============================================================
select cron.unschedule('codpromo-push-dispatch') where exists (select 1 from cron.job where jobname = 'codpromo-push-dispatch');

drop trigger if exists notify_company on public.companies;
drop trigger if exists notify_deal on public.nocode_deals;

drop function if exists public.notify_on_company();
drop function if exists public.notify_on_deal();
drop function if exists public.notifications_feed(integer, timestamptz, boolean);
drop function if exists public.notifications_mark_read(bigint[]);
drop function if exists public.notifications_mark_all_read();
drop function if exists public.my_notification_prefs();
drop function if exists public.set_notification_prefs(text, uuid[]);
drop function if exists public.push_subscribe(text, text, text, text);
drop function if exists public.push_unsubscribe(text);
drop function if exists public.push_unsubscribe_device(text, text);
drop function if exists public.push_dispatch_due();
drop function if exists public.push_batch_claim(bigint);
drop function if exists public.push_batch_targets(bigint, bigint, integer);
drop function if exists public.push_batch_done(bigint, bigint[], bigint[], bigint[], text);
drop function if exists public.push_post(bigint);
drop function if exists public.admin_notifications(integer);
drop function if exists public.admin_create_notification(text, bigint, bigint, text, text, text, text, text, text, text, boolean);
drop function if exists public.admin_update_notification(bigint, text, text, text, text, text, text, text);
drop function if exists public.admin_set_notification_hidden(bigint, boolean);
drop function if exists public.admin_push_overview();
drop function if exists public.admin_push_test();
drop function if exists public.admin_set_push_enabled(boolean);
drop function if exists public.notif_json(public.notifications);
drop function if exists public.notif_matches(public.notifications, uuid, text, uuid[]);
drop function if exists public.notif_visible(public.notifications);
drop function if exists public.notif_deal_live(bigint);
drop function if exists public.push_mode();

drop table if exists public.notification_reads;
drop table if exists public.notification_prefs;
drop table if exists public.push_subscriptions;
drop table if exists public.notifications;
drop table if exists public.push_batches;

delete from private.app_secrets where key in ('push_hook_secret', 'push_mode');

notify pgrst, 'reload schema';
