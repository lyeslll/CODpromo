-- ============================================================
--  CODpromo — الرجوع من phase35 (ما يتشغّلش إلا بطلب المالك).
--  ينحّي فحص شكل الـ slug، ويرجّع قائمة منع المفتاح الذهبي كيما كانت (428 دومين).
-- ============================================================
drop trigger if exists company_slug_guard on public.companies;
drop function if exists public.company_slug_guard();

delete from private.disposable_email_domains
 where domain in (
  'duck.com', 'mozmail.com', 'relay.firefox.com', 'privaterelay.appleid.com',
  'simplelogin.com', 'simplelogin.fr', 'simplelogin.co', 'slmail.me', 'aleeas.com', '8alias.com', '8shield.net', 'silomails.com',
  'addy.io', 'anonaddy.me', 'anonaddy.com',
  'passmail.net', 'passmail.com', 'passinbox.com', 'passfwd.com',
  '33mail.com', 'erine.email',
  'mail.tm', 'mail.gw', 'tmailor.com', 'dpptd.com', 'generator.email', 'crazymailing.com'
 );
