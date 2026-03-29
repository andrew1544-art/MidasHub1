const CACHE_NAME = 'midashub-v4';

self.addEventListener('install', () => {
  // Skip waiting — take over immediately, don't wait for old SW to die
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  // Delete ALL old caches immediately
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // NEVER cache anything — always go to network
  // This ensures users always get the latest version
  return;
});
