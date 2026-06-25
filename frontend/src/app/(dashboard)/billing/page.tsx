'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { api, BillingStatus, BillingPeriodInfo, ApiError } from '@/lib/api';
import { Check, Sparkles, AlertCircle, Loader2 } from 'lucide-react';

function formatDate(iso: string | null): string {
  if (!iso) return '\u2014';
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

const PERIODS = [1, 3, 6, 12] as const;
type Period = (typeof PERIODS)[number];

const PERIOD_LABELS: Record<Period, string> = {
  1: '1 мес',
  3: '3 мес',
  6: '6 мес',
  12: '12 мес',
};

const DEFAULT_PERIODS: Record<string, BillingPeriodInfo> = {
  '1':  { months: 1,  pricePerMonth: 386, discount: 0,  total: 386 },
  '3':  { months: 3,  pricePerMonth: 367, discount: 5,  total: 1101 },
  '6':  { months: 6,  pricePerMonth: 328, discount: 15, total: 1968 },
  '12': { months: 12, pricePerMonth: 309, discount: 20, total: 3708 },
};

export default function BillingPage() {
  const { user } = useAuth();
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [autoRenew, setAutoRenew] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<Period>(1);

  useEffect(() => {
    api.getBillingStatus()
      .then(setBilling)
      .catch(() => setError('Не удалось загрузить данные подписки'))
      .finally(() => setLoading(false));
  }, []);

  const periods = billing?.billingPeriods ?? DEFAULT_PERIODS;
  const currentPeriodInfo = periods[String(selectedPeriod)];

  const handleUpgrade = async () => {
    setActionLoading('upgrade');
    setError(null);
    try {
      const { paymentUrl } = await api.createPayment(autoRenew && selectedPeriod === 1, selectedPeriod);
      if (typeof window.ym === 'function') {
        window.ym(107147478, 'reachGoal', 'buy_pro_click');
      }
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
  const isPastDue = sub?.status === 'PAST_DUE';

  return (
    <div className={`relative${loading ? ' pointer-events-none' : ''}`}>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Тариф и оплата</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
        Текущий план:{' '}
        <span className={`font-semibold ${isPro ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'}`}>
          {billing?.plan ?? user.plan}
        </span>
      </p>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-800 rounded-lg px-4 py-3 mb-6">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Тарифы */}
      <div className="grid md:grid-cols-2 gap-6 max-w-2xl">
        {/* FREE */}
        <div className={`rounded-2xl border p-6 ${!isPro ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/30 dark:bg-emerald-950/30' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'}`}>
          {!isPro && (
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900 px-2 py-0.5 rounded-full mb-3 inline-block">
              Текущий план
            </span>
          )}
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">FREE</h2>
          <p className="text-3xl font-extrabold text-gray-900 dark:text-white mb-4">
            <span className="font-mono">0</span> <span className="text-sm font-normal text-gray-400">бесплатно</span>
          </p>
          <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> 1 сайт</li>
            <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> 100 МБ хранилище</li>
            <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> 10 ГБ трафик/мес</li>
          </ul>
        </div>

        {/* PRO */}
        <div className={`rounded-2xl border p-6 ${isPro ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/30 dark:bg-emerald-950/30' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'}`}>
          {isPro && (
            <span className="text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-green-500 px-2 py-0.5 rounded-full mb-3 inline-flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Текущий план
            </span>
          )}
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">PRO</h2>

          {/* Period selector */}
          {!isPro && (
            <div className="flex gap-1 mb-4 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
              {PERIODS.map((p) => {
                const info = periods[String(p)];
                const isSelected = p === selectedPeriod;
                return (
                  <button
                    key={p}
                    onClick={() => setSelectedPeriod(p)}
                    className={`flex-1 relative py-1.5 px-2 text-xs font-medium rounded-md transition-all ${
                      isSelected
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    {PERIOD_LABELS[p]}
                    {info && info.discount > 0 && (
                      <span className={`block text-[10px] leading-tight ${isSelected ? 'text-emerald-600 dark:text-emerald-400' : 'text-emerald-500'}`}>
                        -{info.discount}%
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <div className="mb-4">
            <p className="text-3xl font-extrabold text-gray-900 dark:text-white">
              <span className="font-mono">{currentPeriodInfo?.pricePerMonth ?? 386}</span>{' '}
              <span className="text-sm font-normal text-gray-400">{'\u20BD'}/мес</span>
            </p>
            {selectedPeriod > 1 && currentPeriodInfo && !isPro && (
              <div className="mt-1 flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400 line-through">386 {'\u20BD'}/мес</span>
                <span className="text-xs font-semibold text-white bg-emerald-500 px-1.5 py-0.5 rounded">
                  -{currentPeriodInfo.discount}%
                </span>
              </div>
            )}
            {selectedPeriod > 1 && currentPeriodInfo && !isPro && (
              <p className="text-xs text-gray-400 mt-1">
                Итого за {selectedPeriod} мес: <span className="font-mono">{currentPeriodInfo.total}</span> {'\u20BD'}
              </p>
            )}
          </div>

          <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400 mb-6">
            <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> 3 сайта</li>
            <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> 500 МБ хранилище</li>
            <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> Безлимит трафик</li>
            <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> Кастомные домены</li>
            <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> Аналитика</li>
          </ul>

          {/* Чекбокс автопродления + кнопка */}
          {!isPro && (
            <div className="space-y-3">
              {selectedPeriod === 1 && (
                <label className="flex items-start gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoRenew}
                    onChange={(e) => setAutoRenew(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Включить автопродление
                    <span className="block text-xs text-gray-400 mt-0.5">
                      {currentPeriodInfo?.pricePerMonth ?? 386} {'\u20BD'}/мес будет списываться автоматически. Отменить можно в любой момент.
                    </span>
                  </span>
                </label>
              )}
              <button
                disabled={actionLoading === 'upgrade' || loading}
                onClick={handleUpgrade}
                className="w-full py-2.5 rounded-lg bg-emerald-500 text-white font-semibold hover:bg-emerald-600 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {actionLoading === 'upgrade' ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Переходим...</>
                ) : selectedPeriod === 1 ? 'Перейти на PRO' : `Оплатить ${currentPeriodInfo?.total}\u00A0\u20BD за ${selectedPeriod}\u00A0мес`}
              </button>
            </div>
          )}

          {/* Статус активной подписки */}
          {isPro && isActive && (
            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
              <p>
                {sub?.hasAutopayment ? 'Следующее списание' : 'PRO активен до'}:{' '}
                <span className="font-medium text-gray-700 dark:text-gray-300">{formatDate(sub?.currentPeriodEnd ?? null)}</span>
                {sub?.hasAutopayment && <span className="ml-1 text-emerald-600 dark:text-emerald-400">(автопродление)</span>}
              </p>
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
                <button onClick={() => setCancelConfirm(false)} className="ml-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  Нет
                </button>
              )}
            </div>
          )}

          {/* Подписка отменена, но PRO ещё активен */}
          {isPro && isCancelled && (
            <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 rounded-lg px-3 py-2">
              {sub?.hasAutopayment
                ? 'Автосписание отменено.'
                : 'Подписка отменена.'
              } PRO активен до {formatDate(sub?.currentPeriodEnd ?? null)}.
              <br />
              <button
                onClick={handleUpgrade}
                disabled={actionLoading === 'upgrade'}
                className="text-emerald-600 dark:text-emerald-400 font-medium hover:underline mt-1"
              >
                Возобновить
              </button>
            </div>
          )}

          {/* Подписка истекла */}
          {isPastDue && (
            <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 rounded-lg px-3 py-2 mt-2">
              Подписка истекла{sub?.currentPeriodEnd ? ` ${formatDate(sub.currentPeriodEnd)}` : ''}.
              Ваш план переведён на FREE.
              <br />
              <button
                onClick={handleUpgrade}
                disabled={actionLoading === 'upgrade'}
                className="text-emerald-600 dark:text-emerald-400 font-medium hover:underline mt-1"
              >
                Продлить PRO
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Skeleton пока грузится */}
      {loading && (
        <div className="absolute inset-0 z-10 bg-white/60 dark:bg-gray-900/60 rounded-xl flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
        </div>
      )}
    </div>
  );
}
