-- ============================================================
--  CODpromo — Phase 16 (S2): قفل RLS — الكتابة للأدمن فقط
--  شغّله مرة واحدة في Supabase → SQL Editor → الصق ثم Run.
--  آمن لإعادة التشغيل (idempotent): drop policy if exists ثم create.
--
--  المتطلّب المسبق: Phase 15 (supabase-phase15-admin.sql) مُشغّلة —
--  تُعرّف دالة public.is_admin() وعمود profiles.is_admin، وحسابك أدمن.
--
--  الفكرة: نُبقي القراءة العامة للمحتوى، ونحصر كل كتابة (إضافة/تعديل/حذف)
--  على من يُرجِع له public.is_admin() = true. لا نلمس إطلاقاً:
--  stork_codes · favorites · paypal_orders · slickpay_invoices.
--
--  ⚠️ انحراف واحد مقصود عن المواصفة الحرفية (موثّق):
--  في company_requests جعلنا SELECT = (auth.uid()=user_id) OR is_admin()
--  بدل is_admin() فقط — وإلا انكسر داشبورد المورّد (fetchMyRequests يقرأ
--  طلبات المستخدم نفسه). نفس نمط profiles المعتمد. UPDATE/DELETE تبقى أدمن فقط.
-- ============================================================

-- ===================== 1) companies =====================
-- SELECT عام (الواجهة العامة تقرأ بالمفتاح العام) · الكتابة للأدمن فقط.
alter table public.companies enable row level security;

drop policy if exists "companies public read" on public.companies;
drop policy if exists "companies anon insert" on public.companies;
drop policy if exists "companies anon update" on public.companies;
drop policy if exists "companies anon delete" on public.companies;
drop policy if exists "companies admin insert" on public.companies;
drop policy if exists "companies admin update" on public.companies;
drop policy if exists "companies admin delete" on public.companies;

create policy "companies public read"
  on public.companies for select
  using (true);
create policy "companies admin insert"
  on public.companies for insert
  with check (public.is_admin());
create policy "companies admin update"
  on public.companies for update
  using (public.is_admin())
  with check (public.is_admin());
create policy "companies admin delete"
  on public.companies for delete
  using (public.is_admin());

-- ===================== 2) categories =====================
alter table public.categories enable row level security;

drop policy if exists "categories public read" on public.categories;
drop policy if exists "categories anon insert" on public.categories;
drop policy if exists "categories anon update" on public.categories;
drop policy if exists "categories anon delete" on public.categories;
drop policy if exists "categories admin insert" on public.categories;
drop policy if exists "categories admin update" on public.categories;
drop policy if exists "categories admin delete" on public.categories;

create policy "categories public read"
  on public.categories for select
  using (true);
create policy "categories admin insert"
  on public.categories for insert
  with check (public.is_admin());
create policy "categories admin update"
  on public.categories for update
  using (public.is_admin())
  with check (public.is_admin());
create policy "categories admin delete"
  on public.categories for delete
  using (public.is_admin());

-- ===================== 3) company_faqs =====================
alter table public.company_faqs enable row level security;

drop policy if exists "faqs public read"  on public.company_faqs;
drop policy if exists "faqs anon insert"  on public.company_faqs;
drop policy if exists "faqs anon update"  on public.company_faqs;
drop policy if exists "faqs anon delete"  on public.company_faqs;
drop policy if exists "faqs admin insert" on public.company_faqs;
drop policy if exists "faqs admin update" on public.company_faqs;
drop policy if exists "faqs admin delete" on public.company_faqs;

create policy "faqs public read"
  on public.company_faqs for select
  using (true);
create policy "faqs admin insert"
  on public.company_faqs for insert
  with check (public.is_admin());
create policy "faqs admin update"
  on public.company_faqs for update
  using (public.is_admin())
  with check (public.is_admin());
create policy "faqs admin delete"
  on public.company_faqs for delete
  using (public.is_admin());

-- ===================== 4) site_settings =====================
alter table public.site_settings enable row level security;

drop policy if exists "settings public read"  on public.site_settings;
drop policy if exists "settings anon insert"   on public.site_settings;
drop policy if exists "settings anon update"   on public.site_settings;
drop policy if exists "settings admin insert"  on public.site_settings;
drop policy if exists "settings admin update"  on public.site_settings;
drop policy if exists "settings admin delete"  on public.site_settings;

create policy "settings public read"
  on public.site_settings for select
  using (true);
create policy "settings admin insert"
  on public.site_settings for insert
  with check (public.is_admin());
create policy "settings admin update"
  on public.site_settings for update
  using (public.is_admin())
  with check (public.is_admin());
create policy "settings admin delete"
  on public.site_settings for delete
  using (public.is_admin());

-- ===================== 5) storage.objects — حاوية الشعارات (logos) =====================
-- SELECT عام (الشعارات تُعرَض للجميع) · الرفع/التعديل/الحذف للأدمن فقط، داخل حاوية logos حصراً.
drop policy if exists "logos public read"  on storage.objects;
drop policy if exists "logos anon insert"  on storage.objects;
drop policy if exists "logos anon update"  on storage.objects;
drop policy if exists "logos anon delete"  on storage.objects;
drop policy if exists "logos admin insert" on storage.objects;
drop policy if exists "logos admin update" on storage.objects;
drop policy if exists "logos admin delete" on storage.objects;

create policy "logos public read"
  on storage.objects for select
  using (bucket_id = 'logos');
create policy "logos admin insert"
  on storage.objects for insert
  with check (bucket_id = 'logos' and public.is_admin());
create policy "logos admin update"
  on storage.objects for update
  using (bucket_id = 'logos' and public.is_admin())
  with check (bucket_id = 'logos' and public.is_admin());
create policy "logos admin delete"
  on storage.objects for delete
  using (bucket_id = 'logos' and public.is_admin());

-- ===================== 6) profiles =====================
-- SELECT = صاحب الصف أو أدمن (نحذف سياسة "admin read all" المفتوحة using(true)).
-- INSERT/UPDATE = صاحب الصف فقط (own). لا حذف.
alter table public.profiles enable row level security;

drop policy if exists "profiles admin read all"    on public.profiles;  -- الثغرة: قراءة عامة لكل الملفات
drop policy if exists "profiles select own"         on public.profiles;
drop policy if exists "profiles select own or admin" on public.profiles;
drop policy if exists "profiles insert own"         on public.profiles;
drop policy if exists "profiles update own"         on public.profiles;

create policy "profiles select own or admin"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());
create policy "profiles insert own"
  on public.profiles for insert
  with check (auth.uid() = id);
create policy "profiles update own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ===================== 7) email_subscribers =====================
-- INSERT عام يبقى (نافذة جمع الإيميل تكتب بالمفتاح العام) · القراءة/التعديل/الحذف للأدمن فقط.
alter table public.email_subscribers enable row level security;

drop policy if exists "subscribers anon insert"   on public.email_subscribers;
drop policy if exists "subscribers admin read"    on public.email_subscribers;  -- كانت select using(true)
drop policy if exists "subscribers admin select"  on public.email_subscribers;
drop policy if exists "subscribers admin update"  on public.email_subscribers;
drop policy if exists "subscribers admin delete"  on public.email_subscribers;

create policy "subscribers anon insert"
  on public.email_subscribers for insert
  with check (true);
create policy "subscribers admin select"
  on public.email_subscribers for select
  using (public.is_admin());
create policy "subscribers admin update"
  on public.email_subscribers for update
  using (public.is_admin())
  with check (public.is_admin());
create policy "subscribers admin delete"
  on public.email_subscribers for delete
  using (public.is_admin());

-- ===================== 8) company_requests =====================
-- INSERT يبقى للمورّد المسجّل (own) — لا نكسر تسجيل العروض.
-- SELECT = صاحب الطلب أو أدمن (المورّد يرى طلباته في داشبورده + الأدمن يرى الكل).
-- UPDATE/DELETE = أدمن فقط (قبول/رفض/حذف من اللوحة).
alter table public.company_requests enable row level security;

drop policy if exists "requests insert own"          on public.company_requests;
drop policy if exists "requests select own"          on public.company_requests;
drop policy if exists "requests admin read all"      on public.company_requests;  -- كانت select using(true)
drop policy if exists "requests admin update all"    on public.company_requests;  -- كانت update using(true)
drop policy if exists "requests select own or admin" on public.company_requests;
drop policy if exists "requests admin update"        on public.company_requests;
drop policy if exists "requests admin delete"        on public.company_requests;

create policy "requests insert own"
  on public.company_requests for insert
  with check (auth.uid() = user_id);
create policy "requests select own or admin"
  on public.company_requests for select
  using (auth.uid() = user_id or public.is_admin());
create policy "requests admin update"
  on public.company_requests for update
  using (public.is_admin())
  with check (public.is_admin());
create policy "requests admin delete"
  on public.company_requests for delete
  using (public.is_admin());

-- ===================== 9) تحديث مخزّن مخطّط PostgREST =====================
notify pgrst, 'reload schema';
