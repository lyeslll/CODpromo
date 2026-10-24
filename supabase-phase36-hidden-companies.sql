-- ============================================================
--  CODpromo — phase36: إخفاء شركة من الموقع بلا ما تتمسح (قرار المالك، 24 أكتوبر 2026 — Trackili)
--
--  companies.status = 'hidden' ← الشركة ما تبانش لحتى زائر ولا مستخدم: العروض، البحث، الفئات، /premium،
--  صفحة الشركة، المفضّلة، الـ sitemap و prerender (كلهم يقراو بالمفتاح العام). الأدمين يشوفها (is_admin)
--  ويرجّعها من الجدول (status = 'active'). بيانات الشركة كاملة تبقى (الكود، الأصوات، المفضّلة…).
--
--  policy جديدة RESTRICTIVE (تتجمع بـ AND مع "public read" الكاينين) — بلا تبديل حتى policy قديمة.
--  الدوال SECURITY DEFINER (أرقام site_stats_auto، offers_usage_rank…) ما تتأثّرش.
--  idempotent، بلا DROP / DELETE / TRUNCATE. الرجوع: supabase-phase36-rollback.sql.
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'companies' and policyname = 'companies hidden from visitors'
  ) then
    create policy "companies hidden from visitors" on public.companies
      as restrictive
      for select
      to public
      using (coalesce(status, 'active') <> 'hidden' or (select public.is_admin()));
  end if;
end $$;

notify pgrst, 'reload schema';
