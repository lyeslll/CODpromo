-- ============================================================
--  CODpromo — phase "coming-soon": بطاقات "العرض قريباً" + "أعلمني عند التفعيل"
--
--  الفكرة: شركة عطاتنا اللوغو والوصف ورابط الإحالة (يخدم من دروك)، بصح العرض مازال. البطاقة تبان
--  كيما الباقي، وفي بلاصة القيمة والكود "قريباً، ترقّبوا". كي يكتب الأدمين العرض ويطفي "قريباً"، البطاقة
--  تولّي عادية وحدها، واللي ضغطو "أعلمني" يوصلهم إشعار (الجرس + الهاتف) — مرة وحدة لكل شخص لكل بطاقة.
--
--  1) companies: coming_soon و premium_coming_soon (علنيين)، coming_soon_since (للأدمين برك، عبر RPC).
--     قاعدتين (CHECK): Premium قريباً = البطاقة قريباً، والبطاقة قريباً = بلا حتى كود (عادي ولا Premium)
--     وبلا رابط Premium → has_premium_code = false → المفتاح الذهبي والماسي والبيع وعدّاد "يمكنك فتح X"
--     ما يشوفوهاش (بلا حتى تبديل في دوال المفاتيح ولا Premium ولا الدفع). trigger قبل الحفظ: coming_soon_since.
--  2) coming_soon_waits: شكون ضغط "أعلمني" (RLS بلا سياسات + بلا صلاحيات للعميل). الكتابة غير عبر
--     coming_soon_wait() (صاحب الحساب، POST). العدّاد رقم برك: بريد حقيقي = شخص واحد، وتحت 3 = ما يبانش.
--  3) العدّادات: site_stats_auto و admin_overview ما يحسبوش القريبة مع العروض اللي تخدم.
--  4) الإشعارات: notify_on_company ما يدير والو للبطاقة القريبة؛ لحظة التفعيل (قريباً ← عرض) = إشعار واحد
--     للكل (نفس "شركة جديدة")، واللي يستناو يشوفوه "العرض الذي كنت تنتظره" (notifications_feed و
--     push_batch_targets يرجّعو waited، حتى إذا تفضيلاتهم ما تطابقش).
--
--  حوايج جداد + create or replace لـ 5 دوال موجودة بنفس التوقيع (site_stats_auto، admin_overview،
--  notify_on_company، notifications_feed، push_batch_targets). idempotent، بلا DROP / DELETE / TRUNCATE.
--  يتشغّل بعد phase-notifications. الرجوع: supabase-phase-coming-soon-rollback.sql
-- ============================================================

-- ===================== 1) companies: الأعمدة + القواعد =====================
alter table public.companies add column if not exists coming_soon boolean not null default false;
alter table public.companies add column if not exists premium_coming_soon boolean not null default false;
alter table public.companies add column if not exists coming_soon_since timestamptz;

-- phase28: القراءة العامة عمود بعمود. coming_soon_since ماشي علني (الأدمين يقراه عبر admin_coming_soon).
grant select (coming_soon, premium_coming_soon) on public.companies to anon, authenticated;

do $$
begin
  -- Premium "قريباً" غير في بطاقة "قريباً"
  if not exists (select 1 from pg_constraint where conrelid = 'public.companies'::regclass and conname = 'companies_premium_soon_needs_soon') then
    alter table public.companies add constraint companies_premium_soon_needs_soon
      check (not premium_coming_soon or coming_soon);
  end if;
  -- بطاقة "قريباً" = بلا كود عادي، بلا كود Premium، بلا رابط Premium (ما كاين والو يتكشف ولا يتباع)
  if not exists (select 1 from pg_constraint where conrelid = 'public.companies'::regclass and conname = 'companies_soon_no_codes') then
    alter table public.companies add constraint companies_soon_no_codes
      check (not coming_soon or (coalesce(btrim(code), '') = '' and coalesce(btrim(premium_code), '') = '' and coalesce(btrim(premium_url), '') = ''));
  end if;
end $$;

-- قبل الحفظ: تاريخ "قريباً من" (تنبيه 30 يوم في الأدمين)؛ البطاقة كي تولّي عرض، Premium القريب يروح معاها
create or replace function public.coming_soon_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(new.coming_soon, false) then
    if tg_op = 'INSERT' or not coalesce(old.coming_soon, false) or new.coming_soon_since is null then
      new.coming_soon_since := now();
    end if;
  else
    new.premium_coming_soon := false;
    new.coming_soon_since := null;
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'coming_soon_guard' and tgrelid = 'public.companies'::regclass) then
    create trigger coming_soon_guard
      before insert or update of coming_soon, premium_coming_soon on public.companies
      for each row execute function public.coming_soon_guard();
  end if;
end $$;

-- ===================== 2) "أعلمني عند التفعيل" =====================
--  سطر لكل (بطاقة، حساب). الإلغاء = active false (السطر يبقى: نفس الشخص ما يتحسبش مرّتين وما يوصلوش
--  جوج إشعارات). inbox = بصمة البريد (free_key_email_hash: sha256 بمفتاح سرّي، بلا البريد بالنص) — العدّاد
--  يحسب كل بريد حقيقي مرة وحدة. notified_at + notification_id = وصلو الإشعار (مرة وحدة في الحياة لهاد البطاقة).
create table if not exists public.coming_soon_waits (
  company_id      bigint not null references public.companies (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  inbox           text,
  active          boolean not null default true,
  toggles         integer not null default 1,
  toggles_day     date not null default current_date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  notified_at     timestamptz,
  notification_id bigint references public.notifications (id) on delete set null,
  primary key (company_id, user_id)
);
create index if not exists coming_soon_waits_user on public.coming_soon_waits (user_id, created_at desc);
create index if not exists coming_soon_waits_open on public.coming_soon_waits (company_id) where active and notified_at is null;
create index if not exists coming_soon_waits_notification on public.coming_soon_waits (notification_id) where notification_id is not null;

alter table public.coming_soon_waits enable row level security;
revoke all on public.coming_soon_waits from anon, authenticated;

-- العدّاد العلني: بريد حقيقي = شخص واحد، تحت 3 = null (الواجهة تكتب "كن من الأوائل")
create or replace function public.coming_soon_count(p_company bigint)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case when x.n >= 3 then x.n end
    from (select count(distinct w.inbox)::int as n
            from public.coming_soon_waits w
           where w.company_id = p_company and w.active and w.notified_at is null and w.inbox is not null) x;
$$;

--  p_on = true: "أعلمني"، false: إلغاء. status: ok | auth | unconfirmed | disposable | owner | unavailable
--  | notified (وصلو الإشعار تاع هاد البطاقة من قبل) | rate_limited. يرجّع waiting (حالة صاحب الحساب) + count.
create or replace function public.coming_soon_wait(p_company bigint, p_on boolean default true)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_on     boolean := coalesce(p_on, true);
  v_has    boolean;
  v_google boolean;
  u        auth.users%rowtype;
  w        public.coming_soon_waits%rowtype;
begin
  -- GET (معاملة قراءة برك في PostgREST) مرفوض: الكتابة POST برك
  if current_setting('transaction_read_only', true) = 'on' then
    raise exception 'read_only' using errcode = '25006';
  end if;
  if v_uid is null then
    return json_build_object('status', 'auth');
  end if;
  -- ضغطات نفس الحساب وحدة بوحدة
  perform pg_advisory_xact_lock(hashtextextended('coming_soon:' || v_uid::text, 0));

  select * into w from public.coming_soon_waits x where x.company_id = p_company and x.user_id = v_uid for update;
  v_has := found;

  -- الإلغاء: سطر صاحب الحساب برك (حتى بلا شروط أخرى)
  if not v_on then
    if v_has and w.active and w.notified_at is null then
      if w.toggles_day = current_date and w.toggles >= 20 then
        return json_build_object('status', 'rate_limited', 'waiting', true, 'count', public.coming_soon_count(p_company));
      end if;
      update public.coming_soon_waits
         set active = false, updated_at = now(),
             toggles = case when toggles_day = current_date then toggles + 1 else 1 end, toggles_day = current_date
       where company_id = p_company and user_id = v_uid;
    end if;
    return json_build_object('status', 'ok', 'waiting', false, 'count', public.coming_soon_count(p_company));
  end if;

  if v_has and w.notified_at is not null then
    return json_build_object('status', 'notified', 'waiting', false, 'count', public.coming_soon_count(p_company));
  end if;
  if v_has and w.active then
    return json_build_object('status', 'ok', 'waiting', true, 'count', public.coming_soon_count(p_company));
  end if;

  -- البطاقة: "قريباً" وظاهرة في الموقع
  if not exists (select 1 from public.companies c
                  where c.id = p_company and coalesce(c.coming_soon, false) and public.company_is_public(c.status)) then
    return json_build_object('status', 'unavailable');
  end if;

  -- حساب حقيقي: ماشي مجهول ولا موقوف، بريد مؤكَّد (ولا Google)، ماشي بريد مؤقت / تحويل، ماشي صاحب الشركة
  select * into u from auth.users au where au.id = v_uid;
  if not found or coalesce(u.is_anonymous, false) or (u.banned_until is not null and u.banned_until > now()) then
    return json_build_object('status', 'auth');
  end if;
  v_google := coalesce(u.raw_app_meta_data -> 'providers', '[]'::jsonb) ? 'google'
              or coalesce(u.raw_app_meta_data ->> 'provider', '') = 'google';
  if u.email is null or btrim(u.email) = '' or (u.email_confirmed_at is null and not coalesce(v_google, false)) then
    return json_build_object('status', 'unconfirmed');
  end if;
  if public.free_key_disposable(u.email) then
    return json_build_object('status', 'disposable');
  end if;
  if exists (select 1 from public.company_owners o where o.company_id = p_company and o.user_id = v_uid) then
    return json_build_object('status', 'owner');
  end if;

  if v_has then
    -- رجوع بعد إلغاء: 20 تبديل في اليوم لكل بطاقة كأقصى (الـ spam ما يكبّرش العدّاد، يكتب برك)
    if w.toggles_day = current_date and w.toggles >= 20 then
      return json_build_object('status', 'rate_limited', 'waiting', false, 'count', public.coming_soon_count(p_company));
    end if;
    update public.coming_soon_waits
       set active = true, inbox = public.free_key_email_hash(u.email), updated_at = now(),
           toggles = case when toggles_day = current_date then toggles + 1 else 1 end, toggles_day = current_date
     where company_id = p_company and user_id = v_uid;
  else
    -- 30 بطاقة جديدة في الساعة لكل حساب كأقصى
    if (select count(*) from public.coming_soon_waits x where x.user_id = v_uid and x.created_at > now() - interval '1 hour') >= 30 then
      return json_build_object('status', 'rate_limited', 'waiting', false, 'count', public.coming_soon_count(p_company));
    end if;
    insert into public.coming_soon_waits (company_id, user_id, inbox)
    values (p_company, v_uid, public.free_key_email_hash(u.email));
  end if;
  return json_build_object('status', 'ok', 'waiting', true, 'count', public.coming_soon_count(p_company));
end;
$$;

-- البطاقات اللي يستنى فيها صاحب الحساب (والوصلو إشعارها) — أرقام برك، تاعو هو برك
create or replace function public.my_coming_soon_waits()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'waiting', coalesce((select json_agg(w.company_id order by w.company_id) from public.coming_soon_waits w
                          where w.user_id = auth.uid() and w.active and w.notified_at is null), '[]'::json),
    'notified', coalesce((select json_agg(w.company_id order by w.company_id) from public.coming_soon_waits w
                           where w.user_id = auth.uid() and w.notified_at is not null), '[]'::json)
  );
$$;

-- للجميع (GET مقبول): عدد البطاقات القريبة الظاهرة + العدّاد لكل وحدة (null تحت 3). حتى اسم ولا حساب.
create or replace function public.coming_soon_board()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'total', (select count(*) from public.companies c where coalesce(c.coming_soon, false) and public.company_is_public(c.status)),
    'items', coalesce((select json_agg(json_build_object('id', c.id, 'waiting', public.coming_soon_count(c.id)) order by c.id)
                         from public.companies c
                        where coalesce(c.coming_soon, false) and public.company_is_public(c.status)), '[]'::json)
  );
$$;

-- الأدمين: كل البطاقات القريبة (حتى المخفية) + عدد اللي يستناو (بريد حقيقي) + الحسابات + الجداد
-- (حساب تزاد في نفس اليوم اللي ضغط فيه = إشارة لحسابات وهمية) + الأيام. بلا حتى اسم ولا بريد.
create or replace function public.admin_coming_soon()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.admin_assert();
  return coalesce((
    select json_agg(json_build_object(
             'id', c.id, 'name', c.name, 'slug', c.slug, 'logo', c.logo, 'logo_bg', c.logo_bg, 'status', c.status,
             'category_id', c.category_id, 'premium_coming_soon', c.premium_coming_soon, 'link', c.link,
             'created_at', c.created_at, 'since', coalesce(c.coming_soon_since, c.created_at),
             'days', floor(extract(epoch from (now() - coalesce(c.coming_soon_since, c.created_at))) / 86400)::int,
             'waiting', (select count(distinct w.inbox) from public.coming_soon_waits w
                          where w.company_id = c.id and w.active and w.notified_at is null and w.inbox is not null),
             'accounts', (select count(*) from public.coming_soon_waits w
                           where w.company_id = c.id and w.active and w.notified_at is null),
             'new_accounts', (select count(*) from public.coming_soon_waits w join auth.users au on au.id = w.user_id
                               where w.company_id = c.id and w.active and w.notified_at is null
                                 and w.created_at < au.created_at + interval '1 day')
           ) order by coalesce(c.coming_soon_since, c.created_at), c.id)
      from public.companies c
     where coalesce(c.coming_soon, false)), '[]'::json);
end;
$$;

-- ===================== 3) العدّادات: القريبة وحدها =====================
-- نفس الدالة (phase-visible-counts) + "ماشي قريباً": الرئيسية، /partners، شارة العروض في الهيدر، AuthShell
create or replace function public.site_stats_auto()
returns table(codes integer, partners integer)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    (
      (select count(*) from public.companies c
         where public.company_is_public(c.status) and not coalesce(c.coming_soon, false)
           and c.code is not null and btrim(c.code) <> '')
      +
      (select count(*) from public.companies c
         where public.company_is_public(c.status) and not coalesce(c.coming_soon, false)
           and coalesce(c.supports_premium, true)
           and c.premium_code is not null and btrim(c.premium_code) <> '')
    )::integer,
    (select count(*) from public.companies c
      where public.company_is_public(c.status) and not coalesce(c.coming_soon, false))::integer;
$function$;

-- نفس الدالة + "companies_soon" وحدها (الشركات والعروض = الظاهرة اللي تخدم برك)
create or replace function public.admin_overview(p_range text default '7d'::text)
returns json
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  tz       constant text := 'Africa/Algiers';
  v_since  timestamptz := public.admin_range_start(p_range);
  v_today  timestamptz := public.admin_range_start('today');
  v_7d     timestamptz := public.admin_range_start('7d');
  v_unit   text;
  v_step   interval;
  v_from   timestamp;
  v_to     timestamp;
  v_series json;
begin
  perform public.admin_assert();

  -- دقّة المنحنى حسب الفترة: ساعة لليوم، يوم لـ 7/30 يوماً، شهر للكل (36 شهراً كحدّ أقصى)
  if p_range = 'today' then
    v_unit := 'hour'; v_step := interval '1 hour';
    v_from := date_trunc('day', now() at time zone tz);
    v_to   := date_trunc('hour', now() at time zone tz);
  elsif p_range in ('7d', '30d') then
    v_unit := 'day'; v_step := interval '1 day';
    v_from := v_since at time zone tz;
    v_to   := date_trunc('day', now() at time zone tz);
  else
    v_unit := 'month'; v_step := interval '1 month';
    v_to   := date_trunc('month', now() at time zone tz);
    v_from := greatest(
      coalesce((select date_trunc('month', min(p.created_at) at time zone tz) from public.profiles p), v_to),
      v_to - interval '35 months'
    );
  end if;

  select json_agg(json_build_object(
           't', to_char(g.b, 'YYYY-MM-DD"T"HH24:MI'),
           'signups', (select count(*) from public.profiles p where date_trunc(v_unit, p.created_at at time zone tz) = g.b),
           'copies',  (select count(*) from public.code_copies c where date_trunc(v_unit, c.created_at at time zone tz) = g.b)
         ) order by g.b)
    into v_series
  from generate_series(v_from, v_to, v_step) as g(b);

  return json_build_object(
    'range', coalesce(p_range, 'all'),
    'users_total', (select count(*) from public.profiles),
    'users_today', (select count(*) from public.profiles where created_at >= v_today),
    'users_7d',    (select count(*) from public.profiles where created_at >= v_7d),
    'users_range', (select count(*) from public.profiles where created_at >= v_since),
    -- أعضاء Premium حقيقيين: بلا الأدمن، وبلا اللي Premium تاعهم جاي غير من شراء تجربة (tier = 'test')
    'premium_active', (
      select count(*) from public.profiles p
      where coalesce(p.is_admin, false) = false
        and p.is_premium = true and (p.premium_until is null or p.premium_until > now())
        and not (
          exists (select 1 from public.purchases pu
                   where pu.user_id = p.id and pu.refunded_at is null and pu.tier = 'test')
          and not exists (select 1 from public.purchases pu
                           where pu.user_id = p.id and pu.refunded_at is null and pu.tier <> 'test')
        )
    ),
    -- الشركات والعروض الظاهرة اللي تخدم برك (نفس site_stats_auto)، والمخفية والقريبة وحدهم
    'companies', (select count(*) from public.companies c
                   where public.company_is_public(c.status) and not coalesce(c.coming_soon, false)),
    'companies_hidden', (select count(*) from public.companies c where not public.company_is_public(c.status)),
    'companies_soon', (select count(*) from public.companies c
                        where public.company_is_public(c.status) and coalesce(c.coming_soon, false)),
    'offers', (
      (select count(*) from public.companies c
         where public.company_is_public(c.status) and not coalesce(c.coming_soon, false)
           and coalesce(btrim(c.code), '') <> '')
      + (select count(*) from public.companies c
         where public.company_is_public(c.status) and not coalesce(c.coming_soon, false)
           and coalesce(c.supports_premium, true) and coalesce(btrim(c.premium_code), '') <> '')
    ),
    'requests_pending', (select count(*) from public.company_requests where status = 'pending'),
    'copies_range', (select count(*) from public.code_copies where created_at >= v_since),
    'votes_range', (select count(*) from public.code_votes where updated_at >= v_since),
    'votes_up_range', (select count(*) from public.code_votes where updated_at >= v_since and vote_type = 'up'),
    'subscribers_total', (select count(*) from public.email_subscribers),
    'subscribers_range', (select count(*) from public.email_subscribers where created_at >= v_since),
    'series_unit', v_unit,
    'series', coalesce(v_series, '[]'::json),
    'top_copied', coalesce((
      select json_agg(t) from (
        select c.id, c.name, c.logo, c.type, count(*) as n
        from public.code_copies cc join public.companies c on c.id = cc.company_id
        where cc.created_at >= v_since
        group by c.id, c.name, c.logo, c.type
        order by n desc, c.name
        limit 5
      ) t
    ), '[]'::json),
    'top_voted', coalesce((
      select json_agg(t) from (
        select c.id, c.name, c.logo, c.type, count(*) as n,
               count(*) filter (where v.vote_type = 'up') as up
        from public.code_votes v join public.companies c on c.id = v.company_id
        where v.updated_at >= v_since
        group by c.id, c.name, c.logo, c.type
        order by n desc, c.name
        limit 5
      ) t
    ), '[]'::json)
  );
end;
$function$;

-- ===================== 4) الإشعارات =====================
-- نفس الدالة (phase-notifications) + زوج حوايج: البطاقة القريبة ما تبعثش إشعار عام (لا كي تتزاد لا كي
-- تتبدّل)، ولحظة التفعيل (قريباً ← عرض) تتعامل معاها coming_soon_went_live (trigger notify_company_waiters)؛
-- والبطاقة اللي تفعّلت وهي مخفية: كي ترجع تبان، اللي ضغطو "أعلمني" يتربطو بإشعار "شركة جديدة".
create or replace function public.notify_on_company()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id bigint;
begin
  begin
    if not public.company_is_public(new.status) then
      return new; -- الشركات المخفية: حتى إشعار
    end if;

    -- "العرض قريباً": حتى إشعار قبل ما يتفعّل؛ والتفعيل نفسو عند notify_company_waiters
    if coalesce(new.coming_soon, false) or (tg_op = 'UPDATE' and coalesce(old.coming_soon, false)) then
      return new;
    end if;

    -- شركة جديدة، ولا مخفية ترجع تبان (أول مرة برك: الفهرس الفريد)
    if tg_op = 'INSERT' or not public.company_is_public(old.status) then
      insert into public.notifications (kind, company_id, is_auto, push_after)
      values ('company', new.id, true, now() + interval '2 minutes')
      on conflict (company_id) where is_auto and kind = 'company' do nothing
      returning id into v_id;
      -- كانت "قريباً" وتفعّلت وهي مخفية: اللي يستناو يوصلهم هاد الإشعار (ولا "كود جديد" إذا "شركة جديدة" خرج من قبل)
      if tg_op = 'UPDATE' and exists (select 1 from public.coming_soon_waits w
                                       where w.company_id = new.id and w.active and w.notified_at is null) then
        if v_id is null then
          insert into public.notifications (kind, company_id, is_auto, push_after)
          values ('code', new.id, true, now() + interval '2 minutes')
          returning id into v_id;
        end if;
        update public.coming_soon_waits w
           set notified_at = now(), notification_id = v_id, updated_at = now()
         where w.company_id = new.id and w.active and w.notified_at is null;
      end if;
      return new;
    end if;

    -- كود عادي جديد (مرة كل 12 ساعة لكل شركة كأقصى — حتى إشعار "شركة جديدة" يحسب)
    if new.code is distinct from old.code and nullif(btrim(coalesce(new.code, '')), '') is not null
       and not exists (
         select 1 from public.notifications x
          where x.company_id = new.id and x.is_auto and x.kind in ('company', 'code')
            and x.created_at > now() - interval '12 hours') then
      insert into public.notifications (kind, company_id, is_auto, push_after)
      values ('code', new.id, true, now() + interval '2 minutes');
    end if;

    -- كود Premium تزاد (الكود نفسو ما يتقراش: الإشعار يقول "كاين" برك)
    if coalesce(new.has_premium_code, false) and not coalesce(old.has_premium_code, false)
       and not exists (
         select 1 from public.notifications x
          where x.company_id = new.id and x.is_auto and x.kind in ('company', 'premium_code')
            and x.created_at > now() - interval '12 hours') then
      insert into public.notifications (kind, company_id, is_auto, push_after)
      values ('premium_code', new.id, true, now() + interval '2 minutes');
    end if;
  exception when others then
    raise warning 'notify_on_company: %', sqlerrm;
  end;
  return new;
end;
$function$;

-- قريباً ← عرض (والبطاقة ظاهرة): إشعار واحد للكل — "شركة جديدة" أول مرة، وإلا "كود جديد" — واللي ضغطو
-- "أعلمني" يتربطو بيه (notified_at: مرة وحدة لكل شخص). تفعّلت وهي مخفية → notify_on_company كي ترجع تبان.
-- داخل begin … exception: حفظ الشركة ما يتكسّرش أبداً.
create or replace function public.coming_soon_went_live()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  begin
    if not coalesce(old.coming_soon, false) or coalesce(new.coming_soon, false) or not public.company_is_public(new.status) then
      return new;
    end if;

    insert into public.notifications (kind, company_id, is_auto, push_after)
    values ('company', new.id, true, now() + interval '2 minutes')
    on conflict (company_id) where is_auto and kind = 'company' do nothing
    returning id into v_id;
    if v_id is null then
      insert into public.notifications (kind, company_id, is_auto, push_after)
      values ('code', new.id, true, now() + interval '2 minutes')
      returning id into v_id;
    end if;

    update public.coming_soon_waits w
       set notified_at = now(), notification_id = v_id, updated_at = now()
     where w.company_id = new.id and w.active and w.notified_at is null;
  exception when others then
    raise warning 'coming_soon_went_live: %', sqlerrm;
  end;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'notify_company_waiters' and tgrelid = 'public.companies'::regclass) then
    create trigger notify_company_waiters
      after update of coming_soon on public.companies
      for each row execute function public.coming_soon_went_live();
  end if;
end $$;

-- نفس الدالة + waited: الإشعار اللي كان صاحب الحساب يستنى فيه (يبان حتى إذا تفضيلاتو ما تطابقش)
create or replace function public.notifications_feed(p_limit integer default 30, p_before timestamp with time zone default null::timestamp with time zone, p_all boolean default false)
returns json
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_uid   uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 30), 1), 60);
  v_p     public.notification_prefs;
  v_items json;
begin
  if v_uid is not null then
    select * into v_p from public.notification_prefs p where p.user_id = v_uid;
  end if;

  select coalesce(json_agg(x.j order by x.published_at desc, x.id desc), '[]'::json) into v_items
    from (
      select n.id, n.published_at,
             (public.notif_json(n)::jsonb
               || jsonb_build_object('read', v_uid is not null and exists (
                    select 1 from public.notification_reads r where r.user_id = v_uid and r.notification_id = n.id))
               || jsonb_build_object('waited', v_uid is not null and exists (
                    select 1 from public.coming_soon_waits w where w.user_id = v_uid and w.notification_id = n.id)))::json as j
        from public.notifications n
       where public.notif_visible(n)
         and (p_before is null or n.published_at < p_before)
         and (coalesce(p_all, false) or public.notif_matches(n, v_uid, v_p.scope, v_p.categories)
              or (v_uid is not null and exists (
                    select 1 from public.coming_soon_waits w where w.user_id = v_uid and w.notification_id = n.id)))
       order by n.published_at desc, n.id desc
       limit v_limit
    ) x;

  return json_build_object(
    'items', v_items,
    'read_all_before', v_p.read_all_before,
    'scope', coalesce(v_p.scope, 'all')
  );
end;
$function$;

-- نفس الدالة + waited لكل جهاز: الإشعار يوصل اللي كان يستنى فيه (حتى إذا تفضيلاتو ما تطابقش)،
-- و send-push يكتبلو "العرض الذي كنت تنتظره"
create or replace function public.push_batch_targets(p_batch bigint, p_after bigint default 0, p_limit integer default 200)
returns json
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  b       public.push_batches;
  v_last  bigint;
  v_items json;
begin
  select * into b from public.push_batches where id = p_batch and state = 'sending';
  if not found then
    return json_build_object('last', null, 'items', '[]'::json);
  end if;
  select max(t.id),
         coalesce(json_agg(json_build_object('id', t.id, 'endpoint', t.endpoint, 'p256dh', t.p256dh, 'auth', t.auth,
                                             'lang', t.lang, 'ids', t.ids, 'waited', t.waited) order by t.id)
                    filter (where b.test_user is not null or cardinality(t.ids) > 0), '[]'::json)
    into v_last, v_items
    from (
      select s.id, s.endpoint, s.p256dh, s.auth, s.lang,
             case when b.test_user is not null then '{}'::bigint[]
                  else array(select n.id from public.notifications n
                              where n.id = any(b.notification_ids)
                                and (public.notif_matches(n, s.user_id, p.scope, p.categories)
                                     or (s.user_id is not null and exists (
                                           select 1 from public.coming_soon_waits w
                                            where w.user_id = s.user_id and w.notification_id = n.id)))
                              order by n.published_at, n.id) end as ids,
             case when b.test_user is not null or s.user_id is null then '{}'::bigint[]
                  else array(select w.notification_id from public.coming_soon_waits w
                              where w.user_id = s.user_id and w.notification_id = any(b.notification_ids)
                              order by w.notification_id) end as waited
        from public.push_subscriptions s
        left join public.notification_prefs p on p.user_id = s.user_id
       where s.active and s.id > coalesce(p_after, 0)
         and (b.test_user is null or s.user_id = b.test_user)
         and (b.mode <> 'test' or exists (select 1 from public.profiles pr where pr.id = s.user_id and pr.is_admin = true))
       order by s.id
       limit least(greatest(coalesce(p_limit, 200), 1), 500)
    ) t;
  return json_build_object('last', v_last, 'items', v_items);
end;
$function$;

-- ===================== 5) الصلاحيات =====================
-- الأدوات الداخلية ما تتناداش من المتصفّح
revoke all on function public.coming_soon_guard() from public, anon, authenticated;
revoke all on function public.coming_soon_went_live() from public, anon, authenticated;
revoke all on function public.coming_soon_count(bigint) from public, anon, authenticated;

-- "أعلمني" وحالة صاحب الحساب: المسجّل برك
revoke all on function public.coming_soon_wait(bigint, boolean) from public, anon;
grant execute on function public.coming_soon_wait(bigint, boolean) to authenticated;
revoke all on function public.my_coming_soon_waits() from public, anon;
grant execute on function public.my_coming_soon_waits() to authenticated;

-- العدّاد العلني (أرقام برك)
revoke all on function public.coming_soon_board() from public;
grant execute on function public.coming_soon_board() to anon, authenticated;

-- الأدمين (admin_assert داخل الدالة)
revoke all on function public.admin_coming_soon() from public, anon;
grant execute on function public.admin_coming_soon() to authenticated;
