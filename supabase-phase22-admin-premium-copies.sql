-- ============================================================
--  CODpromo — Phase 22: Premium دائم للأدمن + سجلّ الأكواد المنسوخة
--  شغّله مرة واحدة: npx supabase db query --linked -f supabase-phase22-admin-premium-copies.sql
--  آمن لإعادة التشغيل (idempotent).
--
--  يضيف:
--   1) has_premium_access(uid): القاعدة الواحدة "من يرى Premium؟" =
--      اشتراك Premium ساري، أو حساب is_admin (Premium مدى الحياة).
--      لا نكتب أي اشتراك في profiles، ولا نلمس trigger protect_premium_columns.
--   2) get_premium_code يستعمل القاعدة نفسها (نفس السلوك الحالي، بلا توسيع لغير الأدمن).
--   3) جدول code_copies: كل نسخة كود من مستخدم مسجّل (للداشبورد: "آخر الأكواد اللي نسختها").
--      RLS: كل مستخدم يقرأ ويُدرج سطوره فقط. لا يُخزَّن نص الكود (أكواد Premium تبقى خادمية).
-- ============================================================

-- ===================== 1) القاعدة: Premium ساري أو أدمن =====================
create or replace function public.has_premium_access(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = uid
      and (
        (p.is_premium = true and (p.premium_until is null or p.premium_until > now()))
        or p.is_admin = true
      )
  );
$$;

-- لا تُستدعى إلا داخل دوال الخادم (لا كشف لحالة حساب آخر من المتصفّح)
revoke all on function public.has_premium_access(uuid) from public, anon, authenticated;

-- ===================== 2) كشف كود Premium (خادمياً) =====================
create or replace function public.get_premium_code(company_id bigint)
returns table (premium_code text, premium_url text)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- غير مسجّل الدخول، أو بلا Premium ساري وليس أدمن → لا شيء
  if auth.uid() is null or not public.has_premium_access(auth.uid()) then
    return;
  end if;

  return query
    select c.premium_code, c.premium_url
    from public.companies c
    where c.id = get_premium_code.company_id;
end;
$$;

grant execute on function public.get_premium_code(bigint) to authenticated;

-- ===================== 3) سجلّ الأكواد المنسوخة =====================
create table if not exists public.code_copies (
  id          bigint generated always as identity primary key,
  user_id     uuid   not null default auth.uid() references auth.users (id) on delete cascade,
  company_id  bigint not null references public.companies (id) on delete cascade,
  -- هل كان المنسوخ كود Premium؟ (نعرض في الداشبورد نفس نوع الكود، بلا تخزين نصّه)
  premium     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists code_copies_user_created_idx on public.code_copies (user_id, created_at desc);

alter table public.code_copies enable row level security;

drop policy if exists "copies own select" on public.code_copies;
drop policy if exists "copies own insert" on public.code_copies;

create policy "copies own select" on public.code_copies
  for select to authenticated using (user_id = auth.uid());
create policy "copies own insert" on public.code_copies
  for insert to authenticated with check (user_id = auth.uid());
-- لا update/delete: السجلّ للإضافة فقط.

grant select, insert on public.code_copies to authenticated;
