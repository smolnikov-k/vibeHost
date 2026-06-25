'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';

export default function AdminAuditLogPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState('');
  const [targetTypeFilter, setTargetTypeFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getAdminAuditLog(page, actionFilter || undefined, targetTypeFilter || undefined);
      setLogs(data.logs);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotal(data.pagination?.total || 0);
    } catch { /* */ }
    setLoading(false);
  }, [page, actionFilter, targetTypeFilter]);

  useEffect(() => { load(); }, [load]);

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  const actionOptions = [
    '', 'suspend_project', 'unsuspend_project', 'update_user', 'update_report',
    'update_subscription', 'create_article', 'update_article', 'delete_article',
    'publish_article', 'unpublish_article', 'upload_blog_image',
  ];

  const targetOptions = ['', 'project', 'user', 'report', 'subscription', 'article'];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Аудит ({total})</h1>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div>
          <label className="text-xs text-gray-400 block mb-1">Действие</label>
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 text-sm focus:border-emerald-500 outline-none"
          >
            <option value="">Все действия</option>
            {actionOptions.filter(Boolean).map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Тип объекта</label>
          <select
            value={targetTypeFilter}
            onChange={(e) => { setTargetTypeFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 text-sm focus:border-emerald-500 outline-none"
          >
            <option value="">Все типы</option>
            {targetOptions.filter(Boolean).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
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
                <th className="px-4 py-3 text-left font-medium">Админ</th>
                <th className="px-4 py-3 text-left font-medium">Действие</th>
                <th className="px-4 py-3 text-center font-medium">Тип</th>
                <th className="px-4 py-3 text-left font-medium">Target ID</th>
                <th className="px-4 py-3 text-right font-medium">Дата</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-3 text-gray-200">{log.admin?.email || '---'}</td>
                  <td className="px-4 py-3 text-gray-300 font-mono text-xs">{log.action}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-700 text-gray-400">
                      {log.targetType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{log.targetId || '---'}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{formatDate(log.createdAt)}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Нет записей</td></tr>
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
