'use client';

import { useStaggerReveal } from '@/lib/useAnimate';
import { Star, Quote } from 'lucide-react';

const testimonials = [
  {
    name: 'Алексей К.',
    role: 'Веб-дизайнер',
    text: 'Показываю клиентам макеты за минуту — перетащил файлы, отправил ссылку. Раньше на это уходил час. Визуальный редактор — вообще огонь!',
    rating: 5,
  },
  {
    name: 'Мария С.',
    role: 'Маркетолог',
    text: 'Запустила лендинг для рекламной кампании без разработчика. QR-код для листовки сгенерировала за секунду. Формы заявок приходят прямо в Telegram — супер удобно!',
    rating: 5,
  },
  {
    name: 'Дмитрий П.',
    role: 'Студент, МГТУ',
    text: 'Идеально для портфолио. Бесплатный тариф покрывает все мои нужды. Загрузил проект за 5 минут, а преподаватель был в восторге от подачи.',
    rating: 4,
  },
  {
    name: 'Елена В.',
    role: 'Фрилансер',
    text: 'Все остальные хостинги либо требовали знания DevOps, либо были слишком ограничены. VibeHosting — золотая середина. Размещаю по 3-4 клиентских сайта в неделю.',
    rating: 5,
  },
  {
    name: 'Иван Т.',
    role: 'Разработчик',
    text: 'Загрузил React-проект с GitHub — он сам всё собрал и задеплоил. Серверы в России, поэтому сайт летает. Не верил, пока не попробовал.',
    rating: 4,
  },
  {
    name: 'Ольга Н.',
    role: 'Владелец кафе',
    text: 'Муж сделал нам сайт-визитку, я сама загрузила на хостинг и подключила домен. Никакого кода, никаких консолей. Поддержка ответила за 10 минут.',
    rating: 5,
  },
];

export function Testimonials() {
  const staggerRef = useStaggerReveal();

  return (
    <section className="py-24 bg-gray-50/50 dark:bg-gray-800/50">
      <div className="max-w-5xl mx-auto px-6">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 dark:text-white mb-4">
          Нам доверяют
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-center mb-16 max-w-xl mx-auto">
          Пользователи выбирают VibeHosting за простоту и скорость
        </p>

        <div ref={staggerRef} className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm dark:shadow-gray-900/20 hover:shadow-md hover:scale-[1.02] transition-all duration-200 relative"
            >
              <Quote className="absolute top-4 right-4 w-6 h-6 text-emerald-100 dark:text-emerald-200" />
              <div className="flex gap-1 mb-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`w-4 h-4 ${i < t.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200 dark:text-gray-600'}`} />
                ))}
              </div>
              <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed mb-5">
                &laquo;{t.text}&raquo;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center text-white text-sm font-bold">
                  {t.name[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{t.name}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-400">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
