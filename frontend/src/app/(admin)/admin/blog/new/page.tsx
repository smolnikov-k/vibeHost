'use client';

import ArticleEditor from '@/components/admin/ArticleEditor';

export default function AdminBlogNewPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Новая статья</h1>
      <ArticleEditor mode="create" />
    </div>
  );
}
