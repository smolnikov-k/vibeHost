import type { MetadataRoute } from 'next';

const BASE_URL = 'https://hostingvibe.ru';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://hostingvibe.ru/api';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE_URL}/gallery`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/ai`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/docs`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/register`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/login`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/terms`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/privacy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/offer`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
  ];

  // Add public gallery projects
  try {
    const res = await fetch(`${API_URL}/gallery?limit=50`, { next: { revalidate: 3600 } });
    if (res.ok) {
      const data = await res.json();
      const galleryPages: MetadataRoute.Sitemap = (data.projects || []).map((p: { slug: string; publishedAt?: string }) => ({
        url: `${BASE_URL}/gallery/${p.slug}`,
        lastModified: p.publishedAt ? new Date(p.publishedAt) : new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }));
      return [...staticPages, ...galleryPages];
    }
  } catch { /* gallery fetch failed — return static pages only */ }

  return staticPages;
}
