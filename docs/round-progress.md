# جولة الهاتف وصفحات الشركات — التقدّم

> ملف حيّ: وين راني وواش بقى. الفرع `mobile-ux-round` (من `main` في `434cdb7`). ما يتدمجش في main بلا "ادمج" من المالك.

## الحالة
- [x] قراءة CLAUDE.md، فرع جديد
- [x] الفحص الأول: 1,070 صورة (Chromium + WebKit؛ Firefox ما يخدمش في هاد الجهاز) + القوائم والنوافذ + Lighthouse prod/local
- [x] مراجعة الصور بـ 5 agents + agent النصوص → `.audit/findings/{home,offers,premium,account,ui,text}.md`
- [ ] `docs/mobile-ux-audit.md` (P0/P1/P2 مع الحالة)
- [x] صفحة الشركة + التقييم (phase34 مطبّقة بعد مراجعة أمان: 50 اختبار) + SEO (prerender + JSON-LD + sitemap)
- [x] القائمة السفلية الجديدة، نافذة النشرة، 404، الأدمين (مسودة، قصّ اللوغو، خانات الصفحة، صفحة التقييمات)
- [~] تصليحات الفحص (شوف "باقي")
- [ ] الفحص الأخير (`.audit/after`) + Lighthouse بعد + مقارنة HTML
- [ ] /security-review + agent يهاجم
- [ ] push + preview + CLAUDE.md + التقرير

## تمّ (commits صغار، `git log --oneline main..mobile-ux-round`)
- لوغوهات WebP بالحجم الصحيح + مربع موحّد (logo_bg / قراءة الحواف).
- BidiText (<bdi>) للأوصاف والمبالغ، السعر "(39$)"، التصويت بلا "0".
- الأدمين: الفورم ما يتمسحش كي ترجع للتبويب (auth.jsx) + مسودة تلقائية + قصّ اللوغو + خانات + /admin/ratings.
- السرعة: اللغات lazy، أعلام 3 برك (CSS 552→133KB)، الخطوط من الموقع، precache أخف، CLS الهيرو/الرئيسية/الداشبورد ≈ 0.
- البطاقات: العضو ما يشوفش "مقفول"، زر "اكشف الكود"، العضو يفتح على Premium (/offers، الفئة، المفضّلة).
- Premium: السعر في أول شاشة، شريط الشراء ما يركبش على شريط التنقّل، تبديل اللغة يخدم.
- الحساب: Google ما يصنعش حساب شركة غالط، أخطاء مترجمة، حقول كلمة المرور RTL، iPhone بلا zoom.
- القائمة: بلا نص تحت اللوغو + بحث، تلميح السحب يروح وحدو، Wordmark "Code promo" كاملة، 404.

## باقي (بالترتيب)
1. تطبيق patch النصوص (agent → `audit-tools/patch-text.json` + notes) بـ `node audit-tools/i18n-add.mjs patch-text.json --replace`.
2. /offers في الهاتف: أقل كلام قبل أول بطاقة؛ chips 44px؛ الفئات الفارغة؛ CLS الفئات/العروض.
3. الخصوصية: نسخة التطبيق (Google Play برك) + النصوص الصحيحة (Resend، بلا hCaptcha).
4. داشبورد الشركة: إعدادات (خروج، حذف الحساب، اللغة).
5. الهيدر في الكمبيوتر: قائمة الحساب (بلاصة زر خروج وحدو) — اقتراح.
6. زر الرجوع في Android يسكّر القوائم (اختياري)، OG image لكل شركة (اقتراح).
7. `docs/mobile-ux-audit.md`، ثم الفحص الأخير وكلش اللي بعدو.

## أدوات الفحص (برا الريبو)
- `D:\CODPROMO\codpromo-project\audit-tools\` : Playwright 1.56 (chromium/webkit) + Lighthouse 12 (Chrome النظام).
  `capture.mjs` (صفحات كاملة)، `interact.mjs` (قوائم ونوافذ)، `lh.mjs` / `inp.mjs` (السرعة)، `cls.mjs`، `quick.mjs`،
  `i18n-add.mjs` (دمج مفاتيح الترجمة)، `serve.mjs` (build محلي مع brotli). `MSYS_NO_PATHCONV=1` قبل `--paths /`.
- `.keys.json` هناك (مفاتيح المشروع، ماشي في git، ما تتطبعش).
- دخول حسابات التجربة: `generateLink` (magiclink) + `/auth/v1/verify` → جلسة في localStorage. بلا إيميل.
- كل كتابة في القاعدة موقوفة بـ `page.route` (allowlist للقراءات برك).
- ⚠️ heredoc في Bash ياكل `\\`: السكريبتات اللي فيها regex تتكتب بـ Write ماشي heredoc.

## ملاحظات مهمّة
- حساب "Stork Team" = `storkteamdz@gmail.com`: ماشي أدمين وما عندو حتى Premium (لا شراء، لا هدية، لا Stork) → الكود المقفول + المفتاح الذهبي = سلوك صحيح.
- حسابات التجربة: test1 عادي (refunded)، test2 و test4 Premium مدى الحياة، test3 ما كاينش. الأدمين = حساب المالك (ما ندخلوش بيه) → حالة الأدمين بـ mock محلي.
- Lighthouse قبل (prod، mobile): LCP 4.0–9.2s، الصور حتى 3.9MB في /premium، JS ~350–370KB. الملفات: `.audit/lh-prod-before.json`، `.audit/lh-local-before.json`.
