'use client';

import { Check, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useScrollReveal } from '@/lib/useAnimate';

const plans = [
  {
    name: 'FREE',
    price: '0',
    period: 'старт бесплатно',
    description: 'Для старта и экспериментов',
    features: [
      '1 сайт',
      '50 МБ хранилище',
      'Субдомен .hostingvibe.ru',
      '10 ГБ трафик / мес',
      'Без привязки карты',
      'Базовая аналитика',
      '3 версии для отката',
    ],
    cta: 'Начать бесплатно',
    href: '/register',
    popular: false,
    accent: false,
  },
  {
    name: 'PRO',
    price: '386',
    period: '/ мес',
    description: 'Для фрилансеров и бизнеса',
    features: [
      '3 сайта',
      '1 ГБ хранилище',
      'Кастомные домены + SSL',
      'Безлимит трафик',
      'Подробная аналитика',
      '15 версий для отката',
      'Визуальный редактор',
      'Формы → Telegram',
    ],
    cta: 'Подключить PRO',
    href: '/register',
    popular: true,
    accent: true,
  },
];

export function Pricing() {
  const leftRef = useScrollReveal({ delay: 0 });
  const rightRef = useScrollReveal({ delay: 150 });
  const refs = [leftRef, rightRef];

  return (
    <section id="pricing" className="py-24">
      <div className="max-w-6xl mx-auto px-6">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-4">
          Простые тарифы
        </h2>
        <p className="text-gray-500 text-center mb-16 max-w-xl mx-auto">
          Начните бесплатно — масштабируйтесь когда будете готовы
        </p>

        <div className="grid md:grid-cols-2 gap-4 md:gap-6 max-w-3xl mx-auto">
          {plans.map((plan, i) => (
            <div
              key={plan.name}
              ref={refs[i]}
              className={`relative rounded-2xl p-7 border ${
                plan.popular
                  ? 'border-emerald-200 bg-gradient-to-b from-emerald-50/50 to-white shadow-xl shadow-emerald-100/50 md:scale-105'
                  : 'border-gray-200 bg-white shadow-sm'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-emerald-500 to-green-500 text-white text-xs font-bold flex items-center gap-1 shadow-md">
                  <Sparkles className="w-3 h-3" />
                  Популярный
                </div>
              )}

              <div className="mb-5">
                <h3 className="text-lg font-bold text-gray-900 mb-1">{plan.name}</h3>
                <p className="text-sm text-gray-500">{plan.description}</p>
              </div>

              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-3xl sm:text-4xl font-extrabold text-gray-900">{plan.price}</span>
                <span className="text-gray-500">
                  {plan.price !== '0' && '₽'} {plan.period}
                </span>
              </div>

              <ul className="space-y-2.5 mb-7">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-600">{feature}</span>
                  </li>
                ))}
              </ul>


              {plan.name === 'FREE' ? (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-4">
                  Проекты на FREE могут быть приостановлены по правилам тарифа, если долго не обновляются.
                </p>
              ) : null}
              <Link
                href={plan.href}
                className={`block w-full text-center py-3 rounded-xl font-semibold transition-all ${
                  plan.accent
                    ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-md shadow-emerald-500/20 hover:shadow-lg hover:-translate-y-0.5'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
