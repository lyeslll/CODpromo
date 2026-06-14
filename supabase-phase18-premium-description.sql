-- ============================================================
--  CODpromo — Phase 18: وصف Premium منفصل (محتوى علني، ليس سرياً)
--  شغّله مرة واحدة في Supabase → SQL Editor → الصق ثم Run.
--  آمن لإعادة التشغيل (idempotent).
--
--  وصف يتبدّل في وضع Premium — يُعامَل تماماً مثل premium_discount والوصف العادي:
--  نصّ علني (لا يحتاج قفل column-level). العربية هي المصدر/الـ fallback،
--  وen/fr تُولَّدان تلقائياً عبر Edge Function "translate-company" وقت الحفظ.
--  نفس بنية الوصف العادي (description / description_en / description_fr).
-- ============================================================

alter table public.companies
  add column if not exists premium_description    text,
  add column if not exists premium_description_en text,
  add column if not exists premium_description_fr text;

-- مهم: أعد تحميل مخزّن مخطّط PostgREST كي تظهر الأعمدة الجديدة فوراً لواجهة REST،
-- وإلا فإن الكتابة من المتصفّح تفشل بخطأ PGRST204
-- ("Could not find the 'premium_description' column ... in the schema cache").
notify pgrst, 'reload schema';

-- ملاحظة: لا حاجة لتعديل سياسات RLS — الأعمدة الجديدة تتبع سياسات الجدول نفسها
-- (قراءة عامة + كتابة من اللوحة للأدمن). وهي علنية كـ premium_discount، فلا تُقفَل
-- column-level مثل premium_code / premium_url.
