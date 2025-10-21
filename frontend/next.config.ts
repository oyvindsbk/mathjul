import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use standalone for Azure Static Web Apps with Node.js runtime
  output: 'standalone',
  // Disable image optimization for standalone builds
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
