-- ============================================================
--  CODpromo — الرجوع من phase34b: يرجّع rate_company و company_rating_summary كيما كانو في phase34
--  (منسوخين حرفياً من supabase-phase34-store-ratings.sql). بلا DROP. الصلاحيات تتعاود كيما كانت.
-- ============================================================

create or replace function public.company_rating_summary(p_company_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with r as (
    select stars, tags from public.company_ratings
     where company_id = p_company_id and hidden_at is null
  ),
  t as (
    select tag, count(*) as n from r, unnest(r.tags) as tag group by tag
  )
  -- تحت 3 تقييمات: العدد برك (بلا معدّل ولا توزيع ولا علامات — ما يتعرفش تقييم شخص واحد)
  , c as (select count(*) as n from r)
  select jsonb_build_object(
    'company_id', p_company_id,
    'count', c.n,
    'avg', case when c.n >= 3 then (select round(avg(stars)::numeric, 1) from r) end,
    'dist', case when c.n >= 3 then (select jsonb_object_agg(s, n) from (select stars as s, count(*) as n from r group by stars) d) end,
    'tags', case when c.n >= 3 then coalesce((select jsonb_agg(jsonb_build_object('tag', tag, 'n', n) order by n desc, tag) from t), '[]'::jsonb) else '[]'::jsonb end,
    'kind', public.company_kind(p_company_id)
  )
  from c;
$$;

create or replace function public.rate_company(p_company_id bigint, p_stars integer, p_tags text[] default '{}')
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_user auth.users%rowtype;
  v_google boolean;
  v_kind text;
  v_allowed text[];
  v_tags text[];
  v_hour int;
  v_day int;
  v_inbox text;
begin
  -- GET (معاملة قراءة برك في PostgREST) مرفوض: الكتابة POST برك.
  if current_setting('transaction_read_only', true) = 'on' then
    raise exception 'read_only' using errcode = '25006';
  end if;
  if v_uid is null then
    return jsonb_build_object('status', 'auth');
  end if;
  -- مصفوفة ضخمة = مرفوضة قبل أي حساب
  if cardinality(p_tags) > 10 then
    return jsonb_build_object('status', 'invalid');
  end if;

  select * into v_user from auth.users where id = v_uid;
  if not found then
    return jsonb_build_object('status', 'auth');
  end if;
  v_google := coalesce(v_user.raw_app_meta_data -> 'providers', '[]'::jsonb) ? 'google'
              or v_user.raw_app_meta_data ->> 'provider' = 'google';
  if v_user.email_confirmed_at is null and not v_google then
    return jsonb_build_object('status', 'unconfirmed');
  end if;
  if public.free_key_disposable(v_user.email) then
    return jsonb_build_object('status', 'disposable');
  end if;

  if not exists (select 1 from public.companies c where c.id = p_company_id and coalesce(c.status, 'active') = 'active') then
    return jsonb_build_object('status', 'unavailable');
  end if;
  -- صاحب الشركة (بوابة الشركات) ما يقيّمش شركتو، وحساب الشركة ما يقيّمش المنافسين (التقييم للزبائن برك)
  if exists (select 1 from public.company_owners o where o.company_id = p_company_id and o.user_id = v_uid) then
    return jsonb_build_object('status', 'owner');
  end if;
  -- account_type يتبدّل من العميل → نشوفو حتى الملكية وطلبات الشركات (الأدمن والـ trigger برك يكتبوهم)
  if exists (select 1 from public.profiles p where p.id = v_uid and p.account_type = 'company')
     or exists (select 1 from public.company_owners o where o.user_id = v_uid)
     or exists (select 1 from public.company_requests q where q.user_id = v_uid) then
    return jsonb_build_object('status', 'company_account');
  end if;

  if p_stars is null or p_stars < 1 or p_stars > 5 then
    return jsonb_build_object('status', 'invalid');
  end if;
  v_kind := public.company_kind(p_company_id);
  v_allowed := public.rating_tags_for(v_kind);
  select coalesce(array_agg(distinct t order by t), '{}') into v_tags
    from unnest(coalesce(p_tags, '{}'::text[])) as t
   where t is not null;
  if cardinality(v_tags) > 4 or not (v_tags <@ v_allowed) then
    return jsonb_build_object('status', 'invalid');
  end if;

  -- حدّ الكتابة: قفل لكل حساب (طلبات متزامنة تمرّ وحدة بوحدة)، 20 في الساعة، و 6 تبديلات في اليوم لنفس الشركة.
  perform pg_advisory_xact_lock(hashtextextended('company_rating:' || v_uid::text, 0));
  -- بريد واحد (Gmail بالنقاط و +، نفس قاعدة المفتاح الذهبي) = تقييم واحد لكل شركة، حتى بحسابات مختلفة
  v_inbox := public.free_key_email_hash(v_user.email);
  if v_inbox is not null then
    perform pg_advisory_xact_lock(hashtextextended('company_rating_inbox:' || v_inbox || ':' || p_company_id::text, 0));
    if exists (select 1 from public.company_ratings r
                where r.company_id = p_company_id and r.email_hash = v_inbox and r.user_id <> v_uid) then
      return jsonb_build_object('status', 'inbox_used');
    end if;
  end if;
  select count(*) into v_hour from public.company_rating_log where user_id = v_uid and created_at > now() - interval '1 hour';
  select count(*) into v_day from public.company_rating_log
   where user_id = v_uid and company_id = p_company_id and created_at > now() - interval '1 day';
  if v_hour >= 20 or v_day >= 6 then
    return jsonb_build_object('status', 'rate_limited');
  end if;

  insert into public.company_ratings (company_id, user_id, email_hash, stars, tags)
  values (p_company_id, v_uid, v_inbox, p_stars, v_tags)
  on conflict (company_id, user_id) do update
    set stars = excluded.stars,
        tags = excluded.tags,
        email_hash = excluded.email_hash,
        edits = public.company_ratings.edits + 1,
        updated_at = now();
  insert into public.company_rating_log (user_id, company_id) values (v_uid, p_company_id);

  return jsonb_build_object(
    'status', 'ok',
    'mine', public.my_company_rating(p_company_id),
    'summary', public.company_rating_summary(p_company_id)
  );
end;
$$;

revoke all on function public.rate_company(bigint, integer, text[]) from public, anon, authenticated;
revoke all on function public.company_rating_summary(bigint) from public, anon, authenticated;
grant execute on function public.rate_company(bigint, integer, text[]) to authenticated;
grant execute on function public.company_rating_summary(bigint) to anon, authenticated;

notify pgrst, 'reload schema';
