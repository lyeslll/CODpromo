# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> ⚠️ الريبو **عمومي**: ممنوع تكتب هنا (ولا في أي ملف داخل الريبو) أي مفتاح سرّي، PIN، أو كلمة سر. أسماء المتغيرات والـ secrets فقط.

---

## 1. المشروع

- **CODpromo** — منصة عربية (RTL) لأكواد الخصم / الكوبونات / الكاش باك لـ **تجّار الدفع عند الاستلام** (COD) في الجزائر والعالم العربي، مع نظام اشتراك **Premium** يكشف أكواد أقوى. الاسم يُقرأ بمعنيين: COD = Cash On Delivery، و CODpromo ≈ "Code promo".
- **الموقع:** `codpromo.com` — منشور على **Vercel** (نشر تلقائي عند كل `git push` على `main`).
- **المستودع:** GitHub `lyeslll/CODpromo` (عمومي).
- **المسار المحلي (Windows):** `D:\CODPROMO\codpromo-project\codpromo`
- **الـ Stack:** Vite 5 + React 18 + React Router 7 · Tailwind CSS v4 (عبر `@tailwindcss/vite`، **ما كاينش `tailwind.config.js`** — الـ tokens في `@theme` داخل `src/index.css`) · framer-motion (مكتبة الحركة الوحيدة) · three + @react-three/fiber v8 (الـ 3D، v8 لأن المشروع React 18) · lucide-react · react-i18next · react-helmet-async · Supabase (DB + Auth + Storage + Edge Functions) · Capacitor 8 (iOS).
- **الهوية البصرية:** أسود + أخضر ليموني (`--color-lime` `#a6f000`) · خط Tajawal للعربية و Inter للإنجليزية/الفرنسية · **الموقع داكن فقط** (لا يوجد وضع فاتح).

### الأوامر
```bash
npm run dev        # Vite dev server
npm run build      # build للإنتاج في dist/
npm run preview    # تشغيل الـ build محلياً
npm run pwa-icons  # توليد أيقونات PWA من public/favicon-1024.png
```
ما كاين لا test runner لا linter لا formatter.

### النشر
```bash
git add -A && git commit -m "وصف التعديل" && git push
```
- **الويب:** Vercel ينشر وحدو بعد الـ push. `vercel.json`: كل المسارات → `index.html` (SPA)، ما عدا `/sitemap.xml` → `api/sitemap.js`، و `/offers` و `/store/:slug` و `/category/:slug` (بـ ar/en/fr) → `api/prerender.js` (meta + JSON-LD للـ bots). `api/prerender.js` يقرا نصوص `/offers` من `src/i18n/locales` (مضمّنة عبر `functions.includeFiles`). `/.well-known/assetlinks.json` مستثنى (لتطبيق Android).
- **Edge Functions:** ما تنشرش مع Vercel. `supabase functions deploy <name> --project-ref uulcgvdsqivgkiulurhk` (و `translate-company` مع `--no-verify-jwt`).
- **SQL على production:** `npx supabase db query --linked -f <file.sql>` (الـ CLI مربوط بالمشروع).

### البنية التقنية
- **Providers:** `main.jsx` → `HelmetProvider` → `LocaleProvider` → `App.jsx` → `MotionConfig reducedMotion="user"` → `AuthProvider` → `PremiumProvider` → `CategoriesProvider` → `VoteStatsProvider` → `ScrollVisibilityProvider` → الراوتر. الـ hooks: `useAuth()`, `usePremium()`, `useLocale()`.
- **جوج طرق للوصول لـ Supabase (مهم):**
  - `src/lib/supabase.js` — `fetch` يدوي على PostgREST/Storage بالمفتاح العام: جدول `companies` (قراءة عامة + كتابة الأدمن) ورفع اللوغوهات لـ bucket `logos`. يقدر يبعث توكن المستخدم في كتابات الأدمن.
  - `src/lib/supabaseClient.js` — SDK `@supabase/supabase-js` بجلسة محفوظة. كل شي مرتبط بالمستخدم: `auth.jsx`, `favorites.js`, `requests.js`, `stork.js`, `subscribers.js`, `admin.js`, `billing.js`, `playBilling.js`, `votes.js`, `siteStats.js`.
  - كل ملف في `src/lib/*.js` طبقة بيانات لمجال واحد؛ المكوّنات ما تنادي Supabase مباشرة.
- **المسارات:** `/` (صفحة تعريف landing)، `/offers` (كل العروض)، `/store/:slug`، `/category/:slug`، `/categories`، `/favorites` (كل وحدة بـ `/en/...` و `/fr/...`)، `/login`، `/signup`، `/forgot-password`، `/reset-password`، `/payment-success|cancel|return|return-paypal`، `/privacy`، `/account-deletion`، `/dashboard` (محمي بـ `RequireAuth`، يتفرّع لـ زبون/شركة حسب `accountType`)، `/admin` (عربي RTL ثابت). أي مسار مجهول → `Home`. كل الصفحات ما عدا `Home` تتحمّل lazy (`React.lazy` في `App.jsx`).
- **روابط قديمة:** `/#stores` (قسم العروض القديم) يتحوّل لـ `/offers`؛ `#how` و `#categories` باقين أقسام في الرئيسية.
- **الثيم:** داكن فقط. الألوان متغيرات CSS في `:root` (`--text`, `--elev`, `--fill`, `--color-ink*`, `--color-lime`…) — استعملها في `className` (مثلاً `bg-[var(--color-ink-card)]`) بلا hex مباشر. ما كاينش `.light` ولا `codpromo:theme` (يتمسح من localStorage في `index.html`). اللوغو دائماً `public/logo-dark.png`.
- **أنواع العروض:** enum عربي ثابت `"تخفيض"` / `"كوبون"` / `"كاش باك"` في `src/lib/types.js`، يتعرض مترجم عبر `getTypeKey`. في الرابط: `type=discount|coupon|cashback` (`TYPE_PARAMS` في `src/lib/offerFilters.js`).
- **الألوان الثلاثة (من `types.js` بالضبط):** تخفيض `#a6f000` · كوبون `#38bdf8` · كاش باك `#fbbf24`. Premium = ذهبي (`#ffe486` / `#f0c63c` / `#cf9a1e`). اللون يعني النوع (أو Premium) فقط، ماشي زينة.
- **قاعدة البيانات:** ملفات SQL مرقّمة تتشغّل بالترتيب (كلها idempotent):
  `supabase-setup` → `supabase-auth-setup` → `supabase-auth-phase2` → `phase3` → `phase4` → `phase5` → `phase6a` → `phase6a-note4` → `phase7-stripe` → `phase8-slickpay` → `phase9-paypal` → `phase10-i18n` → `phase11-i18n-value` → `phase12-premium-code-url` → `phase13-seo` → `phase14-categories` → `phase15-admin` → `phase16-rls-lock` → `phase17a-premium-rpcs` → `phase17b-premium-lock` → `phase18-premium-description` → `phase19-code-votes` → `phase20-google-play` → `phase21-site-stats`.
  أي عمود أو جدول جديد = ملف phase جديد، ماشي تعديل ملف قديم.
- **متغيرات البيئة (الويب):** في `.env` (gitignored) و Vercel، شوف `.env.example`: `VITE_ADMIN_PIN`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_HCAPTCHA_SITE_KEY`. `supabase.js` و `supabaseClient.js` فيهم fallback للـ URL والمفتاح العام.

### الصفحة الرئيسية (landing) — `src/pages/Home.jsx` + `src/components/landing/`
الجمهور: تجّار الدفع عند الاستلام (يشريو خدمات: توصيل، منصات، ERP، بطاقات دفع، إعلانات…). الأقسام بالترتيب:
`LandingHero` (العنوان + "الكوبون السحري") → `StatsStrip` (أرقام `site_stats`) → `NameStory` (COD → Cash On Delivery → Code promo مع التمرير) → `Pillars` (الأنواع الثلاثة بعروض حيّة من عروض حقيقية) → `CardAnatomy` (بطاقة حقيقية + خطوط شرح) → `PremiumCompare` (عادي مقابل Premium، السعر من `plans.js`، المضاعف = القيمة ÷ سعر الشهر) → `CategoryGrid` (`#categories`) → `HowSteps` (`#how`) → `TrustSection` (تصويت حقيقي + شريط الشركاء) → `SampleOffers` (الأنجح من كل نوع) → `FinalCta` → `Footer` (كما هو). كل زر نحو العروض يفتح `/offers` بالفلتر المناسب (`offersLink()` في `src/lib/seo.js`).

### "الكوبون السحري" (الـ 3D) — `src/components/landing/magic/`
- الـ 3D **محصور في الكوبون السحري فقط** (الـ Hero). `MagicScene3D.jsx` (R3F) يتحمّل lazy عند ظهور الـ Hero، وفقط إذا `canUse3D()`؛ مع prefers-reduced-motion / هاتف ضعيف / توفير البيانات / بلا WebGL → `MagicCoupon2D.jsx` (CSS) وحدو. أي خطأ WebGL → يرجع 2D.
- Canvas واحد يغطّي الـ Hero: الكوبون في موضع "المسرح" DOM (`store.anchor`) + كوبونات صغيرة تطفو بعمق (parallax) بألوان الأنواع + جزيئات ذهبية. التفاعل كلّه في DOM (سحب/نقر/مقبض `HeroModeSwitch`/ميلان الهاتف) ويتكتب في `store`.
- الوجهين مرسومين بـ Canvas 2D (`couponFaces.js`) بخطوط الصفحة. العرض الحقيقي من `pickHeroOffer` (قيمة عادية + Premium أكبر)، وإلا مثال توضيحي معلَن. كود Premium ما يبانش أبداً (`••••••`).
- مشهد الـ 3D مستثنى من precache الـ PWA (`globIgnores` في `vite.config.js`).
- ملاحظة framer-motion: الشفافية المربوطة بالتمرير تشتغل على scroll timeline أصلي — خلّي مدى `useTransform` يبدا بـ 0 ويسالي بـ 1، وإلا ترجع القيمة الأصلية بعد آخر نقطة.

### صفحة العروض — `src/pages/OffersPage.jsx` + `src/components/offers/`
- البحث + فلتر النوع بالألوان + شرائح التصنيفات + الترتيب + مبدّل عادي/Premium. **كل الفلاتر في الرابط:** `?type=&category=&mode=premium&sort=success&q=` (تبقى عند تبديل اللغة).
- الهاتف: `FloatingModeSwitch` عائم فوق شريط التنقّل، وسحب أفقي على القائمة يبدّل عادي ⇄ Premium (`touch-action: pan-y`).
- `GoldBurst` = جزيئات ذهبية عند التحوّل لـ Premium. SEO: `CollectionPage` + `ItemList` + Breadcrumb (في الواجهة وفي `api/prerender.js`).

### بطاقات العروض = تذاكر كوبون — `src/components/CompanyCard.jsx`
- جزءان: `.ticket-top` (الشركة + الوصف 3 أسطر + القيمة) و `.ticket-stub` (الكود + النسخ + الزيارة + التصويت)، بينهما نصفا دائرة مقصوصان (CSS mask) وخط مثقّب. الكلاسات في `src/index.css` (`.ticket*`)، والألوان عبر متغيّرات `--edge-base` / `--edge-strong` / `--perf` / `--stub`.
- نفس البطاقة في `/offers` والرئيسية وصفحات الشركة/الفئة/المفضّلة. كل الوظائف باقية: المفضّلة، شارة PREMIUM، القفل، الخدش، النسخ، الزيارة، التصويت، شارة النجاح، المواقع الثابتة للأيقونات. أجزاؤها معلّمة بـ `data-part` (يستعملها `CardAnatomy`).

### أرقام الصفحة الرئيسية — جدول `site_stats` (phase21)
- سطر واحد (`id = 1`): `total_savings_dzd`, `total_codes`, `partners_count`, `premium_unlock_value_usd`. قراءة عامة، تعديل للأدمن برك (RLS `is_admin()`).
- الواجهة تقرا `site_stats_public` (view): الخانة الفارغة تتحسب خادمياً بعدّ دقيق (`site_stats_auto()`: عدد الأكواد العادية + Premium، وعدد الشركاء). القيمتان الماليتان ما تتحسبوش — فارغة = مخفية.
- لوحة الأدمن: تبويب "أرقام الرئيسية" (`src/components/admin/SiteStatsManager.jsx`). لوحة `/admin` عربية ثابتة: نصوصها الجديدة في ملفات الترجمة وتتعرض بالعربية عبر `i18n.getFixedT("ar")`.

---

## 2. طريقة الخدمة

- البرومتات تجي من **محادثة Claude منفصلة**. **نفّذ مباشرة** — بلا ما تعطي plan وتستنى الموافقة.
- **خدمة الويب في Windows برك، وخدمة iOS في الماك برك.** من Windows ما تمسّش دوسي `ios/`.
- المالك (إلياس) مبتدئ: اشرح **بالعربية**، بسطور قصيرة وبسيطة، **خطوة بخطوة**، بلا ما تفترض معرفة تقنية.

---

## 3. القواعد الصارمة

- **`public/favicon.png` ممنوع تمسّو** — لا تعيد توليده لا تبدّلو. هو الأصل بخلفية شفافة لأيقونة التبويب. سكربت `pwa-icons` يولّد غير أيقونات PWA من `favicon-1024.png`.
- **بلوك "شعرة الضوء الليموني" في `src/components/Navbar.jsx` ممنوع يتبدّل** — هو `<span>` فوق كبسولة الهيدر، يبدا بالتعليق `{/* شعرة ضوء ليموني علوية … */}` ويسالي بـ `/>`. كان في الأسطر 238–243، وبعد حذف زر الوضع الفاتح ولّى في **الأسطر 163–168** (نفس المحتوى حرفياً). إذا تبدّلو الأرقام مرة أخرى، القاعدة تبقى على هاد البلوك.
- **Android signing:** ممنوع تولّد signing key جديد. `signing.keystore` يبقى كيما راه.
- **Android package ID يبقى `com.codpromo.twa`** (مربوط بـ Google Play و `public/.well-known/assetlinks.json`).
- **iOS:** أي CSS ولا منطق خاص بـ iOS يكون محصور تحت **`body.is-ios-app`** برك (الصنف يتزاد في `src/main.jsx` كي `Capacitor.getPlatform() === "ios"`). ما يأثّرش على الويب ولا Android.
- **ما كاين حتى نص ظاهر للمستخدم hardcoded:** كلش عبر react-i18next في `src/i18n/locales/{ar,en,fr}.json` بنفس المفاتيح في الثلاثة. الأعلام صور SVG (`flag-icons`) ماشي emoji. أي حقل نصي ديناميكي جديد في قاعدة البيانات يظهر للمستخدم: زيد `<field>_en` / `<field>_fr` في phase جديد، زيدو لـ `I18N_FIELDS` في `src/lib/supabase.js`، واعرض نسخة اللغة النشطة مع fallback للعربية.
- **ممنوع أرقام وهمية في الكود:** كل رقم ظاهر يجي من `site_stats` ولا يتحسب من قاعدة البيانات (المثال التوضيحي للكوبون السحري معلَن بوسم "مثال توضيحي").
- **الـ 3D محصور في الكوبون السحري.** اللوغو يبقى صورة كيما راه (ممنوع 3D للوغو)، والألوان الأساسية (الأسود والليموني) ما تتبدّلش.
- **الموقع داكن فقط** — ما ترجعش وضع فاتح.
- **ممنوع تحلّ Xcode وحدك.**
- **ممنوع تكتب أسرار** (مفاتيح، PIN، passwords) في أي ملف داخل الريبو.

---

## 4. واش تكمّل

**الموقع**
- الموقع داكن فقط، هيدر بميغا مينيو، Bottom Nav للهاتف (الرئيسية / العروض / Premium / المفضّلة / الحساب)، فوتر.
- الرئيسية = landing بـ 3D ("الكوبون السحري") + أقسام تشرح CODpromo؛ `/offers` = كل العروض بفلاتر في الرابط.
- البطاقات تذاكر كوبون بالألوان الثلاثة (ذهبي في Premium).
- صفحات الشركات والفئات (`/store`, `/category`, `/categories`) والمفضّلة (`/favorites`).
- مصادقة كاملة (Email/Password + Google + hCaptcha، reset password)، داشبورد زبون / شركة.
- لوحة `/admin`: الشركات، الفئات، الطلبات، المشتركين، أعضاء Premium، SEO، التصويت، أرقام الرئيسية (`site_stats`)، تصدير CSV.
- نافذة جمع الإيميل، نظام تصويت 👍/👎 على الأكواد (`code_votes` + RPC `cast_vote`).
- SEO: صفحات بـ 3 لغات، `api/prerender.js` (العروض/الشركات/الفئات)، `api/sitemap.js` (فيه `/offers`)، JSON-LD للرئيسية (Organization + WebSite بـ SearchAction نحو `/offers?q=`)، Google Search Console.
- PWA (`vite-plugin-pwa`: manifest + service worker + أيقونات). prefers-reduced-motion محترم في كل الموقع.
- صفحات `/privacy` و `/account-deletion` (مطلوبة من Google Play).

**Premium**
- `PremiumProvider` (`src/lib/premium.jsx`): `unlocked` = بروفايل Premium ساري (`is_premium` + `premium_until`) أو علم محلي `codpromo:premium-unlock`.
- كود ورابط Premium مستقلين لكل شركة، `supports_premium` لكل شركة (مع زر في جدول الأدمن)، وصف Premium منفصل ومترجم.
- كشف الكود بخدش حقيقي (`ScratchCanvas` في `src/components/CompanyCard.jsx`: Canvas + Pointer Events، كشف عند ~50٪). الكود الحقيقي يتجاب خادمياً عبر RPC `get_premium_code`.
- حماية من الاشتراك المزدوج: الدفع يتخبّى إذا المستخدم راه Premium (ويب + Play).

**الدفع** (`src/components/PremiumModal.jsx` + `src/lib/billing.js` + `src/lib/plans.js`؛ المبالغ الموثوقة في الخادم فقط)
- **Stripe** — live. 3 اشتراكات متجدّدة بالدولار: شهر $10 / 3 أشهر $25 / سنة $90. `create-checkout-session` → Stripe Checkout → `/payment-success`، و `stripe-webhook` يزامن `is_premium` / `premium_until` / `plan_type`.
- **SlickPay** — live (CIB/Edahabia عبر SATIM). 3 باقات: 2500 / 6500 / 24000 دج (30/90/365 يوم)، المرجع الخادمي في `supabase/functions/_shared/slickpay.ts`. الـ payload لازم فيه `address`.
- **PayPal** — مفعّل في الواجهة: باقات لمرة واحدة بالدولار (`paypal-create-order` → `/payment-return-paypal` → `paypal-capture-order`).
- **Google Play Billing** — داخل تطبيق Android (TWA) برك، عبر Digital Goods API (`src/lib/playBilling.js`). المنتجات: `premium_monthly` / `premium_quarterly` / `premium_yearly`. المنح خادمي عبر Edge Function `verify-play-purchase` وجدول `google_play_purchases` (phase20). داخل التطبيق يبان Play وحدو؛ على الويب Stripe / SlickPay / PayPal كيما هوما.
- **Stork** — أكواد ترويجية لمرة وحدة تعطي 30 يوم (RPC `redeem_stork_code`).

**الأمان**
- S1 (phase15): `profiles.is_admin` + دالة `is_admin()`.
- S2 (phase16): قفل RLS — الكتابة على `companies` والجداول الإدارية للأدمن برك.
- S3 (phase17a/b): `premium_code` / `premium_url` ممنوعين من القراءة العامة، trigger يحمي حقول الاشتراك في `profiles`، و `stork_codes` مقفول.
- phase21: `site_stats` قراءة عامة وتعديل للأدمن برك (مجرّب: anon ممنوع، المسجّل غير الأدمن 0 سطر).
- `/admin`: بوابة PIN في المتصفح (`VITE_ADMIN_PIN`) + تسجيل دخول إجباري؛ الكتابات تمشي بتوكن المستخدم والحماية الحقيقية هي RLS `is_admin()`.

**i18n**
- ar (افتراضي، RTL) / en / fr (LTR) عبر react-i18next؛ المفاتيح متطابقة في الثلاثة (488 مفتاح).
- `LocaleProvider` يضبط `lang` + `dir` على `<html>` ويحفظ `codpromo:lang`؛ زر `LanguageSwitcher` (يحافظ على فلاتر `/offers` في الرابط).
- ترجمة تلقائية لمحتوى الشركات والفئات (`description_*`, `category_*`…) عبر Edge Function `translate-company` (Anthropic API، المفتاح في Supabase secrets برك) + زر "ترجم الكل" في الأدمن.
- استعمل خصائص Tailwind المنطقية (`ps/pe`, `ms/me`, `start/end`)؛ الأيقونات الاتجاهية تنقلب بـ `ltr:rotate-180`. `/admin` يبقى عربي ثابت.

**Android (TWA)**
- مبني بـ Bubblewrap **خارج الريبو** في `D:\CODPROMO\bubblewrap-build` (`twa-manifest.json`: host `codpromo.com`، آخر نسخة versionCode 4 / 1.0.0.2).
- الـ keystore خارج الريبو في `D:\CODPROMO\CODpromo - Google Play package\`.
- `public/.well-known/assetlinks.json` فيه بصمتي Upload Key و Google Play App Signing (لإخفاء شريط المتصفح).
- تخصيصات وضع التطبيق (standalone): هيدر مدمج، منع قائمة long-press وترجمة Chrome، الهيدر ظاهر ~4 ثواني عند التحميل.

**iOS (Capacitor 8)**
- مشروع `ios/` متزاد (commit `07d29be`): `appId` / Bundle ID `com.codpromo.app`، نسخة 1.0 (build 1)، splash وأيقونة من `resources/`.
- التطبيق يحمّل الـ `dist/` المبني محلياً (ما كاينش `server.url`) — أي تبديل في الويب يحتاج `npm run build` + `npx cap sync ios` على الماك.
- Safe area في `src/index.css` تحت `body.is-ios-app` (موبايل فقط).

---

## 5. واش باقي مفتوح (مؤكّد من الكود)

- **iOS — الدفع:** ما كاين حتى منطق دفع خاص بـ iOS. داخل تطبيق iOS، `PremiumModal` يعرض Stripe / SlickPay / PayPal كيما الويب (ما كاين لا In-App Purchase لا إخفاء). لازم قرار قبل التقديم للـ App Store.
- **قالب الإيميلات:** ما كاين حتى قالب إيميل في الريبو.
- **PayPal — وضع live:** الكود يستعمل sandbox افتراضياً (`_shared/paypal.ts`) إلا إذا تضبط secret `PAYPAL_BASE_URL`. الكود وحدو ما يأكّدش إذا راه live.
- **أرقام الرئيسية:** `total_savings_dzd` و `premium_unlock_value_usd` فارغين في `site_stats` → خانة "إجمالي قيمة الخصومات" ومضاعف Premium (×) مخفيين حتى يعمّرهم الأدمن من تبويب "أرقام الرئيسية".
- **`public/logo-light.png`** باقي في الريبو بلا استعمال (الموقع داكن فقط).
