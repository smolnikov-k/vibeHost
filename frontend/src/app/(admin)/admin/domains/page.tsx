'use client';

import { useEffect, useState } from 'react';
import { Loader2, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';

const sslColors: Record<string, string> = {
  ACTIVE: 'bg-emerald-500/20 text-emerald-400',
  PENDING: 'bg-amber-500/20 text-amber-400',
  PROVISIONING: 'bg-blue-500/20 text-blue-400',
  FAILED: 'bg-red-500/20 text-red-400',
  EXPIRED: 'bg-red-500/20 text-red-400',
};

export default function AdminDomainsPage() {
  const [domains, setDomains] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAdminDomains()
      .then((data) => setDomains(data.domains))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function formatDate(d: string) {
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
      <h1 className="text-2xl font-bold text-white mb-6">Домены ({domains.length})</h1>

      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400">
              <th className="px-4 py-3 text-left font-medium">Hostname</th>
              <th className="px-4 py-3 text-left font-medium">Проект</th>
              <th className="px-4 py-3 text-center font-medium">Verified</th>
              <th className="px-4 py-3 text-center font-medium">SSL</th>
              <th className="px-4 py-3 text-right font-medium">Создан</th>
            </tr>
          </thead>
          <tbody>
            {domains.map((d) => (
              <tr key={d.id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                <td className="px-4 py-3">
                  <a
                    href={`https://${d.hostname}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    {d.hostname} <ExternalLink className="w-3 h-3" />
                  </a>
                </td>
                <td className="px-4 py-3 text-gray-300">
                  {d.project?.slug || '---'}
                  {d.project?.title && <span className="text-gray-500 ml-1">({d.project.title})</span>}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    d.verified ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {d.verified ? 'Yes' : 'No'}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${sslColors[d.sslStatus] || 'bg-gray-700 text-gray-400'}`}>
                    {d.sslStatus}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-gray-500">{formatDate(d.createdAt)}</td>
              </tr>
            ))}
            {domains.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Нет доменов</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
