-- ============================================================
--  CODpromo — Phase 31: المفتاح الذهبي (كود Premium واحد مجاناً لكل حساب، مرة وحدة في حياتو)
--  شغّله مرة واحدة: npx supabase db query --linked -f supabase-phase31-free-key.sql
--  آمن لإعادة التشغيل (idempotent). إضافي فقط: لا حذف لأي جدول/عمود/سطر.
--
--  المفتاح ما يعطيش Premium: ما يكتب حتى حاجة في profiles، ما يبدّلش has_premium_access،
--  ما يمسّش الدفع ولا الهدايا ولا Stork، وما يتحسبش في أرقام المشتركين ولا الدخل.
--
--  1) free_reveals: user_id فريد (مفتاح واحد لكل حساب في حياتو) + الشركة + المصدر + بصمة IP.
--     RLS مفعّل بلا أي سياسة + بلا صلاحيات: حتى واحد ما يقرا ولا يكتب مباشرة، كلش عبر الدوال.
--  2) companies.free_reveal_enabled (افتراضياً true): الشركة متاحة للمفتاح الذهبي.
--     site_stats.free_key_enabled (افتراضياً true): تشغيل/إيقاف الميزة كاملة بضغطة.
--  3) private.disposable_email_domains: مواقع الإيميل المؤقت (necub.com، bowlfuel.com، mailinator…).
--  4) claim_free_reveal(company): ذرّي (قفل استشاري لكل حساب + user_id فريد). يتطلب الميزة مفعّلة،
--     شركة عندها كود Premium ومتاحة للمفتاح، حساب بلا Premium (مدفوع / Stork / هدية / أدمن)
--     ما استعملش مفتاحو، إيميل ماشي مؤقت، وإيميل مؤكَّد أو حساب Google (تأكيد الإيميل مفعّل في Auth).
--  5) get_premium_code: نفس القاعدة + كود الشركة اللي كشفها المستخدم بمفتاحو (هي برك).
--  6) get_my_free_key (حالة مفتاحي)، free_key_public (التشغيل + العدّاد العلني من 50)،
--     ودوال الأدمن (كلها admin_assert + count دقيق).
--  بصمة IP للتسجيل والتنبيه برك: ما نحبسوش بـ IP (بزاف ناس يتقاسمو نفس IP في شبكات الموبايل).
-- ============================================================

-- ===================== 0) مفتاح بصمة IP (خارج الـ API، نفس طريقة الهدايا) =====================
insert into private.app_secrets (key, value)
values ('free_key_ip_pepper', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (key) do nothing;

-- ===================== 1) الإعدادات =====================
alter table public.companies add column if not exists free_reveal_enabled boolean not null default true;
-- القراءة على companies عموداً عموداً منذ phase28: العمود الجديد يحتاج صلاحية صريحة
grant select (free_reveal_enabled) on public.companies to anon, authenticated;

-- القراءة العامة لـ site_stats على الجدول كامل (phase21)؛ التعديل عبر admin_set_free_key_enabled برك
alter table public.site_stats add column if not exists free_key_enabled boolean not null default true;

-- ===================== 2) الكشوفات المجانية =====================
create table if not exists public.free_reveals (
  id         bigint generated always as identity primary key,
  -- فريد: مفتاح واحد لكل حساب في حياتو. إذا تمسح الحساب يبقى السطر بلا صاحب (نفس gift_redemptions).
  user_id    uuid unique references auth.users (id) on delete set null,
  company_id bigint references public.companies (id) on delete set null,
  source     text not null default 'other'
             check (source in ('home', 'offers', 'featured', 'store', 'category', 'favorites', 'dashboard', 'other')),
  ip_hash    text check (ip_hash is null or ip_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

create index if not exists free_reveals_created_idx on public.free_reveals (created_at desc);
create index if not exists free_reveals_company_idx on public.free_reveals (company_id);
create index if not exists free_reveals_ip_idx on public.free_reveals (ip_hash, created_at);

alter table public.free_reveals enable row level security;
revoke all on public.free_reveals from public, anon, authenticated;

-- ===================== 3) مواقع الإيميل المؤقت =====================
-- في المخطط private (ماشي مكشوف للـ API). زيادة دومين: insert into private.disposable_email_domains values ('x.com');
create table if not exists private.disposable_email_domains (
  domain text primary key check (domain ~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$')
);
revoke all on private.disposable_email_domains from public, anon, authenticated;

insert into private.disposable_email_domains (domain) values
  -- حادثة سبتمبر 2026
  ('necub.com'), ('bowlfuel.com'),
  -- Mailinator وأسماؤه
  ('mailinator.com'), ('mailinator.net'), ('mailinator.org'), ('mailinator.us'), ('mailinator2.com'), ('mailinater.com'),
  ('mailin8r.com'), ('mailnator.com'), ('tmailinator.com'), ('notmailinator.com'), ('sogetthis.com'), ('spamherelots.com'),
  ('thisisnotmyrealemail.com'), ('reallymymail.com'), ('suremail.info'), ('binkmail.com'), ('bobmail.info'), ('chammy.info'),
  ('devnullmail.com'), ('letthemeatspam.com'), ('mailismagic.com'), ('monumentmail.com'), ('safetymail.info'),
  ('sendspamhere.com'), ('spamhereplease.com'), ('tradermail.info'), ('veryrealemail.com'), ('zippymail.info'),
  ('mvrht.com'), ('mvrht.net'), ('mt2009.com'), ('mt2014.com'), ('viewcastmedia.com'), ('viewcastmedia.net'),
  ('viewcastmedia.org'), ('wetrainbayarea.com'), ('wetrainbayarea.org'), ('whatiaas.com'), ('whatpaas.com'),
  ('ordinaryamerican.net'), ('myspaceinc.com'), ('winemaven.info'), ('yogamaven.com'), ('putthisinyourspamdatabase.com'),
  -- Guerrilla Mail
  ('guerrillamail.com'), ('guerrillamail.net'), ('guerrillamail.org'), ('guerrillamail.biz'), ('guerrillamail.de'),
  ('guerrillamail.info'), ('guerrillamailblock.com'), ('grr.la'), ('sharklasers.com'), ('spam4.me'), ('pokemail.net'),
  -- دقائق / مؤقت
  ('10minutemail.com'), ('10minutemail.net'), ('10minutemail.co.uk'), ('10minutemail.de'), ('10minutemail.org'),
  ('10minemail.com'), ('20minutemail.com'), ('20minutemail.it'), ('zehnminutenmail.de'), ('zehnminuten.de'),
  ('temp-mail.org'), ('temp-mail.io'), ('temp-mail.ru'), ('tempmail.com'), ('tempmail.net'), ('tempmail.dev'),
  ('tempmail.plus'), ('tempmail.ninja'), ('tempmail.us.com'), ('tempmail.it'), ('tempmailo.com'), ('tempmailaddress.com'),
  ('tempmaildemo.com'), ('tempmailer.com'), ('tempmailer.de'), ('tempr.email'), ('tempinbox.com'), ('tempail.com'),
  ('tempemail.net'), ('tempemail.com'), ('tempemail.co.za'), ('tempomail.fr'), ('temporarymail.com'),
  ('temporaryinbox.com'), ('temporary-mail.net'), ('tempalias.com'), ('tempymail.com'), ('tempsky.com'), ('tempthe.net'),
  ('tmpmail.org'), ('tmpmail.net'), ('tmpeml.com'), ('tmails.net'), ('tmpbox.net'), ('tmail.ws'), ('mytempemail.com'),
  ('mytemp.email'), ('mail-temp.com'), ('mailtemp.info'), ('emailtemporanea.com'), ('emailtemporanea.net'),
  ('emailtemporar.ro'), ('correotemporal.org'), ('minuteinbox.com'),
  -- رمي / سلّة
  ('throwawaymail.com'), ('throwam.com'), ('throwawayemailaddress.com'), ('trashmail.com'), ('trashmail.net'),
  ('trashmail.de'), ('trashmail.io'), ('trashmail.me'), ('trashmail.ws'), ('trashmail.at'), ('trashmail.org'),
  ('trashmailer.com'), ('trash-mail.com'), ('trash-mail.at'), ('trash-mail.de'), ('trash-amil.com'), ('trashymail.com'),
  ('trashymail.net'), ('trashdevil.com'), ('trashdevil.de'), ('trashemail.de'), ('trash2009.com'), ('mytrashmail.com'),
  ('mailmetrash.com'), ('mailtrash.net'), ('wegwerfmail.de'), ('wegwerfmail.net'), ('wegwerfmail.org'),
  ('wegwerfemail.de'), ('wegwerfadresse.de'), ('dumpmail.de'), ('dump-email.info'), ('dumpandjunk.com'),
  ('dumpyemail.com'), ('discard.email'), ('discardmail.com'), ('discardmail.de'), ('disposableaddress.com'),
  ('disposeamail.com'), ('disposemail.com'), ('dispostable.com'), ('deadaddress.com'), ('killmail.com'), ('killmail.net'),
  -- YOPmail
  ('yopmail.com'), ('yopmail.net'), ('yopmail.fr'), ('yopmail.gq'), ('cool.fr.nf'), ('jetable.fr.nf'), ('nospam.ze.tc'),
  ('nomail.xl.cx'), ('mega.zik.dj'), ('speed.1s.fr'), ('courriel.fr.nf'), ('moncourrier.fr.nf'), ('monemail.fr.nf'),
  ('monmail.fr.nf'),
  -- مواقع شائعة أخرى
  ('maildrop.cc'), ('mailnesia.com'), ('mailcatch.com'), ('mintemail.com'), ('mohmal.com'), ('getairmail.com'),
  ('getnada.com'), ('nada.email'), ('inboxkitten.com'), ('inboxbear.com'), ('emailondeck.com'), ('fakeinbox.com'),
  ('fakemail.net'), ('fakemailgenerator.com'), ('armyspy.com'), ('cuvox.de'), ('dayrep.com'), ('einrot.com'),
  ('fleckens.hu'), ('gustr.com'), ('jourrapide.com'), ('rhyta.com'), ('superrito.com'), ('teleworm.us'),
  ('teleworm.com'), ('mailpoof.com'), ('burnermail.io'), ('spamgourmet.com'), ('mailexpire.com'), ('mailforspam.com'),
  ('mailmoat.com'), ('mailnull.com'), ('incognitomail.org'), ('anonbox.net'), ('anonymbox.com'), ('emailfake.com'),
  ('email-fake.com'), ('emlpro.com'), ('emltmp.com'), ('emlhub.com'), ('dropmail.me'), ('10mail.org'), ('yomail.info'),
  ('spymail.one'), ('freeml.net'), ('mailto.plus'), ('fexpost.com'), ('fexbox.org'), ('fextemp.com'),
  ('mailbox.in.ua'), ('rover.info'), ('inpwa.com'), ('intopwa.com'), ('tofeat.com'), ('chitthi.in'), ('any.pink'),
  ('merepost.com'), ('moakt.com'), ('moakt.ws'), ('moakt.cc'), ('disbox.net'), ('disbox.org'), ('harakirimail.com'),
  ('mailsac.com'), ('mail7.io'), ('vomoto.com'), ('byom.de'), ('trbvm.com'), ('kurzepost.de'), ('objectmail.com'),
  ('proxymail.eu'), ('rcpt.at'), ('mailzilla.com'), ('mailzilla.org'), ('nowmymail.com'), ('oneoffemail.com'),
  ('pookmail.com'), ('shortmail.net'), ('sneakemail.com'), ('spamavert.com'), ('spamday.com'), ('spaml.com'),
  ('spaml.de'), ('spammotel.com'), ('spamspot.com'), ('thankyou2010.com'), ('wh4f.org'), ('whyspam.me'),
  ('willselfdestruct.com'), ('xagloo.com'), ('xemaps.com'), ('xents.com'), ('xmaily.com'), ('xoxy.net'),
  ('zoemail.org'), ('zoemail.net'), ('dodgeit.com'), ('dodgit.com'), ('e4ward.com'), ('emailias.com'),
  ('emailwarden.com'), ('gishpuppy.com'), ('jetable.org'), ('jetable.com'), ('jetable.net'), ('kasmail.com'),
  ('klassmaster.com'), ('mailblocks.com'), ('mailquack.com'), ('meltmail.com'), ('messagebeamer.de'), ('nobulk.com'),
  ('noclickemail.com'), ('nospamfor.us'), ('nurfuerspam.de'), ('punkass.com'), ('quickinbox.com'), ('safersignup.de'),
  ('saynotospams.com'), ('shiftmail.com'), ('skeefmail.com'), ('slaskpost.se'), ('smellfear.com'), ('snakemail.com'),
  ('spam.la'), ('spam.su'), ('spamcero.com'), ('spamcon.org'), ('spamthis.co.uk'), ('spamtroll.net'), ('uggsrock.com'),
  ('upliftnow.com'), ('uplipht.com'), ('venompen.com'), ('wilemail.com'), ('yuurok.com'), ('0-mail.com'),
  ('0815.ru'), ('0clickemail.com'), ('0wnd.net'), ('0wnd.org'), ('despam.it'), ('despammed.com'), ('dontreg.com'),
  ('dontsendmespam.de'), ('bugmenot.com'), ('bumpymail.com'), ('brefmail.com'), ('mailhazard.com'), ('mailimate.com'),
  ('mailtothis.com'), ('emailsensei.com'), ('getonemail.com'), ('getonemail.net'), ('hidemail.de'), ('hmamail.com'),
  ('hulapla.de'), ('ieatspam.eu'), ('ieatspam.info'), ('imails.info'), ('inboxalias.com'), ('inboxclean.com'),
  ('inboxclean.org'), ('jnxjn.com'), ('kaspop.com'), ('klzlk.com'), ('koszmail.pl'), ('lookugly.com'),
  ('lortemail.dk'), ('lr78.com'), ('maboard.com'), ('mail-filter.com'), ('mail2rss.org'), ('mail333.com'),
  ('mailbidon.com'), ('mailbiz.biz'), ('maileater.com'), ('mailfreeonline.com'), ('mailme.lv'), ('mailme24.com'),
  ('mailshell.com'), ('mailsiphon.com'), ('mailslite.com'), ('mailtome.de'), ('mbx.cc'), ('mycleaninbox.net'),
  ('myphantomemail.com'), ('neverbox.com'), ('no-spam.ws'), ('nobugmail.com'), ('nomail2me.com'), ('nospam4.us'),
  ('nowhere.org'), ('onewaymail.com'), ('pjjkp.com'), ('prtnx.com'), ('recursor.net'), ('regbypass.com'),
  ('rmqkr.net'), ('rppkn.com'), ('s0ny.net'), ('sharedmailbox.org'), ('shitmail.me'), ('sinnlos-mail.de'),
  ('slopsbox.com'), ('soodonims.com'), ('spamail.de'), ('spambob.com'), ('spambob.net'), ('spambob.org'),
  ('spambog.com'), ('spambog.de'), ('spambog.ru'), ('spambox.info'), ('spambox.us'), ('spamcannon.com'),
  ('spamcannon.net'), ('spamcorptastic.com'), ('spamcowboy.com'), ('spamcowboy.net'), ('spamcowboy.org'),
  ('spamex.com'), ('spamfree.eu'), ('spamfree24.org'), ('spamgoes.in'), ('spamhole.com'), ('spamify.com'),
  ('spaminator.de'), ('spamkill.info'), ('spamobox.com'), ('spamoff.de'), ('spamslicer.com'), ('spamstack.net'),
  ('spamthisplease.com'), ('supergreatmail.com'), ('thanksnospam.info'), ('webemail.me'), ('webm4il.info'),
  ('wuzup.net'), ('wuzupmail.net'), ('yapped.net'), ('yep.it'), ('zetmail.com'), ('luxusmail.org'),
  -- 1secmail
  ('1secmail.com'), ('1secmail.org'), ('1secmail.net'), ('esiix.com'), ('wwjmp.com'), ('xojxe.com'), ('yoggm.com'),
  ('kzccv.com'), ('qiott.com'), ('wuuvo.com'), ('icznn.com'), ('ezztt.com'), ('vjuum.com'), ('laafd.com'), ('txcct.com')
on conflict (domain) do nothing;

-- ===================== 4) أدوات داخلية (ما تتناداش من المتصفّح) =====================
-- الميزة مفعّلة؟ (سطر site_stats الوحيد؛ بلا سطر = مفعّلة)
create or replace function public.free_key_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select s.free_key_enabled from public.site_stats s where s.id = 1), true);
$$;

-- إيميل من موقع إيميل مؤقت؟ (الدومين نفسه أو دومين فرعي منه: x.mailinator.com)
create or replace function public.free_key_disposable(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with e as (
    select rtrim(lower(btrim(coalesce(substring(btrim(coalesce(p_email, '')) from '@([^@]+)$'), ''))), '.') as dom
  )
  select exists (
    select 1
      from e, private.disposable_email_domains d
     where e.dom <> ''
       and (e.dom = d.domain or right(e.dom, length(d.domain) + 1) = '.' || d.domain)
  );
$$;

-- بصمة عنوان IP كما يراه Cloudflare (نفس طريقة الهدايا): sha256 بمفتاح سرّي، بلا IP صريح،
-- وعناوين IPv6 تتجمّع حسب الشبكة /64. بلا عنوان معروف → null (ما يدخلش في تنبيه "نفس IP").
create or replace function public.free_key_ip_hash()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hdr    json;
  v_ip     text;
  v_pepper text;
begin
  begin
    v_hdr := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    v_hdr := null;
  end;
  v_ip := nullif(btrim(v_hdr ->> 'cf-connecting-ip'), '');
  if v_ip is null then
    v_ip := nullif(btrim(regexp_replace(coalesce(v_hdr ->> 'x-forwarded-for', ''), '^.*,', '')), '');
  end if;
  if v_ip is null then
    return null;
  end if;
  begin
    if family(v_ip::inet) = 6 then
      v_ip := host(network(set_masklen(v_ip::inet, 64)));
    end if;
  exception when others then
    null;
  end;
  select s.value into v_pepper from private.app_secrets s where s.key = 'free_key_ip_pepper';
  return encode(sha256(convert_to(coalesce(v_pepper, '') || '|' || v_ip, 'UTF8')), 'hex');
end;
$$;

-- ===================== 5) استعمال المفتاح =====================
-- ذرّي: قفل استشاري لكل حساب → زوج طلبات في نفس الوقت من نفس الحساب يمرّو وحد بوحد،
-- والثاني يلقى الكشف الأول (+ user_id فريد في الجدول كاحتياط).
--  status: ok | yours | auth | used | disabled | has_premium | unavailable | disposable | unconfirmed
--  ok / yours يرجّعو premium_code و premium_url. yours = نفس الشركة اللي كشفها (بلا كشف جديد).
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

  begin
    insert into public.free_reveals (user_id, company_id, source, ip_hash)
    values (v_uid, c.id, v_source, public.free_key_ip_hash());
  exception when unique_violation then
    return json_build_object('status', 'used');
  end;

  return json_build_object('status', 'ok', 'company_id', c.id,
                           'premium_code', c.premium_code, 'premium_url', c.premium_url);
end;
$$;

-- كشف كود Premium (الخدش): Premium (مدفوع / Stork / هدية / أدمن) → كل الشركات،
-- وإلا الشركة اللي كشفها المستخدم بمفتاحو الذهبي برك. has_premium_access ما تبدّلتش.
create or replace function public.get_premium_code(company_id bigint)
returns table (premium_code text, premium_url text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  if not public.has_premium_access(auth.uid())
     and not exists (
       select 1 from public.free_reveals r
        where r.user_id = auth.uid() and r.company_id = get_premium_code.company_id
     ) then
    return;
  end if;

  return query
    select c.premium_code, c.premium_url
    from public.companies c
    where c.id = get_premium_code.company_id;
end;
$$;

-- حالة مفتاح الحساب الحالي: available | used (+ الشركة) | premium (عندو Premium: المفتاح ما يبانش)
-- الكود نفسه ما يرجعش هنا: يتجاب بـ get_premium_code للشركة اللي كشفها.
create or replace function public.get_my_free_key()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  r     public.free_reveals%rowtype;
  co    public.companies%rowtype;
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
  return json_build_object('status', 'available', 'enabled', public.free_key_enabled());
end;
$$;

-- للجميع: الميزة مفعّلة؟ + عدد الكشوفات المجانية (count دقيق، يبان غير من 50 وفوق — قبلها null)
create or replace function public.free_key_public()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'enabled', public.free_key_enabled(),
    'reveals', (select case when x.n >= 50 then x.n end from (select count(*)::bigint as n from public.free_reveals) x)
  );
$$;

-- ===================== 6) دوال الأدمن (كلها تبدأ بـ admin_assert) =====================
-- الأرقام: اليوم / 7 أيام / الكل (توقيت الجزائر، نفس admin_overview)، منحنى 30 يوم،
-- أكثر الشركات اللي تكشفت، شحال واحد اشترك Premium مدفوع من بعد مفتاحو، وتنبيهات "نفس IP".
create or replace function public.admin_free_key_stats()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  tz      constant text := 'Africa/Algiers';
  v_today timestamptz := public.admin_range_start('today');
  v_7d    timestamptz := public.admin_range_start('7d');
  v_from  timestamp := date_trunc('day', now() at time zone tz) - interval '29 days';
begin
  perform public.admin_assert();
  return json_build_object(
    'enabled', public.free_key_enabled(),
    'today', (select count(*) from public.free_reveals where created_at >= v_today),
    'week', (select count(*) from public.free_reveals where created_at >= v_7d),
    'total', (select count(*) from public.free_reveals),
    'series_unit', 'day',
    'series', coalesce((
      select json_agg(json_build_object(
               't', to_char(g.b, 'YYYY-MM-DD"T"HH24:MI'),
               'reveals', (select count(*) from public.free_reveals r
                            where date_trunc('day', r.created_at at time zone tz) = g.b)
             ) order by g.b)
        from generate_series(v_from, date_trunc('day', now() at time zone tz), interval '1 day') as g(b)
    ), '[]'::json),
    'top_companies', coalesce((
      select json_agg(t) from (
        select c.id, c.name, c.logo, c.type, count(*) as n
          from public.free_reveals r join public.companies c on c.id = r.company_id
         group by c.id, c.name, c.logo, c.type
         order by n desc, c.name
         limit 8
      ) t
    ), '[]'::json),
    -- دفع حقيقي بعد تاريخ الكشف: فواتير SlickPay / PayPal المكتملة ومشتريات Google Play بتاريخها.
    -- Stripe ما عندوش سجلّ دفعات عندنا (الـ webhook يكتب في profiles برك) → نحسبو الاشتراك النشط
    -- اللي ينتهي بعد الكشف (الحساب ما كانش عندو Premium وقت الكشف). Stork والهدايا ماشي دفع.
    'converted', (
      select count(*) from public.free_reveals r
       where r.user_id is not null and (
         exists (select 1 from public.slickpay_invoices s
                  where s.user_id = r.user_id and s.status = 'completed' and s.completed_at > r.created_at)
         or exists (select 1 from public.paypal_orders o
                     where o.user_id = r.user_id and o.status = 'completed' and o.completed_at > r.created_at)
         or exists (select 1 from public.google_play_purchases g
                     where g.user_id = r.user_id and g.created_at > r.created_at)
         or exists (select 1 from public.profiles p
                     where p.id = r.user_id and p.payment_provider = 'stripe' and p.is_premium = true
                       and (p.premium_until is null or p.premium_until > r.created_at))
       )
    ),
    -- تنبيه برك (بلا حبس): أكثر من 5 كشوفات من نفس بصمة IP في نفس اليوم، آخر 30 يوم
    'ip_alerts', coalesce((
      select json_agg(t) from (
        select left(r.ip_hash, 12) as ip,
               to_char(date_trunc('day', r.created_at at time zone tz), 'YYYY-MM-DD') as day,
               count(*) as n,
               (array_agg(coalesce(u.email, p.email)::text order by r.created_at desc))[1:10] as emails
          from public.free_reveals r
          left join auth.users u on u.id = r.user_id
          left join public.profiles p on p.id = r.user_id
         where r.ip_hash is not null and r.created_at >= now() - interval '30 days'
         group by r.ip_hash, 2
        having count(*) > 5
         order by 2 desc, 3 desc
         limit 50
      ) t
    ), '[]'::json)
  );
end;
$$;

-- آخر الكشوفات: المستخدم، الشركة، المصدر، التاريخ (+ العدد الكامل، count دقيق)
create or replace function public.admin_free_key_reveals(p_limit integer default 50, p_offset integer default 0)
returns table (
  id bigint,
  user_id uuid,
  full_name text,
  email text,
  company_id bigint,
  company_name text,
  company_logo text,
  company_type text,
  source text,
  ip text,
  created_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  perform public.admin_assert();
  p_limit  := least(greatest(coalesce(p_limit, 50), 1), 500);
  p_offset := greatest(coalesce(p_offset, 0), 0);
  return query
    select r.id, r.user_id, p.full_name::text, coalesce(u.email, p.email)::text,
           r.company_id, c.name::text, c.logo::text, c.type::text, r.source::text,
           left(r.ip_hash, 12), r.created_at, count(*) over ()
      from public.free_reveals r
      left join public.profiles p on p.id = r.user_id
      left join auth.users u on u.id = r.user_id
      left join public.companies c on c.id = r.company_id
     order by r.created_at desc, r.id desc
     limit p_limit offset p_offset;
end;
$$;

-- السويتش العام (site_stats.free_key_enabled)
create or replace function public.admin_set_free_key_enabled(p_enabled boolean)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  perform public.admin_assert();
  update public.site_stats set free_key_enabled = coalesce(p_enabled, false) where id = 1;
  return public.free_key_enabled();
end;
$$;

-- "متاح للمفتاح الذهبي" لشركة (قائمة الشركات + فورم الشركة)
create or replace function public.admin_set_company_free_reveal(p_company_id bigint, p_enabled boolean)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  perform public.admin_assert();
  update public.companies set free_reveal_enabled = coalesce(p_enabled, false) where id = p_company_id;
  return found;
end;
$$;

-- ===================== 7) صلاحيات التنفيذ =====================
-- Supabase يعطي EXECUTE افتراضياً لـ anon و authenticated: نسحبوه صراحةً.
revoke all on function public.free_key_enabled() from public, anon, authenticated;
revoke all on function public.free_key_disposable(text) from public, anon, authenticated;
revoke all on function public.free_key_ip_hash() from public, anon, authenticated;

revoke all on function public.claim_free_reveal(bigint, text) from public, anon;
grant execute on function public.claim_free_reveal(bigint, text) to authenticated;
revoke all on function public.get_my_free_key() from public, anon;
grant execute on function public.get_my_free_key() to authenticated;
revoke all on function public.free_key_public() from public;
grant execute on function public.free_key_public() to anon, authenticated;
grant execute on function public.get_premium_code(bigint) to authenticated;

revoke all on function public.admin_free_key_stats() from public, anon;
revoke all on function public.admin_free_key_reveals(integer, integer) from public, anon;
revoke all on function public.admin_set_free_key_enabled(boolean) from public, anon;
revoke all on function public.admin_set_company_free_reveal(bigint, boolean) from public, anon;
grant execute on function public.admin_free_key_stats() to authenticated;
grant execute on function public.admin_free_key_reveals(integer, integer) to authenticated;
grant execute on function public.admin_set_free_key_enabled(boolean) to authenticated;
grant execute on function public.admin_set_company_free_reveal(bigint, boolean) to authenticated;

notify pgrst, 'reload schema';
