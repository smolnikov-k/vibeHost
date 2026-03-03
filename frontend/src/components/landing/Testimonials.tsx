'use client';

import { useStaggerReveal } from '@/lib/useAnimate';
import { Star } from 'lucide-react';

const testimonials = [
  {
    name: 'Алексей К.',
    role: 'Веб-дизайнер',
    text: 'Показываю клиентам макеты за минуту — перетащил файлы, отправил ссылку. Раньше на это уходил час.',
    rating: 5,
  },
  {
    name: 'Мария С.',
    role: 'Маркетолог',
    text: 'Запустила лендинг для рекламной кампании без разработчика. Формы сразу приходят в Telegram — удобно!',
    rating: 5,
  },
  {
    name: 'Дмитрий П.',
    role: 'Студент',
    text: 'Идеально для портфолио. Бесплатный тариф покрывает все мои нужды. Подключил свой домен за 5 минут.',
    rating: 5,
  },
];

export function Testimonials() {
  const staggerRef = useStaggerReveal();

  return (
    <section className="py-24">
      <div className="max-w-5xl mx-auto px-6">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-4">
          Нам доверяют
        </h2>
        <p className="text-gray-500 text-center mb-16 max-w-xl mx-auto">
          Отзывы пользователей VibeHosting
        </p>

        <div ref={staggerRef} className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex gap-1 mb-4">
                {Array.from({ length: t.rating }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-gray-600 text-sm leading-relaxed mb-5">
                &laquo;{t.text}&raquo;
              </p>
              <div>
                <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                <p className="text-xs text-gray-400">{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
