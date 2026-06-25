'use client';

import { Zap } from 'lucide-react';
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="py-14 border-t border-gray-100 dark:border-gray-700">
      <div className="max-w-5xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 mb-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                Vibe<span className="text-emerald-500">Hosting</span>
              </span>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-400 leading-relaxed">
              Простейший хостинг для статических сайтов. Серверы в России.
            </p>
          </div>

          {/* Product */}
          <nav>
            <p className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-3">Продукт</p>
            <ul className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
              <li><a href="#features" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Возможности</a></li>
              <li><a href="#pricing" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Тарифы</a></li>
              <li><Link href="/blog" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Блог</Link></li>
              <li><Link href="/gallery" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Галерея</Link></li>
              <li><Link href="/ai" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">AI-промпт</Link></li>
              <li><a href="#faq" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">FAQ</a></li>
            </ul>
          </nav>

          {/* Use Cases */}
          <nav>
            <p className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-3">Подходит для</p>
            <ul className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
              <li><a href="#use-cases" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Лендинги и сайты</a></li>
              <li><a href="#use-cases" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Портфолио</a></li>
              <li><a href="#use-cases" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Веб-приложения</a></li>
              <li><a href="#use-cases" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Резюме и CV</a></li>
              <li><a href="#use-cases" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Проекты из AI</a></li>
            </ul>
          </nav>

          {/* Legal & Support */}
          <nav>
            <p className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-3">Поддержка</p>
            <ul className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
              <li>
                <a href="https://t.me/suuportvibebot" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                  Поддержка в Telegram
                </a>
              </li>
              <li>
                <a href="https://t.me/vibehosting" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                  Канал Telegram
                </a>
              </li>
              <li><Link href="/terms" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Соглашение</Link></li>
              <li><Link href="/privacy" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Конфиденциальность</Link></li>
              <li><Link href="/offer" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Оферта</Link></li>
            </ul>
          </nav>
        </div>

        <div className="pt-6 border-t border-gray-100 dark:border-gray-700 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-xs text-gray-400 dark:text-gray-400">
            &copy; {new Date().getFullYear()} VibeHosting. Серверы в России.
          </p>
          <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-gray-400">
            <span>Оплата в рублях</span>
            <span>&middot;</span>
            <span>152-ФЗ</span>
            <span>&middot;</span>
            <span>SSL бесплатно</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
