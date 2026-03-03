'use client';

import { useStaggerReveal } from '@/lib/useAnimate';
import { Globe, ExternalLink } from 'lucide-react';
import Link from 'next/link';

const showcaseItems = [
  {
    title: 'Персональный сайт',
    description: 'Создайте свой личный сайт с собственным доменом за считаные секунды.',
    icon: '👤',
    tags: ['HTML', 'CSS'],
  },
  {
    title: 'Лендинг для бизнеса',
    description: 'Продвигайте услуги с помощью яркой посадочной страницы.',
    icon: '🚀',
    tags: ['React', 'Tailwind'],
  },
  {
    title: 'Портфолио дизайнера',
    description: 'Покажите лучшие работы клиентам — стильно и профессионально.',
    icon: '🎨',
    tags: ['Webflow', 'Figma Export'],
  },
  {
    title: 'Веб-приложение',
    description: 'Разместите SPA или полноценное веб-приложение с автосборкой.',
    icon: '⚡',
    tags: ['Vue', 'Vite'],
  },
  {
    title: 'Резюме / CV',
    description: 'Отправьте ссылку вместо PDF. Всегда актуальная версия.',
    icon: '📄',
    tags: ['HTML'],
  },
  {
    title: 'Проект из AI',
    description: 'Cursor, Bolt, Lovable, v0 — экспортируйте и загрузите.',
    icon: '🤖',
    tags: ['Next.js', 'AI'],
  },
];

export function Showcase() {
  const staggerRef = useStaggerReveal();

  return (
    <section className="py-24">
      <div className="max-w-5xl mx-auto px-6">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-4">
          Размещайте что угодно
        </h2>
        <p className="text-gray-500 text-center mb-16 max-w-xl mx-auto">
          Сайты, приложения, портфолио, резюме — более 100 типов файлов
        </p>

        <div ref={staggerRef} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {showcaseItems.map((item) => (
            <div
              key={item.title}
              className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg hover:border-emerald-100 transition-all group"
            >
              {/* Preview area */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-6 flex items-center justify-center border-b border-gray-100">
                <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                  {item.icon}
                </div>
              </div>

              <div className="p-5">
                <h3 className="text-base font-bold text-gray-900 mb-1.5">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed mb-3">{item.description}</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {item.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 text-xs font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-10">
          <Link
            href="/gallery"
            className="inline-flex items-center gap-2 text-emerald-600 font-semibold text-sm hover:text-emerald-700 transition-colors group"
          >
            Смотреть галерею сайтов
            <ExternalLink className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </div>
    </section>
  );
}
