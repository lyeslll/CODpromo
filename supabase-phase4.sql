-- ============================================================
--  CODpromo — المرحلة 4: صلاحيات لوحة الأدمن — شغّله مرة واحدة
--  Supabase → SQL Editor → الصق ثم Run (آمن لإعادة التشغيل)
-- ============================================================

-- 1) قراءة كل المستخدمين من الأدمن (قائمة المستخدمين + الإحصائيات + CSV)
drop policy if exists "profiles admin read all" on public.profiles;
create policy "profiles admin read all"
  on public.profiles for select using (true);

-- 2) قراءة وتحديث كل طلبات الشركات من الأدمن (قبول/رفض)
drop policy if exists "requests admin read all"   on public.company_requests;
drop policy if exists "requests admin update all" on public.company_requests;
create policy "requests admin read all"
  on public.company_requests for select using (true);
create policy "requests admin update all"
  on public.company_requests for update using (true) with check (true);

-- 3) توحيد قيم الحالة على: pending / accepted / rejected
alter table public.company_requests drop constraint if exists company_requests_status_chk;
alter table public.company_requests
  add constraint company_requests_status_chk
  check (status in ('pending', 'accepted', 'rejected'));

-- ============================================================
--  ⚠️ تحذير أمني مهم:
--  السياسات أعلاه تسمح لأي شخص يملك المفتاح العام (anon) بقراءة
--  كل إيميلات وأسماء المستخدمين. لوحة /admin محمية برمز PIN في
--  الواجهة فقط — وليست حماية حقيقية على مستوى قاعدة البيانات.
--  للأمان الحقيقي لاحقاً: انقل الأدمن إلى Supabase Auth بدور admin
--  واستبدل using(true) بـ using (public.is_admin()).
-- ============================================================
