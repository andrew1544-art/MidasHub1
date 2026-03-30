const V = 'v10';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(k => Promise.all(k.map(c => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (e.data && e.data.type === 'CLEAR_CACHES') {
    caches.keys().then(k => Promise.all(k.map(c => caches.delete(c))));
  }
});

// NO fetch handler — prevents caching issues

// PUSH notifications
self.addEventListener('push', (e) => {
  let data = { title: 'MidasHub', body: 'You have a new notification' };
  try { if (e.data) data = { ...data, ...e.data.json() }; } catch(err) { if (e.data) data.body = e.data.text(); }
  e.waitUntil(self.registration.showNotification(data.title, {
    body: data.body, icon: '/icon-192.png', badge: '/icon-192.png',
    tag: data.tag || 'midashub-' + Date.now(), renotify: true,
    vibrate: [200, 100, 200], data: { url: data.url || '/feed' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url || '/feed';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes(self.location.origin)) { c.focus(); c.navigate(url); return; }
      }
      return self.clients.openWindow(url);
    })
  );
});
