'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api, TelegramStatus } from '@/lib/api';
import { User, Mail, Phone, Trash2, Loader2, Send, Link2, Unlink, Copy, Check, ExternalLink, Code, Lock, Pencil } from 'lucide-react';
import { showToast } from '@/lib/toast';

export default function SettingsPage() {
  const { user, logout, refresh } = useAuth();
  const router = useRouter();
  const [showDelete, setShowDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Profile editing
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameSuccess, setNameSuccess] = useState(false);

  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneValue, setPhoneValue] = useState('');
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [phoneSuccess, setPhoneSuccess] = useState(false);

  // Password change
  const [showPassword, setShowPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Telegram state
  const [tgStatus, setTgStatus] = useState<TelegramStatus | null>(null);
  const [tgLoading, setTgLoading] = useState(true);
  const [deepLink, setDeepLink] = useState('');
  const [generating, setGenerating] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [copied, setCopied] = useState<'action' | 'js' | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showCode, setShowCode] = useState(false);

  const loadTgStatus = useCallback(async () => {
    try {
      const status = await api.getTelegramStatus();
      setTgStatus(status);
    } catch {
      showToast('Не удалось загрузить статус Telegram', 'error');
    } finally {
      setTgLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadTgStatus();
      setNameValue(user.displayName || '');
      setPhoneValue(user.phone || '');
    }
  }, [user, loadTgStatus]);

  if (!user) return null;

  const handleSaveName = async () => {
    setNameSaving(true);
    try {
      await api.updateProfile({ displayName: nameValue });
      await refresh();
      setEditingName(false);
      setNameSuccess(true);
      setTimeout(() => setNameSuccess(false), 2000);
    } catch {
      showToast('Не удалось сохранить имя', 'error');
    } finally {
      setNameSaving(false);
    }
  };

  const handleSavePhone = async () => {
    setPhoneSaving(true);
    try {
      await api.updateProfile({ phone: phoneValue });
      await refresh();
      setEditingPhone(false);
      setPhoneSuccess(true);
      setTimeout(() => setPhoneSuccess(false), 2000);
    } catch {
      showToast('Не удалось сохранить телефон', 'error');
    } finally {
      setPhoneSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      setPasswordError('Заполните оба поля');
      return;
    }
    if (newPassword.length < 8 || !/[a-zA-Zа-яА-ЯёЁ]/.test(newPassword) || !/\d/.test(newPassword)) {
      setPasswordError('Минимум 8 символов, хотя бы одна буква и одна цифра');
      return;
    }
    setPasswordSaving(true);
    setPasswordError('');
    try {
      await api.changePassword(currentPassword, newPassword);
      setPasswordSuccess(true);
      setShowPassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Ошибка смены пароля');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      setDeleteError('Введите пароль');
      return;
    }
    setDeleting(true);
    setDeleteError('');
    try {
      await api.deleteAccount(deletePassword);
      logout();
      router.push('/');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Ошибка удаления');
    } finally {
      setDeleting(false);
    }
  };

  const handleGenerateLink = async () => {
    setGenerating(true);
    try {
      const result = await api.generateTelegramLink();
      setDeepLink(result.deepLink);
    } catch {
      showToast('Не удалось сгенерировать ссылку', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleUnlink = async () => {
    setUnlinking(true);
    try {
      await api.unlinkTelegram();
      setTgStatus({ linked: false });
      setDeepLink('');
    } catch {
      showToast('Не удалось отвязать Telegram', 'error');
    } finally {
      setUnlinking(false);
    }
  };

  const handleCopy = (text: string, which: 'action' | 'js') => {
    navigator.clipboard.writeText(text);
    setCopied(which);
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setCopied(null), 2000);
  };

  const formSnippetAction = `<form action="https://hostingvibe.ru/api/forms/ВАШ-SLUG" method="POST">
  <input name="Имя" required />
  <input name="Телефон" required />
  <textarea name="Сообщение"></textarea>
  <button type="submit">Отправить</button>
</form>`;

  const formSnippetJs = `<script src="https://hostingvibe.ru/api/vibe-forms.js"></script>
<form data-vibe-form>
  <input name="Имя" required />
  <input name="Телефон" required />
  <textarea name="Сообщение"></textarea>
  <button type="submit">Отправить</button>
</form>`;

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Настройки</h1>

      {/* Profile info */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <User className="w-4 h-4 text-emerald-500" />
          Профиль
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Email</label>
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
              <Mail className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-900 dark:text-white">{user.email}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Имя</label>
            {editingName ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  placeholder="Ваше имя"
                  maxLength={50}
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900 outline-none transition-all text-sm"
                  autoFocus
                />
                <button
                  onClick={handleSaveName}
                  disabled={nameSaving}
                  className="px-3 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50"
                >
                  {nameSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Сохранить'}
                </button>
                <button
                  onClick={() => { setEditingName(false); setNameValue(user.displayName || ''); }}
                  className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Отмена
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                <span className="text-sm text-gray-900 dark:text-white">{user.displayName || '—'}</span>
                <button
                  onClick={() => setEditingName(true)}
                  className="text-gray-400 hover:text-emerald-500 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {nameSuccess && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                <Check className="w-3 h-3" /> Имя обновлено
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Телефон</label>
            {editingPhone ? (
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={phoneValue}
                  onChange={(e) => setPhoneValue(e.target.value)}
                  placeholder="+7 900 123-45-67"
                  maxLength={20}
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900 outline-none transition-all text-sm"
                  autoFocus
                />
                <button
                  onClick={handleSavePhone}
                  disabled={phoneSaving}
                  className="px-3 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50"
                >
                  {phoneSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Сохранить'}
                </button>
                <button
                  onClick={() => { setEditingPhone(false); setPhoneValue(user.phone || ''); }}
                  className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Отмена
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-900 dark:text-white">{user.phone || '—'}</span>
                </div>
                <button
                  onClick={() => setEditingPhone(true)}
                  className="text-gray-400 hover:text-emerald-500 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {phoneSuccess && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                <Check className="w-3 h-3" /> Телефон обновлён
              </p>
            )}
            {!user.phone && !editingPhone && (
              <p className="text-xs text-gray-400 dark:text-gray-400 mt-1">Указав телефон, вы ускорите оплату — он будет предзаполнен на форме</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Тариф</label>
            <p className="px-4 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-sm">
              <span className={`font-semibold ${user.plan === 'PRO' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-200'}`}>
                {user.plan}
              </span>
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Хранилище</label>
            <div className="px-4 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-gray-900 dark:text-white">
                  {(Number(user.storageUsed) / 1024 / 1024).toFixed(1)} МБ
                </span>
                <span className="text-sm text-gray-400">
                  из {(Number(user.storageLimit) / 1024 / 1024).toFixed(0)} МБ
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-gray-200 dark:bg-gray-600 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{
                    width: `${Math.min(Math.round((Number(user.storageUsed) / Number(user.storageLimit)) * 100), 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Password change */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Lock className="w-4 h-4 text-emerald-500" />
          Безопасность
        </h2>

        {passwordSuccess && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-emerald-50 dark:bg-emerald-950 border border-emerald-100 dark:border-emerald-800 mb-4">
            <Check className="w-4 h-4 text-emerald-600" />
            <p className="text-sm text-emerald-700 dark:text-emerald-300">Пароль успешно изменён</p>
          </div>
        )}

        {showPassword ? (
          <div className="space-y-3">
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Текущий пароль"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900 outline-none transition-all text-sm"
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="8 символов"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900 outline-none transition-all text-sm"
            />
            {passwordError && (
              <p className="text-xs text-red-500">{passwordError}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleChangePassword}
                disabled={passwordSaving}
                className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 disabled:opacity-50 flex items-center gap-1 transition-colors"
              >
                {passwordSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                Сменить пароль
              </button>
              <button
                onClick={() => { setShowPassword(false); setCurrentPassword(''); setNewPassword(''); setPasswordError(''); }}
                className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowPassword(true)}
            className="text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors font-medium"
          >
            Сменить пароль
          </button>
        )}
      </div>

      {/* Telegram integration */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Send className="w-4 h-4 text-sky-500" />
          Telegram-уведомления
        </h2>

        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Получайте заявки с форм вашего сайта прямо в Telegram.
        </p>

        {tgLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            Загрузка...
          </div>
        ) : tgStatus?.linked ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-emerald-50 dark:bg-emerald-950 border border-emerald-100 dark:border-emerald-800">
              <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
                <Check className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Telegram подключён</p>
                {tgStatus.username && (
                  <p className="text-xs text-emerald-600">@{tgStatus.username}</p>
                )}
              </div>
            </div>

            <button
              onClick={handleUnlink}
              disabled={unlinking}
              className="flex items-center gap-2 text-sm text-red-500 hover:text-red-600 transition-colors disabled:opacity-50"
            >
              {unlinking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlink className="w-3 h-3" />}
              Отвязать Telegram
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {deepLink ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Нажмите на ссылку — бот привяжет ваш аккаунт автоматически:
                </p>
                <a
                  href={deepLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-3 rounded-lg bg-sky-50 border border-sky-200 text-sky-700 hover:bg-sky-100 transition-colors text-sm font-medium"
                >
                  <ExternalLink className="w-4 h-4" />
                  Открыть бота в Telegram
                </a>
                <p className="text-xs text-gray-400">
                  После привязки обновите эту страницу.
                </p>
              </div>
            ) : (
              <button
                onClick={handleGenerateLink}
                disabled={generating}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-sky-500 text-white text-sm font-medium hover:bg-sky-600 transition-colors disabled:opacity-50"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                Подключить Telegram
              </button>
            )}
          </div>
        )}

        {/* Integration code */}
        {tgStatus?.linked && (
          <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
            <button
              onClick={() => setShowCode(!showCode)}
              className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <Code className="w-4 h-4" />
              {showCode ? 'Скрыть код для сайта' : 'Показать код для сайта'}
            </button>

            {showCode && (
              <div className="mt-4 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Вариант 1: Простая форма</p>
                    <button
                      onClick={() => handleCopy(formSnippetAction, 'action')}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
                    >
                      {copied === 'action' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copied === 'action' ? 'Скопировано' : 'Копировать'}
                    </button>
                  </div>
                  <pre className="p-3 rounded-lg bg-gray-900 text-green-400 text-xs overflow-x-auto whitespace-pre-wrap">
                    {formSnippetAction}
                  </pre>
                  <p className="text-xs text-gray-400 mt-1">
                    Замените <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">ВАШ-SLUG</code> на slug вашего проекта. После отправки страница перезагрузится.
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Вариант 2: Без перезагрузки (AJAX)</p>
                    <button
                      onClick={() => handleCopy(formSnippetJs, 'js')}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
                    >
                      {copied === 'js' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copied === 'js' ? 'Скопировано' : 'Копировать'}
                    </button>
                  </div>
                  <pre className="p-3 rounded-lg bg-gray-900 text-green-400 text-xs overflow-x-auto whitespace-pre-wrap">
                    {formSnippetJs}
                  </pre>
                  <p className="text-xs text-gray-400 mt-1">
                    Для сайтов на поддомене <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">.hostingvibe.ru</code> slug определяется автоматически.
                    Для кастомного домена добавьте <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">data-vibe-slug=&quot;ваш-slug&quot;</code> на форму.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Danger zone */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-red-100 dark:border-red-900 shadow-sm p-6">
        <h2 className="text-base font-semibold text-red-600 dark:text-red-400 mb-3 flex items-center gap-2">
          <Trash2 className="w-4 h-4" />
          Опасная зона
        </h2>

        {showDelete ? (
          <div>
            <p className="text-sm text-red-600 dark:text-red-400 mb-3">
              Удалить аккаунт и все проекты? Это действие необратимо.
            </p>
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="Введите пароль для подтверждения"
              className="w-full px-3 py-2 rounded-lg border border-red-200 dark:border-red-800 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-red-400 focus:ring-2 focus:ring-red-100 dark:focus:ring-red-900 outline-none transition-all text-sm mb-3"
            />
            {deleteError && (
              <p className="text-xs text-red-500 mb-3">{deleteError}</p>
            )}
            <div className="flex gap-3 flex-wrap">
              <button
                className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50 flex items-center gap-1"
                onClick={handleDeleteAccount}
                disabled={deleting}
              >
                {deleting && <Loader2 className="w-3 h-3 animate-spin" />}
                Да, удалить
              </button>
              <button
                onClick={() => { setShowDelete(false); setDeletePassword(''); setDeleteError(''); }}
                className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowDelete(true)}
            className="text-sm text-red-500 hover:text-red-600 transition-colors"
          >
            Удалить аккаунт
          </button>
        )}
      </div>
    </div>
  );
}
