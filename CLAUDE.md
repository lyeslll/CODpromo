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
- إصلاحات Premium: تأثير الخدش (scratch)، الإطار الذهبي، ارتفاع البطاقة، و`supports_premium` لكل بطاقة على حدة.
- ربط نظام الدفع.
- قالب الإيميلات.

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

## Admin auth is frontend-only — and RLS is wide open

The `/admin` panel is gated by a PIN compared in the browser (`src/lib/config.js`, `ADMIN_PIN` from `VITE_ADMIN_PIN`, unlock state in `sessionStorage`). This is **not** real security: the SQL policies grant the anonymous/publishable key full read+write on `companies`, and public read on `profiles`, `company_requests`, `email_subscribers`, and `stork_codes` (see the security notes in `supabase-phase4.sql` / `phase5` / `phase6a`). Treat all "admin" data as readable by anyone with the public key. Do not assume server-side authorization exists.

## Database

Schema is applied by running the numbered SQL files manually in the Supabase SQL editor, **in order**, once each (all are idempotent / safe to re-run):

`supabase-setup.sql` (companies + logos bucket) → `supabase-auth-setup.sql` (profiles) → `supabase-auth-phase2.sql` (account_type/company fields + `handle_new_user` trigger) → `supabase-phase3.sql` (favorites + company_requests) → `supabase-phase4.sql` (admin read policies) → `supabase-phase5.sql` (email_subscribers) → `supabase-phase6a.sql` (premium + stork_codes) → `supabase-phase6a-note4.sql` (`companies.supports_premium`).

When you add a column or table in code, add a matching idempotent migration as the next phase file rather than editing earlier ones.

Offer types are a fixed Arabic enum used across UI and stats — `"تخفيض"` (discount), `"كوبون"` (coupon), `"كاش باك"` (cashback) — defined with their colors/icons in `src/lib/types.js`.

## Theming

Dark is the default. An inline script in `index.html` reads `localStorage["codpromo:theme"]` and sets the `<html>` class **before first paint** to avoid a flash, and shows a `#boot` spinner that `main.jsx` fades out after React mounts. `ThemeProvider` keeps the class in sync. Colors are CSS custom properties (`--text`, `--elev`, `--fill`, `--accent-text`, `--color-ink*`, `--color-lime`, …) redefined under `.dark` / `.light` in `src/index.css` — reference these vars in `className` (e.g. `bg-[var(--color-ink-card)]`) rather than hardcoding hex.

## Environment variables

Set in `.env` locally (gitignored) and in Vercel; see `.env.example`. Note that `supabase.js` and `supabaseClient.js` ship **hardcoded fallbacks** for the Supabase URL/key, so the app runs without env vars, but `VITE_ADMIN_PIN` defaults to a placeholder and must be set for the admin panel.

- `VITE_ADMIN_PIN` — admin panel PIN
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — Supabase project
- `VITE_HCAPTCHA_SITE_KEY` — hCaptcha site key (the `10000000-…0001` test key always passes)
