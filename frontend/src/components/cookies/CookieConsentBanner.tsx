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
    <div className="fixed inset-x-4 bottom-4 z-50 sm:inset-x-auto sm:right-6 sm:max-w-md">
      <div className="rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-xl backdrop-blur">
        <p className="text-sm font-semibold text-gray-900">Cookie-файлы и аналитика</p>
        <p className="mt-1 text-sm text-gray-600">
          Мы используем обязательные cookie для работы сайта и Яндекс.Метрику для аналитики только с вашего
          согласия.
        </p>
        <p className="mt-2 text-xs text-gray-500">
          Подробнее — в{' '}
          <Link href="/privacy" className="text-emerald-600 hover:text-emerald-700 hover:underline">
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
            className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            Только необходимые
          </button>
        </div>
      </div>
    </div>
  );
}
