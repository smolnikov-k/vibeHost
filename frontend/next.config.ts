import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  async redirects() {
    return [
      { source: '/projects/:id/editor', destination: '/projects/:id/edit', permanent: true },
      { source: '/projects/:id/patches', destination: '/projects/:id/edit', permanent: true },
    ];
  },
};

export default nextConfig;
