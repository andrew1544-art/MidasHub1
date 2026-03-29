const V = 'v7';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(k => Promise.all(k.map(c => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// PUSH NOTIFICATION — shows even when app is closed
self.addEventListener('push', (e) => {
  let data = { title: 'MidasHub ⚡', body: 'You have a new notification', icon: '/icon-192.png' };
  try { if (e.data) data = { ...data, ...e.data.json() }; } catch(err) {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'midashub-' + Date.now(),
      renotify: true,
      vibrate: [200, 100, 200],
      data: { url: data.url || '/feed' },
    })
  );
});

// Click notification → open app
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url || '/feed';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) { if (c.url.includes(self.location.origin)) { c.focus(); c.navigate(url); return; } }
      return clients.openWindow(url);
    })
  );
});
