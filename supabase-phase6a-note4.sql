-- ============================================================
--  CODpromo — المرحلة 6أ (ملاحظة 4): دعم Premium لكل شركة — شغّله مرة واحدة
--  Supabase → SQL Editor → الصق ثم Run
-- ============================================================

-- افتراضي true ليبقى السلوك الحالي (كل البطاقات تدعم Premium).
-- اجعلها false لأي شركة لتبقى بهويتها العادية حتى في وضع Premium.
alter table public.companies
  add column if not exists supports_premium boolean not null default true;
