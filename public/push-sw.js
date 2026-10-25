/* ============================================================
   CODpromo — إشعارات الهاتف (Web Push) داخل service worker الموقع.
   يتحمّل من sw.js تاع Workbox (vite.config.js → workbox.importScripts).
   النص يجي جاهز من send-push بلغة الجهاز (title / body / url / tag / icon / badge / lang / dir) —
   بلا أي نص هنا غير اسم الموقع كاحتياط. الضغط يحلّ الصفحة (نفس الموقع برك) في نافذة مفتوحة ولا جديدة.
   ============================================================ */
self.addEventListener("push", (event) => {
  let d = {};
  try {
    d = event.data ? event.data.json() : {};
  } catch (e) {
    d = {};
  }
  const str = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");
  const title = str(d.title, 140) || "CODpromo";
  const options = {
    body: str(d.body, 300),
    icon: str(d.icon, 600) || "/pwa-192.png",
    badge: str(d.badge, 600) || "/push-badge.png",
    tag: str(d.tag, 64) || "codpromo",
    lang: str(d.lang, 5) || "ar",
    dir: d.dir === "rtl" || d.dir === "ltr" ? d.dir : "auto",
    data: { url: str(d.url, 600) || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  let target = new URL("/", self.location.origin).href;
  try {
    const u = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin);
    if (u.origin === self.location.origin) target = u.href;
  } catch (e) {
    /* رابط غالط → الرئيسية */
  }
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of wins) {
        if (new URL(c.url).origin !== self.location.origin) continue;
        try {
          await c.focus();
          if ("navigate" in c) await c.navigate(target);
          return;
        } catch (e) {
          /* نافذة ما تتبدّلش → نافذة جديدة */
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
