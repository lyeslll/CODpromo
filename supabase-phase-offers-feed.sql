-- ============================================================
--  CODpromo — phase "offers-feed": ملف العروض العام لـ ilyesderradji.com (schema codpromo.offers.v1)
--
--  https://codpromo.com/feeds/offers.v1.json (api/offers-feed.js) = العروض العادية برك تاع الشركات
--  الظاهرة، و https://codpromo.com/go/<id>?src=ilyesderradji (api/go.js) = تحويل يحسب النقرة ومن بعد
--  يدّي لرابط الإحالة. العقد: docs/codpromo-feed.md تاع مشروع ilyesderradji.com.
--
--  1) companies: ilyes_slug (المعرّف في دليل ilyesderradji.com، اختياري؛ فارغ = slug تاع CODpromo) و
--     ilyes_visible (يظهر في ilyesderradji.com، افتراضياً true). علنيين (phase28: grant select عمود بعمود).
--     ilyes_slug يتعمّر للشركات الموجودة من ملف الأمثلة تاع الدليل (codpromo-sample.json، 24 شركة).
--  2) القاعدة الوحيدة (الملف + التحويل + النقرة):
--     offers_feed_ok = الشركة ظاهرة (company_is_public) + ilyes_visible + كود عادي [A-Za-z0-9_-]{1,32}
--     + رابط https. بطاقات "قريباً" (phase coming-soon) مستثنية صراحة (not coming_soon في الدوال الثلاثة)،
--     وزيد على هذا ما عندهمش كود (CHECK companies_soon_no_codes). يتشغّل بعد phase-coming-soon.
--     offers_feed_id = "<slug>--<id>": فيه "--" → ما يتصادمش أبداً مع /go/<slug> تاع العروض بلا كود
--     (CHECK nocode_deals_slug_chk ما يقبلش "--")، و vercel.json يبعث هاد الشكل برك لـ api/go.js.
--  3) offers_feed_v1() و offers_feed_target(id): SECURITY INVOKER — تتنادى بالمفتاح العام: RLS تخبّي
--     المخفية، وأعمدة Premium ممنوعة على anon (phase28) → حتى خطأ في الكود ما يخرّجش كود Premium.
--  4) feed_clicks + offers_feed_click(id, src): النقرة تتسجّل من متصفّح الزائر (cf-connecting-ip تاع
--     Cloudflare، نفس بصمة deal_clicks): زائر واحد = نقرة وحدة في اليوم لكل عرض ولكل مصدر. src من قائمة
--     ثابتة (ilyesderradji | other). GET مرفوض، Origin = codpromo.com برك (صفحة /go/)، 5000 نقرة في اليوم
--     لكل عرض كحدّ.
--  5) partner_feed_clicks() (لوحة الشريك: شركاتو برك) و admin_feed_clicks(company) (الأدمين).
--
--  حوايج جداد برك: عمودين + جدول + دوال جداد (حتى دالة قديمة ما تبدّلت). بلا DROP / DELETE / TRUNCATE.
--  idempotent. الرجوع: supabase-phase-offers-feed-rollback.sql
-- ============================================================

-- ===================== 1) companies: المعرّف في الدليل + الظهور =====================
alter table public.companies add column if not exists ilyes_slug text;
alter table public.companies add column if not exists ilyes_visible boolean not null default true;

do $$
begin
  -- نفس قاعدة brand_slug في العقد
  if not exists (select 1 from pg_constraint where conrelid = 'public.companies'::regclass and conname = 'companies_ilyes_slug_chk') then
    alter table public.companies add constraint companies_ilyes_slug_chk
      check (ilyes_slug is null or ilyes_slug ~ '^[a-z0-9-]{1,64}$');
  end if;
end $$;

-- phase28: القراءة العامة عمود بعمود (الكتابة: الأدمين برك، RLS "companies admin update")
grant select (ilyes_slug, ilyes_visible) on public.companies to anon, authenticated;

-- المعرّفات من ملف الأمثلة تاع الدليل (codpromo-sample.json، 2026-10-24). الشركات اللي ماهيش فيه
-- (redotpay-virtual، redotpay-physical، flow-bazar-sphere، sawa9ly) تبقى فارغة = الـ slug تاع CODpromo.
update public.companies c
   set ilyes_slug = v.dir
  from (values
    ('ayor', 'ayor'), ('redotpay', 'redotpay'), ('minea', 'minea'), ('bybit', 'bybit-card'),
    ('voice213', 'voice213'), ('overview', 'overview'), ('shipper', 'shipper'), ('swift-express', 'swift-express'),
    ('lightfunnels', 'lightfunnels'), ('bigspy', 'bigspy'), ('visualgpt', 'visualgpt'), ('order', 'orderdz'),
    ('spybox', 'spybox'), ('trackili', 'trackili'), ('esolution', 'esolution'), ('suivisms', 'suivisms'),
    ('fahim', 'fahim'), ('dzbuild', 'dzbuild'), ('okwin', 'okwin'), ('tassyir', 'tassyir'),
    ('takka-store', 'takka-store'), ('just-sell', 'justsell'), ('colivraison-express', 'colivraison-express'),
    ('unifunl', 'unifunl')
  ) as v (slug, dir)
 where c.slug = v.slug
   and c.ilyes_slug is null;

-- ===================== 2) القاعدة الوحيدة =====================
-- immutable وبلا SET (تتدمج inline)، ما تقرا حتى جدول.
create or replace function public.offers_feed_id(p_slug text, p_id bigint)
returns text
language sql
immutable
parallel safe
as $$
  select rtrim(left(case when coalesce(p_slug, '') ~ '^[a-z0-9]+(-[a-z0-9]+)*$' then p_slug else 'offer' end, 44), '-')
         || '--' || p_id::text;
$$;

comment on function public.offers_feed_id(text, bigint) is
  'CODpromo: معرّف العرض في ملف ilyesderradji.com = <slug>--<id> (≤ 64، فيه "--" → ماشي slug عرض بلا كود). نفس المعرّف في /go/<id>.';

create or replace function public.offers_feed_ok(p_status text, p_visible boolean, p_code text, p_link text)
returns boolean
language sql
immutable
parallel safe
as $$
  select public.company_is_public(p_status)
     and coalesce(p_visible, true)
     and coalesce(p_code, '') ~ '^[A-Za-z0-9_-]{1,32}$'
     and coalesce(p_link, '') ~ '^https://[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}(:[0-9]{1,5})?([/?#][^[:space:]<>"\\]*)?$';
$$;

comment on function public.offers_feed_ok(text, boolean, text, text) is
  'CODpromo: العرض يدخل لملف ilyesderradji.com (ويخدم تحويلو /go/<id>) غير إذا: الشركة ظاهرة، ilyes_visible، كود عادي صالح، رابط https. المصدر الوحيد لهاد القاعدة.';

grant execute on function public.offers_feed_id(text, bigint) to anon, authenticated, service_role;
grant execute on function public.offers_feed_ok(text, boolean, text, text) to anon, authenticated, service_role;

-- ===================== 3) القراءة (المفتاح العام) =====================
-- الملف: الأعمدة الآمنة برك (Premium = has_premium نعم/لا، بلا كود ولا رابط ولا قيمة). الأحدث أولاً، 500 كأقصى.
create or replace function public.offers_feed_v1()
returns table (
  feed_id text, brand_slug text, slug text, name text, type text, discount text, code text,
  logo text, code_checked_at timestamptz, has_premium boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  select public.offers_feed_id(c.slug, c.id),
         coalesce(c.ilyes_slug,
                  case when c.slug ~ '^[a-z0-9-]{1,64}$' then c.slug end,
                  public.offers_feed_id(c.slug, c.id)),
         c.slug, c.name, c.type, c.discount, btrim(c.code), c.logo, c.code_checked_at,
         coalesce(c.has_premium_code, false) and c.supports_premium is distinct from false
    from public.companies c
   where public.offers_feed_ok(c.status, c.ilyes_visible, btrim(c.code), c.link)
     and not c.coming_soon
   order by c.created_at desc nulls last, c.id desc
   limit 500;
$$;

-- التحويل /go/<id>: نفس القاعدة، والوجهة من القاعدة برك (رابط الإحالة العادي). id غالط / مخفي / "قريباً" = والو.
create or replace function public.offers_feed_target(p_id text)
returns table (name text, url text)
language sql
stable
security invoker
set search_path = public
as $$
  select c.name, c.link
    from public.companies c
   where c.id = case when coalesce(p_id, '') ~ '^[a-z0-9]+(-[a-z0-9]+)*--[0-9]{1,18}$'
                     then (substring(p_id from '--([0-9]{1,18})$'))::bigint end
     and public.offers_feed_id(c.slug, c.id) = p_id
     and public.offers_feed_ok(c.status, c.ilyes_visible, btrim(c.code), c.link)
     and not c.coming_soon;
$$;

revoke all on function public.offers_feed_v1() from public;
revoke all on function public.offers_feed_target(text) from public;
grant execute on function public.offers_feed_v1() to anon, authenticated, service_role;
grant execute on function public.offers_feed_target(text) to anon, authenticated, service_role;

-- ===================== 4) النقرات =====================
create table if not exists public.feed_clicks (
  id         bigint generated always as identity primary key,
  company_id bigint not null references public.companies (id) on delete cascade,
  source     text not null,
  visitor    text not null,
  day        date not null,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.feed_clicks'::regclass and conname = 'feed_clicks_source_chk') then
    alter table public.feed_clicks add constraint feed_clicks_source_chk check (source in ('ilyesderradji', 'other'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.feed_clicks'::regclass and conname = 'feed_clicks_once_per_day') then
    alter table public.feed_clicks add constraint feed_clicks_once_per_day unique (company_id, source, visitor, day);
  end if;
end $$;

create index if not exists feed_clicks_company_day on public.feed_clicks (company_id, day);

-- لا قراءة ولا كتابة مباشرة: التسجيل عبر offers_feed_click والأرقام عبر partner_feed_clicks / admin_feed_clicks
alter table public.feed_clicks enable row level security;
revoke all on public.feed_clicks from anon, authenticated;

--  {counted: true} = نقرة جديدة اليوم لهاد الزائر. id ماشي في الملف / Origin ماشي codpromo.com / بلا IP /
--  الحدّ → {counted: false}.
create or replace function public.offers_feed_click(p_id text, p_src text default null)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  tz constant text := 'Africa/Algiers';
  v_day     date := (now() at time zone tz)::date;
  v_src     text := case when p_src = 'ilyesderradji' then 'ilyesderradji' else 'other' end;
  v_company bigint;
  v_hdr     json;
  v_ip      text;
  v_pepper  text;
  v_n       integer;
begin
  -- GET (معاملة قراءة برك في PostgREST) مرفوض: الكتابة POST برك
  if current_setting('transaction_read_only', true) = 'on' then
    raise exception 'read_only' using errcode = '25006';
  end if;
  if coalesce(p_id, '') !~ '^[a-z0-9]+(-[a-z0-9]+)*--[0-9]{1,18}$' then
    return json_build_object('counted', false);
  end if;

  -- SECURITY DEFINER: RLS ما تخدمش هنا → offers_feed_ok يفحص company_is_public بيدّو
  select c.id into v_company
    from public.companies c
   where c.id = (substring(p_id from '--([0-9]{1,18})$'))::bigint
     and public.offers_feed_id(c.slug, c.id) = p_id
     and public.offers_feed_ok(c.status, c.ilyes_visible, btrim(c.code), c.link)
     and not c.coming_soon;
  if v_company is null then
    return json_build_object('counted', false);
  end if;

  begin
    v_hdr := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    v_hdr := null;
  end;
  -- النقرة تتحسب غير من صفحة /go/ تاعنا (المتصفّح يبعث Origin = codpromo.com): موقع آخر ما يقدرش
  -- يخلّي متصفّحات زوارو يبعثو نقرات مزوّرة (المراجعة المستقلة). client بلا متصفّح يقدر يزوّر Origin،
  -- بصح يبقى محدود بنقرة وحدة لكل IP في اليوم.
  if lower(coalesce(v_hdr ->> 'origin', '')) not in ('https://codpromo.com', 'https://www.codpromo.com') then
    return json_build_object('counted', false);
  end if;

  -- الزائر بعنوان IP كما يراه Cloudflare (cf-connecting-ip، ما يتزوّرش) — نفس nocode_go
  v_ip := nullif(btrim(v_hdr ->> 'cf-connecting-ip'), '');
  if v_ip is null then
    v_ip := nullif(btrim(regexp_replace(coalesce(v_hdr ->> 'x-forwarded-for', ''), '^.*,', '')), '');
  end if;
  -- IPv6: جهاز واحد يملك شبكة /64 كاملة → زائر واحد
  begin
    if v_ip is not null and family(v_ip::inet) = 6 then
      v_ip := host(network(set_masklen(v_ip::inet, 64)));
    end if;
  exception when others then
    v_ip := null;
  end;
  if v_ip is null then
    return json_build_object('counted', false);
  end if;

  -- حدّ في اليوم لكل عرض (يحمي الجدول من الإغراق)
  if (select count(*) from public.feed_clicks f where f.company_id = v_company and f.day = v_day) >= 5000 then
    return json_build_object('counted', false);
  end if;

  select s.value into v_pepper from private.app_secrets s where s.key = 'deal_click_pepper';
  insert into public.feed_clicks (company_id, source, visitor, day)
  values (v_company, v_src,
          encode(sha256(convert_to(coalesce(v_pepper, '') || '|feed|' || v_day::text || '|ip:' || v_ip, 'UTF8')), 'hex'),
          v_day)
  on conflict on constraint feed_clicks_once_per_day do nothing;
  get diagnostics v_n = row_count;
  return json_build_object('counted', v_n > 0);
end;
$$;

revoke all on function public.offers_feed_click(text, text) from public;
grant execute on function public.offers_feed_click(text, text) to anon, authenticated;

-- ===================== 5) الأرقام =====================
-- لوحة الشريك: النقرات اللي جات من ilyesderradji.com على شركاتو برك (company_owners).
create or replace function public.partner_feed_clicks()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  tz constant text := 'Africa/Algiers';
  v_uid   uuid := auth.uid();
  v_today date := (now() at time zone tz)::date;
begin
  if v_uid is null then
    raise exception 'auth required' using errcode = '42501';
  end if;
  return coalesce((
    select json_agg(json_build_object(
             'company_id', o.company_id,
             'total', (select count(*) from public.feed_clicks f
                        where f.company_id = o.company_id and f.source = 'ilyesderradji'),
             'd30', (select count(*) from public.feed_clicks f
                      where f.company_id = o.company_id and f.source = 'ilyesderradji' and f.day > v_today - 30)
           ) order by o.company_id)
      from public.company_owners o
     where o.user_id = v_uid
  ), '[]'::json);
end;
$$;

-- الأدمين: لكل شركة (ولا شركة وحدة) — ilyesderradji.com في 7 / 30 يوم / الكل، والمصادر الأخرى.
create or replace function public.admin_feed_clicks(p_company bigint default null)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  tz constant text := 'Africa/Algiers';
  v_today date := (now() at time zone tz)::date;
begin
  perform public.admin_assert();
  return coalesce((
    select json_agg(json_build_object(
             'company_id', x.company_id, 'd7', x.d7, 'd30', x.d30, 'total', x.total, 'other', x.other
           ) order by x.total desc, x.company_id)
      from (
        select f.company_id,
               count(*) filter (where f.source = 'ilyesderradji' and f.day > v_today - 7) as d7,
               count(*) filter (where f.source = 'ilyesderradji' and f.day > v_today - 30) as d30,
               count(*) filter (where f.source = 'ilyesderradji') as total,
               count(*) filter (where f.source <> 'ilyesderradji') as other
          from public.feed_clicks f
         where p_company is null or f.company_id = p_company
         group by f.company_id
      ) x
  ), '[]'::json);
end;
$$;

revoke all on function public.partner_feed_clicks() from public, anon;
revoke all on function public.admin_feed_clicks(bigint) from public, anon;
grant execute on function public.partner_feed_clicks() to authenticated;
grant execute on function public.admin_feed_clicks(bigint) to authenticated;

notify pgrst, 'reload schema';
