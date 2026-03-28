import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow board-deploy to build into a staging dir (.next.staging) without
  // touching the live .next/ that prod is serving from.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  serverExternalPackages: ['better-sqlite3', 'sqlite-vec'],
  reactCompiler: true,
  async headers() {
    return [
      {
        // Never cache HTML pages — browser always gets fresh chunk references after deploy
        source: '/((?!_next/static|_next/image|favicon.ico).*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
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
