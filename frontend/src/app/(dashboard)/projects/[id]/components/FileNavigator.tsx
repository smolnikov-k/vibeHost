'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  FolderOpen, Folder, File, ChevronRight, Loader2,
} from 'lucide-react';
import { api, type FileEntry } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { formatBytes } from '@/lib/utils';
import { formatDate } from './shared';

interface FileNavigatorProps {
  projectId: string;
}

export function FileNavigator({ projectId }: FileNavigatorProps) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [filePath, setFilePath] = useState('');
  const [filesLoading, setFilesLoading] = useState(false);

  const loadFiles = useCallback(async (dir?: string) => {
    setFilesLoading(true);
    try {
      const data = await api.getProjectFiles(projectId, dir);
      setFiles(data.files);
      setFilePath(dir || '');
    } catch {
      showToast('Не удалось загрузить файлы проекта', 'error');
      setFiles([]);
    } finally {
      setFilesLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  return (
    <div className="mt-6 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
      <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <FolderOpen className="w-4 h-4 text-emerald-500" />
        Файлы проекта
      </h2>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm mb-3 flex-wrap">
        <button
          onClick={() => loadFiles()}
          className={`hover:text-emerald-600 transition-colors ${!filePath ? 'text-emerald-600 font-medium' : 'text-gray-500 dark:text-gray-400'}`}
        >
          /
        </button>
        {filePath && filePath.split('/').filter(Boolean).map((segment, i, arr) => {
          const fullPath = arr.slice(0, i + 1).join('/');
          const isLast = i === arr.length - 1;
          return (
            <span key={fullPath} className="flex items-center gap-1">
              <ChevronRight className="w-3 h-3 text-gray-300" />
              <button
                onClick={() => loadFiles(fullPath)}
                className={`hover:text-emerald-600 transition-colors ${isLast ? 'text-emerald-600 font-medium' : 'text-gray-500 dark:text-gray-400'}`}
              >
                {segment}
              </button>
            </span>
          );
        })}
      </div>

      {filesLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
        </div>
      ) : files.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">Нет файлов</p>
      ) : (
        <div className="border border-gray-100 dark:border-gray-700 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs">
              <tr>
                <th className="text-left py-2 px-3 font-medium">Имя</th>
                <th className="text-right py-2 px-3 font-medium w-24">Размер</th>
                <th className="text-right py-2 px-3 font-medium w-40 hidden sm:table-cell">Изменён</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {filePath && (
                <tr
                  className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                  onClick={() => {
                    const parent = filePath.split('/').slice(0, -1).join('/');
                    loadFiles(parent || undefined);
                  }}
                >
                  <td className="py-2 px-3 flex items-center gap-2 text-gray-500 dark:text-gray-400">
                    <Folder className="w-4 h-4 text-gray-300" />
                    ..
                  </td>
                  <td></td>
                  <td className="hidden sm:table-cell"></td>
                </tr>
              )}
              {files.map((f) => (
                <tr
                  key={f.name}
                  className={`hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${f.type === 'directory' ? 'cursor-pointer' : ''}`}
                  onClick={() => {
                    if (f.type === 'directory') {
                      loadFiles(filePath ? `${filePath}/${f.name}` : f.name);
                    }
                  }}
                >
                  <td className="py-2 px-3">
                    <span className="flex items-center gap-2">
                      {f.type === 'directory' ? (
                        <Folder className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <File className="w-4 h-4 text-gray-300 shrink-0" />
                      )}
                      <span className={`truncate ${f.type === 'directory' ? 'text-emerald-700 dark:text-emerald-400 font-medium' : 'text-gray-700 dark:text-gray-200'}`}>
                        {f.name}
                      </span>
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right text-gray-400 text-xs">
                    {f.type === 'file' && f.size !== undefined ? formatBytes(f.size) : ''}
                  </td>
                  <td className="py-2 px-3 text-right text-gray-400 text-xs hidden sm:table-cell">
                    {formatDate(f.modified)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
