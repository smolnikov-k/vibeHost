'use client';

import { useState } from 'react';
import { Clock, RotateCcw, ChevronDown, ChevronUp, ExternalLink, Loader2 } from 'lucide-react';
import { formatBytes } from '@/lib/utils';
import { formatDate, statusColors, type Deployment } from './shared';

interface DeploymentHistoryProps {
  deployments: Deployment[];
  onRollback: (version: number) => Promise<void>;
  onPublish?: (deploymentId: string) => Promise<void>;
}

export function DeploymentHistory({ deployments, onRollback, onPublish }: DeploymentHistoryProps) {
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const handlePublish = async (deploymentId: string) => {
    if (!onPublish || publishingId) return;
    setPublishingId(deploymentId);
    try {
      await onPublish(deploymentId);
    } finally {
      setPublishingId(null);
    }
  };

  return (
    <div className="mt-6 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
      <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <Clock className="w-4 h-4 text-emerald-500" />
        История деплоев
      </h2>

      {deployments.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">Нет деплоев</p>
      ) : (
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {deployments.map((dep) => (
            <div key={dep.id}>
              <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">v{dep.version}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${statusColors[dep.status] || ''}`}>
                      {dep.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatDate(dep.createdAt)} &middot; {formatBytes(Number(dep.sizeBytes))}
                  </p>
                  {dep.errorMessage && (
                    <p className="text-xs text-red-500 mt-0.5">{dep.errorMessage}</p>
                  )}
                  {dep.status === 'PREVIEW' && dep.previewSlug && (
                    <a
                      href={`https://${dep.previewSlug}.hostingvibe.ru`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 mt-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Открыть превью
                    </a>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-2 shrink-0">
                  {(dep.buildLog || dep.errorMessage) && (
                    <button
                      onClick={() => setExpandedLog(expandedLog === dep.id ? null : dep.id)}
                      className="text-xs text-gray-400 hover:text-emerald-500 flex items-center gap-0.5"
                      title="Лог сборки"
                    >
                      {expandedLog === dep.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      Лог
                    </button>
                  )}

                  {dep.status === 'PREVIEW' && onPublish && (
                    <button
                      onClick={() => handlePublish(dep.id)}
                      disabled={publishingId === dep.id}
                      className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium disabled:opacity-50 flex items-center gap-1"
                    >
                      {publishingId === dep.id && <Loader2 className="w-3 h-3 animate-spin" />}
                      {publishingId === dep.id ? 'Публикуем...' : 'Опубликовать'}
                    </button>
                  )}

                  {dep.status === 'SUPERSEDED' && (
                    <button
                      onClick={() => onRollback(dep.version)}
                      className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Откатить
                    </button>
                  )}
                </div>
              </div>

              {expandedLog === dep.id && (dep.buildLog || dep.errorMessage) && (
                <div className="mt-1 mx-1 rounded-lg bg-gray-900 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 p-3 overflow-hidden">
                  <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono max-h-60 overflow-auto break-all">
                    {dep.buildLog || dep.errorMessage}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
