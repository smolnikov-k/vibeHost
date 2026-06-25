'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Trash2, Download, Loader2, AlertTriangle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { showToast } from '@/lib/toast';

interface DangerZoneProps {
  projectId: string;
  projectSlug: string;
  projectVersion: number;
  isLive: boolean;
  setError: (error: string) => void;
}

export function DangerZone({ projectId, projectSlug, projectVersion, isLive, setError }: DangerZoneProps) {
  const router = useRouter();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch(api.getExportUrl(projectId), {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Ошибка экспорта');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectSlug}-v${projectVersion}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка экспорта';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.deleteProject(projectId);
      router.push('/projects');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка удаления';
      setError(msg);
      showToast(msg, 'error');
      setDeleting(false);
    }
  };

  return (
    <div className="mt-6 bg-white dark:bg-gray-900 rounded-2xl border border-red-100 dark:border-red-900 shadow-sm p-6">
      <h2 className="text-base font-semibold text-red-600 dark:text-red-400 mb-4 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" />
        Опасная зона
      </h2>

      <div className="flex flex-wrap gap-3">
        {isLive && (
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          Скачать ZIP
        </button>
        )}

        {showDeleteConfirm ? (
          <div className="flex items-center gap-2">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition-colors"
            >
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Да, удалить
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Отмена
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Удалить проект
          </button>
        )}
      </div>
    </div>
  );
}
