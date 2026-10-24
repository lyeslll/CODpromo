-- ============================================================
--  CODpromo — الرجوع عن phase34 (صفحة الشركة + التقييم). ⚠️ يمسح التقييمات والخانات الجديدة.
--  ما يتشغّلش إلا بقرار المالك. ما يمسّ حتى جدول ولا عمود كان قبل phase34.
-- ============================================================
begin;

drop function if exists public.admin_set_rating_hidden(bigint, boolean);
drop function if exists public.admin_list_ratings(bigint, integer);
drop function if exists public.rate_company(bigint, integer, text[]);
drop function if exists public.my_company_rating(bigint);
drop function if exists public.company_rating_summaries();
drop function if exists public.company_rating_summary(bigint);
drop function if exists public.company_kind(bigint);
drop function if exists public.rating_tags_for(text);

drop table if exists public.company_rating_log;
drop table if exists public.company_ratings;

alter table public.companies drop constraint if exists companies_about_len_check;
alter table public.companies drop constraint if exists companies_logo_bg_check;
alter table public.companies drop constraint if exists companies_store_kind_check;
alter table public.companies
  drop column if exists about, drop column if exists about_en, drop column if exists about_fr,
  drop column if exists features, drop column if exists features_en, drop column if exists features_fr,
  drop column if exists usage_steps, drop column if exists usage_steps_en, drop column if exists usage_steps_fr,
  drop column if exists store_kind, drop column if exists code_checked_at, drop column if exists logo_bg;

commit;
