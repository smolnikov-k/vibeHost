'use client';

import { Suspense, useState, useEffect, useRef, useId } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Zap, Eye, EyeOff, Loader2 } from 'lucide-react';
import { animate } from 'animejs';
import { useAuth } from '@/lib/auth';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planParam = searchParams.get('plan');
  const slugParam = searchParams.get('slug');
  const { register, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptLegal, setAcceptLegal] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const registeringRef = useRef(false);
  const errorId = useId();
  const passwordHintId = useId();

  // Redirect already-logged-in users (skip during active registration to avoid race with ?welcome=1)
  useEffect(() => {
    if (user && !registeringRef.current) router.push('/projects');
  }, [user, router]);

  useEffect(() => {
    if (cardRef.current) {
      animate(cardRef.current, {
        opacity: [0, 1],
        translateY: ['20px', '0px'],
        duration: 600,
        ease: 'outExpo',
      });
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedEmail = email.trim();
    const trimmedName = displayName.trim();

    if (!trimmedName || trimmedName.length < 2) {
      setError('Укажите ваше имя (минимум 2 символа)');
      return;
    }

    if (!trimmedEmail || !/[^\s@]+@[^\s@]+\.[^\s@]+/.test(trimmedEmail)) {
      setError('Укажи корректный email — он нужен для входа и писем о статусе проекта');
      return;
    }

    if (password.length < 8 || !/[a-zA-Zа-яА-ЯёЁ]/.test(password) || !/\d/.test(password)) {
      setError('Минимум 8 символов, хотя бы одна буква и одна цифра');
      return;
    }

    if (!acceptLegal) {
      setError('Подтверди согласие с Политикой конфиденциальности и Условиями использования');
      return;
    }

    setLoading(true);
    registeringRef.current = true;
    try {
      await register(trimmedEmail, password, trimmedName || undefined);
      if (typeof window !== 'undefined' && typeof window.ym === 'function') {
        window.ym(107147478, 'reachGoal', 'registration');
      }
      // Redirect to email verification page
      const params = new URLSearchParams();
      if (slugParam) params.set('slug', slugParam);
      if (planParam) params.set('plan', planParam);
      const qs = params.toString();
      router.push(`/verify-email${qs ? `?${qs}` : ''}`);
    } catch (err) {
      registeringRef.current = false;
      setError(err instanceof Error ? err.message : 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  };

  const passwordDescribedBy = error ? `${passwordHintId} ${errorId}` : passwordHintId;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div ref={cardRef} className="w-full max-w-sm opacity-0">
        {/* Logo */}
        <Link href="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900 dark:text-white">
            Vibe<span className="text-emerald-500">Hosting</span>
          </span>
        </Link>

        {/* Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 sm:p-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-2">Регистрация</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300 text-center mb-4">
            {planParam === 'pro'
              ? 'Создай аккаунт — подключишь PRO после входа.'
              : 'Без карты. Сразу выдадим 1 сайт, 100 МБ и ссылку для предпросмотра.'}
          </p>

          <div id={errorId} role="alert" aria-live="assertive" className="min-h-6 mb-4">
            {error ? (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900 text-sm text-red-600 dark:text-red-400">{error}</div>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Имя
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-sm bg-white dark:bg-gray-900 dark:text-white"
                placeholder="Как вас зовут?"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-sm bg-white dark:bg-gray-900 dark:text-white"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Пароль
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={passwordDescribedBy}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-sm pr-10 bg-white dark:bg-gray-900 dark:text-white"
                  placeholder="Минимум 8 символов"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-controls="password"
                  aria-pressed={showPassword}
                  aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p id={passwordHintId} className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Минимум 8 символов, хотя бы одна буква и одна цифра.
              </p>
            </div>

            <label className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
              <input
                type="checkbox"
                required
                checked={acceptLegal}
                onChange={(e) => setAcceptLegal(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>
                Я подтверждаю согласие с{' '}
                <Link href="/privacy" className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:underline">
                  Политикой конфиденциальности
                </Link>{' '}
                и{' '}
                <Link href="/terms" className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:underline">
                  Условиями использования
                </Link>
                .
              </span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-emerald-500 text-white font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Создать аккаунт
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
          Уже есть аккаунт?{' '}
          <Link href="/login" className="text-emerald-600 dark:text-emerald-400 font-medium hover:text-emerald-700 dark:hover:text-emerald-300">
            Войти
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
