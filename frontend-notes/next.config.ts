import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Standalone server: middleware and the API proxy need a Node runtime, not a static export.
  output: 'standalone',
  poweredByHeader: false,
  // "Kontekster" were renamed to "prosjekter"; keep old bookmarks working.
  redirects: async () => [{ source: '/kontekster', destination: '/prosjekter', permanent: true }],
};

export default nextConfig;
