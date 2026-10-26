/* ==========================================================================
   Service Worker de Dulce Fresa
   Recibe las notificaciones push aunque la página esté cerrada.
   Este archivo DEBE estar en /public para que quede en la raíz del sitio (/sw.js).
   ========================================================================== */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// Llega una notificación desde el panel de promos
self.addEventListener("push", (e) => {
  let datos = {};
  try {
    datos = e.data ? e.data.json() : {};
  } catch {
    datos = { body: e.data ? e.data.text() : "" };
  }

  const titulo = datos.title || "Dulce Fresa 🍓";
  e.waitUntil(
    self.registration.showNotification(titulo, {
      body: datos.body || "",
      // ... aquí pega la ruta de tu ícono (sube un PNG cuadrado de 192x192 a /public/img/)
      icon: datos.icon || "/img/icono-192.png",
      badge: "/img/icono-192.png",
      vibrate: [80, 40, 80],
      data: { url: datos.url || "/" },
    })
  );
});

// La persona toca la notificación: abre (o enfoca) la página en el link de la promo
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || "/", self.location.origin).href;

  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ventanas) => {
      for (const v of ventanas) {
        if (v.url.startsWith(self.location.origin) && "focus" in v) {
          v.navigate(url);
          return v.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});