import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use export for static export to Azure Static Web Apps
  output: 'export',
  // Disable image optimization for static export
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
