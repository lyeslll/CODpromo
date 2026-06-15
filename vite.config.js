import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // تحديث تلقائي: عند نشر نسخة جديدة، يتفعّل الـSW الجديد فوراً (skipWaiting)
      // فلا يعلق المستخدم على نسخة قديمة. لا يحتاج أي كود في التطبيق (حقن تلقائي).
      registerType: "autoUpdate",
      injectRegister: "auto",
      manifestFilename: "manifest.json",
      // أصول إضافية تُنسخ وتُتاح (favicon / أيقونة iOS / robots)
      includeAssets: ["favicon.png", "apple-touch-icon.png", "robots.txt"],

      manifest: {
        name: "CODpromo",
        short_name: "CODpromo",
        description: "منصة أكواد الخصم والكوبونات والكاش باك",
        lang: "ar",
        dir: "rtl",
        theme_color: "#0A0A0A",
        background_color: "#0A0A0A",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "pwa-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },

      workbox: {
        // precache لقشرة التطبيق فقط (JS/CSS/HTML) — لا نخزّن أعلام/صور ضخمة مسبقاً.
        globPatterns: ["**/*.{js,css,html}"],
        // SPA: أي تنقّل يُخدَم من index.html (يشمل /store, /category, /admin, العودة من الدفع…)
        navigateFallback: "/index.html",
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          // بيانات Supabase الديناميكية (قراءات REST/Storage) → Network-First:
          // نأخذ الشبكة دائماً (لا بيانات قديمة)، والكاش احتياط قصير عند انقطاع الشبكة فقط.
          // ملاحظة: الكتابات/RPC تستعمل POST فلا تُخزَّن (تذهب للشبكة دائماً)، والمصادقة
          // (/auth/) والـEdge Functions (/functions/) غير مشمولة → تمرّ مباشرة للشبكة.
          {
            urlPattern: ({ url }) =>
              url.hostname.endsWith("supabase.co") &&
              (url.pathname.startsWith("/rest/") || url.pathname.startsWith("/storage/")),
            handler: "NetworkFirst",
            method: "GET",
            options: {
              cacheName: "supabase-data",
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 80, maxAgeSeconds: 300 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // خطوط Google (CSS) → StaleWhileRevalidate
          {
            urlPattern: ({ url }) => url.origin === "https://fonts.googleapis.com",
            handler: "StaleWhileRevalidate",
            options: { cacheName: "google-fonts-css" },
          },
          // ملفات الخطوط → CacheFirst (سنة)
          {
            urlPattern: ({ url }) => url.origin === "https://fonts.gstatic.com",
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-files",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // الصور (لوجوهات/أعلام/أيقونات) → CacheFirst (شهر) لتحميل أسرع
          {
            urlPattern: ({ request }) => request.destination === "image",
            handler: "CacheFirst",
            options: {
              cacheName: "images",
              expiration: { maxEntries: 150, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },

      // السيرفس وركر معطّل في وضع التطوير (npm run dev) — يُختبر عبر build + preview.
      devOptions: { enabled: false },
    }),
  ],
});
