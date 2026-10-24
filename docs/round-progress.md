# جولة الهاتف وصفحات الشركات — التقدّم

> ملف حيّ: وين راني وواش بقى. الفرع `mobile-ux-round` (من `main` في `434cdb7`). ما يتدمجش في main بلا "ادمج" من المالك.

## الحالة
- [x] قراءة CLAUDE.md، فرع جديد
- [x] الفحص الأول: 1,070 صورة (Chromium + WebKit؛ Firefox ما يخدمش في هاد الجهاز) + القوائم والنوافذ + Lighthouse prod/local
- [x] مراجعة الصور بـ 5 agents + agent النصوص → `.audit/findings/{home,offers,premium,account,ui,text}.md`
- [x] `docs/mobile-ux-audit.md` (P0/P1/P2 مع الحالة + أرقام الفحص الأخير)
- [x] صفحة الشركة + التقييم (phase34 + phase34b مطبّقين، 73 اختبار) + SEO (prerender + JSON-LD + sitemap + OG)
- [x] القائمة السفلية الجديدة، نافذة النشرة، 404، الأدمين (مسودة، قصّ اللوغو، خانات الصفحة، صفحة التقييمات)
- [x] تصليحات الفحص (P0 كاملين، P1 كاملين ما عدا إرسال النشرة — الجولة الجاية)
- [x] الفحص الأخير (`.audit/after`) + Lighthouse بعد + مقارنة HTML (`.audit/compare.html`)
- [x] /security-review (بلا ثغرة) + agent يهاجم (4 نقاط صغيرة → phase34b + prerender)
- [ ] push + preview + التقرير

## تمّ (commits صغار، `git log --oneline main..mobile-ux-round`)
- لوغوهات WebP بالحجم الصحيح + مربع موحّد (logo_bg / قراءة الحواف).
- BidiText (<bdi>) للأوصاف والمبالغ، السعر "(39$)"، "1,176$"، التصويت بلا "0".
- الأدمين: الفورم ما يتمسحش كي ترجع للتبويب (auth.jsx) + مسودة تلقائية (كود Premium في sessionStorage برك) + قصّ اللوغو + خانات + /admin/ratings.
- السرعة: اللغات lazy، أعلام 3 برك (CSS 552→142KB)، الخطوط من الموقع، أقسام الرئيسية تحت الشاشة chunk وحدو (JS الأول 1,012→956KB)،
  CLS ≈ 0 في الرئيسية / الداشبورد / /offers / /premium / صفحة الشركة (حتى للعضو وفي هاتف بطيء).
- البطاقات: العضو ما يشوفش "مقفول"، زر "اكشف الكود"، العضو يفتح على Premium (/offers، الفئة، المفضّلة).
- Premium: السعر في أول شاشة، شريط الشراء ما يركبش على شريط التنقّل، تبديل اللغة يخدم، الـ Hero يستنى حالة الحساب.
- الحساب: Google ما يصنعش حساب شركة غالط، أخطاء مترجمة، حقول كلمة المرور RTL، iPhone بلا zoom، عناوين الصفحات + noindex.
- القائمة: بلا نص تحت اللوغو + بحث، تلميح السحب يروح وحدو، Wordmark "Code promo" كاملة، 404، زر الرجوع في Android.
- الأمان: phase34b (بلا بريد/مجهول/موقوف ما يقيّمش، عناوين التحويل، التوزيع من 5)، slug مـ escaped، og:image بـ host معروف، replace بدالة في prerender.

## باقي (للمالك ولا الجولة الجاية)
1. إرسال النشرة + رابط "حذف بريدي" (النص دروك "قائمة انتظار" صادق).
2. قرارات: CHECK على شكل `companies.slug`، عناوين التحويل في قائمة المفتاح الذهبي، `app.iosSoon`، Bybit/Trackili.
3. تجربة على iPhone حقيقي و Firefox (ما خدموش هنا).
4. مراجعة `docs/company-descriptions-draft.md` ولصق النبذات من الأدمين.
5. تبديل الخط (font swap) يعطي ≈0.07 في Lighthouse (كيما قبل) — حلّ كامل يحتاج قياسات خط احتياطي (اقتراح).

## أدوات الفحص (برا الريبو)
- `D:\CODPROMO\codpromo-project\audit-tools\` : Playwright 1.56 (chromium/webkit) + Lighthouse 12 (Chrome النظام).
  `capture.mjs` (صفحات كاملة)، `interact.mjs` (قوائم ونوافذ)، `lh.mjs` / `inp.mjs` (السرعة)، `cls.mjs` / `cls-slow.mjs` (Slow 4G + CPU ×4)،
  `profile2.mjs` (CPU profile بـ source maps)، `quick.mjs`، `gateways.mjs` / `sheet-check.mjs` (طرق الدفع تطبيق/متصفّح)،
  `compare.mjs` (صفحة قبل/بعد)، `i18n-add.mjs`، `serve.mjs` (build محلي مع brotli). `MSYS_NO_PATHCONV=1` قبل `--paths /`.
- `.keys.json` هناك (مفاتيح المشروع، ماشي في git، ما تتطبعش).
- دخول حسابات التجربة: `generateLink` (magiclink) + `/auth/v1/verify` → جلسة في localStorage. بلا إيميل.
- كل كتابة في القاعدة موقوفة بـ `page.route` (allowlist للقراءات برك).
- ⚠️ heredoc في Bash ياكل `\\`: السكريبتات اللي فيها regex تتكتب بـ Write ماشي heredoc.
- ⚠️ `String.replace(a, b)` بنص فيه `$&` / `` $` `` / `$'` يخرّب النتيجة → `replace(a, () => b)` ديما (سكريبتات + prerender).

## ملاحظات مهمّة
- حساب "Stork Team" = `storkteamdz@gmail.com`: ماشي أدمين وما عندو حتى Premium (لا شراء، لا هدية، لا Stork) → الكود المقفول + المفتاح الذهبي = سلوك صحيح.
- حسابات التجربة: test1 عادي (refunded)، test2 و test4 Premium مدى الحياة، test3 ما كاينش. الأدمين = حساب المالك (ما ندخلوش بيه) → حالة الأدمين بـ mock محلي.
- Lighthouse قبل/بعد: `.audit/lh-local-before.json` / `.audit/lh-local-after.json` (+ `lh-store-*5.json` بـ 5 مرات)، prod: `.audit/lh-prod-before.json`.
