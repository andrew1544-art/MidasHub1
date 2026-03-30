/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  headers: async () => [
    {
      // Never cache the service worker — always get latest
      source: '/sw.js',
      headers: [
        { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        { key: 'Service-Worker-Allowed', value: '/' },
      ],
    },
    {
      // HTML pages — show cached version instantly, refresh in background
      source: '/((?!_next/static|_next/image|icon|manifest|sw).*)',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=0, s-maxage=60, stale-while-revalidate=300' },
      ],
    },
  ],
};

module.exports = nextConfig;
