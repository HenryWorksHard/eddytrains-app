import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'gwynpezohzwhueeimjao.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  // Apple App Site Association — iOS fetches this file from
  // https://app.cmpdcollective.com/.well-known/apple-app-site-association
  // to know which paths (e.g. /update-password, /accept-invite) should
  // open the Capacitor app directly instead of Safari. It's a JSON file
  // with NO extension, so we must force the correct Content-Type header
  // or iOS silently rejects it.
  async headers() {
    return [
      {
        source: '/.well-known/apple-app-site-association',
        headers: [
          { key: 'Content-Type', value: 'application/json' },
          // Cache aggressively — iOS caches this file per domain and only
          // refetches when the associated-domains entitlement changes.
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
    ]
  },
};

export default nextConfig;
