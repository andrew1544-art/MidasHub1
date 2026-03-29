const V = 'v8';

self.addEventListener('install', () => {
  console.log('[SW] Installing', V);
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  console.log('[SW] Activating', V);
  e.waitUntil(
    caches.keys().then(k => Promise.all(k.map(c => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// PUSH — fires even when app is completely closed
self.addEventListener('push', (e) => {
  console.log('[SW] Push received!', e.data?.text());
  let data = { title: 'MidasHub ⚡', body: 'You have a new notification' };
  try {
    if (e.data) {
      const parsed = e.data.json();
      data = { ...data, ...parsed };
    }
  } catch(err) {
    // If JSON parse fails, use text
    if (e.data) data.body = e.data.text();
  }

  const options = {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'midashub-' + Date.now(),
    renotify: true,
    requireInteraction: false,
    vibrate: [200, 100, 200],
    data: { url: data.url || '/feed' },
    actions: [],
  };

  e.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Click notification → open/focus app
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url || '/feed';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      // Focus existing tab if open
      for (const c of list) {
        if (c.url.includes(self.location.origin)) {
          c.focus();
          c.navigate(url);
          return;
        }
      }
      // Open new window
      return clients.openWindow(url);
    })
  );
});
