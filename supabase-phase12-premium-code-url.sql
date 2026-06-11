-- ============================================================
--  CODpromo — Phase 12: كود ورابط خاصّان بعرض Premium
--  شغّله مرة واحدة في Supabase SQL Editor (آمن لإعادة التشغيل).
--
--  لجعل عرض Premium متناظراً مع العادي: كود ورابط مستقلّان.
--  منطق الـfallback في الواجهة: إن كان أيٌّ منهما فارغاً يُستعمل نظير العادي
--  (premium_code → code، premium_url → link). هذه الحقول universal (لا تُترجَم).
-- ============================================================

alter table public.companies
  add column if not exists premium_code text,
  add column if not exists premium_url  text;

-- أعد تحميل مخزّن مخطّط PostgREST كي تظهر الأعمدة الجديدة فوراً لواجهة REST
-- (وإلا تفشل الكتابة بخطأ PGRST204).
notify pgrst, 'reload schema';
