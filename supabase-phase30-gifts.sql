-- ============================================================
--  CODpromo — Phase 30: نظام الهدايا (روابط تعطي Premium مجاني لمدة محدّدة)
--  شغّله مرة واحدة: npx supabase db query --linked -f supabase-phase30-gifts.sql
--  آمن لإعادة التشغيل (idempotent). إضافي فقط: لا حذف لأي جدول/عمود/سطر.
--
--  نظام منفصل تماماً على الدفع والاشتراكات وعلى Stork:
--   - لا يكتب أبداً في حقول الدفع تاع profiles (is_premium / premium_until / plan_type /
--     payment_provider …)، ولا يلمس trigger protect_premium_columns.
--   - Premium الهدية يعيش في gift_redemptions.premium_until، ويُقرأ عبر has_premium_access.
--   - كي تكمل المدة يرجع الحساب عادي وحدو (premium_until > now()) — بلا cron.
--
--  1) gift_campaigns: الروابط. شخصية (max_uses = 1) أو دعوة جماعية (حدّ أقصى + انتهاء اختياري).
--     الكود 16 حرفاً عشوائياً من 31 حرفاً بلا الحروف المتشابهة (0/O و 1/I/L) — يتولّد في القاعدة.
--  2) gift_redemptions: من فعّل وإلى متى. user_id فريد = كل حساب ياخذ هدية وحدة في حياتو.
--  3) gift_attempts: المحاولات الغالطة (حماية من التخمين: 10 في الساعة لكل حساب،
--     و 30 لكل عنوان IP بلا حساب في المعاينة — البصمة مجزّأة بمفتاح سرّي، بلا IP صريح).
--  4) RLS: حتى زائر ولا مستخدم (ولا حتى الأدمن) يقرا ولا يكتب في هاد الجداول مباشرة.
--     المستخدم يشوف هديته عبر my_gift، والأدمن عبر دوال admin_* اللي تبدأ بـ admin_assert().
--  5) has_premium_access: Premium من الملف (مدفوع / Stork) أو أدمن، أو هدية نشطة.
--  6) admin_list_users: الخطة "gift" مع تاريخ نهاية الهدية.
-- ============================================================

-- ===================== 0) مفتاح بصمة المحاولات (خارج الـ API) =====================
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.app_secrets (
  key   text primary key,
  value text not null
);
revoke all on private.app_secrets from public, anon, authenticated;

insert into private.app_secrets (key, value)
values ('gift_attempt_pepper', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (key) do nothing;

-- ===================== 1) الجداول =====================
create table if not exists public.gift_campaigns (
  id            bigint generated always as identity primary key,
  code          text not null unique
                check (code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{12,32}$'),
  kind          text not null check (kind in ('personal', 'group')),
  duration_days integer not null check (duration_days between 1 and 3650),
  max_uses      integer not null check (max_uses between 1 and 100000),
  uses_count    integer not null default 0,
  expires_at    timestamptz,
  is_active     boolean not null default true,
  label         text check (label is null or char_length(label) <= 120),
  created_at    timestamptz not null default now(),
  -- الشخصية = استعمال واحد برك، والعدّاد ما يفوتش الحدّ أبداً (حتى مع الطلبات المتزامنة)
  constraint gift_personal_single check (kind <> 'personal' or max_uses = 1),
  constraint gift_uses_in_range check (uses_count between 0 and max_uses)
);

create table if not exists public.gift_redemptions (
  id            bigint generated always as identity primary key,
  campaign_id   bigint not null references public.gift_campaigns (id),
  -- فريد: هدية وحدة لكل حساب في حياتو. إذا تمسح الحساب يبقى السطر بلا صاحب (نفس stork_codes.used_by).
  user_id       uuid unique references auth.users (id) on delete set null,
  redeemed_at   timestamptz not null default now(),
  premium_until timestamptz not null,
  revoked_at    timestamptz,
  constraint gift_until_after_redeem check (premium_until > redeemed_at)
);

create index if not exists gift_redemptions_campaign_idx on public.gift_redemptions (campaign_id, redeemed_at desc);

create table if not exists public.gift_attempts (
  subject    text primary key,           -- 'u:<uuid>' للحساب، 'ip:<sha256>' للزائر
  fails      timestamptz[] not null default '{}',
  updated_at timestamptz not null default now()
);

-- ===================== 2) القفل: لا قراءة ولا كتابة مباشرة =====================
-- RLS مفعّل بلا أي سياسة + سحب كل الصلاحيات: الوصول الوحيد عبر الدوال أدناه (SECURITY DEFINER).
alter table public.gift_campaigns   enable row level security;
alter table public.gift_redemptions enable row level security;
alter table public.gift_attempts    enable row level security;
revoke all on public.gift_campaigns   from public, anon, authenticated;
revoke all on public.gift_redemptions from public, anon, authenticated;
revoke all on public.gift_attempts    from public, anon, authenticated;

-- ===================== 3) أدوات داخلية =====================
-- توحيد الكود: حروف كبيرة، بلا فراغات ولا "-" (الرابط يبيّنو بمجموعات XXXX-XXXX-XXXX-XXXX)
create or replace function public.gift_norm(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select upper(regexp_replace(left(coalesce(p, ''), 100), '[^A-Za-z0-9]', '', 'g'));
$$;

-- كود عشوائي من 16 حرفاً (31 حرفاً ممكناً، ≈ 79 bit). سحب بالرفض (byte < 248) باش ما يكونش انحياز.
create or replace function public.gift_new_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  abc   constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_out text := '';
  v_b   bytea;
  v_i   integer;
  v_x   integer;
begin
  while length(v_out) < 16 loop
    v_b := extensions.gen_random_bytes(32);
    for v_i in 0 .. 31 loop
      v_x := get_byte(v_b, v_i);
      if v_x < 248 and length(v_out) < 16 then
        v_out := v_out || substr(abc, (v_x % 31) + 1, 1);
      end if;
    end loop;
  end loop;
  return v_out;
end;
$$;

-- صاحب المحاولة: الحساب، وإلا بصمة عنوان IP كما يراه Cloudflare (نفس طريقة nocode_go)
create or replace function public.gift_subject()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_hdr    json;
  v_ip     text;
  v_pepper text;
begin
  if v_uid is not null then
    return 'u:' || v_uid::text;
  end if;
  begin
    v_hdr := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    v_hdr := null;
  end;
  v_ip := nullif(btrim(v_hdr ->> 'cf-connecting-ip'), '');
  if v_ip is null then
    v_ip := nullif(btrim(regexp_replace(coalesce(v_hdr ->> 'x-forwarded-for', ''), '^.*,', '')), '');
  end if;
  -- IPv6: جهاز واحد يملك شبكة /64 كاملة
  begin
    if v_ip is not null and family(v_ip::inet) = 6 then
      v_ip := host(network(set_masklen(v_ip::inet, 64)));
    end if;
  exception when others then
    null;
  end;
  select s.value into v_pepper from private.app_secrets s where s.key = 'gift_attempt_pepper';
  return 'ip:' || encode(sha256(convert_to(coalesce(v_pepper, '') || '|' || coalesce(v_ip, 'unknown'), 'UTF8')), 'hex');
end;
$$;

-- هل وصل صاحب المحاولة للحدّ؟ (عدد المحاولات الغالطة في آخر ساعة)
create or replace function public.gift_limited(p_subject text, p_max integer)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select count(*) >= p_max
    from public.gift_attempts a, unnest(a.fails) as f
   where a.subject = p_subject and f > now() - interval '1 hour';
$$;

-- تسجيل محاولة غالطة (نخلّيو غير آخر ساعة، 50 كأقصى — الجدول ما يكبرش)
create or replace function public.gift_note_failure(p_subject text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  insert into public.gift_attempts as a (subject, fails, updated_at)
  values (p_subject, array[now()], now())
  on conflict (subject) do update
    set fails = (
          select coalesce(array_agg(x.f order by x.f), '{}')
            from (select f
                    from unnest(a.fails || now()) as f
                   where f > now() - interval '1 hour'
                   order by f desc
                   limit 50) as x
        ),
        updated_at = now();
end;
$$;

-- ===================== 4) القاعدة الموحّدة: من عندو Premium؟ =====================
-- Premium من حقول الملف (مدفوع / Stork) أو أدمن — بلا الهدايا. (هذا كان has_premium_access قبل phase30)
create or replace function public.has_profile_premium(uid uuid)
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

-- هدية نشطة: ما تسحبتش وما كملتش مدّتها
create or replace function public.has_active_gift(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.gift_redemptions g
    where g.user_id = uid
      and g.revoked_at is null
      and g.premium_until > now()
  );
$$;

-- القاعدة الواحدة "من يرى Premium؟" (get_premium_code و nocode_go يستعملوها):
-- Premium مدفوع ساري، أو أدمن، أو هدية نشطة.
create or replace function public.has_premium_access(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_profile_premium(uid) or public.has_active_gift(uid);
$$;

-- ===================== 5) دوال المستخدم =====================
-- معاينة رابط الهدية (صفحة /gift/:code، حتى للزائر بلا حساب):
--  status: ok | invalid | inactive | expired | exhausted | yours | already_redeemed | has_premium | rate_limited
--  ما تعطيش حتى معلومة داخلية (لا الملاحظة ولا عدد الاستعمالات).
create or replace function public.gift_preview(p_code text)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_code text := public.gift_norm(p_code);
  v_sub  text;
  c      public.gift_campaigns%rowtype;
  r      public.gift_redemptions%rowtype;
begin
  -- GET (PostgREST) يمرّ في معاملة للقراءة برك: ما نقدروش نسجّلو المحاولة الغالطة، فيولّي طريق
  -- للتخمين بلا حدّ (كود صحيح = 200، غالط = خطأ). نرفضوه قبل أي بحث → نفس الخطأ للزوج.
  if current_setting('transaction_read_only') = 'on' then
    raise exception 'POST only' using errcode = '25006';
  end if;
  if v_code = '' then
    return json_build_object('status', 'invalid');
  end if;

  -- محاولات نفس الصاحب تمرّ وحدة وحدة، والحدّ يتفحص قبل أي بحث على الكود
  v_sub := public.gift_subject();
  perform pg_advisory_xact_lock(hashtextextended('gift:' || v_sub, 0));
  if public.gift_limited(v_sub, case when v_uid is null then 30 else 10 end) then
    return json_build_object('status', 'rate_limited');
  end if;

  select * into c from public.gift_campaigns g where g.code = v_code;
  if not found then
    perform public.gift_note_failure(v_sub);
    return json_build_object('status', 'invalid');
  end if;

  if v_uid is not null then
    select * into r from public.gift_redemptions g where g.user_id = v_uid;
    if r.id is not null and r.campaign_id = c.id then
      return json_build_object(
        'status', 'yours', 'kind', c.kind, 'duration_days', c.duration_days,
        'premium_until', r.premium_until,
        'active', r.revoked_at is null and r.premium_until > now());
    end if;
  end if;

  if not c.is_active then
    return json_build_object('status', 'inactive', 'kind', c.kind);
  end if;
  if c.expires_at is not null and c.expires_at <= now() then
    return json_build_object('status', 'expired', 'kind', c.kind);
  end if;
  if c.uses_count >= c.max_uses then
    return json_build_object('status', 'exhausted', 'kind', c.kind);
  end if;

  if v_uid is not null then
    if r.id is not null then
      return json_build_object('status', 'already_redeemed', 'kind', c.kind, 'duration_days', c.duration_days);
    end if;
    if public.has_profile_premium(v_uid) then
      return json_build_object('status', 'has_premium', 'kind', c.kind, 'duration_days', c.duration_days);
    end if;
  end if;

  return json_build_object('status', 'ok', 'kind', c.kind, 'duration_days', c.duration_days);
end;
$$;

-- تفعيل الهدية (حساب داخل برك). ذرّي:
--  - قفل استشاري لكل حساب: محاولات نفس الحساب وحدة وحدة (الحدّ + لا تفعيل مزدوج).
--  - قفل سطر الحملة (for update): الطلبات المتزامنة على نفس الرابط وحدة وحدة،
--    والعدّاد يزيد غير إذا uses_count < max_uses (+ CHECK في الجدول) → ما يفوتش الحدّ أبداً.
--  - عندو Premium مدفوع نشط ولا أدمن → يرفض والكود ما يتحسبش.
--  status: ok | auth | invalid | inactive | expired | exhausted | yours | already_redeemed | has_premium | rate_limited
create or replace function public.redeem_gift(p_code text)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_code  text := public.gift_norm(p_code);
  v_sub   text;
  v_until timestamptz;
  c       public.gift_campaigns%rowtype;
  r       public.gift_redemptions%rowtype;
begin
  -- نفس حماية gift_preview: GET (قراءة برك) مرفوض قبل أي بحث على الكود
  if current_setting('transaction_read_only') = 'on' then
    raise exception 'POST only' using errcode = '25006';
  end if;
  if v_uid is null then
    return json_build_object('status', 'auth');
  end if;
  if v_code = '' then
    return json_build_object('status', 'invalid');
  end if;

  v_sub := 'u:' || v_uid::text;
  perform pg_advisory_xact_lock(hashtextextended('gift:' || v_sub, 0));
  if public.gift_limited(v_sub, 10) then
    return json_build_object('status', 'rate_limited');
  end if;

  select * into c from public.gift_campaigns g where g.code = v_code for update;
  if not found then
    perform public.gift_note_failure(v_sub);
    return json_build_object('status', 'invalid');
  end if;

  select * into r from public.gift_redemptions g where g.user_id = v_uid;
  if r.id is not null and r.campaign_id = c.id then
    return json_build_object(
      'status', 'yours', 'kind', c.kind, 'duration_days', c.duration_days,
      'premium_until', r.premium_until,
      'active', r.revoked_at is null and r.premium_until > now());
  end if;

  if not c.is_active then
    return json_build_object('status', 'inactive', 'kind', c.kind);
  end if;
  if c.expires_at is not null and c.expires_at <= now() then
    return json_build_object('status', 'expired', 'kind', c.kind);
  end if;
  if c.uses_count >= c.max_uses then
    return json_build_object('status', 'exhausted', 'kind', c.kind);
  end if;
  if r.id is not null then
    return json_build_object('status', 'already_redeemed', 'kind', c.kind, 'duration_days', c.duration_days);
  end if;
  if public.has_profile_premium(v_uid) then
    return json_build_object('status', 'has_premium', 'kind', c.kind, 'duration_days', c.duration_days);
  end if;

  v_until := now() + make_interval(days => c.duration_days);
  -- العدّاد والتفعيل في نفس الكتلة: إذا فشل واحد يتلغاو الزوج
  begin
    update public.gift_campaigns g
       set uses_count = g.uses_count + 1
     where g.id = c.id and g.uses_count < g.max_uses;
    if not found then
      return json_build_object('status', 'exhausted', 'kind', c.kind);
    end if;
    insert into public.gift_redemptions (campaign_id, user_id, premium_until)
    values (c.id, v_uid, v_until);
  exception when unique_violation then
    return json_build_object('status', 'already_redeemed', 'kind', c.kind, 'duration_days', c.duration_days);
  end;

  return json_build_object('status', 'ok', 'kind', c.kind, 'duration_days', c.duration_days, 'premium_until', v_until);
end;
$$;

-- هدية المستخدم الحالي (أو null): للداشبورد والواجهة (usePremium)
create or replace function public.my_gift()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
           'redeemed_at', r.redeemed_at,
           'premium_until', r.premium_until,
           'duration_days', c.duration_days,
           'revoked', r.revoked_at is not null,
           'active', r.revoked_at is null and r.premium_until > now())
    from public.gift_redemptions r
    join public.gift_campaigns c on c.id = r.campaign_id
   where auth.uid() is not null and r.user_id = auth.uid();
$$;

-- ===================== 6) دوال الأدمن (كلها تبدأ بـ admin_assert) =====================
-- أرقام الهدايا برك: الحسابات النشطة بهدية، الروابط النشطة، الاستعمالات هاد الشهر (توقيت الجزائر)
create or replace function public.admin_gift_stats()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.admin_assert();
  return json_build_object(
    'active_accounts', (
      select count(*) from public.gift_redemptions r
       where r.user_id is not null and r.revoked_at is null and r.premium_until > now()),
    'active_links', (
      select count(*) from public.gift_campaigns g
       where g.is_active and (g.expires_at is null or g.expires_at > now()) and g.uses_count < g.max_uses),
    'uses_month', (
      select count(*) from public.gift_redemptions r
       where r.redeemed_at >= date_trunc('month', now() at time zone 'Africa/Algiers') at time zone 'Africa/Algiers')
  );
end;
$$;

-- كل الروابط (الأحدث أولاً) مع حالتها وعدد أصحابها النشطين
create or replace function public.admin_list_gifts()
returns table (
  id bigint,
  code text,
  kind text,
  duration_days integer,
  max_uses integer,
  uses_count integer,
  expires_at timestamptz,
  is_active boolean,
  label text,
  created_at timestamptz,
  status text,
  active_holders bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  perform public.admin_assert();
  return query
    select g.id, g.code, g.kind, g.duration_days, g.max_uses, g.uses_count, g.expires_at,
           g.is_active, g.label, g.created_at,
           case
             when not g.is_active then 'inactive'
             when g.expires_at is not null and g.expires_at <= now() then 'expired'
             when g.uses_count >= g.max_uses then 'exhausted'
             else 'active'
           end,
           (select count(*) from public.gift_redemptions r
             where r.campaign_id = g.id and r.user_id is not null
               and r.revoked_at is null and r.premium_until > now())
      from public.gift_campaigns g
     order by g.created_at desc, g.id desc
     limit 2000;
end;
$$;

-- هدية جديدة: الكود يتولّد هنا (فريد، مع إعادة المحاولة في حالة تصادم)
create or replace function public.admin_create_gift(
  p_kind          text,
  p_duration_days integer,
  p_max_uses      integer default null,
  p_expires_at    timestamptz default null,
  p_label         text default null
)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_max  integer;
  v_id   bigint;
  v_code text;
  v_try  integer;
begin
  perform public.admin_assert();
  if p_kind is null or p_kind not in ('personal', 'group') then
    raise exception 'invalid kind' using errcode = '22023';
  end if;
  if p_duration_days is null or p_duration_days < 1 or p_duration_days > 3650 then
    raise exception 'invalid duration' using errcode = '22023';
  end if;
  v_max := case when p_kind = 'personal' then 1 else p_max_uses end;
  if v_max is null or v_max < 1 or v_max > 100000 then
    raise exception 'invalid max uses' using errcode = '22023';
  end if;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'expiry must be in the future' using errcode = '22023';
  end if;

  for v_try in 1 .. 5 loop
    v_code := public.gift_new_code();
    begin
      insert into public.gift_campaigns (code, kind, duration_days, max_uses, expires_at, label)
      values (v_code, p_kind, p_duration_days, v_max, p_expires_at,
              nullif(left(btrim(coalesce(p_label, '')), 120), ''))
      returning gift_campaigns.id into v_id;
      exit;
    exception when unique_violation then
      v_id := null;
    end;
  end loop;
  if v_id is null then
    raise exception 'could not generate a unique code';
  end if;

  return (
    select json_build_object(
      'id', g.id, 'code', g.code, 'kind', g.kind, 'duration_days', g.duration_days,
      'max_uses', g.max_uses, 'uses_count', g.uses_count, 'expires_at', g.expires_at,
      'is_active', g.is_active, 'label', g.label, 'created_at', g.created_at,
      'status', 'active', 'active_holders', 0)
      from public.gift_campaigns g where g.id = v_id
  );
end;
$$;

-- تشغيل / إيقاف رابط
create or replace function public.admin_set_gift_active(p_id bigint, p_active boolean)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  perform public.admin_assert();
  update public.gift_campaigns set is_active = coalesce(p_active, false) where id = p_id;
  return found;
end;
$$;

-- شكون استعمل رابط: الاسم، الإيميل، التاريخ، ونهاية Premium
create or replace function public.admin_gift_redemptions(p_campaign bigint)
returns table (
  id bigint,
  user_id uuid,
  full_name text,
  email text,
  redeemed_at timestamptz,
  premium_until timestamptz,
  revoked_at timestamptz,
  active boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  perform public.admin_assert();
  return query
    select r.id, r.user_id, p.full_name, coalesce(u.email, p.email)::text,
           r.redeemed_at, r.premium_until, r.revoked_at,
           (r.user_id is not null and r.revoked_at is null and r.premium_until > now())
      from public.gift_redemptions r
      left join public.profiles p on p.id = r.user_id
      left join auth.users u on u.id = r.user_id
     where r.campaign_id = p_campaign
     order by r.redeemed_at desc, r.id desc;
end;
$$;

-- سحب الهدية: revoked_at = الآن → has_premium_access يرجع false في الحين.
-- السحب نهائي: الاستعمال يبقى محسوب، والحساب ما ياخذش هدية أخرى (هدية وحدة في الحياة).
create or replace function public.admin_revoke_gift(p_id bigint)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  perform public.admin_assert();
  update public.gift_redemptions set revoked_at = now() where id = p_id and revoked_at is null;
  return (
    select json_build_object('id', r.id, 'revoked_at', r.revoked_at, 'premium_until', r.premium_until)
      from public.gift_redemptions r where r.id = p_id
  );
end;
$$;

-- ===================== 7) جدول المستخدمين: الخطة "gift" =====================
-- نفس admin_list_users تاع phase23 (نفس التوقيع ونفس الأعمدة)، مع:
--  plan = 'gift' إذا الحساب عندو هدية نشطة وما عندوش Premium مدفوع ولا أدمن،
--  و premium_until = نهاية الهدية في هاد الحالة. فلتر p_plan يقبل 'gift' تاني.
create or replace function public.admin_list_users(
  p_search text default null,
  p_plan   text default null,      -- free | premium | lifetime | gift
  p_type   text default null,      -- customer | company
  p_range  text default 'all',
  p_sort   text default 'created_at', -- created_at | last_sign_in | name | email | favorites | copies
  p_desc   boolean default true,
  p_limit  integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  full_name text,
  email text,
  account_type text,
  company_name text,
  plan text,
  premium_until timestamptz,
  plan_type text,
  payment_provider text,
  provider text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  favorites_count bigint,
  copies_count bigint,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_q text := nullif(btrim(coalesce(p_search, '')), '');
  v_since timestamptz := public.admin_range_start(p_range);
begin
  perform public.admin_assert();
  p_limit  := least(greatest(coalesce(p_limit, 25), 1), 1000);
  p_offset := greatest(coalesce(p_offset, 0), 0);
  -- نهرب رموز ILIKE حتى يُبحث عن النص حرفياً
  if v_q is not null then
    v_q := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  return query
  with base as (
    select
      p.id,
      p.full_name,
      coalesce(u.email, p.email)::text as email,
      p.account_type,
      p.company_name,
      case
        when p.is_admin = true then 'lifetime'
        when p.is_premium = true and (p.premium_until is null or p.premium_until > now()) then 'premium'
        when g.premium_until is not null then 'gift'
        else 'free'
      end as plan,
      case
        when p.is_admin = true then p.premium_until
        when p.is_premium = true and (p.premium_until is null or p.premium_until > now()) then p.premium_until
        when g.premium_until is not null then g.premium_until
        else p.premium_until
      end as premium_until,
      p.plan_type,
      p.payment_provider,
      coalesce(
        (select string_agg(x, ',' order by x) from jsonb_array_elements_text(u.raw_app_meta_data -> 'providers') as x),
        u.raw_app_meta_data ->> 'provider',
        'email'
      )::text as provider,
      p.created_at,
      u.last_sign_in_at,
      (select count(*) from public.favorites f where f.user_id = p.id) as favorites_count,
      (select count(*) from public.code_copies cc where cc.user_id = p.id) as copies_count
    from public.profiles p
    left join auth.users u on u.id = p.id
    left join lateral (
      select gr.premium_until
        from public.gift_redemptions gr
       where gr.user_id = p.id and gr.revoked_at is null and gr.premium_until > now()
    ) g on true
  )
  select b.id, b.full_name, b.email, b.account_type, b.company_name, b.plan, b.premium_until,
         b.plan_type, b.payment_provider, b.provider, b.created_at, b.last_sign_in_at,
         b.favorites_count, b.copies_count, count(*) over () as total_count
  from base b
  where (v_q is null or b.full_name ilike v_q or b.email ilike v_q)
    and (nullif(p_plan, '') is null or b.plan = p_plan)
    and (nullif(p_type, '') is null or b.account_type = p_type)
    and b.created_at >= v_since
  order by
    case when p_sort = 'created_at'   and p_desc     then b.created_at end desc nulls last,
    case when p_sort = 'created_at'   and not p_desc then b.created_at end asc  nulls last,
    case when p_sort = 'last_sign_in' and p_desc     then b.last_sign_in_at end desc nulls last,
    case when p_sort = 'last_sign_in' and not p_desc then b.last_sign_in_at end asc  nulls last,
    case when p_sort = 'name'         and p_desc     then lower(b.full_name) end desc nulls last,
    case when p_sort = 'name'         and not p_desc then lower(b.full_name) end asc  nulls last,
    case when p_sort = 'email'        and p_desc     then lower(b.email) end desc nulls last,
    case when p_sort = 'email'        and not p_desc then lower(b.email) end asc  nulls last,
    case when p_sort = 'favorites'    and p_desc     then b.favorites_count end desc nulls last,
    case when p_sort = 'favorites'    and not p_desc then b.favorites_count end asc  nulls last,
    case when p_sort = 'copies'       and p_desc     then b.copies_count end desc nulls last,
    case when p_sort = 'copies'       and not p_desc then b.copies_count end asc  nulls last,
    b.created_at desc, b.id
  limit p_limit offset p_offset;
end;
$$;

-- ===================== 8) صلاحيات التنفيذ =====================
-- الأدوات الداخلية والقواعد: الخادم برك (ما تتناداش من المتصفّح)
revoke all on function public.gift_norm(text) from public, anon, authenticated;
revoke all on function public.gift_new_code() from public, anon, authenticated;
revoke all on function public.gift_subject() from public, anon, authenticated;
revoke all on function public.gift_limited(text, integer) from public, anon, authenticated;
revoke all on function public.gift_note_failure(text) from public, anon, authenticated;
revoke all on function public.has_profile_premium(uuid) from public, anon, authenticated;
revoke all on function public.has_active_gift(uuid) from public, anon, authenticated;
revoke all on function public.has_premium_access(uuid) from public, anon, authenticated;

-- المعاينة للزائر والمسجّل، التفعيل وهديتي للمسجّل برك
revoke all on function public.gift_preview(text) from public;
grant execute on function public.gift_preview(text) to anon, authenticated;
revoke all on function public.redeem_gift(text) from public, anon;
grant execute on function public.redeem_gift(text) to authenticated;
revoke all on function public.my_gift() from public, anon;
grant execute on function public.my_gift() to authenticated;

-- الأدمن: المسجّلون برك، والدالة نفسها ترفض غير الأدمن (admin_assert)
revoke all on function public.admin_gift_stats() from public, anon;
revoke all on function public.admin_list_gifts() from public, anon;
revoke all on function public.admin_create_gift(text, integer, integer, timestamptz, text) from public, anon;
revoke all on function public.admin_set_gift_active(bigint, boolean) from public, anon;
revoke all on function public.admin_gift_redemptions(bigint) from public, anon;
revoke all on function public.admin_revoke_gift(bigint) from public, anon;
revoke all on function public.admin_list_users(text, text, text, text, text, boolean, integer, integer) from public, anon;
grant execute on function public.admin_gift_stats() to authenticated;
grant execute on function public.admin_list_gifts() to authenticated;
grant execute on function public.admin_create_gift(text, integer, integer, timestamptz, text) to authenticated;
grant execute on function public.admin_set_gift_active(bigint, boolean) to authenticated;
grant execute on function public.admin_gift_redemptions(bigint) to authenticated;
grant execute on function public.admin_revoke_gift(bigint) to authenticated;
grant execute on function public.admin_list_users(text, text, text, text, text, boolean, integer, integer) to authenticated;

notify pgrst, 'reload schema';
