import './globals.css';

export const metadata = {
  title: 'MidasHub — All Your Socials, One Place',
  description: 'The ultimate social hub. See every post from every platform in one feed. No restrictions, no limits. Join free.',
  keywords: 'social media, hub, aggregator, facebook, instagram, snapchat, tiktok, twitter',
  manifest: '/manifest.json',
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
          // Self-healing: detect cached error page
          try {
            if (document.referrer.indexOf('chrome-error') > -1) {
              if (navigator.serviceWorker) navigator.serviceWorker.getRegistrations().then(function(r){r.forEach(function(reg){reg.unregister()})});
              setTimeout(function(){ location.replace('/feed'); }, 500);
            }
          } catch(e) {}

          // ChunkLoadError recovery
          window.addEventListener('error', function(e) {
            if (e.message && e.message.indexOf('ChunkLoadError') > -1) {
              setTimeout(function(){ location.reload(); }, 500);
            }
          });

          // Register SW
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js?v=10').then(function(r) {
              r.update();
              if (r.waiting) r.waiting.postMessage({ type: 'SKIP_WAITING' });
            }).catch(function(){});
          }

          // Soft refresh on return from background (NO hard reload)
          // Dispatches event that pages listen to — they refetch data
          var _bg = 0;
          document.addEventListener('visibilitychange', function() {
            if (document.visibilityState === 'hidden') {
              _bg = Date.now();
              // Save scroll position
              try {
                sessionStorage.setItem('mh-scroll', String(window.scrollY));
                sessionStorage.setItem('mh-path', window.location.pathname);
              } catch(e) {}
            } else if (_bg && Date.now() - _bg > 3000) {
              // Only dispatch refresh event — no page reload
              window.dispatchEvent(new Event('midashub:resumed'));
              _bg = 0;
            }
          });

          // Restore scroll
          try {
            var _sp = sessionStorage.getItem('mh-path');
            var _ss = sessionStorage.getItem('mh-scroll');
            if (_sp && _sp === window.location.pathname && _ss) {
              var _sy = parseInt(_ss);
              setTimeout(function() { try { window.scroll(0, _sy); } catch(e) {} }, 500);
              setTimeout(function() { try { window.scroll(0, _sy); } catch(e) {} }, 1500);
            }
            sessionStorage.removeItem('mh-scroll');
            sessionStorage.removeItem('mh-path');
          } catch(e) {}
        `}} />
      </body>
    </html>
  );
}
