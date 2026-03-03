'use client';

import { Zap } from 'lucide-react';
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="py-12 border-t border-gray-100">
      <div className="max-w-5xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-start justify-between gap-8 mb-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-bold text-gray-900">
                Vibe<span className="text-emerald-500">Hosting</span>
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Хостинг для статических сайтов. Серверы в России.
            </p>
          </div>

          {/* Links */}
          <div className="flex gap-12 text-sm text-gray-500">
            <nav className="flex flex-col gap-2">
              <a href="#features" className="hover:text-emerald-600 transition-colors">Возможности</a>
              <a href="#pricing" className="hover:text-emerald-600 transition-colors">Тарифы</a>
              <Link href="/gallery" className="hover:text-emerald-600 transition-colors">Галерея</Link>
            </nav>
            <nav className="flex flex-col gap-2">
              <Link href="/terms" className="hover:text-emerald-600 transition-colors">Соглашение</Link>
              <Link href="/privacy" className="hover:text-emerald-600 transition-colors">Конфиденциальность</Link>
              <a href="https://t.me/vibehosting" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-600 transition-colors">Telegram</a>
            </nav>
          </div>
        </div>

        <div className="pt-6 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">
            &copy; {new Date().getFullYear()} VibeHosting
          </p>
        </div>
      </div>
    </footer>
  );
}
