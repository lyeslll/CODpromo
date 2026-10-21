-- ============================================================
--  CODpromo — Phase 21: أرقام الصفحة الرئيسية (site_stats) — يعدّلها الأدمن
--  شغّله مرة واحدة في Supabase → SQL Editor → الصق ثم Run.
--  آمن لإعادة التشغيل (idempotent).
--
--  يضيف:
--   1) جدول site_stats (سطر واحد فقط: id = 1) فيه أربعة أرقام يعدّلها الأدمن:
--      total_savings_dzd ........ إجمالي قيمة الخصومات بالدينار
--      total_codes .............. عدد الأكواد
--      partners_count ........... عدد الشركاء
--      premium_unlock_value_usd . قيمة الخصومات التي يفتحها Premium بالدولار
--   2) RLS: القراءة للجميع، والتعديل للأدمن فقط (public.is_admin() من phase15).
--      لا insert ولا delete من المتصفح — السطر موجود دائماً.
--   3) دالة site_stats_auto(): عدّ دقيق (count) على الخادم لعدد الأكواد
--      (العادية + Premium) وعدد الشركاء — بلا كشف أي كود.
--   4) view site_stats_public: نفس الأرقام، وكل خانة فارغة (NULL) تُعوَّض
--      تلقائياً بالعدّ من قاعدة البيانات. القيمتان الماليتان لا تُحسبان
--      تلقائياً: إن بقيتا فارغتين تُرجَعان NULL وتُخفيهما الواجهة.
-- ============================================================

-- ===================== 1) الجدول (سطر واحد) =====================
create table if not exists public.site_stats (
  id                        smallint primary key default 1 check (id = 1),
  total_savings_dzd         numeric(16, 0) check (total_savings_dzd >= 0),
  total_codes               integer check (total_codes >= 0),
  partners_count            integer check (partners_count >= 0),
  premium_unlock_value_usd  numeric(12, 2) check (premium_unlock_value_usd >= 0),
  updated_at                timestamptz not null default now()
);

insert into public.site_stats (id) values (1) on conflict (id) do nothing;

-- updated_at يتحدّث تلقائياً عند كل تعديل
create or replace function public.touch_site_stats()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists site_stats_touch on public.site_stats;
create trigger site_stats_touch
  before update on public.site_stats
  for each row execute function public.touch_site_stats();

-- ===================== 2) RLS + الصلاحيات =====================
alter table public.site_stats enable row level security;

drop policy if exists "site_stats public read" on public.site_stats;
drop policy if exists "site_stats admin update" on public.site_stats;

create policy "site_stats public read"
  on public.site_stats for select
  using (true);
create policy "site_stats admin update"
  on public.site_stats for update
  using (public.is_admin())
  with check (public.is_admin());

-- الأدوار العامة: قراءة فقط، والمسجّل يعدّل الأعمدة الأربعة فقط (والسياسة تحصرها بالأدمن).
revoke all on public.site_stats from anon, authenticated;
grant select on public.site_stats to anon, authenticated;
grant update (total_savings_dzd, total_codes, partners_count, premium_unlock_value_usd)
  on public.site_stats to authenticated;

-- ===================== 3) العدّ التلقائي (خادمي) =====================
-- security definer: يعدّ أكواد Premium دون أن يكشفها (يُرجع أرقاماً فقط).
create or replace function public.site_stats_auto()
returns table (codes integer, partners integer)
language sql
security definer
stable
set search_path = public
as $$
  select
    (
      (select count(*) from public.companies c
         where c.code is not null and btrim(c.code) <> '')
      +
      (select count(*) from public.companies c
         where coalesce(c.supports_premium, true)
           and c.premium_code is not null and btrim(c.premium_code) <> '')
    )::integer,
    (select count(*) from public.companies)::integer;
$$;

revoke all on function public.site_stats_auto() from public;
grant execute on function public.site_stats_auto() to anon, authenticated;

-- ===================== 4) view القراءة العامة =====================
create or replace view public.site_stats_public
with (security_invoker = true) as
select
  s.total_savings_dzd,
  coalesce(s.total_codes, a.codes)       as total_codes,
  coalesce(s.partners_count, a.partners) as partners_count,
  s.premium_unlock_value_usd,
  a.codes                                as total_codes_auto,
  a.partners                             as partners_count_auto,
  s.updated_at
from public.site_stats s
cross join public.site_stats_auto() a
where s.id = 1;

grant select on public.site_stats_public to anon, authenticated;

-- ===================== 5) تحديث مخزّن مخطّط PostgREST =====================
notify pgrst, 'reload schema';
