-- ============================================================
--  CODpromo — Phase 26: بوابة الشركات (Partners)
--  شغّله مرة واحدة: npx supabase db query --linked -f supabase-phase26-partners-portal.sql
--  آمن لإعادة التشغيل (idempotent). إضافي فقط: لا حذف ولا إعادة تسمية لأي عمود أو جدول.
--
--  1) site_stats: users_count (فارغ = عدّ تلقائي) + audience_followers (جمهور Ilyes Derradji).
--  2) company_requests: أعمدة فورم العرض الكامل + التواصل والشراكة + المراجعة (سبب الرفض…).
--     trigger: الطلب من العميل = pending دائماً، حساب شركة فقط، 5 طلبات معلّقة كحدّ أقصى،
--     وطلب التعديل لشركة يملكها صاحب الطلب فقط.
--  3) company_owners: ربط الشركة المنشورة بحساب صاحبها (يقرأ سطره فقط؛ الكتابة للأدمن).
--  4) company_private.affiliate_url (رابط الإحالة/الأفلييت).
--  5) RPCs: partner_overview(), partner_offer_detail(company), admin_publish_request(...),
--     admin_reject_request(...) — كلها SECURITY DEFINER؛ دوال الأدمن تبدأ بـ admin_assert().
--  6) bucket partner-logos: PNG/JPG/WebP، 1MB، كل حساب في دوسيه باسمه (uid/…).
--  لا كلمات سر في أي عمود: روابط ومعلومات تواصل فقط.
-- ============================================================

-- ===================== 1) أرقام الصفحة الرئيسية =====================
alter table public.site_stats add column if not exists users_count integer check (users_count is null or users_count >= 0);
alter table public.site_stats add column if not exists audience_followers integer check (audience_followers is null or audience_followers >= 0);

-- عدّ المستخدمين خادمياً (الـ view بـ security_invoker، و profiles محمي بـ RLS)
create or replace function public.site_stats_users_auto()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer from public.profiles;
$$;
grant execute on function public.site_stats_users_auto() to anon, authenticated;

-- نفس الأعمدة بنفس الترتيب + أعمدة جديدة في الآخر
create or replace view public.site_stats_public
with (security_invoker = true) as
select
  s.total_savings_dzd,
  coalesce(s.total_codes, a.codes) as total_codes,
  coalesce(s.partners_count, a.partners) as partners_count,
  s.premium_unlock_value_usd,
  a.codes as total_codes_auto,
  a.partners as partners_count_auto,
  s.updated_at,
  coalesce(s.users_count, public.site_stats_users_auto()) as users_count,
  s.audience_followers,
  public.site_stats_users_auto() as users_count_auto
from public.site_stats s
cross join public.site_stats_auto() a(codes, partners)
where s.id = 1;
grant select on public.site_stats_public to anon, authenticated;
-- phase21 يمنح UPDATE على أعمدة محدّدة فقط → نمنح العمودين الجديدين (RLS: الأدمن فقط)
grant update (users_count, audience_followers) on public.site_stats to authenticated;

-- القيمة اللي عطاها المالك (متابعين Ilyes Derradji على الشبكات) — تتعدّل من لوحة الأدمن
update public.site_stats set audience_followers = 855000 where id = 1 and audience_followers is null;

-- ===================== 2) طلبات الشركات =====================
alter table public.company_requests add column if not exists request_type text not null default 'new';
alter table public.company_requests add column if not exists company_id bigint references public.companies (id) on delete set null;
alter table public.company_requests add column if not exists category_id uuid references public.categories (id) on delete set null;
alter table public.company_requests add column if not exists discount text;
alter table public.company_requests add column if not exists premium_discount text;
alter table public.company_requests add column if not exists premium_code text;
alter table public.company_requests add column if not exists premium_url text;
alter table public.company_requests add column if not exists premium_description text;
alter table public.company_requests add column if not exists supports_premium boolean not null default true;
alter table public.company_requests add column if not exists website_url text;
alter table public.company_requests add column if not exists contact_name text;
alter table public.company_requests add column if not exists whatsapp text;
alter table public.company_requests add column if not exists contact_email text;
alter table public.company_requests add column if not exists affiliate_url text;
alter table public.company_requests add column if not exists affiliate_dashboard_url text;
alter table public.company_requests add column if not exists commission_pct numeric(5, 2) check (commission_pct is null or (commission_pct >= 0 and commission_pct <= 100));
alter table public.company_requests add column if not exists message text;
alter table public.company_requests add column if not exists rejection_reason text;
alter table public.company_requests add column if not exists reviewed_at timestamptz;
alter table public.company_requests add column if not exists reviewed_by uuid;
alter table public.company_requests add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'company_requests_request_type_chk') then
    alter table public.company_requests add constraint company_requests_request_type_chk check (request_type in ('new', 'edit'));
  end if;
end $$;

create index if not exists company_requests_status_idx on public.company_requests (status, created_at desc);

-- ===================== 3) ملكية الشركات =====================
create table if not exists public.company_owners (
  company_id bigint primary key references public.companies (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists company_owners_user_idx on public.company_owners (user_id);
alter table public.company_owners enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'company_owners' and policyname = 'owners select own or admin') then
    create policy "owners select own or admin" on public.company_owners
      for select to authenticated using (user_id = auth.uid() or public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'company_owners' and policyname = 'owners admin write') then
    create policy "owners admin write" on public.company_owners
      for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;
revoke all on public.company_owners from anon;
grant select, insert, update on public.company_owners to authenticated;

-- ===================== حارس الطلبات (من العميل) =====================
-- SECURITY INVOKER عمداً: current_user لازم يبقى دور العميل (authenticated) حتى يشتغل الحارس.
create or replace function public.guard_company_request()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_pending int;
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    new.updated_at := now();
    return new;
  end if;

  if tg_op = 'INSERT' then
    if auth.uid() is null or new.user_id is distinct from auth.uid() then
      raise exception 'request must belong to the caller' using errcode = '42501';
    end if;
    if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.account_type = 'company') then
      raise exception 'company_account_required' using errcode = '42501';
    end if;
    select count(*) into v_pending from public.company_requests where user_id = auth.uid() and status = 'pending';
    if v_pending >= 5 then
      raise exception 'too_many_pending' using errcode = 'P0001';
    end if;
    -- حقول المراجعة يضبطها الأدمن فقط
    new.status := 'pending';
    new.rejection_reason := null;
    new.reviewed_at := null;
    new.reviewed_by := null;
    new.created_at := now();
    new.updated_at := now();
    if new.request_type = 'edit' then
      if new.company_id is null or not exists (
        select 1 from public.company_owners o where o.company_id = new.company_id and o.user_id = auth.uid()
      ) then
        raise exception 'not_your_company' using errcode = '42501';
      end if;
    else
      new.request_type := 'new';
      new.company_id := null;
    end if;
    return new;
  end if;

  -- UPDATE / DELETE من العميل محجوبين أصلاً بـ RLS (أدمن فقط) — حماية إضافية
  raise exception 'requests are read-only for clients' using errcode = '42501';
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'guard_company_request_trg') then
    create trigger guard_company_request_trg
      before insert or update on public.company_requests
      for each row execute function public.guard_company_request();
  end if;
end $$;

-- ===================== 4) رابط الإحالة في المعلومات الداخلية =====================
alter table public.company_private add column if not exists affiliate_url text;

-- ===================== 5) دوال بوابة الشركات =====================
-- نظرة عامة للشركة صاحبة الجلسة: عروضها المنشورة فقط (company_owners)، بعدّ دقيق.
create or replace function public.partner_overview()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  tz constant text := 'Africa/Algiers';
  v_uid uuid := auth.uid();
  v_from timestamp := date_trunc('day', now() at time zone tz) - interval '29 days';
begin
  if v_uid is null then
    raise exception 'auth required' using errcode = '42501';
  end if;

  return json_build_object(
    'offers', (select count(*) from public.company_owners o where o.user_id = v_uid),
    'copies', (select count(*) from public.code_copies c join public.company_owners o on o.company_id = c.company_id where o.user_id = v_uid),
    'copies_30d', (select count(*) from public.code_copies c join public.company_owners o on o.company_id = c.company_id
                   where o.user_id = v_uid and c.created_at >= (v_from at time zone tz)),
    'votes', (select count(*) from public.code_votes v join public.company_owners o on o.company_id = v.company_id where o.user_id = v_uid),
    'votes_up', (select count(*) from public.code_votes v join public.company_owners o on o.company_id = v.company_id where o.user_id = v_uid and v.vote_type = 'up'),
    'favorites', (select count(*) from public.favorites f join public.company_owners o on o.company_id = f.company_id where o.user_id = v_uid),
    'series', (
      select json_agg(json_build_object(
               't', to_char(g.d, 'YYYY-MM-DD'),
               'copies', (select count(*) from public.code_copies c join public.company_owners o on o.company_id = c.company_id
                          where o.user_id = v_uid and date_trunc('day', c.created_at at time zone tz) = g.d)
             ) order by g.d)
      from generate_series(v_from, date_trunc('day', now() at time zone tz), interval '1 day') as g(d)
    ),
    'items', coalesce((
      select json_agg(json_build_object(
               'id', co.id, 'name', co.name, 'logo', co.logo, 'type', co.type, 'slug', co.slug,
               'discount', co.discount, 'premium_discount', co.premium_discount, 'clicks', co.clicks,
               'copies', (select count(*) from public.code_copies c where c.company_id = co.id),
               'votes', (select count(*) from public.code_votes v where v.company_id = co.id),
               'votes_up', (select count(*) from public.code_votes v where v.company_id = co.id and v.vote_type = 'up'),
               'favorites', (select count(*) from public.favorites f where f.company_id = co.id)
             ) order by co.created_at desc)
      from public.companies co join public.company_owners o on o.company_id = co.id
      where o.user_id = v_uid
    ), '[]'::json)
  );
end;
$$;

-- تفاصيل عرض تملكه الشركة (لتعمير "اطلب تعديل"، مع كود/رابط Premium تاعها)
create or replace function public.partner_offer_detail(p_company_id bigint)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.company_owners o where o.company_id = p_company_id and o.user_id = auth.uid()
  ) then
    raise exception 'not_your_company' using errcode = '42501';
  end if;
  return (
    select json_build_object(
      'id', c.id, 'name', c.name, 'logo', c.logo, 'category_id', c.category_id, 'type', c.type,
      'discount', c.discount, 'code', c.code, 'link', c.link, 'description', c.description,
      'premium_discount', c.premium_discount, 'premium_code', c.premium_code, 'premium_url', c.premium_url,
      'premium_description', c.premium_description, 'supports_premium', c.supports_premium
    )
    from public.companies c where c.id = p_company_id
  );
end;
$$;

-- النشر: يربط الطلب بالشركة (المنشأة/المحدّثة من الواجهة بتوكن الأدمن) وبصاحبها
create or replace function public.admin_publish_request(p_request_id bigint, p_company_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
begin
  perform public.admin_assert();
  if not exists (select 1 from public.companies where id = p_company_id) then
    raise exception 'company not found';
  end if;
  update public.company_requests
    set status = 'accepted', company_id = p_company_id, rejection_reason = null,
        reviewed_at = now(), reviewed_by = auth.uid(), updated_at = now()
    where id = p_request_id
    returning user_id into v_user;
  if not found then
    raise exception 'request not found';
  end if;
  -- شركة لها مالك أصلاً (طلب تعديل قديم مثلاً): لا نغيّر المالك — تغييره قرار الأدمن وحده
  if v_user is not null then
    insert into public.company_owners (company_id, user_id) values (p_company_id, v_user)
    on conflict (company_id) do nothing;
  end if;
end;
$$;

-- الرفض مع سبب يظهر للشركة
create or replace function public.admin_reject_request(p_request_id bigint, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.admin_assert();
  update public.company_requests
    set status = 'rejected', rejection_reason = nullif(btrim(coalesce(p_reason, '')), ''),
        reviewed_at = now(), reviewed_by = auth.uid(), updated_at = now()
    where id = p_request_id;
  if not found then
    raise exception 'request not found';
  end if;
end;
$$;

revoke all on function public.partner_overview() from public, anon;
revoke all on function public.partner_offer_detail(bigint) from public, anon;
revoke all on function public.admin_publish_request(bigint, bigint) from public, anon;
revoke all on function public.admin_reject_request(bigint, text) from public, anon;
grant execute on function public.partner_overview() to authenticated;
grant execute on function public.partner_offer_detail(bigint) to authenticated;
grant execute on function public.admin_publish_request(bigint, bigint) to authenticated;
grant execute on function public.admin_reject_request(bigint, text) to authenticated;

-- ===================== 6) لوغوهات طلبات الشركات =====================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('partner-logos', 'partner-logos', true, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = 1048576, allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];

-- bucket عمومي: الصور تُقرأ برابطها العام بلا سياسة SELECT (فما كاينش سرد لكل الدواسي).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'partner logos owner select') then
    create policy "partner logos owner select" on storage.objects for select to authenticated
      using (bucket_id = 'partner-logos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'partner logos owner insert') then
    create policy "partner logos owner insert" on storage.objects for insert to authenticated
      with check (bucket_id = 'partner-logos' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'partner logos owner update') then
    create policy "partner logos owner update" on storage.objects for update to authenticated
      using (bucket_id = 'partner-logos' and (storage.foldername(name))[1] = auth.uid()::text)
      with check (bucket_id = 'partner-logos' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'partner logos owner or admin delete') then
    create policy "partner logos owner or admin delete" on storage.objects for delete to authenticated
      using (bucket_id = 'partner-logos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
  end if;
end $$;

notify pgrst, 'reload schema';
