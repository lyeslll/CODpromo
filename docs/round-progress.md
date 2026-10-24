# جولة الهاتف وصفحات الشركات — التقدّم

> ملف حيّ: وين راني وواش بقى. الفرع `mobile-ux-round` (من `main` في `434cdb7`).

## الحالة
- [x] قراءة CLAUDE.md، فرع جديد
- [ ] الفحص الأول (صور قبل + Lighthouse) → `.audit/before` (برا git)
- [ ] `docs/mobile-ux-audit.md` (P0/P1/P2)
- [ ] التيليفون: القائمة السفلية، الهيدر والقوائم، نافذة النشرة، السرعة، النصوص، Wordmark
- [ ] صفحة الشركة + التقييم (phase34) + SEO
- [ ] الأدمين: مسح الفورم، قصّ اللوغو، خانات جديدة
- [ ] الكمبيوتر: تصليحات صغار
- [ ] الفحص الأخير + Lighthouse بعد + الأمان
- [ ] push + preview + CLAUDE.md + التقرير

## أدوات الفحص (برا الريبو)
- `D:\CODPROMO\codpromo-project\audit-tools\` : Playwright 1.56 (chromium/webkit/firefox) + Lighthouse 12.
- `.keys.json` هناك (مفاتيح المشروع، ماشي في git، ما تتطبعش).
- دخول حسابات التجربة: `generateLink` (magiclink) + `/auth/v1/verify` → جلسة في localStorage. بلا إيميل.
- كل كتابة في القاعدة موقوفة بـ `page.route` (allowlist للقراءات برك).

## ملاحظات مهمّة
- حساب "Stork Team" = `storkteamdz@gmail.com`: ماشي أدمين وما عندو حتى Premium (لا شراء، لا هدية، لا Stork) → الكود المقفول + المفتاح الذهبي = سلوك صحيح.
- حسابات التجربة: test1 عادي (refunded)، test2 و test4 Premium مدى الحياة، test3 ما كاينش. الأدمين = حساب المالك (ما ندخلوش بيه) → حالة الأدمين بـ mock محلي.
