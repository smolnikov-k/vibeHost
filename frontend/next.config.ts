import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    root: path.resolve(__dirname),
  },
  async redirects() {
    return [
      { source: '/projects/:id/editor', destination: '/projects/:id/edit', permanent: true },
      { source: '/projects/:id/patches', destination: '/projects/:id/edit', permanent: true },
    ];
  },
};

export default nextConfig;
