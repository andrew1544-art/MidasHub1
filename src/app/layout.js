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
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
              navigator.serviceWorker.register('/sw.js').catch(() => {});
            });
          }
        `}} />
      </body>
    </html>
  );
}
