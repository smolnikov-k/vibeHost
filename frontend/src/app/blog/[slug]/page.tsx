import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArticleContent } from './ArticleContent';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://hostingvibe.ru/api';

interface BlogArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string | null;
  coverImage: string | null;
  author: { displayName: string | null };
  status: string;
  publishedAt: string | null;
  viewCount: number;
  readTime: number;
  metaTitle: string | null;
  metaDesc: string | null;
  ogImage: string | null;
  tags: string[];
  createdAt: string;
}

async function getArticle(slug: string): Promise<BlogArticle | null> {
  try {
    const res = await fetch(`${API_URL}/blog/${encodeURIComponent(slug)}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return { title: 'Статья не найдена' };

  return {
    title: article.metaTitle || article.title,
    description: article.metaDesc || article.excerpt || undefined,
    alternates: { canonical: `/blog/${article.slug}` },
    openGraph: {
      title: article.metaTitle || article.title,
      description: article.metaDesc || article.excerpt || undefined,
      type: 'article',
      url: `https://hostingvibe.ru/blog/${article.slug}`,
      images: article.ogImage || article.coverImage ? [{ url: (article.ogImage || article.coverImage)! }] : undefined,
      publishedTime: article.publishedAt || undefined,
      authors: article.author.displayName ? [article.author.displayName] : undefined,
      tags: article.tags,
    },
  };
}

export default async function BlogArticlePage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) notFound();

  return <ArticleContent article={article} />;
}
