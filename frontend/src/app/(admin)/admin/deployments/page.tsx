'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Loader2, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '@/lib/api';

const statusColors: Record<string, string> = {
  LIVE: 'bg-emerald-500/20 text-emerald-400',
  FAILED: 'bg-red-500/20 text-red-400',
  PENDING: 'bg-amber-500/20 text-amber-400',
  EXTRACTING: 'bg-blue-500/20 text-blue-400',
  BUILDING: 'bg-blue-500/20 text-blue-400',
  PREVIEW: 'bg-purple-500/20 text-purple-400',
  SUPERSEDED: 'bg-gray-700 text-gray-400',
};

export default function AdminDeploymentsPage() {
  const [deployments, setDeployments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getAdminDeployments(page, statusFilter || undefined);
      setDeployments(data.deployments);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotal(data.pagination?.total || 0);
    } catch { /* */ }
    setLoading(false);
  }, [page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
    return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Деплои ({total})</h1>
      </div>

      <div className="flex items-center gap-1 bg-gray-800 border border-gray-700 rounded-lg p-1 mb-6 w-fit">
        {[
          { value: '', label: 'Все' },
          { value: 'LIVE', label: 'LIVE' },
          { value: 'FAILED', label: 'ERROR' },
          { value: 'PENDING', label: 'PENDING' },
          { value: 'BUILDING', label: 'BUILDING' },
          { value: 'PREVIEW', label: 'PREVIEW' },
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
                <th className="px-4 py-3 text-center font-medium">Статус</th>
                <th className="px-4 py-3 text-center font-medium">Версия</th>
                <th className="px-4 py-3 text-right font-medium">Размер</th>
                <th className="px-4 py-3 text-right font-medium">Дата</th>
                <th className="px-4 py-3 text-center font-medium">Лог</th>
              </tr>
            </thead>
            <tbody>
              {deployments.map((d) => (
                <React.Fragment key={d.id}>
                  <tr className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-emerald-400">{d.project?.slug || '---'}</div>
                      <div className="text-xs text-gray-500">{d.project?.user?.email}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusColors[d.status] || 'bg-gray-700 text-gray-400'}`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-300">v{d.version}</td>
                    <td className="px-4 py-3 text-right text-gray-400">{formatSize(d.sizeBytes)}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{formatDate(d.createdAt)}</td>
                    <td className="px-4 py-3 text-center">
                      {(d.buildLog || d.errorMessage) ? (
                        <button
                          onClick={() => setExpandedLog(expandedLog === d.id ? null : d.id)}
                          className="text-gray-400 hover:text-emerald-400 transition-colors"
                        >
                          {expandedLog === d.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      ) : (
                        <span className="text-gray-600">---</span>
                      )}
                    </td>
                  </tr>
                  {expandedLog === d.id && (d.buildLog || d.errorMessage) && (
                    <tr>
                      <td colSpan={6} className="px-4 py-3 bg-gray-900">
                        <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono max-h-60 overflow-auto">
                          {d.buildLog || d.errorMessage}
                        </pre>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {deployments.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Нет деплоев</td></tr>
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
