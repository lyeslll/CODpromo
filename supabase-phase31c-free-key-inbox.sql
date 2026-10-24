-- ============================================================
--  CODpromo — Phase 31c: المفتاح الذهبي = مفتاح واحد لكل بريد حقيقي (ماشي لكل حساب برك)
--  شغّله مرة واحدة بعد phase31: npx supabase db query --linked -f supabase-phase31c-free-key-inbox.sql
--  آمن لإعادة التشغيل (idempotent). إضافي فقط: لا حذف لأي جدول/عمود/سطر.
--
--  نفس البريد بأسماء مختلفة = مفتاح واحد:
--   - كل الدومينات: "+" وما بعدها تتنحّى (x+promo@outlook.com = x@outlook.com).
--   - gmail.com / googlemail.com: النقاط تتنحّى تاني (x.y@gmail.com = xy@googlemail.com).
--  ما يتخزّنش البريد: free_reveals.email_hash = sha256 بمفتاح سرّي (private.app_secrets.free_key_email_pepper)
--  للبريد الموحّد، فريد (unique index). قفل استشاري لكل بريد → حسابين بنفس البريد في نفس اللحظة: وحد برك.
--  claim_free_reveal: حالة جديدة inbox_used. get_my_free_key: used + inbox = true (بلا معلومات الحساب الآخر).
-- ============================================================

-- ===================== 0) مفتاح بصمة البريد (خارج الـ API) =====================
insert into private.app_secrets (key, value)
values ('free_key_email_pepper', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (key) do nothing;

-- ===================== 1) توحيد البريد + البصمة =====================
-- x.y+promo@GoogleMail.com → xy@gmail.com ؛ a+1@outlook.com → a@outlook.com ؛ بلا @ أو جزء فارغ → null
create or replace function public.free_key_email_norm(p_email text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v        text := lower(btrim(coalesce(p_email, '')));
  v_local  text;
  v_domain text;
begin
  v_domain := rtrim(coalesce(substring(v from '@([^@]+)$'), ''), '.');
  v_local  := coalesce(substring(v from '^(.*)@[^@]+$'), '');
  v_local  := split_part(v_local, '+', 1);
  if v_domain in ('gmail.com', 'googlemail.com') then
    v_local  := replace(v_local, '.', '');
    v_domain := 'gmail.com';
  end if;
  if v_local = '' or v_domain = '' then
    return null;
  end if;
  return v_local || '@' || v_domain;
end;
$$;

create or replace function public.free_key_email_hash(p_email text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
           when x.n is null then null
           else encode(sha256(convert_to(
                  coalesce((select s.value from private.app_secrets s where s.key = 'free_key_email_pepper'), '') || '|' || x.n,
                  'UTF8')), 'hex')
         end
    from (select public.free_key_email_norm(p_email) as n) x;
$$;

-- ===================== 2) العمود + التعمير + الفهرس الفريد =====================
alter table public.free_reveals add column if not exists email_hash text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'free_reveals_email_hash_chk') then
    alter table public.free_reveals add constraint free_reveals_email_hash_chk
      check (email_hash is null or email_hash ~ '^[0-9a-f]{64}$');
  end if;
end $$;

-- الكشوفات القديمة: أوّل كشف لكل بريد ياخذ البصمة (اللي بعدو يبقى بلا بصمة — ما نسحبوش كود مكشوف)
with ranked as (
  select r.id,
         public.free_key_email_hash(u.email) as h,
         row_number() over (partition by public.free_key_email_hash(u.email) order by r.created_at, r.id) as rn
    from public.free_reveals r
    join auth.users u on u.id = r.user_id
   where r.email_hash is null
)
update public.free_reveals f
   set email_hash = ranked.h
  from ranked
 where ranked.id = f.id
   and ranked.rn = 1
   and ranked.h is not null
   and not exists (select 1 from public.free_reveals x where x.email_hash = ranked.h);

create unique index if not exists free_reveals_email_hash_key on public.free_reveals (email_hash) where email_hash is not null;

-- ===================== 3) استعمال المفتاح: + مفتاح واحد لكل بريد =====================
--  status: ok | yours | auth | used | inbox_used | disabled | has_premium | unavailable | disposable | unconfirmed
create or replace function public.claim_free_reveal(p_company_id bigint, p_source text default null)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_source text := case
                     when p_source in ('home', 'offers', 'featured', 'store', 'category', 'favorites', 'dashboard', 'other') then p_source
                     else 'other'
                   end;
  v_google boolean;
  v_inbox  text;
  v_which  text;
  u        auth.users%rowtype;
  r        public.free_reveals%rowtype;
  c        public.companies%rowtype;
begin
  -- GET (PostgREST) يمرّ في معاملة للقراءة برك: الكشف كتابة، نرفضوه قبل أي فحص (نفس الهدايا)
  if current_setting('transaction_read_only') = 'on' then
    raise exception 'POST only' using errcode = '25006';
  end if;
  if v_uid is null then
    return json_build_object('status', 'auth');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('free_key:' || v_uid::text, 0));

  select * into r from public.free_reveals f where f.user_id = v_uid;
  if found then
    if r.company_id = p_company_id then
      select * into c from public.companies co where co.id = r.company_id;
      return json_build_object('status', 'yours', 'company_id', r.company_id,
                               'premium_code', c.premium_code, 'premium_url', c.premium_url);
    end if;
    return json_build_object('status', 'used', 'company_id', r.company_id);
  end if;

  if not public.free_key_enabled() then
    return json_build_object('status', 'disabled');
  end if;
  -- المفتاح للحسابات بلا Premium: المدفوع و Stork والهدية والأدمن يشوفو كلش أصلاً
  if public.has_premium_access(v_uid) then
    return json_build_object('status', 'has_premium');
  end if;

  -- بطاقة أكواد عندها كود Premium (ماشي مجمّدة) والأدمن خلّاها متاحة للمفتاح
  select * into c from public.companies co where co.id = p_company_id;
  if not found
     or not coalesce(c.has_premium_code, false)
     or c.supports_premium is false
     or not coalesce(c.free_reveal_enabled, false) then
    return json_build_object('status', 'unavailable');
  end if;

  select * into u from auth.users au where au.id = v_uid;
  if not found or coalesce(u.is_anonymous, false) then
    return json_build_object('status', 'auth');
  end if;
  if public.free_key_disposable(u.email) then
    return json_build_object('status', 'disposable');
  end if;
  -- تأكيد الإيميل مفعّل في Auth: إيميل مؤكَّد، ولا حساب Google
  v_google := coalesce(u.raw_app_meta_data ->> 'provider', '') = 'google'
              or coalesce(u.raw_app_meta_data -> 'providers', '[]'::jsonb) ? 'google';
  if u.email_confirmed_at is null and not v_google then
    return json_build_object('status', 'unconfirmed');
  end if;

  -- بريد واحد = مفتاح واحد (حتى بحساب آخر): قفل لكل بريد → حسابين بنفس البريد في نفس اللحظة وحد بوحد
  v_inbox := public.free_key_email_hash(u.email);
  if v_inbox is not null then
    perform pg_advisory_xact_lock(hashtextextended('free_key_inbox:' || v_inbox, 0));
    if exists (select 1 from public.free_reveals f where f.email_hash = v_inbox) then
      return json_build_object('status', 'inbox_used');
    end if;
  end if;

  begin
    insert into public.free_reveals (user_id, company_id, source, ip_hash, email_hash)
    values (v_uid, c.id, v_source, public.free_key_ip_hash(), v_inbox);
  exception when unique_violation then
    get stacked diagnostics v_which = constraint_name;
    return json_build_object('status', case when v_which = 'free_reveals_email_hash_key' then 'inbox_used' else 'used' end);
  end;

  return json_build_object('status', 'ok', 'company_id', c.id,
                           'premium_code', c.premium_code, 'premium_url', c.premium_url);
end;
$$;

-- حالة مفتاحي: available | used (+ الشركة) | used + inbox (نفس البريد استعمل مفتاحو من حساب آخر) | premium
create or replace function public.get_my_free_key()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_inbox text;
  r       public.free_reveals%rowtype;
  co      public.companies%rowtype;
begin
  if v_uid is null then
    return json_build_object('status', 'guest', 'enabled', public.free_key_enabled());
  end if;
  select * into r from public.free_reveals f where f.user_id = v_uid;
  if found then
    select * into co from public.companies x where x.id = r.company_id;
    return json_build_object(
      'status', 'used',
      'enabled', public.free_key_enabled(),
      'premium', public.has_premium_access(v_uid),
      'company_id', r.company_id,
      'created_at', r.created_at,
      'company', case when co.id is null then null
                      else json_build_object('id', co.id, 'name', co.name, 'slug', co.slug, 'logo', co.logo, 'type', co.type) end
    );
  end if;
  if public.has_premium_access(v_uid) then
    return json_build_object('status', 'premium', 'enabled', public.free_key_enabled());
  end if;
  -- نفس البريد (نقاط Gmail / "+") استعمل مفتاحو من حساب آخر: ما نكشفوش أي حاجة على ذاك الحساب
  v_inbox := public.free_key_email_hash((select au.email from auth.users au where au.id = v_uid));
  if v_inbox is not null and exists (select 1 from public.free_reveals f where f.email_hash = v_inbox) then
    return json_build_object('status', 'used', 'enabled', public.free_key_enabled(), 'inbox', true, 'company_id', null, 'company', null);
  end if;
  return json_build_object('status', 'available', 'enabled', public.free_key_enabled());
end;
$$;

-- ===================== 4) صلاحيات التنفيذ =====================
revoke all on function public.free_key_email_norm(text) from public, anon, authenticated;
revoke all on function public.free_key_email_hash(text) from public, anon, authenticated;
revoke all on function public.claim_free_reveal(bigint, text) from public, anon;
grant execute on function public.claim_free_reveal(bigint, text) to authenticated;
revoke all on function public.get_my_free_key() from public, anon;
grant execute on function public.get_my_free_key() to authenticated;

notify pgrst, 'reload schema';
