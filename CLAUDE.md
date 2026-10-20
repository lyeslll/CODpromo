# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> ⚠️ الريبو **عمومي**: ممنوع تكتب هنا (ولا في أي ملف داخل الريبو) أي مفتاح سرّي، PIN، أو كلمة سر. أسماء المتغيرات والـ secrets فقط.

---

## 1. المشروع

- **CODpromo** — منصة عربية (RTL) لأكواد الخصم / الكوبونات / الكاش باك للسوق الجزائري والعربي، مع نظام اشتراك **Premium** يكشف أكواد حصرية.
- **الموقع:** `codpromo.com` — منشور على **Vercel** (نشر تلقائي عند كل `git push` على `main`).
- **المستودع:** GitHub `lyeslll/CODpromo` (عمومي).
- **المسار المحلي (Windows):** `D:\CODPROMO\codpromo-project\codpromo`
- **الـ Stack:** Vite 5 + React 18 + React Router 7 · Tailwind CSS v4 (عبر `@tailwindcss/vite`، **ما كاينش `tailwind.config.js`** — الـ tokens في `@theme` داخل `src/index.css`) · framer-motion · lucide-react · react-i18next · react-helmet-async · Supabase (DB + Auth + Storage + Edge Functions) · Capacitor 8 (iOS).
- **الهوية البصرية:** أسود + أخضر ليموني (`--color-lime` `#a6f000`) · خط Tajawal للعربية و Inter للإنجليزية/الفرنسية · Dark افتراضي مع Light.

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
- **الويب:** Vercel ينشر وحدو بعد الـ push. `vercel.json`: كل المسارات → `index.html` (SPA)، ما عدا `/sitemap.xml` → `api/sitemap.js`، و `/store/:slug` و `/category/:slug` (بـ ar/en/fr) → `api/prerender.js` (SEO للـ bots). `/.well-known/assetlinks.json` مستثنى (لتطبيق Android).
- **Edge Functions:** ما تنشرش مع Vercel. `supabase functions deploy <name> --project-ref uulcgvdsqivgkiulurhk` (و `translate-company` مع `--no-verify-jwt`).

### البنية التقنية
- **Providers:** `main.jsx` → `HelmetProvider` → `LocaleProvider` → `ThemeProvider` → `App.jsx` → `AuthProvider` → `PremiumProvider` → `CategoriesProvider` → `VoteStatsProvider` → `ScrollVisibilityProvider` → الراوتر. الـ hooks: `useAuth()`, `usePremium()`, `useTheme()`, `useLocale()`.
- **جوج طرق للوصول لـ Supabase (مهم):**
  - `src/lib/supabase.js` — `fetch` يدوي على PostgREST/Storage بالمفتاح العام: جدول `companies` (قراءة عامة + كتابة الأدمن) ورفع اللوغوهات لـ bucket `logos`. يقدر يبعث توكن المستخدم في كتابات الأدمن.
  - `src/lib/supabaseClient.js` — SDK `@supabase/supabase-js` بجلسة محفوظة. كل شي مرتبط بالمستخدم: `auth.jsx`, `favorites.js`, `requests.js`, `stork.js`, `subscribers.js`, `admin.js`, `billing.js`, `playBilling.js`, `votes.js`.
  - كل ملف في `src/lib/*.js` طبقة بيانات لمجال واحد؛ المكوّنات ما تنادي Supabase مباشرة.
- **المسارات:** `/`، `/store/:slug`، `/category/:slug`، `/categories`، `/favorites` (كل وحدة بـ `/en/...` و `/fr/...`)، `/login`، `/signup`، `/forgot-password`، `/reset-password`، `/payment-success|cancel|return|return-paypal`، `/privacy`، `/account-deletion`، `/dashboard` (محمي بـ `RequireAuth`، يتفرّع لـ زبون/شركة حسب `accountType`)، `/admin` (دايماً dark و RTL). أي مسار مجهول → `Home`.
- **الثيم:** سكربت inline في `index.html` يقرا `localStorage["codpromo:theme"]` قبل أول رسم. الألوان متغيرات CSS (`--text`, `--elev`, `--fill`, `--color-ink*`, `--color-lime`…) معرّفة تحت `.dark` / `.light` — استعملها في `className` (مثلاً `bg-[var(--color-ink-card)]`) بلا hex مباشر.
- **أنواع العروض:** enum عربي ثابت `"تخفيض"` / `"كوبون"` / `"كاش باك"` في `src/lib/types.js`، يتعرض مترجم عبر `getTypeKey`.
- **قاعدة البيانات:** ملفات SQL مرقّمة تتشغّل يدوياً في Supabase SQL Editor بالترتيب (كلها idempotent):
  `supabase-setup` → `supabase-auth-setup` → `supabase-auth-phase2` → `phase3` → `phase4` → `phase5` → `phase6a` → `phase6a-note4` → `phase7-stripe` → `phase8-slickpay` → `phase9-paypal` → `phase10-i18n` → `phase11-i18n-value` → `phase12-premium-code-url` → `phase13-seo` → `phase14-categories` → `phase15-admin` → `phase16-rls-lock` → `phase17a-premium-rpcs` → `phase17b-premium-lock` → `phase18-premium-description` → `phase19-code-votes` → `phase20-google-play`.
  أي عمود أو جدول جديد = ملف phase جديد، ماشي تعديل ملف قديم.
- **متغيرات البيئة (الويب):** في `.env` (gitignored) و Vercel، شوف `.env.example`: `VITE_ADMIN_PIN`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_HCAPTCHA_SITE_KEY`. `supabase.js` و `supabaseClient.js` فيهم fallback للـ URL والمفتاح العام.

---

## 2. طريقة الخدمة

- البرومتات تجي من **محادثة Claude منفصلة**. **نفّذ مباشرة** — بلا ما تعطي plan وتستنى الموافقة.
- **خدمة الويب في Windows برك، وخدمة iOS في الماك برك.** من Windows ما تمسّش دوسي `ios/`.
- المالك (إلياس) مبتدئ: اشرح **بالعربية**، بسطور قصيرة وبسيطة، **خطوة بخطوة**، بلا ما تفترض معرفة تقنية.

---

## 3. القواعد الصارمة

- **`public/favicon.png` ممنوع تمسّو** — لا تعيد توليده لا تبدّلو. هو الأصل بخلفية شفافة لأيقونة التبويب. سكربت `pwa-icons` يولّد غير أيقونات PWA من `favicon-1024.png`.
- **`src/components/Navbar.jsx` الأسطر 238–243 ممنوع تتبدّل** — هي `<span>` تاع "شعرة الضوء الليموني" فوق كبسولة الهيدر (تبدا بالتعليق `{/* شعرة ضوء ليموني علوية … */}` وتسالي بـ `/>`). إذا تبدّلو أرقام الأسطر، القاعدة تبقى على هاد البلوك.
- **Android signing:** ممنوع تولّد signing key جديد. `signing.keystore` يبقى كيما راه.
- **Android package ID يبقى `com.codpromo.twa`** (مربوط بـ Google Play و `public/.well-known/assetlinks.json`).
- **iOS:** أي CSS ولا منطق خاص بـ iOS يكون محصور تحت **`body.is-ios-app`** برك (الصنف يتزاد في `src/main.jsx` كي `Capacitor.getPlatform() === "ios"`). ما يأثّرش على الويب ولا Android.
- **ما كاين حتى نص ظاهر للمستخدم hardcoded:** كلش عبر react-i18next في `src/i18n/locales/{ar,en,fr}.json` بنفس المفاتيح في الثلاثة. الأعلام صور SVG (`flag-icons`) ماشي emoji. أي حقل نصي ديناميكي جديد في قاعدة البيانات يظهر للمستخدم: زيد `<field>_en` / `<field>_fr` في phase جديد، زيدو لـ `I18N_FIELDS` في `src/lib/supabase.js`، واعرض نسخة اللغة النشطة مع fallback للعربية.
- **ممنوع تحلّ Xcode وحدك.**
- **ممنوع تكتب أسرار** (مفاتيح، PIN، passwords) في أي ملف داخل الريبو.

---

## 4. واش تكمّل

**الموقع**
- التصميم الكامل (RTL، Dark/Light)، هيدر بميغا مينيو، Bottom Nav للهاتف، فوتر.
- صفحات الشركات والفئات (`/store`, `/category`, `/categories`) والمفضّلة (`/favorites`).
- مصادقة كاملة (Email/Password + Google + hCaptcha، reset password)، داشبورد زبون / شركة.
- لوحة `/admin`: الشركات، الفئات، الطلبات، المشتركين، أعضاء Premium، SEO، التصويت، تصدير CSV.
- نافذة جمع الإيميل، نظام تصويت 👍/👎 على الأكواد (`code_votes` + RPC `cast_vote`).
- SEO: صفحات بـ 3 لغات، `api/prerender.js` للـ bots، `api/sitemap.js`، Google Search Console.
- PWA (`vite-plugin-pwa`: manifest + service worker + أيقونات).
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
- `/admin`: بوابة PIN في المتصفح (`VITE_ADMIN_PIN`) + تسجيل دخول إجباري؛ الكتابات تمشي بتوكن المستخدم والحماية الحقيقية هي RLS `is_admin()`.

**i18n**
- ar (افتراضي، RTL) / en / fr (LTR) عبر react-i18next؛ المفاتيح متطابقة في الثلاثة (396 مفتاح).
- `LocaleProvider` يضبط `lang` + `dir` على `<html>` ويحفظ `codpromo:lang`؛ زر `LanguageSwitcher`.
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
