const V = 'v6';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(k => Promise.all(k.map(c => caches.delete(c))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll()).then(clients => {
        clients.forEach(c => c.postMessage({ type: 'RELOAD' }));
      })
  );
});
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
