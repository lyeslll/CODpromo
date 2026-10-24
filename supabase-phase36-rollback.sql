-- ============================================================
--  CODpromo — الرجوع من phase36 (ما يتشغّلش إلا بطلب المالك).
--  ينحّي policy الإخفاء: الشركات اللي status = 'hidden' ترجع تبان للجميع.
-- ============================================================
drop policy if exists "companies hidden from visitors" on public.companies;
notify pgrst, 'reload schema';
