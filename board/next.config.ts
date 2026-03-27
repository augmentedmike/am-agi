import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow board-deploy to build into a staging dir (.next.staging) without
  // touching the live .next/ that prod is serving from.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  reactCompiler: true,
  async headers() {
    return [
      {
        // Allow embed routes to be loaded in iframes from any origin
        source: '/embed/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
          { key: 'Content-Security-Policy', value: "frame-ancestors *" },
        ],
      },
    ];
  },
};

export default nextConfig;
