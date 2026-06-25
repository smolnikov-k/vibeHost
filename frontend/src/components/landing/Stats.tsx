'use client';

import { useScrollReveal } from '@/lib/useAnimate';

const stats = [
  { value: '500+', label: 'сайтов размещено' },
  { value: '99.9%', label: 'аптайм сервера' },
  { value: '< 1 сек', label: 'время загрузки' },
  { value: '24/7', label: 'поддержка в Telegram' },
];

export function Stats() {
  const ref = useScrollReveal();

  return (
    <section className="py-16">
      <div className="max-w-4xl mx-auto px-6" ref={ref}>
        <div className="bg-gradient-to-r from-emerald-500 to-green-500 rounded-2xl p-10 shadow-xl shadow-emerald-500/10 dark:shadow-emerald-900/30">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl md:text-4xl font-extrabold text-white mb-1 font-mono">{stat.value}</p>
                <p className="text-sm text-emerald-100">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
