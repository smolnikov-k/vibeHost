import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/projects/:id/editor', destination: '/projects/:id/edit', permanent: true },
      { source: '/projects/:id/patches', destination: '/projects/:id/edit', permanent: true },
    ];
  },
};

export default nextConfig;
