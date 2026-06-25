'use client';

import { useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useScrollReveal } from '@/lib/useAnimate';

const PERIODS = [1, 3, 6, 12] as const;
type Period = (typeof PERIODS)[number];

const PERIOD_LABELS: Record<Period, string> = {
  1: '1 мес',
  3: '3 мес',
  6: '6 мес',
  12: '12 мес',
};

const PRO_PERIODS: Record<Period, { price: number; discount: number; total: number }> = {
  1:  { price: 386, discount: 0,  total: 386 },
  3:  { price: 367, discount: 5,  total: 1101 },
  6:  { price: 328, discount: 15, total: 1968 },
  12: { price: 309, discount: 20, total: 3708 },
};

const freeFeatures = [
  '1 сайт',
  '100 МБ хранилище',
  'Субдомен .hostingvibe.ru',
  '10 ГБ трафик / мес',
  'Без привязки карты',
  'Базовая аналитика',
  '3 версии для отката',
];

const proFeatures = [
  '3 сайта',
  '500 МБ хранилище',
  'Кастомные домены + SSL',
  'Безлимит трафик',
  'Подробная аналитика',
  '15 версий для отката',
  'Визуальный редактор',
  'Формы \u2192 Telegram',
];

export function Pricing() {
  const leftRef = useScrollReveal({ delay: 0 });
  const rightRef = useScrollReveal({ delay: 150 });
  const [selectedPeriod, setSelectedPeriod] = useState<Period>(1);

  const proInfo = PRO_PERIODS[selectedPeriod];

  return (
    <section id="pricing" className="py-24">
      <div className="max-w-6xl mx-auto px-6">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 dark:text-white mb-4">
          Простые тарифы
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-center mb-8 max-w-xl mx-auto">
          Начните бесплатно {'\u2014'} масштабируйтесь когда будете готовы
        </p>

        {/* Period toggle */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex gap-1 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
            {PERIODS.map((p) => {
              const info = PRO_PERIODS[p];
              const isSelected = p === selectedPeriod;
              return (
                <button
                  key={p}
                  onClick={() => setSelectedPeriod(p)}
                  className={`relative px-4 py-2 text-sm font-medium rounded-md transition-all ${
                    isSelected
                      ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm dark:shadow-gray-900/20'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  {PERIOD_LABELS[p]}
                  {info.discount > 0 && (
                    <span className={`ml-1 text-xs ${isSelected ? 'text-emerald-600 dark:text-emerald-400' : 'text-emerald-500 dark:text-emerald-400'}`}>
                      -{info.discount}%
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 md:gap-6 max-w-3xl mx-auto">
          {/* FREE */}
          <div
            ref={leftRef}
            className="relative rounded-2xl p-7 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm dark:shadow-gray-900/20 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
          >
            <div className="mb-5">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">FREE</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Для старта и экспериментов</p>
            </div>

            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white font-mono">0</span>
              <span className="text-gray-500 dark:text-gray-400"> старт бесплатно</span>
            </div>

            <ul className="space-y-2.5 mb-7">
              {freeFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-600 dark:text-gray-300">{feature}</span>
                </li>
              ))}
            </ul>

            <Link
              href="/register"
              className="block w-full text-center py-3 rounded-xl font-semibold transition-all bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              Начать бесплатно
            </Link>
          </div>

          {/* PRO */}
          <div
            ref={rightRef}
            className="relative rounded-2xl p-7 border border-emerald-200 dark:border-emerald-700 bg-gradient-to-b from-emerald-50/50 to-white dark:from-emerald-950/30 dark:to-gray-900 shadow-xl shadow-emerald-100/50 dark:shadow-emerald-900/30 md:scale-105 transition-all duration-200 hover:shadow-2xl"
          >
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-emerald-500 to-green-500 text-white text-xs font-bold flex items-center gap-1 shadow-md">
              <Sparkles className="w-3 h-3" />
              Популярный
            </div>

            <div className="mb-5">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">PRO</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Для фрилансеров и бизнеса</p>
            </div>

            <div className="mb-6">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white font-mono">{proInfo.price}</span>
                <span className="text-gray-500 dark:text-gray-400">{'\u20BD'} / мес</span>
              </div>
              {selectedPeriod > 1 && (
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-sm text-gray-400 dark:text-gray-400 line-through">386 {'\u20BD'}/мес</span>
                  <span className="text-xs font-semibold text-white bg-emerald-500 px-1.5 py-0.5 rounded">
                    -{proInfo.discount}%
                  </span>
                </div>
              )}
              {selectedPeriod > 1 && (
                <p className="text-xs text-gray-400 dark:text-gray-400 mt-1">
                  Итого за {selectedPeriod} мес: <span className="font-mono font-medium text-gray-600 dark:text-gray-300">{proInfo.total} {'\u20BD'}</span>
                </p>
              )}
            </div>

            <ul className="space-y-2.5 mb-7">
              {proFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-600 dark:text-gray-300">{feature}</span>
                </li>
              ))}
            </ul>

            <Link
              href="/register?plan=pro"
              className="block w-full text-center py-3 rounded-xl font-semibold transition-all bg-emerald-500 text-white hover:bg-emerald-600 shadow-md shadow-emerald-500/20 hover:shadow-lg hover:-translate-y-0.5"
            >
              Подключить PRO
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
