'use client';

import { useEffect, useState, useCallback } from 'react';
import { History, RotateCcw, Trash2, Loader2, AlertCircle, Star } from 'lucide-react';
import { api, type Version } from '@/lib/api';
import { formatBytes } from '@/lib/utils';
import { formatDate } from './shared';

interface VersionHistoryProps {
  projectId: string;
  onRollback: (version: number) => Promise<void>;
}

export function VersionHistory({ projectId, onRollback }: VersionHistoryProps) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [maxVersions, setMaxVersions] = useState(0);
  const [plan, setPlan] = useState('FREE');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getVersions(projectId);
      setVersions(data.versions);
      setMaxVersions(data.maxVersions);
      setPlan(data.plan);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить версии');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRollback = async (version: number) => {
    setRolling(true);
    try {
      await onRollback(version);
      await load();
    } finally {
      setRolling(false);
      setConfirming(null);
    }
  };

  const handleDelete = async (version: number) => {
    try {
      await api.deleteVersion(projectId, version);
      await load();
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="mt-6 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <History className="w-4 h-4 text-emerald-500" />
          Версии
        </h2>
        {!loading && versions.length > 0 && (
          <span className="text-xs text-gray-400">
            Использовано {versions.length}/{maxVersions} версий
          </span>
        )}
      </div>

      {plan === 'FREE' && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 px-3 py-2.5">
          <Star className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            На тарифе <span className="font-semibold">PRO</span> доступно до 15 версий с возможностью отката.
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-sm text-red-500 py-4">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      ) : versions.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">Нет сохранённых версий</p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {versions.map((v) => (
            <div
              key={v.version}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                v.isCurrent
                  ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800'
                  : 'bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700'
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">v{v.version}</span>
                  {v.isCurrent && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 font-medium">
                      текущая
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {formatDate(v.createdAt)} &middot; {formatBytes(Number(v.sizeBytes))}
                </p>
              </div>

              {!v.isCurrent && v.hasBackup && (
                <>
                  {confirming === v.version ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Откатить?</span>
                      <button
                        onClick={() => handleRollback(v.version)}
                        disabled={rolling}
                        className="text-xs px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1"
                      >
                        {rolling && <Loader2 className="w-3 h-3 animate-spin" />}
                        Да
                      </button>
                      <button
                        onClick={() => { setConfirming(null); }}
                        disabled={rolling}
                        className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
                      >
                        Нет
                      </button>
                    </div>
                  ) : deleting === v.version ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Удалить?</span>
                      <button
                        onClick={() => handleDelete(v.version)}
                        className="text-xs px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700 flex items-center gap-1"
                      >
                        Да
                      </button>
                      <button
                        onClick={() => setDeleting(null)}
                        className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
                      >
                        Нет
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setConfirming(v.version)}
                        className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Откатить
                      </button>
                      <button
                        onClick={() => setDeleting(v.version)}
                        className="text-xs text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-400 flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
