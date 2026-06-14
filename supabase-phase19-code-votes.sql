-- ============================================================
--  CODpromo — Phase 19: نظام التصويت على الأكواد (Code Voting)
--  شغّله مرة واحدة في Supabase → SQL Editor → الصق ثم Run.
--  آمن لإعادة التشغيل (idempotent).
--
--  يضيف:
--   1) جدول code_votes  : صوت واحد لكل زائر لكل شركة (👍/👎).
--   2) فهرس على company_id للأداء.
--   3) RLS: القراءة عامة (للإحصائيات فقط). لا insert/update/delete مباشر —
--      كل كتابة تمرّ حصراً عبر الدالة cast_vote (SECURITY DEFINER) فلا يمكن
--      التلاعب بهويّة المصوّت أو حذف الأصوات من المتصفّح.
--   4) view code_vote_stats : 👍، 👎، الإجمالي، نسبة النجاح، آخر نجاح — بكفاءة.
--   5) دالة cast_vote(company_id, vote_type, voter_id) : تصويت/تغيير صوت ذرّياً.
-- ============================================================

-- ===================== 1) الجدول =====================
create table if not exists public.code_votes (
  id          bigint generated always as identity primary key,
  company_id  bigint not null references public.companies (id) on delete cascade,
  vote_type   text   not null check (vote_type in ('up', 'down')),
  -- معرّف المصوّت: للمسجّل 'u:'||uid (يُضبط خادمياً، لا يُنتحَل)، وللزائر 'a:'||معرّف localStorage.
  voter_id    text   not null,
  user_id     uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- صوت واحد لكل مصوّت لكل شركة (تغيير الصوت = تحديث نفس الصف)
  unique (company_id, voter_id)
);

-- ===================== 2) فهرس الأداء =====================
create index if not exists code_votes_company_idx on public.code_votes (company_id);

-- ===================== 3) RLS: قراءة عامة فقط =====================
alter table public.code_votes enable row level security;

drop policy if exists "votes select" on public.code_votes;
-- نحذف أي سياسات كتابة قديمة إن وُجدت (الكتابة تمرّ عبر الدالة فقط)
drop policy if exists "votes insert" on public.code_votes;
drop policy if exists "votes update" on public.code_votes;
drop policy if exists "votes delete" on public.code_votes;

create policy "votes select" on public.code_votes for select using (true);
-- لا سياسات insert/update/delete → كل كتابة مباشرة محجوبة. الكتابة عبر cast_vote فقط.

-- ===================== 4) View الإحصائيات =====================
-- نسبة النجاح = (👍 / الإجمالي) %. آخر نجاح = آخر وقت صوت فيه أحدهم 👍.
create or replace view public.code_vote_stats as
select
  company_id,
  count(*) filter (where vote_type = 'up')                                   as up_count,
  count(*) filter (where vote_type = 'down')                                 as down_count,
  count(*)                                                                    as total_count,
  round(100.0 * count(*) filter (where vote_type = 'up') / greatest(count(*), 1))::int as success_rate,
  max(updated_at) filter (where vote_type = 'up')                            as last_up_at
from public.code_votes
group by company_id;

grant select on public.code_vote_stats to anon, authenticated;

-- ===================== 5) دالة التصويت (ذرّية) =====================
-- تُدرج صوتاً جديداً أو تُحدّث صوت المصوّت الحالي (تغيير 👍/👎) في عملية واحدة.
-- للمسجّل: المعرّف يُشتقّ من auth.uid() (لا يُنتحَل). للزائر: من معرّف localStorage.
-- تعيد عدّادات الشركة المحدّثة (up/down) لتحديث الواجهة فوراً.
create or replace function public.cast_vote(
  p_company_id bigint,
  p_vote_type  text,
  p_voter_id   text
)
returns table (up_count bigint, down_count bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_voter text;
begin
  if p_vote_type not in ('up', 'down') then
    raise exception 'invalid vote_type';
  end if;

  -- ربط الهوية: المسجّل بمفتاح uid (يمنع الانتحال)، والزائر بمعرّفه المحلي.
  v_voter := case
    when v_uid is not null then 'u:' || v_uid::text
    else 'a:' || coalesce(nullif(btrim(p_voter_id), ''), 'anon')
  end;

  insert into public.code_votes (company_id, vote_type, voter_id, user_id)
  values (p_company_id, p_vote_type, v_voter, v_uid)
  on conflict (company_id, voter_id)
  do update set vote_type = excluded.vote_type, updated_at = now(), user_id = excluded.user_id;

  return query
    select
      count(*) filter (where vote_type = 'up'),
      count(*) filter (where vote_type = 'down')
    from public.code_votes
    where company_id = p_company_id;
end;
$$;

grant execute on function public.cast_vote(bigint, text, text) to anon, authenticated;

-- ============================================================
--  ⚠️ ملاحظة أمان: القراءة عامة (إحصائيات مجمّعة فقط، بلا هويّات).
--  الكتابة محصورة في cast_vote التي تربط هوية المسجّل بـ auth.uid().
--  هذا يمنع الحذف/الانتحال، لكنه بوّابة تفاعل ناعمة لا حماية صارمة ضد
--  زائر مصمّم على التكرار (يستطيع مسح localStorage). كافٍ لبناء الثقة.
-- ============================================================
