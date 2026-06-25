'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import ArticleEditor from '@/components/admin/ArticleEditor';

export default function AdminBlogEditPage() {
  const params = useParams();
  const router = useRouter();
  const [article, setArticle] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const articleId = params.id as string;

  useEffect(() => {
    api.getAdminArticle(articleId)
      .then(setArticle)
      .catch(() => router.push('/admin/blog'))
      .finally(() => setLoading(false));
  }, [articleId, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
      </div>
    );
  }

  if (!article) {
    return <div className="text-center py-20 text-gray-500">Статья не найдена</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Редактирование: {article.title}</h1>
      <ArticleEditor
        mode="edit"
        initial={{
          id: article.id,
          title: article.title,
          slug: article.slug,
          excerpt: article.excerpt || '',
          content: article.content || '',
          coverImage: article.coverImage || '',
          tags: article.tags || [],
          metaTitle: article.metaTitle || '',
          metaDesc: article.metaDesc || '',
          ogImage: article.ogImage || '',
          status: article.status,
        }}
      />
    </div>
  );
}
