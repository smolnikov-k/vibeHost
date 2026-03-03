'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { api, BillingStatus, ApiError } from '@/lib/api';
import { Check, Sparkles, Zap, AlertCircle, Loader2 } from 'lucide-react';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function BillingPage() {
  const { user } = useAuth();
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState(false);

  useEffect(() => {
    api.getBillingStatus()
      .then(setBilling)
      .catch(() => setError('Не удалось загрузить данные подписки'))
      .finally(() => setLoading(false));
  }, []);

  const handleUpgrade = async () => {
    setActionLoading('upgrade');
    setError(null);
    try {
      const { paymentUrl } = await api.createPayment();
      window.location.href = paymentUrl;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ошибка создания платежа');
      setActionLoading(null);
    }
  };

  const handleAiPack = async (pack: '10' | '50') => {
    setActionLoading(`aipack_${pack}`);
    setError(null);
    try {
      const { paymentUrl } = await api.createAiPack(pack);
      window.location.href = paymentUrl;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ошибка создания платежа');
      setActionLoading(null);
    }
  };

  const handleCancel = async () => {
    if (!cancelConfirm) {
      setCancelConfirm(true);
      return;
    }
    setActionLoading('cancel');
    setError(null);
    try {
      await api.cancelSubscription();
      const updated = await api.getBillingStatus();
      setBilling(updated);
      setCancelConfirm(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ошибка отмены подписки');
    } finally {
      setActionLoading(null);
    }
  };

  if (!user) return null;

  const isPro = billing ? billing.plan === 'PRO' : user.plan === 'PRO';
  const sub = billing?.subscription;
  const isActive = sub?.status === 'ACTIVE';
  const isCancelled = sub?.status === 'CANCELLED';

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Тариф и оплата</h1>
      <p className="text-sm text-gray-500 mb-8">
        Текущий план:{' '}
        <span className={`font-semibold ${isPro ? 'text-emerald-600' : 'text-gray-700'}`}>
          {billing?.plan ?? user.plan}
        </span>
        {billing && (
          <span className="ml-2 text-gray-400">· AI-запросов: {billing.aiCredits}</span>
        )}
      </p>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3 mb-6">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Тарифы */}
      <div className="grid md:grid-cols-2 gap-6 max-w-2xl">
        {/* FREE */}
        <div className={`rounded-2xl border p-6 ${!isPro ? 'border-emerald-300 bg-emerald-50/30' : 'border-gray-200 bg-white'}`}>
          {!isPro && (
            <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full mb-3 inline-block">
              Текущий план
            </span>
          )}
          <h2 className="text-lg font-bold text-gray-900 mb-1">FREE</h2>
          <p className="text-3xl font-extrabold text-gray-900 mb-4">
            0 <span className="text-sm font-normal text-gray-400">навсегда</span>
          </p>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> 1 сайт</li>
            <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> 50 МБ хранилище</li>
            <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> 10 ГБ трафик/мес</li>
            <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> 10 AI-запросов</li>
          </ul>
        </div>

        {/* PRO */}
        <div className={`rounded-2xl border p-6 ${isPro ? 'border-emerald-300 bg-emerald-50/30' : 'border-gray-200 bg-white'}`}>
          {isPro && (
            <span className="text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-green-500 px-2 py-0.5 rounded-full mb-3 inline-flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Текущий план
            </span>
          )}
          <h2 className="text-lg font-bold text-gray-900 mb-1">PRO</h2>
          <p className="text-3xl font-extrabold text-gray-900 mb-4">
            386 <span className="text-sm font-normal text-gray-400">₽/мес</span>
          </p>
          <ul className="space-y-2 text-sm text-gray-600 mb-6">
            <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> 3 сайта</li>
            <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> 1 ГБ хранилище</li>
            <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> Безлимит трафик</li>
            <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> 20 AI-запросов/мес</li>
            <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> Кастомные домены</li>
            <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> Аналитика</li>
          </ul>

          {/* Кнопка перехода */}
          {!isPro && (
            <button
              disabled={actionLoading === 'upgrade' || loading}
              onClick={handleUpgrade}
              className="w-full py-2.5 rounded-lg bg-emerald-500 text-white font-semibold hover:bg-emerald-600 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {actionLoading === 'upgrade' ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Переходим...</>
              ) : 'Перейти на PRO'}
            </button>
          )}

          {/* Статус активной подписки */}
          {isPro && isActive && (
            <div className="text-xs text-gray-500 space-y-1">
              <p>Следующее списание: <span className="font-medium text-gray-700">{formatDate(sub?.currentPeriodEnd ?? null)}</span></p>
              <button
                onClick={handleCancel}
                disabled={actionLoading === 'cancel'}
                className="text-red-500 hover:text-red-600 transition-colors mt-2"
              >
                {cancelConfirm
                  ? (actionLoading === 'cancel' ? 'Отменяем...' : 'Подтвердить отмену?')
                  : 'Отменить подписку'}
              </button>
              {cancelConfirm && (
                <button onClick={() => setCancelConfirm(false)} className="ml-3 text-gray-400 hover:text-gray-600">
                  Нет
                </button>
              )}
            </div>
          )}

          {/* Подписка отменена, но PRO ещё активен */}
          {isPro && isCancelled && (
            <div className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
              Подписка отменена. PRO активен до {formatDate(sub?.currentPeriodEnd ?? null)}.
              <br />
              <button
                onClick={handleUpgrade}
                disabled={actionLoading === 'upgrade'}
                className="text-emerald-600 font-medium hover:underline mt-1"
              >
                Возобновить
              </button>
            </div>
          )}
        </div>
      </div>

      {/* AI пакеты */}
      <div className="mt-10">
        <h2 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
          <Zap className="w-5 h-5 text-emerald-500" />
          Пакеты AI-запросов
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Докупите AI-запросы — доступны на любом тарифе
        </p>
        <div className="flex gap-4 flex-wrap">
          {([['10', '99'], ['50', '399']] as const).map(([pack, price]) => (
            <button
              key={pack}
              disabled={!!actionLoading || loading}
              onClick={() => handleAiPack(pack)}
              className="px-6 py-3 rounded-xl border border-gray-200 bg-white hover:border-emerald-300 hover:shadow-sm transition-all text-left disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {actionLoading === `aipack_${pack}` ? (
                <div className="flex items-center gap-2 text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Переходим...</span>
                </div>
              ) : (
                <>
                  <p className="font-bold text-gray-900">{pack} запросов</p>
                  <p className="text-sm text-emerald-600 font-medium">{price} ₽</p>
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Skeleton пока грузится */}
      {loading && (
        <div className="absolute inset-0 bg-white/60 rounded-xl flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
        </div>
      )}
    </div>
  );
}
