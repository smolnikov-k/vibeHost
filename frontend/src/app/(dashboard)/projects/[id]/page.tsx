'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Globe, ExternalLink, Upload, Trash2, Clock,
  HardDrive, FileArchive, FileCode, Loader2, RotateCcw, Settings2,
  Folder, File, ChevronRight, FolderOpen, Download, Eye, EyeOff, Save, Tag,
  Github, BarChart3, Pencil, QrCode, Lock, Timer,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { api, type Project, type Deployment, type FileEntry } from '@/lib/api';
import { formatBytes } from '@/lib/utils';

function formatDate(date: string) {
  return new Date(date).toLocaleString('ru-RU', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const statusColors: Record<string, string> = {
  LIVE: 'bg-emerald-100 text-emerald-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  EXTRACTING: 'bg-yellow-100 text-yellow-700',
  FAILED: 'bg-red-100 text-red-700',
  SUPERSEDED: 'bg-gray-100 text-gray-500',
};

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [filePath, setFilePath] = useState('');
  const [filesLoading, setFilesLoading] = useState(false);
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [githubSubdir, setGithubSubdir] = useState('');
  const [githubDeploying, setGithubDeploying] = useState(false);
  const [passwordEnabled, setPasswordEnabled] = useState(false);
  const [password, setPassword] = useState('');
  const [showQR, setShowQR] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFiles = useCallback(async (dir?: string) => {
    setFilesLoading(true);
    try {
      const data = await api.getProjectFiles(id, dir);
      setFiles(data.files);
      setFilePath(dir || '');
    } catch {
      setFiles([]);
    } finally {
      setFilesLoading(false);
    }
  }, [id]);

  const loadData = useCallback(async () => {
    try {
      const [pData, dData] = await Promise.all([
        api.getProject(id),
        api.getDeployments(id),
      ]);
      const proj = pData;
      setProject(proj);
      setDeployments(dData);
      setDescription(proj.description || '');
      setTagsInput((proj.tags || []).join(', '));
      setIsPublic(proj.isPublic || false);
      setPasswordEnabled(proj.passwordEnabled || false);
      loadFiles();
    } catch {
      router.push('/projects');
    } finally {
      setLoading(false);
    }
  }, [id, router, loadFiles]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  }, []);

  const handleSaveSettings = async () => {
    setSaving(true);
    setSaveMsg('');
    try {
      const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
      const update: Record<string, unknown> = { description: description || undefined, isPublic, tags };
      if (passwordEnabled && password) {
        update.password = password;
        update.passwordEnabled = true;
      } else if (!passwordEnabled) {
        update.passwordEnabled = false;
      }
      await api.updateProject(id, update);
      setPassword('');
      setSaveMsg('Сохранено');
      setTimeout(() => setSaveMsg(''), 2000);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleGithubDeploy = async () => {
    if (!githubUrl) return;
    setGithubDeploying(true);
    setError('');
    try {
      await api.deployGithub(id, githubUrl, githubSubdir || undefined);
      setGithubUrl('');
      setGithubSubdir('');
      // Poll for completion
      setTimeout(() => loadData(), 3000);
      setTimeout(() => loadData(), 8000);
      setTimeout(() => loadData(), 15000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка деплоя из GitHub');
    } finally {
      setGithubDeploying(false);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      await api.deploy(id, file);
      setFile(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setUploading(false);
    }
  };

  const handleRollback = async (version: number) => {
    try {
      await api.rollback(id, version);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка отката');
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.deleteProject(id);
      router.push('/projects');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления');
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!project) return null;

  return (
    <div>
      <Link
        href="/projects"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-emerald-600 transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Все проекты
      </Link>

      {/* Project header */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 mb-1">{project.title}</h1>
            <a
              href={`https://${project.slug}.hostingvibe.ru`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              <Globe className="w-3.5 h-3.5" />
              {project.slug}.hostingvibe.ru
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="flex items-center gap-2">
            {project.status === 'LIVE' && (
              <Link
                href={`/projects/${id}/edit`}
                className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                Редактировать
              </Link>
            )}
            <Link
              href={`/projects/${id}/analytics`}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-emerald-600 transition-colors"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Аналитика
            </Link>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
              statusColors[project.status] || 'bg-gray-100 text-gray-500'
            }`}>
              {project.status === 'LIVE' ? 'Онлайн' : project.status}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-4 text-xs text-gray-400 flex-wrap">
          <span className="flex items-center gap-1">
            <HardDrive className="w-3.5 h-3.5" />
            {formatBytes(Number(project.sizeBytes))}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            Обновлён {formatDate(project.updatedAt)}
          </span>
          {project.currentVersion > 0 && (
            <span>Версия {project.currentVersion}</span>
          )}
          {project.passwordEnabled && (
            <span className="flex items-center gap-1 text-amber-500">
              <Lock className="w-3.5 h-3.5" />
              Защищён паролем
            </span>
          )}
          {project.expiresAt && (
            <span className="flex items-center gap-1 text-orange-500">
              <Timer className="w-3.5 h-3.5" />
              Истекает {formatDate(project.expiresAt)}
            </span>
          )}
          <button
            onClick={() => setShowQR(!showQR)}
            className="flex items-center gap-1 text-emerald-500 hover:text-emerald-600 transition-colors"
          >
            <QrCode className="w-3.5 h-3.5" />
            QR-код
          </button>
        </div>

        {/* QR Code */}
        {showQR && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-4">
            <QRCodeSVG
              value={`https://${project.slug}.hostingvibe.ru`}
              size={120}
              bgColor="transparent"
              fgColor="#111827"
            />
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Поделитесь сайтом</p>
              <p className="text-xs text-gray-400 mb-2">Отсканируйте QR-код или скопируйте ссылку</p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`https://${project.slug}.hostingvibe.ru`);
                }}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
              >
                Скопировать ссылку
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Upload new version */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Upload className="w-4 h-4 text-emerald-500" />
            Обновить сайт
          </h2>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">
              {error}
            </div>
          )}

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
              dragOver ? 'border-emerald-400 bg-emerald-50'
                : file ? 'border-emerald-300 bg-emerald-50/50'
                  : 'border-gray-200 hover:border-emerald-300'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip,.tar.gz,.tgz,.html,.htm,application/zip,application/x-zip-compressed,application/gzip,application/x-gzip,application/x-tar,application/x-compressed-tar"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  const name = f.name.toLowerCase();
                  if (name.endsWith('.zip') || name.endsWith('.tar.gz') || name.endsWith('.tgz') || name.endsWith('.html') || name.endsWith('.htm')) {
                    setFile(f);
                  } else {
                    setError('Поддерживаются только ZIP, TAR.GZ и HTML файлы');
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
                  <p className="text-sm font-medium text-gray-900">{file.name}</p>
                  <p className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(1)} МБ</p>
                </div>
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Перетащи ZIP, TAR.GZ или HTML</p>
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
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Github className="w-4 h-4 text-emerald-500" />
            Деплой из GitHub
          </h2>

          <div className="space-y-3">
            <input
              type="text"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="https://github.com/user/repo"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-sm"
            />
            <input
              type="text"
              value={githubSubdir}
              onChange={(e) => setGithubSubdir(e.target.value)}
              placeholder="Поддиректория (необязательно, напр. dist)"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-sm text-gray-600"
            />
            <button
              onClick={handleGithubDeploy}
              disabled={!githubUrl || githubDeploying}
              className="w-full py-2.5 rounded-lg bg-gray-900 text-white font-medium text-sm hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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

      {/* Deployments history */}
      <div className="mt-6 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-emerald-500" />
          История деплоев
        </h2>

          {deployments.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">Нет деплоев</p>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {deployments.map((dep) => (
                <div
                  key={dep.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">v{dep.version}</span>
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
                  </div>

                  {dep.status === 'SUPERSEDED' && (
                    <button
                      onClick={() => handleRollback(dep.version)}
                      className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Откатить
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      {/* File navigator */}
      {project.status === 'LIVE' && (
        <div className="mt-6 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-emerald-500" />
            Файлы проекта
          </h2>

          {/* Breadcrumb */}
          <div className="flex items-center gap-1 text-sm mb-3 flex-wrap">
            <button
              onClick={() => loadFiles()}
              className={`hover:text-emerald-600 transition-colors ${!filePath ? 'text-emerald-600 font-medium' : 'text-gray-500'}`}
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
                    className={`hover:text-emerald-600 transition-colors ${isLast ? 'text-emerald-600 font-medium' : 'text-gray-500'}`}
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
            <div className="border border-gray-100 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs">
                  <tr>
                    <th className="text-left py-2 px-3 font-medium">Имя</th>
                    <th className="text-right py-2 px-3 font-medium w-24">Размер</th>
                    <th className="text-right py-2 px-3 font-medium w-40 hidden sm:table-cell">Изменён</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filePath && (
                    <tr
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => {
                        const parent = filePath.split('/').slice(0, -1).join('/');
                        loadFiles(parent || undefined);
                      }}
                    >
                      <td className="py-2 px-3 flex items-center gap-2 text-gray-500">
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
                      className={`hover:bg-gray-50 transition-colors ${f.type === 'directory' ? 'cursor-pointer' : ''}`}
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
                          <span className={`truncate ${f.type === 'directory' ? 'text-emerald-700 font-medium' : 'text-gray-700'}`}>
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
      )}

      {/* Settings */}
      <div className="mt-6 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-gray-400" />
          Настройки
        </h2>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-sm resize-none"
              placeholder="Краткое описание проекта"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5" />
              Теги
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-sm"
              placeholder="landing, портфолио, react (через запятую)"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-gray-700">Публичный проект</label>
              <p className="text-xs text-gray-400">Отображается в галерее для всех</p>
            </div>
            <button
              onClick={() => setIsPublic(!isPublic)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                isPublic ? 'bg-emerald-500' : 'bg-gray-200'
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                isPublic ? 'translate-x-5' : ''
              }`} />
            </button>
          </div>

          {/* Password protection */}
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-gray-700 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5" />
                Защита паролем
              </label>
              <p className="text-xs text-gray-400">Посетители вводят пароль перед просмотром</p>
            </div>
            <button
              onClick={() => setPasswordEnabled(!passwordEnabled)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                passwordEnabled ? 'bg-amber-500' : 'bg-gray-200'
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                passwordEnabled ? 'translate-x-5' : ''
              }`} />
            </button>
          </div>

          {passwordEnabled && (
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition-all text-sm"
              placeholder={`${project.passwordEnabled ? 'Введите новый пароль (или оставьте пустым)' : 'Задайте пароль для доступа'}`}
            />
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Сохранить
            </button>
            {saveMsg && <span className="text-xs text-emerald-600">{saveMsg}</span>}
          </div>
        </div>

        {/* Export + Delete */}
        <div className="border-t border-gray-100 pt-4 flex items-center gap-4 mb-4">
          {project.status === 'LIVE' && (
            <button
              onClick={async () => {
                try {
                  const res = await fetch(api.getExportUrl(id), {
                    headers: { 'Authorization': `Bearer ${api.getToken()}` },
                  });
                  if (!res.ok) throw new Error('Ошибка экспорта');
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${project.slug}-v${project.currentVersion}.zip`;
                  a.click();
                  URL.revokeObjectURL(url);
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Ошибка экспорта');
                }
              }}
              className="flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Скачать ZIP
            </button>
          )}
        </div>

        <div className="border-t border-gray-100 pt-4">
          {showDelete ? (
            <div className="flex items-center gap-3">
              <p className="text-sm text-red-600 flex-1">
                Удалить проект «{project.title}» и все файлы? Это нельзя отменить.
              </p>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50 flex items-center gap-1"
              >
                {deleting && <Loader2 className="w-3 h-3 animate-spin" />}
                Да, удалить
              </button>
              <button
                onClick={() => setShowDelete(false)}
                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-200"
              >
                Отмена
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowDelete(true)}
              className="flex items-center gap-2 text-sm text-red-500 hover:text-red-600 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Удалить проект
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
