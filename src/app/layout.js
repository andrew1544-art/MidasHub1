import './globals.css';

export const metadata = {
  title: 'MidasHub — All Your Socials, One Place',
  description: 'The ultimate social hub. See every post from every platform in one feed. No restrictions, no limits. Join free.',
  keywords: 'social media, hub, aggregator, facebook, instagram, snapchat, tiktok, twitter',
  manifest: '/manifest.json',
  themeColor: '#FFD700',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'MidasHub',
  },
  openGraph: {
    title: 'MidasHub — All Your Socials, One Place',
    description: 'The ultimate social hub. See every post from every platform in one feed.',
    type: 'website',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0a0a0f',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="antialiased">
        {children}
        <script dangerouslySetInnerHTML={{ __html: `
          // SELF-HEALING: Detect broken cache/error state and auto-recover
          try {
            // If referrer is chrome-error, we loaded from a cached error page
            if (document.referrer.indexOf('chrome-error') > -1 || 
                document.referrer.indexOf('chromewebdata') > -1) {
              // Nuclear: clear everything and reload
              if (navigator.serviceWorker) navigator.serviceWorker.getRegistrations().then(function(r){r.forEach(function(reg){reg.unregister()})});
              if (window.caches) caches.keys().then(function(k){k.forEach(function(c){caches.delete(c)})});
              sessionStorage.clear();
              setTimeout(function(){ location.replace('/feed'); }, 500);
            }
          } catch(e) {}

          // Global error handler — if app crashes badly, offer recovery
          window.addEventListener('error', function(e) {
            if (e.message && (e.message.indexOf('ChunkLoadError') > -1 || e.message.indexOf('Loading chunk') > -1)) {
              // Stale JS chunks — clear SW cache and reload
              if (window.caches) caches.keys().then(function(k){k.forEach(function(c){caches.delete(c)})});
              setTimeout(function(){ location.reload(); }, 200);
            }
          });

          // Clear all caches on load
          if ('caches' in window) { caches.keys().then(function(k) { k.forEach(function(c) { caches.delete(c); }); }); }
          // Register/update SW — cache-bust to ensure latest version
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js?v=10').then(function(r) {
              r.update();
              if (r.waiting) { r.waiting.postMessage({ type: 'SKIP_WAITING' }); }
              r.addEventListener('updatefound', function() {
                var nw = r.installing;
                if (nw) nw.addEventListener('statechange', function() {
                  if (nw.state === 'activated') console.log('[SW] New version activated');
                });
              });
            }).catch(function(){});
            // Listen for reload message from new SW
            navigator.serviceWorker.addEventListener('message', function(e) {
              if (e.data && e.data.type === 'RELOAD') window.location.reload();
            });
          }
          // Auto-reload after being away
          var _bg = 0;
          document.addEventListener('visibilitychange', function() {
            if (document.visibilityState === 'hidden') {
              _bg = Date.now();
              try {
                sessionStorage.setItem('mh-scroll', String(window.scrollY));
                sessionStorage.setItem('mh-path', window.location.pathname);
                sessionStorage.setItem('mh-time', String(Date.now()));
                // Check if compose modal is open
                var composeOpen = document.querySelector('.modal-overlay') !== null;
                if (composeOpen) sessionStorage.setItem('mh-compose-open', '1');
              } catch(e) {}
            }
            else if (_bg) {
              var away = Date.now() - _bg;
              // If compose was open, give more time (30s) before reloading
              var wasComposing = false;
              try { wasComposing = sessionStorage.getItem('mh-compose-open') === '1'; } catch(e) {}
              var threshold = wasComposing ? 30000 : 15000;
              if (away > threshold) { window.location.reload(); }
              try { sessionStorage.removeItem('mh-compose-open'); } catch(e) {}
            }
          });
          // Restore scroll after reload
          try {
            var _sp = sessionStorage.getItem('mh-path');
            var _ss = sessionStorage.getItem('mh-scroll');
            var _st = sessionStorage.getItem('mh-time');
            if (_sp && _sp === window.location.pathname && _ss && _st) {
              var _age = Date.now() - parseInt(_st);
              if (_age < 300000) {
                var _sy = parseInt(_ss);
                setTimeout(function() { try { window.scroll(0, _sy); } catch(e) {} }, 400);
                setTimeout(function() { try { window.scroll(0, _sy); } catch(e) {} }, 1000);
                setTimeout(function() { try { window.scroll(0, _sy); } catch(e) {} }, 2000);
              }
              sessionStorage.removeItem('mh-scroll');
              sessionStorage.removeItem('mh-path');
              sessionStorage.removeItem('mh-time');
            }
          } catch(e) {}
        `}} />
      </body>
    </html>
  );
}
