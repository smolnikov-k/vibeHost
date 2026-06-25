'use client';

import { Blocks, Sparkles, Github, FileArchive } from 'lucide-react';
import { useScrollReveal } from '@/lib/useAnimate';

const items = [
  {
    icon: FileArchive,
    title: 'Готовый сайт',
    description: 'HTML, CSS, картинки — просто перетащите папку или ZIP. Работает сразу.',
  },
  {
    icon: Blocks,
    title: 'Проект с библиотеками',
    description: 'React, Next.js, Vite, Astro, Tailwind, anime.js — мы сами запустим npm install и соберём.',
  },
  {
    icon: Github,
    title: 'GitHub-репозиторий',
    description: 'Вставьте ссылку — мы склонируем, соберём и опубликуем. Автоматически.',
  },
  {
    icon: Sparkles,
    title: 'Проект из AI',
    description: 'Cursor, Bolt, Lovable, v0 — экспортируйте проект и загрузите к нам. Всё заработает.',
  },
];

export function Supports() {
  const sectionRef = useScrollReveal();

  return (
    <section className="py-24">
      <div className="max-w-5xl mx-auto px-6" ref={sectionRef}>
        <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 dark:text-white mb-4">
          Загружайте что угодно
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-center mb-4 max-w-xl mx-auto">
          Простой HTML или сложный проект с десятком библиотек — мы разберёмся сами
        </p>
        <p className="text-emerald-600 dark:text-emerald-400 text-center text-sm font-medium mb-16 max-w-xl mx-auto">
          Не нужно знать что такое npm, build или deploy
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {items.map((item) => (
            <div
              key={item.title}
              className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm dark:shadow-gray-900/20 hover:shadow-md hover:border-emerald-100 dark:hover:border-emerald-800 hover:scale-[1.02] transition-all duration-200 group"
            >
              <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center mb-4 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900 transition-colors">
                <item.icon className="w-6 h-6 text-emerald-500" />
              </div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2">{item.title}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
