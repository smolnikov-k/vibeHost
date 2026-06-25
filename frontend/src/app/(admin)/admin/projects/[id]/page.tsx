'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Loader2, ExternalLink, Ban, CheckCircle, Eye, FileText,
  Paintbrush, QrCode, ChevronDown, ChevronRight,
} from 'lucide-react';
import { api } from '@/lib/api';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

const statusColors: Record<string, string> = {
  LIVE: 'bg-emerald-500/20 text-emerald-400',
  SUSPENDED: 'bg-red-500/20 text-red-400',
  ERROR: 'bg-red-500/20 text-red-400',
  PROCESSING: 'bg-amber-500/20 text-amber-400',
  UPLOADING: 'bg-gray-700 text-gray-400',
};

const sslColors: Record<string, string> = {
  ACTIVE: 'bg-emerald-500/20 text-emerald-400',
  PENDING: 'bg-amber-500/20 text-amber-400',
  PROVISIONING: 'bg-amber-500/20 text-amber-400',
  FAILED: 'bg-red-500/20 text-red-400',
  EXPIRED: 'bg-red-500/20 text-red-400',
  NONE: 'bg-gray-700 text-gray-400',
};

const deployStatusColors: Record<string, string> = {
  LIVE: 'bg-emerald-500/20 text-emerald-400',
  FAILED: 'bg-red-500/20 text-red-400',
  PENDING: 'bg-amber-500/20 text-amber-400',
  EXTRACTING: 'bg-blue-500/20 text-blue-400',
  BUILDING: 'bg-blue-500/20 text-blue-400',
  SUPERSEDED: 'bg-gray-700 text-gray-400',
};

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'deployments', label: 'Deployments' },
  { id: 'domains', label: 'Domains' },
  { id: 'analytics', label: 'Analytics' },
];

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(d: string) {
  return new Date(d).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function AdminProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [confirmSuspend, setConfirmSuspend] = useState(false);
  const [suspending, setSuspending] = useState(false);
  const [expandedDeploy, setExpandedDeploy] = useState<string | null>(null);

  useEffect(() => {
    api.getAdminProjectDetail(projectId)
      .then(setData)
      .catch(() => router.push('/admin/projects'))
      .finally(() => setLoading(false));
  }, [projectId, router]);

  const handleSuspend = async () => {
    if (!data) return;
    setSuspending(true);
    try {
      const result = await api.suspendProject(projectId);
      setData((prev: any) => ({
        ...prev,
        project: { ...prev.project, status: result.status },
      }));
    } catch { /* */ }
    setSuspending(false);
    setConfirmSuspend(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
      </div>
    );
  }

  if (!data) {
    return <div className="text-center py-20 text-gray-500">Проект не найден</div>;
  }

  const { project, deployments, domains, stats } = data;
  const siteUrl = `https://${project.slug}.hostingvibe.ru`;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Link href="/admin/projects" className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:border-emerald-500 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-white flex items-center gap-2 flex-wrap">
            {project.title}
            <span className="font-mono text-sm text-gray-400 font-normal">{project.slug}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusColors[project.status] || 'bg-gray-700 text-gray-400'}`}>
              {project.status}
            </span>
          </h1>
          <div className="flex items-center gap-3 text-sm text-gray-400 mt-1">
            <span>{project.user.email}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              project.user.plan === 'PRO' ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-700 text-gray-400'
            }`}>{project.user.plan}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <a
            href={siteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-700 text-gray-200 text-sm font-medium hover:bg-gray-600 transition-colors"
          >
            <ExternalLink className="w-4 h-4" /> Открыть сайт
          </a>
          {(project.status === 'LIVE' || project.status === 'SUSPENDED') && (
            <button
              onClick={() => setConfirmSuspend(true)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                project.status === 'SUSPENDED'
                  ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                  : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
              }`}
            >
              {project.status === 'SUSPENDED' ? (
                <><CheckCircle className="w-4 h-4" /> Unsuspend</>
              ) : (
                <><Ban className="w-4 h-4" /> Suspend</>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700 mb-6 mt-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {activeTab === 'overview' && (
        <div>
          {/* Stat cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-gray-400">Просмотры</span>
              </div>
              <div className="text-xl font-bold text-white">{stats.views.total}</div>
              <div className="text-xs text-gray-500 mt-1">
                Сегодня: {stats.views.today} | Неделя: {stats.views.week} | Месяц: {stats.views.month}
              </div>
            </div>
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-purple-400" />
                <span className="text-xs text-gray-400">Формы</span>
              </div>
              <div className="text-xl font-bold text-white">{stats.formSubmissions}</div>
            </div>
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Paintbrush className="w-4 h-4 text-amber-400" />
                <span className="text-xs text-gray-400">Патчи</span>
              </div>
              <div className="text-xl font-bold text-white">{stats.patches}</div>
            </div>
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
              <div className="flex items-center gap-2 mb-2">
                <QrCode className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-gray-400">QR-коды</span>
              </div>
              <div className="text-xl font-bold text-white">{stats.qrCodes}</div>
            </div>
          </div>

          {/* Project info */}
          <div className="grid sm:grid-cols-2 gap-4 mb-8">
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
              <h3 className="text-sm font-medium text-gray-300 mb-4">Информация о проекте</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Slug</span>
                  <span className="text-white font-mono">{project.slug}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Статус</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusColors[project.status] || 'bg-gray-700 text-gray-400'}`}>
                    {project.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Размер</span>
                  <span className="text-white">{formatSize(project.sizeBytes)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Версия</span>
                  <span className="text-white">v{project.currentVersion}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Публичный</span>
                  <span className={project.isPublic ? 'text-emerald-400' : 'text-gray-500'}>{project.isPublic ? 'Да' : 'Нет'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Создан</span>
                  <span className="text-white">{formatDate(project.createdAt)}</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
              <h3 className="text-sm font-medium text-gray-300 mb-4">Владелец</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Email</span>
                  <span className="text-white">{project.user.email}</span>
                </div>
                {project.user.displayName && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Имя</span>
                    <span className="text-white">{project.user.displayName}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-400">Тариф</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    project.user.plan === 'PRO' ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-700 text-gray-400'
                  }`}>{project.user.plan}</span>
                </div>
                <div className="mt-4">
                  <Link
                    href={`/admin/users/${project.user.id}`}
                    className="text-emerald-400 hover:underline text-sm"
                  >
                    Перейти к пользователю →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Deployments */}
      {activeTab === 'deployments' && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700">
            <h3 className="text-sm font-medium text-gray-300">Последние деплои ({deployments.length})</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400">
                <th className="px-4 py-2 text-left font-medium w-8"></th>
                <th className="px-4 py-2 text-center font-medium">Версия</th>
                <th className="px-4 py-2 text-center font-medium">Статус</th>
                <th className="px-4 py-2 text-center font-medium">Размер</th>
                <th className="px-4 py-2 text-right font-medium">Дата</th>
              </tr>
            </thead>
            <tbody>
              {deployments.map((d: any) => (
                <>
                  <tr
                    key={d.id}
                    className="border-b border-gray-700/50 hover:bg-gray-700/30 cursor-pointer transition-colors"
                    onClick={() => setExpandedDeploy(expandedDeploy === d.id ? null : d.id)}
                  >
                    <td className="px-4 py-2 text-gray-500">
                      {(d.buildLog || d.errorMessage) && (
                        expandedDeploy === d.id
                          ? <ChevronDown className="w-4 h-4" />
                          : <ChevronRight className="w-4 h-4" />
                      )}
                    </td>
                    <td className="px-4 py-2 text-center text-gray-300">v{d.version}</td>
                    <td className="px-4 py-2 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${deployStatusColors[d.status] || 'bg-gray-700 text-gray-400'}`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center text-gray-400">{formatSize(d.sizeBytes)}</td>
                    <td className="px-4 py-2 text-right text-gray-500">{formatDateTime(d.createdAt)}</td>
                  </tr>
                  {expandedDeploy === d.id && (d.buildLog || d.errorMessage) && (
                    <tr key={`${d.id}-log`} className="border-b border-gray-700/50">
                      <td colSpan={5} className="px-4 py-3">
                        {d.errorMessage && (
                          <div className="mb-2">
                            <span className="text-xs text-red-400 font-medium">Error: </span>
                            <span className="text-xs text-red-300">{d.errorMessage}</span>
                          </div>
                        )}
                        {d.buildLog && (
                          <pre className="text-xs text-gray-300 bg-gray-900 rounded-lg p-3 max-h-60 overflow-y-auto whitespace-pre-wrap">
                            {d.buildLog}
                          </pre>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {deployments.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Нет деплоев</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Domains */}
      {activeTab === 'domains' && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700">
            <h3 className="text-sm font-medium text-gray-300">Домены ({domains.length})</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400">
                <th className="px-4 py-2 text-left font-medium">Hostname</th>
                <th className="px-4 py-2 text-center font-medium">Verified</th>
                <th className="px-4 py-2 text-center font-medium">SSL</th>
                <th className="px-4 py-2 text-right font-medium">Дата</th>
              </tr>
            </thead>
            <tbody>
              {domains.map((d: any) => (
                <tr key={d.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="px-4 py-2">
                    <a
                      href={`https://${d.hostname}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-400 hover:underline flex items-center gap-1"
                    >
                      {d.hostname} <ExternalLink className="w-3 h-3" />
                    </a>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      d.verified ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-700 text-gray-400'
                    }`}>
                      {d.verified ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${sslColors[d.sslStatus] || 'bg-gray-700 text-gray-400'}`}>
                      {d.sslStatus}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right text-gray-500">{formatDate(d.createdAt)}</td>
                </tr>
              ))}
              {domains.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">Нет доменов</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Analytics */}
      {activeTab === 'analytics' && (
        <div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
              <div className="text-xs text-gray-400 mb-1">Всего просмотров</div>
              <div className="text-2xl font-bold text-white">{stats.views.total}</div>
            </div>
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
              <div className="text-xs text-gray-400 mb-1">Сегодня</div>
              <div className="text-2xl font-bold text-white">{stats.views.today}</div>
            </div>
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
              <div className="text-xs text-gray-400 mb-1">За неделю</div>
              <div className="text-2xl font-bold text-white">{stats.views.week}</div>
            </div>
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
              <div className="text-xs text-gray-400 mb-1">За месяц</div>
              <div className="text-2xl font-bold text-white">{stats.views.month}</div>
            </div>
          </div>
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
            <h3 className="text-sm font-medium text-gray-300 mb-4">Активность</h3>
            <div className="grid sm:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Формы: </span>
                <span className="text-white font-medium">{stats.formSubmissions}</span>
              </div>
              <div>
                <span className="text-gray-400">Патчи: </span>
                <span className="text-white font-medium">{stats.patches}</span>
              </div>
              <div>
                <span className="text-gray-400">QR-коды: </span>
                <span className="text-white font-medium">{stats.qrCodes}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmSuspend}
        onConfirm={handleSuspend}
        onCancel={() => setConfirmSuspend(false)}
        title={project.status === 'SUSPENDED' ? 'Разблокировать проект' : 'Заблокировать проект'}
        message={project.status === 'SUSPENDED'
          ? `Разблокировать проект "${project.title}"?`
          : `Заблокировать проект "${project.title}"? Сайт станет недоступен.`
        }
        confirmLabel={project.status === 'SUSPENDED' ? 'Разблокировать' : 'Заблокировать'}
        variant={project.status === 'SUSPENDED' ? 'default' : 'danger'}
        loading={suspending}
      />
    </div>
  );
}
