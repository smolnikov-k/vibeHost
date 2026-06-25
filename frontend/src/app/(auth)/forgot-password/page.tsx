'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Zap, Loader2, Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { animate } from 'animejs';
import { api } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const cardRef = useRef<HTMLDivElement>(null);

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
    setLoading(true);
    try {
      await api.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div ref={cardRef} className="w-full max-w-sm opacity-0">
        <Link href="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900 dark:text-white">
            Vibe<span className="text-emerald-500">Hosting</span>
          </span>
        </Link>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-8">
          {sent ? (
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-6 h-6 text-emerald-500" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Проверьте почту</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Если аккаунт с адресом <strong>{email}</strong> существует, мы отправили ссылку для сброса пароля.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 font-medium hover:text-emerald-700 dark:hover:text-emerald-300"
              >
                <ArrowLeft className="w-4 h-4" />
                Вернуться ко входу
              </Link>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center mx-auto mb-4">
                <Mail className="w-6 h-6 text-emerald-500" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white text-center mb-2">Забыли пароль?</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
                Введите email и мы отправим ссылку для сброса
              </p>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900 text-sm text-red-600 dark:text-red-400">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-sm bg-white dark:bg-gray-900 dark:text-white"
                    placeholder="your@email.com"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-lg bg-emerald-500 text-white font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Отправить ссылку
                </button>
              </form>
            </>
          )}
        </div>

        {!sent && (
          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
            <Link href="/login" className="text-emerald-600 dark:text-emerald-400 font-medium hover:text-emerald-700 dark:hover:text-emerald-300 inline-flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" />
              Вернуться ко входу
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
