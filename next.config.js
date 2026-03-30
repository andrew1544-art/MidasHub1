/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  headers: async () => [
    {
      source: '/sw.js',
      headers: [
        { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        { key: 'Service-Worker-Allowed', value: '/' },
      ],
    },
    {
      source: '/recover.html',
      headers: [
        { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
      ],
    },
    {
      source: '/((?!_next/static|_next/image|icon|manifest|sw|recover).*)',
      headers: [
        { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
      ],
    },
  ],
};

module.exports = nextConfig;
