'use client';

import { useState, useRef, useCallback } from 'react';
import {
  Upload, FileArchive, FileCode, Loader2, Github,
} from 'lucide-react';
import { api, type Deployment } from '@/lib/api';
import { showToast } from '@/lib/toast';

interface DeployUploaderProps {
  projectId: string;
  onDeployUpdate: (deploymentId: string, data: { status: string; errorMessage?: string | null; buildLog?: string | null }) => void;
  onReload: () => Promise<void>;
  error: string;
  setError: (error: string) => void;
}

export function DeployUploader({ projectId, onDeployUpdate, onReload, error, setError }: DeployUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [githubUrl, setGithubUrl] = useState('');
  const [githubSubdir, setGithubSubdir] = useState('');
  const [githubDeploying, setGithubDeploying] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) {
      const name = dropped.name.toLowerCase();
      if (name.endsWith('.zip') || name.endsWith('.tar.gz') || name.endsWith('.tgz')) {
        setFile(dropped);
      } else {
        setError('Поддерживаются только ZIP и TAR.GZ архивы');
      }
    }
  }, []);

  const handleGithubDeploy = async () => {
    if (!githubUrl) return;
    setGithubDeploying(true);
    setError('');
    try {
      const result = await api.deployGithub(projectId, githubUrl, githubSubdir || undefined);
      setGithubUrl('');
      setGithubSubdir('');
      if (result.deploymentId) {
        api.streamDeployStatus(projectId, result.deploymentId, (data) => {
          onDeployUpdate(result.deploymentId!, data);
          if (data.status === 'LIVE' && typeof window.ym === 'function') {
            window.ym(107147478, 'reachGoal', 'deploy_success');
          }
        }, () => onReload());
      } else {
        setTimeout(() => onReload(), 3000);
        setTimeout(() => onReload(), 8000);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка деплоя из GitHub';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setGithubDeploying(false);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const result = await api.deploy(projectId, file);
      setFile(null);
      await onReload();
      if (result.deploymentId) {
        api.streamDeployStatus(projectId, result.deploymentId, (data) => {
          onDeployUpdate(result.deploymentId, data);
          if (data.status === 'LIVE' && typeof window.ym === 'function') {
            window.ym(107147478, 'reachGoal', 'deploy_success');
          }
        }, () => onReload());
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка загрузки';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Upload new version */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Upload className="w-4 h-4 text-emerald-500" />
          Обновить сайт
        </h2>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-800 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-4 sm:p-8 text-center cursor-pointer transition-all ${
            dragOver ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950'
              : file ? 'border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/50'
                : 'border-gray-200 dark:border-gray-600 hover:border-emerald-300'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,.tar.gz,.tgz,application/zip,application/x-zip-compressed,application/gzip,application/x-gzip,application/x-tar,application/x-compressed-tar"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                const name = f.name.toLowerCase();
                if (name.endsWith('.zip') || name.endsWith('.tar.gz') || name.endsWith('.tgz')) {
                  setFile(f);
                } else {
                  setError('Поддерживаются только ZIP и TAR.GZ архивы');
                  e.target.value = '';
                }
              }
            }}
            className="hidden"
          />
          {file ? (
            <div className="flex items-center justify-center gap-3">
              {file.name.endsWith('.zip') || file.name.endsWith('.tar.gz') || file.name.endsWith('.tgz') ? (
                <FileArchive className="w-6 h-6 text-emerald-500" />
              ) : (
                <FileCode className="w-6 h-6 text-emerald-500" />
              )}
              <div className="text-left">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{file.name}</p>
                <p className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(1)} МБ</p>
              </div>
            </div>
          ) : (
            <>
              <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Перетащи ZIP, TAR.GZ или HTML</p>
            </>
          )}
        </div>

        {file && (
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full mt-4 py-2.5 rounded-lg bg-emerald-500 text-white font-medium text-sm hover:bg-emerald-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
            {uploading ? 'Загружаем...' : 'Загрузить новую версию'}
          </button>
        )}
      </div>

      {/* GitHub deploy */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Github className="w-4 h-4 text-emerald-500" />
          Деплой из GitHub
        </h2>

        <div className="space-y-3">
          <input
            type="text"
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
            placeholder="https://github.com/user/repo"
            aria-label="URL репозитория GitHub"
            className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900 outline-none transition-all text-sm"
          />
          <input
            type="text"
            value={githubSubdir}
            onChange={(e) => setGithubSubdir(e.target.value)}
            placeholder="Поддиректория (необязательно, напр. dist)"
            aria-label="Поддиректория репозитория"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900 outline-none transition-all text-sm"
          />
          <button
            onClick={handleGithubDeploy}
            disabled={!githubUrl || githubDeploying}
            className="w-full py-2.5 rounded-lg bg-gray-900 dark:bg-gray-700 text-white font-medium text-sm hover:bg-gray-800 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {githubDeploying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Клонируем...
              </>
            ) : (
              <>
                <Github className="w-4 h-4" />
                Деплой из GitHub
              </>
            )}
          </button>
          <p className="text-xs text-gray-400">
            Публичный репозиторий. Автоопределение папки с index.html.
          </p>
        </div>
      </div>
    </div>
  );
}
