'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  AlertTriangle, CheckCircle, XCircle, Clock, ChevronLeft, ChevronRight,
  Loader2, Filter, ExternalLink,
} from 'lucide-react';
import { api, type AdminReport } from '@/lib/api';

const statusLabels: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  PENDING: { label: 'Ожидает', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  REVIEWED: { label: 'Рассмотрена', color: 'bg-blue-100 text-blue-700', icon: AlertTriangle },
  RESOLVED: { label: 'Решена', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  DISMISSED: { label: 'Отклонена', color: 'bg-gray-100 text-gray-500', icon: XCircle },
};

const reasonLabels: Record<string, string> = {
  SPAM: 'Спам',
  MALWARE: 'Вредоносный контент',
  PHISHING: 'Фишинг',
  ILLEGAL: 'Нелегальный контент',
  COPYRIGHT: 'Нарушение авторских прав',
  OTHER: 'Другое',
};

export default function AdminReportsPage() {
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterStatus, setFilterStatus] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getAdminReports({
        page,
        status: filterStatus || undefined,
      });
      setReports(data.reports);
      setTotalPages(data.pagination.totalPages);
      setTotal(data.pagination.total);
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = async (id: string, status: string) => {
    setUpdating(id);
    try {
      await api.updateReportStatus(id, status);
      await load();
    } catch { /* ignore */ }
    finally { setUpdating(null); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Жалобы</h1>
          <p className="text-sm text-gray-400 mt-1">Всего: {total}</p>
        </div>
        <div className="flex items-center gap-1 bg-gray-800 border border-gray-700 rounded-lg p-1">
          <button
            onClick={() => { setFilterStatus(''); setPage(1); }}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              !filterStatus ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Все
          </button>
          {['PENDING', 'REVIEWED', 'RESOLVED', 'DISMISSED'].map((s) => (
            <button
              key={s}
              onClick={() => { setFilterStatus(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filterStatus === s ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              {statusLabels[s]?.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-20">
          <AlertTriangle className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">Нет жалоб</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const st = statusLabels[report.status] || statusLabels.PENDING;
            return (
              <div key={report.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${st.color}`}>
                        {st.label}
                      </span>
                      <span className="text-xs text-gray-500">
                        {reasonLabels[report.reason] || report.reason}
                      </span>
                    </div>
                    <p className="text-sm text-white mb-1">
                      Проект: <span className="text-emerald-400">{report.project.title}</span>{' '}
                      <span className="text-gray-500">({report.project.slug})</span>
                    </p>
                    {report.message && (
                      <p className="text-xs text-gray-400 mt-1">{report.message}</p>
                    )}
                    <p className="text-xs text-gray-600 mt-2">
                      {new Date(report.createdAt).toLocaleString('ru-RU')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={`https://${report.project.customDomain || `${report.project.slug}.hostingvibe.ru`}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-gray-400 hover:text-emerald-400 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    {report.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => handleStatusChange(report.id, 'RESOLVED')}
                          disabled={updating === report.id}
                          className="text-xs px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          Решить
                        </button>
                        <button
                          onClick={() => handleStatusChange(report.id, 'DISMISSED')}
                          disabled={updating === report.id}
                          className="text-xs px-2 py-1 rounded bg-gray-600 text-gray-300 hover:bg-gray-500 disabled:opacity-50"
                        >
                          Отклонить
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:border-emerald-500 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-400 px-3">{page} / {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:border-emerald-500 disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
