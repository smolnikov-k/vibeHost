import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/gallery', '/blog', '/docs'],
        disallow: ['/projects', '/billing', '/settings', '/domains', '/admin', '/api/'],
      },
    ],
    sitemap: 'https://hostingvibe.ru/sitemap.xml',
  };
}
