import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/gallery'],
        disallow: ['/projects', '/billing', '/settings', '/domains'],
      },
    ],
    sitemap: 'https://hostingvibe.ru/sitemap.xml',
  };
}
