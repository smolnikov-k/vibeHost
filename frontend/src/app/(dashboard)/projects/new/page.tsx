'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FileArchive, FileCode, ArrowLeft, Loader2, Check, X } from 'lucide-react';
import { animate } from 'animejs';
import { api } from '@/lib/api';
import Link from 'next/link';

export default function NewProjectPage() {
  const router = useRouter();
  const [step, setStep] = useState<'info' | 'upload'>('info');
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const slugTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (cardRef.current) {
      animate(cardRef.current, {
        opacity: [0, 1],
        translateY: ['15px', '0px'],
        duration: 500,
        ease: 'outExpo',
      });
    }
  }, []);

  // Auto-generate slug from title
  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[а-яё]/g, (char) => {
        const map: Record<string, string> = {
          'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
          'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
          'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
          'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '',
          'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
        };
        return map[char] || char;
      })
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32);
  };

  const handleTitleChange = (value: string) => {
    setTitle(value);
    const newSlug = generateSlug(value);
    setSlug(newSlug);
    checkSlug(newSlug);
  };

  const handleSlugChange = (value: string) => {
    const cleaned = value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 32);
    setSlug(cleaned);
    checkSlug(cleaned);
  };

  const checkSlug = (s: string) => {
    if (slugTimeout.current) clearTimeout(slugTimeout.current);
    if (s.length < 2) {
      setSlugStatus('idle');
      return;
    }
    setSlugStatus('checking');
    slugTimeout.current = setTimeout(async () => {
      try {
        const data = await api.checkSlug(s);
        setSlugStatus(data.available ? 'available' : 'taken');
      } catch {
        setSlugStatus('idle');
      }
    }, 400);
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !slug || slugStatus !== 'available') return;
    setError('');
    setLoading(true);
    try {
      const data = await api.createProject(title, slug);
      setProjectId(data.id);
      setStep('upload');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка создания проекта');
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && (dropped.name.endsWith('.zip') || dropped.name.endsWith('.tar.gz') || dropped.name.endsWith('.tgz') || dropped.name.endsWith('.html') || dropped.name.endsWith('.htm'))) {
      setFile(dropped);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      const name = selected.name.toLowerCase();
      if (name.endsWith('.zip') || name.endsWith('.tar.gz') || name.endsWith('.tgz') || name.endsWith('.html') || name.endsWith('.htm')) {
        setFile(selected);
      } else {
        setError('Поддерживаются только ZIP, TAR.GZ и HTML файлы');
        e.target.value = '';
      }
    }
  };

  const handleUpload = async () => {
    if (!file || !projectId) return;
    setUploading(true);
    setError('');
    try {
      await api.deploy(projectId, file);
      router.push(`/projects/${projectId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
      setUploading(false);
    }
  };

  return (
    <div>
      <Link
        href="/projects"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-emerald-600 transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Назад к проектам
      </Link>

      <div ref={cardRef} className="max-w-lg mx-auto opacity-0">
        {step === 'info' ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-8">
            <h1 className="text-xl font-bold text-gray-900 mb-6">Новый проект</h1>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateProject} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Название проекта
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-sm"
                  placeholder="Мой крутой сайт"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Адрес сайта
                </label>
                <div className="flex items-center">
                  <input
                    type="text"
                    required
                    value={slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    className="flex-1 px-4 py-2.5 rounded-l-lg border border-gray-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-sm"
                    placeholder="my-site"
                  />
                  <span className="px-3 py-2.5 bg-gray-50 border border-l-0 border-gray-200 rounded-r-lg text-sm text-gray-400">
                    .hostingvibe.ru
                  </span>
                </div>

                {/* Slug status */}
                <div className="mt-1.5 h-5">
                  {slugStatus === 'checking' && (
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Проверяю...
                    </span>
                  )}
                  {slugStatus === 'available' && (
                    <span className="text-xs text-emerald-600 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Доступен
                    </span>
                  )}
                  {slugStatus === 'taken' && (
                    <span className="text-xs text-red-500 flex items-center gap-1">
                      <X className="w-3 h-3" /> Занят
                    </span>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || slugStatus !== 'available'}
                className="w-full py-2.5 rounded-lg bg-emerald-500 text-white font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Создать проект
              </button>
            </form>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-8">
            <h1 className="text-xl font-bold text-gray-900 mb-2">Загрузи сайт</h1>
            <p className="text-sm text-gray-500 mb-6">
              ZIP или TAR.GZ архив. Внутри должен быть index.html или package.json.
            </p>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">
                {error}
              </div>
            )}

            {/* Dropzone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 sm:p-10 text-center cursor-pointer transition-all ${
                dragOver
                  ? 'border-emerald-400 bg-emerald-50'
                  : file
                    ? 'border-emerald-300 bg-emerald-50/50'
                    : 'border-gray-200 hover:border-emerald-300 hover:bg-gray-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip,.tar.gz,.tgz,application/zip,application/x-zip-compressed,application/gzip,application/x-gzip,application/x-tar,application/x-compressed-tar"
                onChange={handleFileSelect}
                className="hidden"
              />

              {file ? (
                <div className="flex items-center justify-center gap-3">
                  {file.name.endsWith('.zip') || file.name.endsWith('.tar.gz') || file.name.endsWith('.tgz') ? (
                    <FileArchive className="w-8 h-8 text-emerald-500" />
                  ) : (
                    <FileCode className="w-8 h-8 text-emerald-500" />
                  )}
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-900">{file.name}</p>
                    <p className="text-xs text-gray-400">
                      {(file.size / 1024 / 1024).toFixed(1)} МБ
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <Upload className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">Перетащи файл сюда</p>
                  <p className="text-xs text-gray-400 mt-1">.zip, .tar.gz или .html</p>
                </>
              )}
            </div>

            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="w-full mt-6 py-2.5 rounded-lg bg-emerald-500 text-white font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
              {uploading ? 'Загружаем...' : 'Загрузить и опубликовать'}
            </button>

            <button
              onClick={() => router.push(`/projects/${projectId}`)}
              className="w-full mt-2 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Загружу позже
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
