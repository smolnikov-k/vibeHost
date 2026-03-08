'use client';

import { useEffect, useState, useCallback } from 'react';
import { Search, ChevronLeft, ChevronRight, Loader2, Eye, Heart, Ban, CheckCircle, ExternalLink } from 'lucide-react';
import { api, type AdminProject } from '@/lib/api';

const statusColors: Record<string, string> = {
  LIVE: 'bg-emerald-500/20 text-emerald-400',
  PROCESSING: 'bg-blue-500/20 text-blue-400',
  ERROR: 'bg-red-500/20 text-red-400',
  SUSPENDED: 'bg-amber-500/20 text-amber-400',
  UPLOADING: 'bg-gray-700 text-gray-400',
};

export default function AdminProjectsPage() {
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async (p: number, q: string) => {
    setLoading(true);
    try {
      const data = await api.getAdminProjects({ page: p, q: q || undefined });
      setProjects(data.projects);
      setTotalPages(data.pagination.totalPages);
      setTotal(data.pagination.total);
    } catch { /* */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(page, query); }, [page, load]);

  const handleSearch = () => { setPage(1); load(1, query); };

  const handleSuspend = async (id: string) => {
    try {
      const result = await api.suspendProject(id);
      setProjects(prev => prev.map(p => p.id === id ? { ...p, status: result.status } : p));
    } catch { /* */ }
  };

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
    return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Проекты ({total})</h1>
      </div>

      <div className="flex items-center gap-2 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Поиск по названию или slug..."
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 outline-none"
          />
        </div>
        <button onClick={handleSearch} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors">
          Найти
        </button>
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
                <th className="px-4 py-3 text-left font-medium">Проект</th>
                <th className="px-4 py-3 text-left font-medium">Владелец</th>
                <th className="px-4 py-3 text-center font-medium">Статус</th>
                <th className="px-4 py-3 text-center font-medium">Размер</th>
                <th className="px-4 py-3 text-center font-medium">
                  <div className="flex items-center justify-center gap-2">
                    <Eye className="w-3 h-3" />/<Heart className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-4 py-3 text-right font-medium">Действия</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="text-gray-200 font-medium">{p.title}</div>
                    <a href={`https://${p.customDomain || `${p.slug}.hostingvibe.ru`}`} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-400 hover:underline flex items-center gap-1">
                      {p.customDomain || `${p.slug}.hostingvibe.ru`} <ExternalLink className="w-3 h-3" />
                    </a>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{p.user.email}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusColors[p.status] || 'bg-gray-700 text-gray-400'}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-400">{formatSize(p.sizeBytes)}</td>
                  <td className="px-4 py-3 text-center text-gray-400">{p.views} / {p.likes}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleSuspend(p.id)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                        p.status === 'SUSPENDED'
                          ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                          : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                      }`}
                    >
                      {p.status === 'SUSPENDED' ? (
                        <><CheckCircle className="w-3 h-3" /> Разблокировать</>
                      ) : (
                        <><Ban className="w-3 h-3" /> Заблокировать</>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
              {projects.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Проекты не найдены</td></tr>
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
    </div>
  );
}
