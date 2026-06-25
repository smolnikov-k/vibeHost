'use client';

import { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Zap, Loader2, CheckCircle, Mail } from 'lucide-react';
import { animate } from 'animejs';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenParam = searchParams.get('token');
  const slugParam = searchParams.get('slug');
  const planParam = searchParams.get('plan');
  const { user, refresh } = useAuth();

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Auto-send verification code on mount for existing users (no code yet)
  // For new registrations, code was already sent — start with cooldown
  const hasSentRef = useRef(false);
  useEffect(() => {
    if (tokenParam || !user || user.emailVerified || hasSentRef.current) return;
    hasSentRef.current = true;
    api.resendVerification()
      .then(() => setResendCooldown(60))
      .catch(() => { /* first send may fail for rate limit — user can click resend */ });
  }, [tokenParam, user]);

  // Countdown timer for resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const redirectAfterVerify = useCallback(() => {
    const params = new URLSearchParams({ welcome: '1' });
    if (slugParam) params.set('slug', slugParam);
    if (planParam) params.set('plan', planParam);
    router.push(`/projects?${params.toString()}`);
  }, [router, slugParam, planParam]);

  // Auto-verify via token in URL (link click from email)
  useEffect(() => {
    if (!tokenParam) return;
    setLoading(true);
    api.verifyEmail({ token: tokenParam })
      .then(async () => {
        setVerified(true);
        await refresh();
        setTimeout(redirectAfterVerify, 1500);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Ошибка подтверждения');
      })
      .finally(() => setLoading(false));
  }, [tokenParam, refresh, redirectAfterVerify]);

  // If user is already verified, redirect
  useEffect(() => {
    if (user?.emailVerified) {
      redirectAfterVerify();
    }
  }, [user, redirectAfterVerify]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const trimmed = code.trim();

    if (!/^\d{6}$/.test(trimmed)) {
      setError('Введите 6-значный код');
      return;
    }

    setLoading(true);
    try {
      await api.verifyEmail({ code: trimmed });
      setVerified(true);
      await refresh();
      setTimeout(redirectAfterVerify, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка подтверждения');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || resending) return;
    setResending(true);
    setError('');
    try {
      await api.resendVerification();
      setResendCooldown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить код');
    } finally {
      setResending(false);
    }
  };

  const handleCodeChange = (value: string) => {
    // Only allow digits, max 6
    const digits = value.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
  };

  if (verified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div ref={cardRef} className="w-full max-w-sm text-center">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-8">
            <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Email подтверждён</h1>
            <p className="text-sm text-gray-600 dark:text-gray-300">Перенаправляем в панель управления...</p>
          </div>
        </div>
      </div>
    );
  }

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
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center">
              <Mail className="w-7 h-7 text-emerald-500" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-2">Подтвердите email</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300 text-center mb-6">
            Мы отправили 6-значный код на{' '}
            {user?.email ? (
              <span className="font-medium text-gray-900 dark:text-white">{user.email}</span>
            ) : (
              'вашу почту'
            )}
          </p>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900 text-sm text-red-600 dark:text-red-400 mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="verify-code" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Код подтверждения
              </label>
              <input
                ref={inputRef}
                id="verify-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-center text-2xl font-bold tracking-[0.3em] placeholder:text-gray-300 dark:placeholder:text-gray-600 placeholder:tracking-[0.3em] placeholder:text-base placeholder:font-normal bg-white dark:bg-gray-900 dark:text-white"
                placeholder="000000"
                maxLength={6}
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full py-2.5 rounded-lg bg-emerald-500 text-white font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Подтвердить
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={handleResend}
              disabled={resendCooldown > 0 || resending}
              className="text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {resending
                ? 'Отправка...'
                : resendCooldown > 0
                  ? `Отправить повторно (${resendCooldown}с)`
                  : 'Отправить код повторно'}
            </button>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 text-center">
            <button
              onClick={redirectAfterVerify}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              Пропустить и продолжить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
        </div>
      }
    >
      <VerifyEmailForm />
    </Suspense>
  );
}
