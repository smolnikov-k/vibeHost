'use client';

import { useStaggerReveal } from '@/lib/useAnimate';
import { Server, ShieldCheck, Headphones, FileText } from 'lucide-react';

const signals = [
  {
    icon: Server,
    title: 'Серверы в России',
    description: 'Данные хранятся на серверах в РФ. Минимальный пинг для российских пользователей.',
  },
  {
    icon: ShieldCheck,
    title: 'Соответствие 152-ФЗ',
    description: 'Персональные данные обрабатываются в соответствии с законодательством РФ.',
  },
  {
    icon: Headphones,
    title: 'Поддержка на русском',
    description: 'Техподдержка в Telegram — отвечаем быстро и по делу. Без языкового барьера.',
  },
  {
    icon: FileText,
    title: 'Оплата в рублях',
    description: 'Принимаем российские карты через Prodamus. Никаких проблем с валютой.',
  },
];

export function TrustSignals() {
  const staggerRef = useStaggerReveal();

  return (
    <section className="py-24">
      <div className="max-w-5xl mx-auto px-6">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 dark:text-white mb-4">
          Почему выбирают нас
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-center mb-16 max-w-xl mx-auto">
          Создано для российского рынка — с пониманием ваших потребностей
        </p>

        <div ref={staggerRef} className="grid md:grid-cols-2 gap-6">
          {signals.map((signal) => (
            <div
              key={signal.title}
              className="flex gap-4 p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 hover:border-emerald-100 dark:hover:border-emerald-800 hover:shadow-sm dark:hover:shadow-gray-900/20 hover:scale-[1.02] transition-all duration-200"
            >
              <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center shrink-0">
                <signal.icon className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">{signal.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{signal.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
