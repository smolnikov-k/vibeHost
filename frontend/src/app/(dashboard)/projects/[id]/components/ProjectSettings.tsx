'use client';

import { useState } from 'react';
import {
  Settings2, Tag, Lock, BarChart3, Loader2, Save, Eye, EyeOff,
} from 'lucide-react';
import { api } from '@/lib/api';
import { showToast } from '@/lib/toast';
import type { Project } from './shared';

interface ProjectSettingsProps {
  project: Project;
  projectId: string;
  onReload: () => Promise<void>;
  setError: (error: string) => void;
}

export function ProjectSettings({ project, projectId, onReload, setError }: ProjectSettingsProps) {
  const [description, setDescription] = useState(project.description || '');
  const [tagsInput, setTagsInput] = useState((project.tags || []).join(', '));
  const [isPublic, setIsPublic] = useState(project.isPublic || false);
  const [passwordEnabled, setPasswordEnabled] = useState(project.passwordEnabled || false);
  const [password, setPassword] = useState('');
  const [metrikaId, setMetrikaId] = useState(project.metrikaId || '');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const handleSaveSettings = async () => {
    setSaving(true);
    setSaveMsg('');
    try {
      // Validate: enabling password for the first time requires a password
      if (passwordEnabled && !password && !project.passwordEnabled) {
        setError('Введите пароль для включения защиты');
        showToast('Введите пароль для включения защиты', 'error');
        setSaving(false);
        return;
      }
      const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
      const update: Record<string, unknown> = { description: description || undefined, isPublic, tags, metrikaId: metrikaId.trim() || null };
      if (passwordEnabled && password) {
        update.password = password;
        update.passwordEnabled = true;
      } else if (passwordEnabled && !password && project.passwordEnabled) {
        // Keep existing password, just ensure enabled stays true
        update.passwordEnabled = true;
      } else if (!passwordEnabled) {
        update.passwordEnabled = false;
      }
      await api.updateProject(projectId, update as Parameters<typeof api.updateProject>[1]);
      setPassword('');
      setSaveMsg('Сохранено');
      setTimeout(() => setSaveMsg(''), 2000);
      await onReload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка сохранения';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-6 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
      <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <Settings2 className="w-4 h-4 text-gray-400" />
        Настройки
      </h2>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Описание</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900 outline-none transition-all text-sm resize-none"
            placeholder="Краткое описание проекта"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1 flex items-center gap-1">
            <Tag className="w-3.5 h-3.5" />
            Теги
          </label>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900 outline-none transition-all text-sm"
            placeholder="landing, портфолио, react (через запятую)"
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Публичный проект</label>
            <p className="text-xs text-gray-400">Отображается в галерее для всех</p>
          </div>
          <button
            onClick={() => setIsPublic(!isPublic)}
            role="switch"
            aria-checked={isPublic}
            aria-label="Публичный проект"
            className={`relative w-11 h-6 rounded-full transition-colors ${
              isPublic ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-gray-600'
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 flex items-center gap-1">
              <Lock className="w-3.5 h-3.5" />
              Защита паролем
            </label>
            <p className="text-xs text-gray-400">Посетители вводят пароль перед просмотром</p>
          </div>
          <button
            onClick={() => setPasswordEnabled(!passwordEnabled)}
            role="switch"
            aria-checked={passwordEnabled}
            aria-label="Защита паролем"
            className={`relative w-11 h-6 rounded-full transition-colors ${
              passwordEnabled ? 'bg-amber-500' : 'bg-gray-200 dark:bg-gray-600'
            }`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
              passwordEnabled ? 'translate-x-5' : ''
            }`} />
          </button>
        </div>

        {passwordEnabled && (
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-amber-400 focus:ring-2 focus:ring-amber-100 dark:focus:ring-amber-900 outline-none transition-all text-sm"
            placeholder={`${project.passwordEnabled ? 'Введите новый пароль (или оставьте пустым)' : 'Задайте пароль для доступа'}`}
            autoComplete="new-password"
          />
        )}

        {/* Yandex.Metrika */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1 flex items-center gap-1">
            <BarChart3 className="w-3.5 h-3.5" />
            Яндекс.Метрика
          </label>
          <input
            type="text"
            value={metrikaId}
            onChange={(e) => setMetrikaId(e.target.value.replace(/\D/g, ''))}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900 outline-none transition-all text-sm"
            placeholder="Номер счётчика, например 98765432"
            maxLength={12}
          />
          <p className="text-xs text-gray-400 mt-1">Счётчик и отслеживание форм будут внедрены при следующем деплое</p>
          {metrikaId && (
            <div className="mt-2 p-2.5 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">Автоматическое отслеживание заявок</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                При отправке любой формы на сайте автоматически срабатывает цель <span className="font-mono bg-white dark:bg-gray-700 px-1 py-0.5 rounded border border-gray-200 dark:border-gray-600">form_submit</span>. Чтобы видеть конверсии в Метрике:
              </p>
              <ol className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5 ml-3 list-decimal">
                <li>Откройте <a href={`https://metrika.yandex.ru/list`} target="_blank" rel="noopener noreferrer" className="text-emerald-600 dark:text-emerald-400 underline">metrika.yandex.ru</a> → ваш счётчик → Настройка → Цели</li>
                <li>Нажмите «Добавить цель»</li>
                <li>Выберите «JavaScript-событие»</li>
                <li>Идентификатор: <span className="font-mono bg-white dark:bg-gray-700 px-1 py-0.5 rounded border border-gray-200 dark:border-gray-600">form_submit</span></li>
                <li>Сохраните — готово, заявки будут отображаться как конверсии</li>
              </ol>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Сохранить
          </button>
          {saveMsg && <span className="text-xs text-emerald-600 dark:text-emerald-400">{saveMsg}</span>}
        </div>
      </div>
    </div>
  );
}
