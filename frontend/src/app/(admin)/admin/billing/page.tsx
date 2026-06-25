'use client';

import { useEffect, useState } from 'react';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-emerald-500/20 text-emerald-400',
  PAST_DUE: 'bg-amber-500/20 text-amber-400',
  CANCELLED: 'bg-red-500/20 text-red-400',
  INACTIVE: 'bg-gray-700 text-gray-400',
};

export default function AdminBillingPage() {
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getAdminSubscriptions(page),
      api.getAdminPayments(),
    ])
      .then(([subData, payData]) => {
        setSubscriptions(subData.subscriptions);
        setTotalPages(subData.pagination?.totalPages || 1);
        setPayments(payData.payments);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  const handleToggle = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'CANCELLED' : 'ACTIVE';
    setActing(id);
    try {
      await api.updateAdminSubscription(id, { status: newStatus });
      const subData = await api.getAdminSubscriptions(page);
      setSubscriptions(subData.subscriptions);
    } catch { /* */ }
    setActing(null);
  };

  function formatDate(d: string | null) {
    if (!d) return '---';
    return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Биллинг</h1>

      {/* Subscriptions */}
      <h2 className="text-lg font-semibold text-gray-300 mb-4">Подписки</h2>
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400">
              <th className="px-4 py-3 text-left font-medium">Email</th>
              <th className="px-4 py-3 text-center font-medium">Статус</th>
              <th className="px-4 py-3 text-center font-medium">Период</th>
              <th className="px-4 py-3 text-right font-medium">Цена</th>
              <th className="px-4 py-3 text-right font-medium">Начало</th>
              <th className="px-4 py-3 text-right font-medium">Окончание</th>
              <th className="px-4 py-3 text-right font-medium">Действие</th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.map((s) => (
              <tr key={s.id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                <td className="px-4 py-3 text-gray-200">{s.user?.email || '---'}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusColors[s.status] || 'bg-gray-700 text-gray-400'}`}>
                    {s.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-gray-400">{s.billingPeriod} мес.</td>
                <td className="px-4 py-3 text-right text-gray-300">{s.priceRub || '---'} RUB</td>
                <td className="px-4 py-3 text-right text-gray-500">{formatDate(s.currentPeriodStart)}</td>
                <td className="px-4 py-3 text-right text-gray-500">{formatDate(s.currentPeriodEnd)}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleToggle(s.id, s.status)}
                    disabled={acting === s.id}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                      s.status === 'ACTIVE'
                        ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                    }`}
                  >
                    {s.status === 'ACTIVE' ? 'Деактивировать' : 'Активировать'}
                  </button>
                </td>
              </tr>
            ))}
            {subscriptions.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Нет подписок</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mb-8">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:border-emerald-500 disabled:opacity-30 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-500 px-3">{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:border-emerald-500 disabled:opacity-30 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Payments */}
      <h2 className="text-lg font-semibold text-gray-300 mb-4">Последние платежи</h2>
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400">
              <th className="px-4 py-3 text-left font-medium">Event ID</th>
              <th className="px-4 py-3 text-left font-medium">Order ID</th>
              <th className="px-4 py-3 text-center font-medium">Статус</th>
              <th className="px-4 py-3 text-right font-medium">Дата</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                <td className="px-4 py-3 text-gray-300 font-mono text-xs">{p.providerEventId || '---'}</td>
                <td className="px-4 py-3 text-gray-400 font-mono text-xs">{p.orderId || '---'}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    p.status === 'PROCESSED' ? 'bg-emerald-500/20 text-emerald-400' :
                    p.status === 'FAILED' ? 'bg-red-500/20 text-red-400' :
                    'bg-gray-700 text-gray-400'
                  }`}>{p.status}</span>
                </td>
                <td className="px-4 py-3 text-right text-gray-500">{formatDate(p.createdAt)}</td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">Нет платежей</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
