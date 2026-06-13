-- ============================================================
--  CODpromo — Phase 17a: دوال Premium الخادمية (RPC) — إضافية فقط
--  شغّله مرة واحدة في Supabase → SQL Editor → الصق ثم Run.
--  آمن لإعادة التشغيل (idempotent). لا يقفل شيئاً ولا يغيّر أي سياسة.
--
--  ⚠️ شغّل هذا الملف أولاً (قبل/مع نشر الواجهة الجديدة)، ثم بعد التأكد
--     من عمل الموقع شغّل supabase-phase17b-premium-lock.sql.
--
--  يضيف:
--   1) get_premium_code(company_id): يكشف كود/رابط Premium لشركة فقط لمن
--      هو مشترك Premium فعّال (أو أدمن — لتحرير الأكواد من اللوحة).
--   2) redeem_stork_code(code): يفعّل كود Stork ذرّياً ويمنح 30 يوم Premium.
--  كلتاهما SECURITY DEFINER (تتجاوزان RLS بأمان داخل منطق محكوم).
-- ============================================================

-- ===================== 1) كشف كود Premium (خادمياً) =====================
-- يتحقق من جلسة المستخدم (auth.uid()) أنه مشترك Premium ساري المفعول،
-- وإلا لا يُرجع شيئاً (NULL/صفر صفوف). الأدمن مسموح له أيضاً (لتعبئة نموذج
-- التحرير في اللوحة بعد قفل الأعمدة). لا يثق إطلاقاً بأي علم من المتصفّح.
create or replace function public.get_premium_code(company_id bigint)
returns table (premium_code text, premium_url text)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- غير مسجّل الدخول → لا شيء
  if auth.uid() is null then
    return;
  end if;

  -- يجب أن يكون مشترك Premium فعّال، أو أدمن
  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        (p.is_premium = true and (p.premium_until is null or p.premium_until > now()))
        or p.is_admin = true
      )
  ) then
    return;
  end if;

  return query
    select c.premium_code, c.premium_url
    from public.companies c
    where c.id = get_premium_code.company_id;
end;
$$;

grant execute on function public.get_premium_code(bigint) to authenticated;

-- ===================== 2) تفعيل كود Stork (ذرّي) =====================
-- يتحقق أن الكود موجود وغير مستخدم، يعلّمه مستخدماً (used_by = صاحب الجلسة)،
-- ويمنح 30 يوم Premium. كل ذلك داخل معاملة واحدة مع قفل صف الكود (for update)
-- لمنع الاستخدام المزدوج عند التزامن. يعيد نصّ حالة لتترجمه الواجهة.
--   'ok'      نجاح
--   'enter'   كود فارغ
--   'invalid' كود غير موجود
--   'used'    كود مستخدم مسبقاً
--   'auth'    غير مسجّل الدخول
create or replace function public.redeem_stork_code(code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_id   bigint;
  v_norm text;
begin
  if v_uid is null then
    return 'auth';
  end if;

  v_norm := upper(btrim(coalesce(code, '')));
  if v_norm = '' then
    return 'enter';
  end if;

  -- اقفل صف الكود غير المستخدم ذرّياً (يمنع سباق الاستخدام المزدوج)
  select s.id into v_id
  from public.stork_codes s
  where s.code = v_norm and s.is_used = false
  for update;

  if v_id is null then
    -- ميّز بين "مستخدم مسبقاً" و"غير موجود" لرسالة أوضح
    if exists (select 1 from public.stork_codes s where s.code = v_norm) then
      return 'used';
    end if;
    return 'invalid';
  end if;

  update public.stork_codes
    set is_used = true, used_by = v_uid, used_at = now()
    where id = v_id;

  -- منح 30 يوماً. نستعمل greatest حتى لا نقصّ مدّة مشترك دافع موجودة (أمان للموقع الحيّ).
  update public.profiles
    set is_premium = true,
        premium_until = greatest(coalesce(premium_until, now()), now()) + interval '30 days'
    where id = v_uid;

  return 'ok';
end;
$$;

grant execute on function public.redeem_stork_code(text) to authenticated;
