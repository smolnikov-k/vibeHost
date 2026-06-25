'use client';

import { useState } from 'react';
import { useScrollReveal } from '@/lib/useAnimate';
import {
  Megaphone, Palette, Code2, GraduationCap, Briefcase,
  Building2, ShoppingBag, ArrowRight,
} from 'lucide-react';
import Link from 'next/link';

const audiences = [
  {
    id: 'marketing',
    icon: Megaphone,
    label: 'Маркетинг',
    title: 'Запускайте лендинги без разработчика',
    description: 'Тестируйте гипотезы за минуты, а не дни. Создайте лендинг, получите QR-код для листовки и отслеживайте конверсию — всё в одном месте.',
    features: ['Мгновенные лендинги', 'QR-коды для офлайна', 'Аналитика просмотров', 'Формы заявок в Telegram'],
  },
  {
    id: 'design',
    icon: Palette,
    label: 'Дизайнеры',
    title: 'Показывайте работы клиентам за 2 минуты',
    description: 'Экспортируйте макет из Figma или Webflow, перетащите файлы — и отправьте ссылку клиенту. Защитите превью паролем, если нужно.',
    features: ['Портфолио за минуту', 'Защита паролем', 'Свой домен', 'Визуальный редактор'],
  },
  {
    id: 'dev',
    icon: Code2,
    label: 'Разработчики',
    title: 'Deploy из GitHub одной кнопкой',
    description: 'React, Vue, Next.js, Vite, Astro — загрузите проект, мы сами запустим npm install и соберём. Или вставьте ссылку на GitHub-репозиторий.',
    features: ['Автосборка проектов', 'GitHub-интеграция', 'Версии и откат', 'Удобный деплой из панели'],
  },
  {
    id: 'students',
    icon: GraduationCap,
    label: 'Студенты',
    title: 'Бесплатный хостинг для учебных проектов',
    description: 'Разместите курсовую, портфолио или дипломный проект бесплатно без карты. Покажите преподавателю ссылку вместо флешки.',
    features: ['Бесплатный старт без карты', 'Субдомен .hostingvibe.ru', 'Портфолио для резюме', 'Без привязки карты'],
  },
  {
    id: 'business',
    icon: Building2,
    label: 'Малый бизнес',
    title: 'Сайт-визитка для компании за 5 минут',
    description: 'Не нужен WordPress или Тильда. Загрузите готовый сайт, подключите домен и принимайте заявки в Telegram.',
    features: ['Свой домен + SSL', 'Формы заявок', 'Оплата в рублях', 'Поддержка на русском'],
  },
  {
    id: 'freelance',
    icon: Briefcase,
    label: 'Фрилансеры',
    title: 'Хостинг для клиентских проектов',
    description: 'Размещайте сайты клиентов, управляйте ими из одной панели. Каждый проект на своём домене с аналитикой.',
    features: ['До 3 проектов на PRO', 'Управление проектами из одной панели', 'Аналитика по проектам', 'Поддержка в Telegram'],
  },
];

export function UseCases() {
  const [active, setActive] = useState('marketing');
  const ref = useScrollReveal();

  const current = audiences.find((a) => a.id === active)!;

  return (
    <section id="use-cases" className="py-24 bg-gray-50/50 dark:bg-gray-800/50">
      <div className="max-w-5xl mx-auto px-6" ref={ref}>
        <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 dark:text-white mb-4">
          VibeHosting — для вас
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-center mb-12 max-w-xl mx-auto">
          Независимо от вашей сферы — мы сделали хостинг максимально простым
        </p>

        {/* Audience tabs */}
        <div className="flex items-center justify-center gap-2 mb-10 flex-wrap">
          {audiences.map((a) => (
            <button
              key={a.id}
              onClick={() => setActive(a.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                active === a.id
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                  : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-emerald-200 dark:hover:border-emerald-800 hover:text-emerald-600 dark:hover:text-emerald-400'
              }`}
            >
              <a.icon className="w-4 h-4" />
              {a.label}
            </button>
          ))}
        </div>

        {/* Active audience content */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 sm:p-8 md:p-10 shadow-sm dark:shadow-gray-900/20">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">{current.title}</h3>
              <p className="text-gray-500 dark:text-gray-400 leading-relaxed mb-6">{current.description}</p>
              <ul className="space-y-2.5 mb-6">
                {current.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                    <div className="w-5 h-5 rounded-full bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center shrink-0">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    </div>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-white font-semibold text-sm hover:bg-emerald-600 transition-colors shadow-md shadow-emerald-500/20 group"
              >
                Попробовать бесплатно
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            {/* Visual placeholder - browser mockup */}
            <div className="hidden md:block">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-700">
                  <div className="w-3 h-3 rounded-full bg-red-300" />
                  <div className="w-3 h-3 rounded-full bg-amber-300" />
                  <div className="w-3 h-3 rounded-full bg-green-300" />
                  <div className="flex-1 ml-3 h-5 rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 flex items-center px-2">
                    <span className="text-[10px] text-gray-400 dark:text-gray-400">yoursite.hostingvibe.ru</span>
                  </div>
                </div>
                <div className="p-6 min-h-[200px] flex flex-col items-center justify-center text-center">
                  <current.icon className="w-12 h-12 text-emerald-300 mb-3" />
                  <p className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1">{current.title}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-400">Загрузите файлы и получите такой сайт</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
