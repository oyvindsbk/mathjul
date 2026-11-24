import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Standalone server: middleware and the API proxy need a Node runtime, not a static export.
  output: 'standalone',
  poweredByHeader: false,
};

export default nextConfig;
