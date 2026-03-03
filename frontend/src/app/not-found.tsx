import Link from 'next/link';
import { Zap, ArrowLeft, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold text-gray-900">
              Vibe<span className="text-emerald-500">Hosting</span>
            </span>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-8xl font-black text-gray-100 mb-4 select-none">404</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Страница не найдена</h1>
          <p className="text-sm text-gray-500 mb-8 max-w-sm mx-auto">
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
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:border-emerald-300 transition-colors"
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
