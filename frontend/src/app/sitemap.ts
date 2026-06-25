import type { MetadataRoute } from 'next';

const BASE_URL = 'https://hostingvibe.ru';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://hostingvibe.ru/api';

interface GalleryProject {
  slug: string;
  publishedAt: string | null;
}

interface GalleryResponse {
  projects: GalleryProject[];
  pagination: { totalPages: number };
}

interface BlogArticle {
  slug: string;
  publishedAt: string | null;
}

interface BlogResponse {
  articles: BlogArticle[];
  pagination: { totalPages: number };
}

async function fetchGalleryProjects(): Promise<GalleryProject[]> {
  try {
    const res = await fetch(`${API_URL}/gallery?sort=newest&page=1&limit=100`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data: GalleryResponse = await res.json();
    const projects = [...data.projects];

    // Fetch remaining pages if any
    const totalPages = data.pagination.totalPages;
    if (totalPages > 1) {
      const extraPages = await Promise.allSettled(
        Array.from({ length: totalPages - 1 }, (_, i) =>
          fetch(`${API_URL}/gallery?sort=newest&page=${i + 2}&limit=100`, {
            next: { revalidate: 3600 },
          }).then((r) => r.json() as Promise<GalleryResponse>)
        )
      );
      for (const result of extraPages) {
        if (result.status === 'fulfilled') {
          projects.push(...result.value.projects);
        }
      }
    }

    return projects;
  } catch {
    return [];
  }
}

async function fetchBlogArticles(): Promise<BlogArticle[]> {
  try {
    const res = await fetch(`${API_URL}/blog?limit=50&page=1`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data: BlogResponse = await res.json();
    return data.articles;
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE_URL}/blog`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/gallery`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/ai`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/docs`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/register`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/login`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/terms`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/privacy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/offer`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
  ];

  const [galleryProjects, blogArticles] = await Promise.all([
    fetchGalleryProjects(),
    fetchBlogArticles(),
  ]);

  const gallerySlugs: MetadataRoute.Sitemap = galleryProjects.map((project) => ({
    url: `https://${project.slug}.hostingvibe.ru`,
    lastModified: project.publishedAt ? new Date(project.publishedAt) : new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));

  const blogSlugs: MetadataRoute.Sitemap = blogArticles.map((article) => ({
    url: `${BASE_URL}/blog/${article.slug}`,
    lastModified: article.publishedAt ? new Date(article.publishedAt) : new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  return [...staticPages, ...gallerySlugs, ...blogSlugs];
}
