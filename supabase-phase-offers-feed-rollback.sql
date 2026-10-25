-- ============================================================
--  CODpromo — الرجوع من phase "offers-feed" (ما يتشغّلش إلا بطلب المالك: فيه DROP).
--  الترتيب: أولاً رجّع الكود (git revert تاع الدمج + push) باش الموقع ما يبقاش يطلب هاد الأعمدة
--  والدوال، ومن بعد هاد الملف. ينحّي: الدوال الستة، الجدول feed_clicks (النقرات تروح معاه)،
--  والعمودين ilyes_slug / ilyes_visible. باقي الشركات والعروض ما يتمسّوش.
-- ============================================================
drop function if exists public.admin_feed_clicks(bigint);
drop function if exists public.partner_feed_clicks();
drop function if exists public.offers_feed_click(text, text);
drop function if exists public.offers_feed_target(text);
drop function if exists public.offers_feed_v1();
drop function if exists public.offers_feed_ok(text, boolean, text, text);
drop function if exists public.offers_feed_id(text, bigint);

drop table if exists public.feed_clicks;

alter table public.companies drop constraint if exists companies_ilyes_slug_chk;
alter table public.companies drop column if exists ilyes_visible;
alter table public.companies drop column if exists ilyes_slug;

notify pgrst, 'reload schema';
