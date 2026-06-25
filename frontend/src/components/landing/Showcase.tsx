'use client';

import { useStaggerReveal } from '@/lib/useAnimate';
import { ExternalLink } from 'lucide-react';
import Link from 'next/link';

const showcaseItems = [
  {
    slug: 'bereg',
    title: 'Берег — ресторан',
    description: 'Ресторан авторской кухни на набережной в Санкт-Петербурге. Тёмная тема, бронирование стола.',
    emoji: '🦞',
    tags: ['Ресторан', 'Бронирование'],
    accent: 'from-teal-900 to-emerald-950',
  },
  {
    slug: 'case-design',
    title: 'Анна Смирнова — дизайнер',
    description: 'Портфолио UX/UI дизайнера: мобильные приложения, веб-интерфейсы, дизайн-системы.',
    emoji: '🎨',
    tags: ['Портфолио', 'Дизайн'],
    accent: 'from-violet-900 to-purple-950',
  },
  {
    slug: 'nutrition',
    title: 'НутриПро Академия',
    description: 'Лендинг онлайн-курса по нутрициологии с тарифами, программой и формой записи.',
    emoji: '🥗',
    tags: ['Онлайн-курс', 'Тарифы'],
    accent: 'from-teal-800 to-cyan-950',
  },
  {
    slug: 'case-marketing',
    title: 'SPARK Agency — вебинар',
    description: 'Лендинг бесплатного маркетингового вебинара с таймером и формой регистрации.',
    emoji: '🚀',
    tags: ['Маркетинг', 'Лендинг'],
    accent: 'from-orange-800 to-red-950',
  },
  {
    slug: 'saas',
    title: 'Planly — SaaS-продукт',
    description: 'Планирование и автопостинг контента в соцсети. Тарифы, интеграции, онбординг.',
    emoji: '⚡',
    tags: ['SaaS', 'Продукт'],
    accent: 'from-blue-900 to-indigo-950',
  },
  {
    slug: 'barber',
    title: 'Fresh Cut — Барбершоп',
    description: 'Мужской барбершоп в Санкт-Петербурге. Прайс-лист, запись к мастеру.',
    emoji: '✂️',
    tags: ['Малый бизнес', 'Запись'],
    accent: 'from-zinc-900 to-neutral-950',
  },
  {
    slug: 'dentaclinic',
    title: 'ДентаКлиника',
    description: 'Стоматология в Новосибирске: услуги, врачи, онлайн-запись. Светлая тема.',
    emoji: '🦷',
    tags: ['Клиника', 'Медицина'],
    accent: 'from-sky-800 to-blue-950',
  },
  {
    slug: 'freelance',
    title: 'Pixelcraft Studio',
    description: 'Веб-студия для малого бизнеса: портфолио проектов, услуги, обратная связь.',
    emoji: '💻',
    tags: ['Веб-студия', 'Фриланс'],
    accent: 'from-indigo-900 to-slate-950',
  },
  {
    slug: 'hackathon',
    title: 'EcoRoute — хакатон',
    description: 'Студенческий проект экологичных маршрутов. 1 место на HackMoscow 2026.',
    emoji: '🌿',
    tags: ['Стартап', 'Хакатон'],
    accent: 'from-green-900 to-emerald-950',
  },
  {
    slug: 'smm',
    title: 'Карина Ветрова — SMM',
    description: 'Персональный сайт SMM-специалиста: кейсы, услуги, отзывы, форма заявки.',
    emoji: '📱',
    tags: ['Фриланс', 'SMM'],
    accent: 'from-rose-800 to-pink-950',
  },
  {
    slug: 'autopro',
    title: 'AutoPro — автосервис',
    description: 'Автосервис полного цикла в Москве: диагностика, ремонт, ТО и шиномонтаж.',
    emoji: '🔧',
    tags: ['Автосервис', 'Запись'],
    accent: 'from-orange-900 to-red-950',
  },
  {
    slug: 'khlebnydom',
    title: 'Хлебный Дом — пекарня',
    description: 'Ремесленная пекарня в Казани: хлеб на закваске, круассаны, торты на заказ.',
    emoji: '🍞',
    tags: ['Пекарня', 'Заказ'],
    accent: 'from-amber-800 to-orange-950',
  },
  {
    slug: 'flowers',
    title: 'Флорика — цветочная мастерская',
    description: 'Авторские букеты, оформление свадеб и доставка цветов за 2 часа по Екатеринбургу.',
    emoji: '🌹',
    tags: ['Цветы', 'Доставка'],
    accent: 'from-pink-900 to-rose-950',
  },
  {
    slug: 'case-student',
    title: 'Портфолио студента',
    description: 'Портфолио студента: учебные проекты, навыки, достижения и контакты.',
    emoji: '🎓',
    tags: ['Портфолио', 'Студент'],
    accent: 'from-cyan-800 to-teal-950',
  },
  {
    slug: 'vetclinic',
    title: 'ВетДом — ветклиника',
    description: 'Ветеринарная клиника в Уфе: лечение, хирургия, вакцинация и скорая помощь 24/7.',
    emoji: '🐾',
    tags: ['Ветклиника', 'Медицина'],
    accent: 'from-green-900 to-emerald-950',
  },
  {
    slug: 'case-coffee',
    title: 'Brew & Co. — Кофейня',
    description: 'Кофейня в центре Москвы. Меню, атмосфера, контакты и форма бронирования столика.',
    emoji: '☕',
    tags: ['Кофейня', 'Малый бизнес'],
    accent: 'from-amber-900 to-stone-950',
  },
  {
    slug: 'case-dev',
    title: 'Дмитрий Козлов — Fullstack',
    description: 'Портфолио fullstack-разработчика: проекты, стек технологий, опыт работы.',
    emoji: '👨‍💻',
    tags: ['Портфолио', 'Разработка'],
    accent: 'from-blue-800 to-indigo-950',
  },
];

export function Showcase() {
  const staggerRef = useStaggerReveal();

  return (
    <section className="py-24">
      <div className="max-w-6xl mx-auto px-6">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 dark:text-white mb-4">
          Реальные сайты наших пользователей
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-center mb-16 max-w-xl mx-auto">
          Портфолио, лендинги, SaaS, бизнес-сайты — всё это уже захостено на VibeHosting
        </p>

        <div ref={staggerRef} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {showcaseItems.map((item) => (
            <a
              key={item.slug}
              href={`https://${item.slug}.hostingvibe.ru`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-lg hover:border-emerald-100 dark:hover:border-emerald-800 hover:scale-[1.02] transition-all duration-200 group block"
            >
              {/* Preview area */}
              <div className={`bg-gradient-to-br ${item.accent} p-6 flex items-center justify-center border-b border-gray-100 dark:border-gray-700 relative`}>
                <div className="w-16 h-16 rounded-2xl bg-white/10 shadow-sm flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                  {item.emoji}
                </div>
                <ExternalLink className="absolute top-3 right-3 w-3.5 h-3.5 text-white/40 group-hover:text-white/70 transition-colors" />
              </div>

              <div className="p-5">
                <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1.5">{item.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-3">{item.description}</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {item.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 text-xs font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </a>
          ))}
        </div>

        <div className="text-center mt-10">
          <Link
            href="/gallery"
            className="inline-flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors group"
          >
            Смотреть все сайты в галерее
            <ExternalLink className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </div>
    </section>
  );
}
