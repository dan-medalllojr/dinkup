// Web Push handlers, pulled into the generated service worker with Workbox's
// importScripts (see vite.config.ts). Plain JS: it runs in the worker as-is.

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Dinkup', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      // Same tag replaces an older notification about the same thing.
      tag: data.tag,
      data: { url: data.url || '/' },
    }),
  );
});

// Tapping a notification opens the game: reuse an open Dinkup window if there
// is one, otherwise open a new one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) return open.focus().then((w) => w.navigate(url));
      return self.clients.openWindow(url);
    }),
  );
});
