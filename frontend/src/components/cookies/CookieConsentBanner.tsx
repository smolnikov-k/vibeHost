'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  CookieConsentState,
  getStoredCookieConsent,
  setStoredCookieConsent,
} from '@/lib/consent';

export function CookieConsentBanner() {
  const [consent, setConsent] = useState<CookieConsentState | null>(null);

  useEffect(() => {
    setConsent(getStoredCookieConsent());
  }, []);

  const handleDecision = (value: CookieConsentState) => {
    setStoredCookieConsent(value);
    setConsent(value);
    window.dispatchEvent(new CustomEvent('vh:cookie-consent-changed', { detail: { consent: value } }));
  };

  if (consent !== null) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 sm:inset-x-auto sm:bottom-4 sm:right-6 sm:max-w-md">
      <div className="border-t sm:border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 p-4 shadow-xl backdrop-blur sm:rounded-2xl">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">Cookie-файлы и аналитика</p>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          Мы используем обязательные cookie для работы сайта и Яндекс.Метрику для аналитики только с вашего
          согласия.
        </p>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Подробнее — в{' '}
          <Link href="/privacy" className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:underline">
            Политике конфиденциальности
          </Link>
          .
        </p>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => handleDecision('accepted')}
            className="w-full rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-600"
          >
            Принять аналитические cookie
          </button>
          <button
            type="button"
            onClick={() => handleDecision('rejected')}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Только необходимые
          </button>
        </div>
      </div>
    </div>
  );
}
