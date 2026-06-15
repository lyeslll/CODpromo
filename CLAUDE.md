# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Vite dev server
npm run build    # production build to dist/
npm run preview  # serve the production build locally
```

There is no test runner, linter, or formatter configured. Deployment is Vercel (`vercel.json` rewrites all routes to `/index.html` for the SPA).

## Project overview (نظرة عامة)

- **CODpromo** — منصة أكواد خصم / كوبونات / كاش باك، عربية RTL.
- **الهوية البصرية:** أسود + أخضر ليموني (`--color-lime` `#a6f000`) + خط Tajawal. تدعم الوضع الداكن والفاتح (Dark/Light).
- **النشر:** منشور على **codpromo.com** عبر **Vercel** (نشر تلقائي عند كل `git push`).
- **المستودع:** GitHub — `github.com/lyeslll/CODpromo`.
- **قاعدة البيانات:** Supabase. لوحة `/admin` محمية بـ PIN في متغير بيئة (`VITE_ADMIN_PIN`).

### المنجز (Done)
التصميم الكامل · مصادقة كاملة (Google + hCaptcha) · داشبورد الأعضاء (زبون / شركة) · لوحة الأدمن (إحصائيات / تصدير CSV / إدارة الطلبات) · نافذة جمع الإيميل (Email popup) · نظام Premium.

### المتبقي (To do)
- إصلاحات Premium: الإطار الذهبي، ارتفاع البطاقة، و`supports_premium` لكل بطاقة على حدة. (تأثير الخدش scratch صار نظام Canvas حقيقي — أُنجز.)
- قالب الإيميلات.

> **كشف كود Premium (الخدش):** `ScratchCanvas` في `src/components/CompanyCard.jsx` — خدش حقيقي بـ HTML5 Canvas (Pointer Events + `destination-out`)، كشف تلقائي عند ~50٪، جزيئات ذهبية، اهتزاز (`navigator.vibrate`)، ولمعة احتفالية. يظهر فقط للمشترك المصرّح له؛ الكود الحقيقي يبقى يُجلب خادمياً عبر `get_premium_code` (قبل الكشف تحت الغطاء `••••••` فقط).

### العمل مع المالك (إلياس)
المالك **إلياس مبتدئ**. عند الشرح أو التوجيه:
- اشرح **بالعربية**، بسطور قصيرة وبسيطة.
- وجّهه **خطوة بخطوة**، ولا تفترض معرفة تقنية مسبقة.

### رفع التعديلات (نشر)
```bash
git add -A && git commit -m "وصف التعديل" && git push
```
Vercel ينشر التغييرات تلقائياً بعد الدفع — لا حاجة لخطوة نشر يدوية.

## What this is

CODpromo is an Arabic, RTL, dark-first single-page app for discount/coupon/cashback codes (Algeria / Arab market). Stack: Vite + React 18 + React Router 7, Tailwind CSS v4 (via the `@tailwindcss/vite` plugin — there is **no `tailwind.config.js`**; theme tokens live in `@theme` inside `src/index.css`), framer-motion, lucide-react. Source comments and UI strings are in Arabic.

## Two Supabase access patterns (important)

The codebase talks to one Supabase project through **two separate clients** — pick the right one when adding code:

- **`src/lib/supabase.js`** — hand-rolled `fetch` against the PostgREST/Storage REST API using the publishable key directly. This is the **public `companies` table** layer (read for the storefront, write for the admin panel) plus logo uploads to the `logos` storage bucket. It does **not** carry an auth session.
- **`src/lib/supabaseClient.js`** — the `@supabase/supabase-js` SDK with a persisted auth session (`detectSessionInUrl`, autorefresh). Everything **auth-aware** uses this: `auth.jsx`, `favorites.js`, `requests.js`, `stork.js`, `subscribers.js`, `admin.js`. Queries here run under the logged-in user and rely on RLS.

Each `src/lib/*.js` module is a thin data-access layer for one domain (companies, favorites, requests, stork, subscribers, admin reads, profiles). UI components import these — they do not call Supabase inline.

## Provider tree & routing

`main.jsx` → `ThemeProvider` → `App.jsx` → `AuthProvider` → `PremiumProvider` → `BrowserRouter` routes. Consume via the hooks `useTheme()`, `useAuth()`, `usePremium()`.

- `useAuth()` exposes `user`, `session`, `profile`, `accountType` (`"customer"` | `"company"`, read from the `profiles` row, falling back to `user_metadata`), and the auth actions (`signUp`, `signIn`, `signInWithGoogle`, `resetPassword`, `updatePassword`, `signOut`). All email/password and reset flows pass an hCaptcha token.
- `/dashboard` is wrapped in `RequireAuth` (redirects unauthenticated users to `/login`). `pages/Dashboard.jsx` then forks to `CustomerDashboard` or `CompanyDashboard` based on `accountType`.
- `/admin` is force-wrapped in a `<div className="dark">` so the admin panel stays dark regardless of the site theme.
- Unknown routes fall through to `Home`.

## Premium / Stork unlocking

`PremiumProvider` (`src/lib/premium.jsx`) computes `unlocked` as **either** a valid premium profile (`profile.is_premium` and `premium_until` in the future) **or** a local unlock flag in `localStorage` (`codpromo:premium-unlock`). Redeeming a Stork code (`stork.js`) marks the one-time code used, grants the signed-in user 30 days of premium, and sets the local flag. Per-company `supports_premium` controls whether a card shows premium pricing.

### Payment providers (طرق الدفع)

`PremiumModal.jsx` offers four unlock paths: **Stripe** (recurring USD subscription), **PayPal** (one-time USD plans), **SlickPay** (Algerian CIB/Edahabia via SATIM), and **Stork** promo codes. Each provider has a 3-card plan-selection sub-step in the modal (USD plans = `USD_PLANS`, DZD = `DZ_PLANS`, both in `src/lib/plans.js`). `src/lib/billing.js` wraps the Supabase Edge Functions for each provider; the trusted amounts/durations live server-side (never trusted from the browser).

**Stripe is live in production** — three **recurring** USD plans: **month $10 / quarter $25 / year $90** (the year card shows "الأكثر توفيراً"). Each plan maps to a Stripe Price ID held in Supabase secrets: `STRIPE_PRICE_ID` (month, the original), `STRIPE_PRICE_ID_QUARTER` (every 3 months), `STRIPE_PRICE_ID_YEAR` (yearly) — all currency **USD**. Flow: `startPremiumCheckout(plan)` → `create-checkout-session` (validates `plan` ∈ month/quarter/year, defaults to month for back-compat; forces `currency:"usd"`; passes `plan_type` in subscription metadata) → Stripe hosted checkout (`mode:"subscription"`) → `/payment-success`. Stripe drives renewal; `stripe-webhook` syncs `is_premium`, `premium_until` (from `current_period_end`, so correct for every interval), `subscription_status`, `plan_type` (from sub metadata), and `payment_provider:"stripe"` on checkout/subscription/invoice events. Tested LIVE with a 100%-off coupon — Premium activated correctly. Other Stripe secrets: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.

**SlickPay is live in production.** Three DZD plans: **شهر 2500 / 3 أشهر 6500 / سنة 24000 دج** (30/90/365 days), defined in `src/lib/plans.js` (`DZ_PLANS`) for display and authoritatively in `supabase/functions/_shared/slickpay.ts` (`PLANS`). Flow: `startSlickpayCheckout` → `slickpay-create-invoice` → SATIM → `/payment-return` → `slickpay-invoice-status` → `activatePremium`, with `slickpay-webhook` as the server-to-server confirmation. The invoice payload **must include `address`** (SlickPay prod returns 422 without it). Secrets in Supabase: `SLICKPAY_PUBLIC_KEY`, `SLICKPAY_WEBHOOK_SIGNATURE`, `SLICKPAY_BASE_URL` (set to `https://prodapi.slick-pay.com/api/v2`). Edge Functions deploy via `supabase functions deploy <name> --project-ref uulcgvdsqivgkiulurhk` (not Vercel).

## Admin auth is frontend-only — and RLS is wide open

The `/admin` panel is gated by a PIN compared in the browser (`src/lib/config.js`, `ADMIN_PIN` from `VITE_ADMIN_PIN`, unlock state in `sessionStorage`). This is **not** real security: the SQL policies grant the anonymous/publishable key full read+write on `companies`, and public read on `profiles`, `company_requests`, `email_subscribers`, and `stork_codes` (see the security notes in `supabase-phase4.sql` / `phase5` / `phase6a`). Treat all "admin" data as readable by anyone with the public key. Do not assume server-side authorization exists.

## Database

Schema is applied by running the numbered SQL files manually in the Supabase SQL editor, **in order**, once each (all are idempotent / safe to re-run):

`supabase-setup.sql` (companies + logos bucket) → `supabase-auth-setup.sql` (profiles) → `supabase-auth-phase2.sql` (account_type/company fields + `handle_new_user` trigger) → `supabase-phase3.sql` (favorites + company_requests) → `supabase-phase4.sql` (admin read policies) → `supabase-phase5.sql` (email_subscribers) → `supabase-phase6a.sql` (premium + stork_codes) → `supabase-phase6a-note4.sql` (`companies.supports_premium`).

When you add a column or table in code, add a matching idempotent migration as the next phase file rather than editing earlier ones.

Offer types are a fixed Arabic enum used across UI and stats — `"تخفيض"` (discount), `"كوبون"` (coupon), `"كاش باك"` (cashback) — defined with their colors/icons in `src/lib/types.js`.

## PWA والأيقونات

طبقة PWA عبر `vite-plugin-pwa` (إعدادها في `vite.config.js`): manifest + service worker (Network-First لبيانات Supabase، CacheFirst للصور/الخطوط، autoUpdate). أيقونات التطبيق (`pwa-192/512`, `pwa-maskable-192/512`, `apple-touch-icon`) تُولَّد من `public/favicon-1024.png` عبر `npm run pwa-icons` (`scripts/gen-pwa-icons.mjs`).

> **قاعدة دائمة (إلزامية):** `public/favicon.png` هو التصميم **الأصلي بخلفية شفافة** لأيقونة تبويب المتصفح — **ممنوع إعادة توليده أو استبداله نهائياً**. فقط أيقونات PWA تُولَّد من `favicon-1024.png` (سكربت `pwa-icons` لا يلمس `favicon.png`).

## Code voting (التصويت على الأكواد)

كل بطاقة كود فيها قسم "هل نجح هذا الكود معك؟" (👍/👎) بنسبة نجاح وشارة "🔥 الأكثر نجاحاً" — لبناء الثقة و SEO. الهجرة `supabase-phase19-code-votes.sql` (شغّلها مرّة واحدة):

- جدول `code_votes` (صوت واحد لكل مصوّت لكل شركة عبر `unique(company_id, voter_id)`). RLS: **قراءة عامة فقط**؛ كل كتابة تمرّ حصراً عبر RPC `cast_vote` (SECURITY DEFINER، ذرّية). هوية المسجّل تُشتقّ خادمياً من `auth.uid()` (`'u:'||uid`) فلا تُنتحَل؛ الزائر بمعرّف `localStorage` (`'a:'||id`). لا حذف/تعديل مباشر.
- View `code_vote_stats`: `up_count`/`down_count`/`total_count`/`success_rate`/`last_up_at` لكل شركة (للقراءة العامة المجمّعة).
- الواجهة: `src/lib/votes.js` (RPC + voter id + التخزين المحلي `codpromo:voter-id` / `codpromo:votes` + `relativeTime`)، و`VoteStatsProvider` (`src/lib/voteStats.jsx`، مركّب في `App.jsx` فوق الراوتر) يجلب خريطة الإحصائيات مرّة واحدة ويوفّرها لكل البطاقات. مكوّن `src/components/CodeVote.jsx` داخل `CompanyCard` فيظهر تلقائياً في الرئيسية/الفئة/الشركة/المفضّلة وللأكواد العادية و Premium. الرئيسية تدعم الترتيب حسب نسبة النجاح. لوحة الأدمن: تبويب «التصويت» (`src/components/admin/VotesTable.jsx`) لاكتشاف الأكواد الميتة (نسبة منخفضة).

## i18n — اللغات (عربي / إنجليزي / فرنسي)

الموقع متعدّد اللغات عبر **react-i18next**: العربية (الافتراضية، RTL) + الإنجليزية + الفرنسية (LTR).

- ملفات الترجمة في `src/i18n/locales/{ar,en,fr}.json` (مفتاح واحد لكل نص، ويجب أن تبقى المفاتيح **متطابقة** في اللغات الثلاث). التهيئة في `src/i18n/index.js`.
- `src/lib/locale.jsx` (`LocaleProvider` / `useLocale`) يضبط `lang` + `dir` على `<html>`، يحفظ الاختيار في `localStorage` (`codpromo:lang`)، والافتراضي عربي. سكربت anti-flash في `index.html` يضبط اللغة/الاتجاه قبل أول رسم.
- زر اللغة: `src/components/LanguageSwitcher.jsx` (في Navbar + AuthShell + DashboardShell).
- الخط يتبدّل عبر CSS حسب `[lang]` في `src/index.css`: Tajawal للعربية، Inter للإنجليزية/الفرنسية.
- RTL/LTR: استعمل خصائص Tailwind المنطقية (`ps/pe`, `ms/me`, `start/end`, `text-start/text-end`) لا الفيزيائية (`pl/pr`, `left/right`)، والأيقونات الاتجاهية تنقلب بـ `ltr:rotate-180`.
- لوحة `/admin` تبقى عربية RTL ثابتة (ملفوفة بـ `dir="rtl" lang="ar"`) ولا تُترجم. قيم أنواع العروض تبقى عربية في القاعدة وتُعرض مترجمة عبر `getTypeKey` في `src/lib/types.js`.

### ترجمة المحتوى الديناميكي (حقول قاعدة البيانات)
الأوصاف/الفئات الديناميكية للشركات تُترجم **تلقائياً** عند الحفظ، ولا تُترك بالعربية فقط:
- الأعمدة: `description` + `description_en` + `description_fr`، و`category` + `category_en` + `category_fr` (العربية هي المصدر و fallback). الهجرة في `supabase-phase10-i18n.sql`.
- Edge Function `translate-company` (موديل `claude-haiku-4-5-20251001`) يترجم عبر Anthropic API؛ المفتاح `ANTHROPIC_API_KEY` من Supabase secrets فقط (أبداً في الكود/GitHub). نشر: `supabase functions deploy translate-company --no-verify-jwt --project-ref uulcgvdsqivgkiulurhk`.
- `addCompany`/`updateCompany` في `src/lib/supabase.js` يستدعيان الترجمة تلقائياً عبر `withTranslations` (إن فشلت، يُحفظ بالعربية ويُترجَم لاحقاً). زر **"ترجم الكل"** في لوحة الأدمن (تبويب الشركات) يعمل Backfill للموجود.
- العرض في `CompanyCard.jsx` يختار نسخة اللغة النشطة مع fallback للعربية. أسماء العلامات والأكواد والأرقام تبقى كما هي بلا ترجمة.

### قاعدة دائمة (إلزامية)
> **أي ميزة أو محتوى جديد يُضاف إلى الموقع يجب أن يُترجَم تلقائياً للّغات الثلاث (ar/en/fr) عبر react-i18next بنفس النظام الحالي — لا نصوص مكتوبة مباشرة (hardcoded) في الواجهة. والأعلام تكون صوراً/SVG (مكتبة `flag-icons`) وليست emoji.**
>
> **وأي حقل نصي ديناميكي جديد يُضاف لقاعدة البيانات ويظهر للمستخدم (وصف، فئة، عنوان عرض…) يجب أن يتبع نفس نظام الترجمة التلقائية:** أضِف أعمدة `<field>_en` / `<field>_fr` في هجرة جديدة، أدرِج الحقل في `I18N_FIELDS` بـ `src/lib/supabase.js` ليُترجَم عند الحفظ وفي زر "ترجم الكل"، واعرض نسخة اللغة النشطة مع fallback للعربية.

## Theming

Dark is the default. An inline script in `index.html` reads `localStorage["codpromo:theme"]` and sets the `<html>` class **before first paint** to avoid a flash, and shows a `#boot` spinner that `main.jsx` fades out after React mounts. `ThemeProvider` keeps the class in sync. Colors are CSS custom properties (`--text`, `--elev`, `--fill`, `--accent-text`, `--color-ink*`, `--color-lime`, …) redefined under `.dark` / `.light` in `src/index.css` — reference these vars in `className` (e.g. `bg-[var(--color-ink-card)]`) rather than hardcoding hex.

## Environment variables

Set in `.env` locally (gitignored) and in Vercel; see `.env.example`. Note that `supabase.js` and `supabaseClient.js` ship **hardcoded fallbacks** for the Supabase URL/key, so the app runs without env vars, but `VITE_ADMIN_PIN` defaults to a placeholder and must be set for the admin panel.

- `VITE_ADMIN_PIN` — admin panel PIN
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — Supabase project
- `VITE_HCAPTCHA_SITE_KEY` — hCaptcha site key (the `10000000-…0001` test key always passes)
