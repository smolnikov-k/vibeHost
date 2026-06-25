'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Search, Plus, Loader2, Edit2, Trash2, Eye, EyeOff, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

export default function AdminBlogPage() {
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [acting, setActing] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getAdminArticles(page, statusFilter || undefined, search || undefined);
      setArticles(data.articles);
      setTotalPages(data.pagination.totalPages);
      setTotal(data.pagination.total);
    } catch { /* */ }
    setLoading(false);
  }, [page, statusFilter, search]);

  useEffect(() => { load(); }, [load]);

  const handleSearch = () => { setPage(1); load(); };

  const handlePublish = async (id: string) => {
    setActing(id);
    try {
      await api.publishAdminArticle(id);
      await load();
    } catch { /* */ }
    setActing(null);
  };

  const handleUnpublish = async (id: string) => {
    setActing(id);
    try {
      await api.unpublishAdminArticle(id);
      await load();
    } catch { /* */ }
    setActing(null);
  };

  const handleDelete = async (id: string) => {
    setActing(id);
    try {
      await api.deleteAdminArticle(id);
      await load();
    } catch { /* */ }
    setActing(null);
    setDeleteTarget(null);
  };

  function formatDate(d: string | null) {
    if (!d) return '---';
    return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Блог ({total})</h1>
        <Link
          href="/admin/blog/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Новая статья
        </Link>
      </div>

      {/* Search + filter */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Поиск по заголовку..."
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 outline-none"
          />
        </div>
        <div className="flex items-center gap-1 bg-gray-800 border border-gray-700 rounded-lg p-1">
          {[
            { value: '', label: 'Все' },
            { value: 'DRAFT', label: 'Черновики' },
            { value: 'PUBLISHED', label: 'Опубликованные' },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => { setStatusFilter(f.value); setPage(1); }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                statusFilter === f.value ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
        </div>
      ) : (
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400">
                <th className="px-4 py-3 text-left font-medium">Заголовок</th>
                <th className="px-4 py-3 text-center font-medium">Статус</th>
                <th className="px-4 py-3 text-center font-medium">Просмотры</th>
                <th className="px-4 py-3 text-right font-medium">Опубликовано</th>
                <th className="px-4 py-3 text-right font-medium">Действия</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((a) => (
                <tr key={a.id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="text-gray-200 font-medium">{a.title}</div>
                    <div className="text-xs text-gray-500">{a.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      a.status === 'PUBLISHED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-700 text-gray-400'
                    }`}>{a.status === 'PUBLISHED' ? 'Опубликована' : 'Черновик'}</span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-400">{a.viewCount || 0}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{formatDate(a.publishedAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/admin/blog/${a.id}/edit`}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-400 hover:bg-gray-700/50 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Link>
                      {a.status === 'DRAFT' ? (
                        <button
                          onClick={() => handlePublish(a.id)}
                          disabled={acting === a.id}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-400 hover:bg-gray-700/50 transition-colors disabled:opacity-50"
                          title="Опубликовать"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUnpublish(a.id)}
                          disabled={acting === a.id}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-amber-400 hover:bg-gray-700/50 transition-colors disabled:opacity-50"
                          title="Снять с публикации"
                        >
                          <EyeOff className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => setDeleteTarget({ id: a.id, title: a.title })}
                        disabled={acting === a.id}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-gray-700/50 transition-colors disabled:opacity-50"
                        title="Удалить"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {articles.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Нет статей</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:border-emerald-500 disabled:opacity-30 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-500 px-3">{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:border-emerald-500 disabled:opacity-30 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
        title="Удалить статью"
        message={`Вы уверены, что хотите удалить статью "${deleteTarget?.title}"?`}
        confirmLabel="Удалить"
        variant="danger"
        loading={acting === deleteTarget?.id}
      />
    </div>
  );
}
