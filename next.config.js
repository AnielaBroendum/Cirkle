/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      // Test brands' product images are linked from their own webshops (MVP).
      { protocol: 'https', hostname: 'cdn.shopify.com' },
      { protocol: 'https', hostname: 'cdn.prod.website-files.com' },
    ],
  },
  // Old addresses (NEXT_PUBLIC_LEGACY_HOSTS, comma-separated, e.g. the
  // *.vercel.app domain) redirect permanently (308) to the same path and query
  // on the app URL, so QR tags printed with them keep working.
  async redirects() {
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');
    if (!/^https:\/\//.test(appUrl)) return [];
    const appHost = new URL(appUrl).host;
    return (process.env.NEXT_PUBLIC_LEGACY_HOSTS || '')
      .split(',')
      .map((h) => h.trim().toLowerCase())
      .filter((h) => h && h !== appHost)
      .map((host) => ({
        source: '/:path*',
        has: [{ type: 'host', value: host }],
        destination: `${appUrl}/:path*`,
        permanent: true,
      }));
  },
};

module.exports = nextConfig;
