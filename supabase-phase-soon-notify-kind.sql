-- ============================================================
--  CODpromo — phase "soon-notify" (1/2): النوع الجديد "coming_soon" في public.notifications
--
--  ⚠️ فيه DROP CONSTRAINT (بموافقة المالك، 26 أكتوبر 2026 — كيما phase32c): القاعدتين القديمتين
--  (notifications_kind_check و notifications_target) يتبدّلو بنفس القاعدة + "coming_soon". ما يتمسح حتى
--  سطر ولا بيانات؛ الـ ADD يتأكّد من السطور الموجودة. معاملة وحدة: يا كلش يا والو.
--
--  coming_soon = إشعار "قريباً على CODpromo" (الجرس برك، بلا هاتف). يحتاج company_id (البطاقة الأولى).
--  يتشغّل قبل supabase-phase-soon-notify.sql. idempotent. الرجوع: الجزء 2 من supabase-phase-soon-notify-rollback.sql
-- ============================================================

begin;

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('company', 'code', 'premium_code', 'deal', 'feature', 'announcement', 'coming_soon'));

alter table public.notifications drop constraint if exists notifications_target;
alter table public.notifications add constraint notifications_target check (
  (kind in ('company', 'code', 'premium_code', 'coming_soon') and company_id is not null)
  or (kind = 'deal' and deal_id is not null)
  or (kind in ('feature', 'announcement') and title is not null and char_length(btrim(title)) > 0)
);

commit;
