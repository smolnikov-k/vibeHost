import type { Metadata } from 'next';
import Link from 'next/link';
import { Zap, ArrowLeft, Home } from 'lucide-react';

export const metadata: Metadata = {
  title: '404 — Страница не найдена',
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold text-gray-900 dark:text-white">
              Vibe<span className="text-emerald-500">Hosting</span>
            </span>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-8xl font-black text-gray-100 dark:text-gray-800 mb-4 select-none">404</div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Страница не найдена</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 max-w-sm mx-auto">
            Такой страницы не существует. Проверьте URL или вернитесь на главную.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-colors"
            >
              <Home className="w-4 h-4" />
              На главную
            </Link>
            <Link
              href="/gallery"
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Галерея
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
