-- ============================================================
--  CODpromo — phase35: شكل رابط الشركة + قائمة منع المفتاح الذهبي (قرار المالك، 24 أكتوبر 2026)
--
--  1) slug الشركة: حروف لاتينية صغيرة وأرقام وشرطات (مثلاً just-sell)، 80 حرف كحدّ أقصى.
--     يتفحص غير للشركات الجديدة وكي يتبدّل الرابط — الروابط الكاينة (27، كلها صحيحة) ما تتبدّلش وما تتفحصش،
--     وتعديل حقل آخر في شركة قديمة يمرّ عادي. trigger (ماشي CHECK) باش ما يعاودش يفحص السطور القديمة.
--     slug فارغ (null) مقبول كيما قبل (الواجهة تستعمل store-<id>).
--  2) عناوين التحويل والإيميلات المؤقتة (duck.com، Firefox Relay، SimpleLogin، addy.io، Proton pass…)
--     تتزاد لـ private.disposable_email_domains = المفتاح الذهبي (و التقييم) برك؛ التسجيل يبقى عادي.
--     يمسّ الكشوفات الجديدة برك: اللي عندو مفتاح مستعمل يبقى عندو (free_reveals ما يتمسّش).
--  3) Gmail بالـ "+" والنقاط = نفس البريد: موجود من phase31c (free_key_email_norm) — بلا تبديل هنا، مجرّب في الاختبارات.
--  idempotent، بلا DROP / DELETE / TRUNCATE. الرجوع: supabase-phase35-rollback.sql.
-- ============================================================

-- ===================== 1) شكل الـ slug =====================
create or replace function public.company_slug_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.slug is distinct from old.slug then
    if new.slug is not null and (new.slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(new.slug) > 80) then
      raise exception 'slug_format: % (حروف لاتينية صغيرة وأرقام وشرطات برك، مثلاً just-sell)', new.slug
        using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.company_slug_guard() from public, anon, authenticated;

create or replace trigger company_slug_guard
  before insert or update of slug on public.companies
  for each row execute function public.company_slug_guard();

-- ===================== 2) قائمة منع المفتاح الذهبي =====================
insert into private.disposable_email_domains (domain)
select d from (values
  -- عناوين التحويل (بريد واحد = عناوين بلا حدّ)
  ('duck.com'), ('mozmail.com'), ('relay.firefox.com'), ('privaterelay.appleid.com'),
  ('simplelogin.com'), ('simplelogin.fr'), ('simplelogin.co'), ('slmail.me'), ('aleeas.com'), ('8alias.com'), ('8shield.net'), ('silomails.com'),
  ('addy.io'), ('anonaddy.me'), ('anonaddy.com'),
  ('passmail.net'), ('passmail.com'), ('passinbox.com'), ('passfwd.com'),
  ('33mail.com'), ('erine.email'),
  -- إيميلات مؤقتة ناقصة في القائمة
  ('mail.tm'), ('mail.gw'), ('tmailor.com'), ('dpptd.com'), ('generator.email'), ('crazymailing.com')
) as v(d)
where not exists (select 1 from private.disposable_email_domains x where x.domain = v.d);
