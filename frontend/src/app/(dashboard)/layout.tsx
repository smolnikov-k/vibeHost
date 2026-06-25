'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { animate } from 'animejs';
import { AuthProvider, useAuth } from '@/lib/auth';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ToastContainer } from '@/components/ToastContainer';
import { Zap, FolderOpen, Settings, LogOut, Loader2, CreditCard, Globe, Shield, MessageCircle, AlertTriangle } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout, refresh } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  // Refresh user data on every navigation and when tab regains focus
  useEffect(() => {
    refresh();
  }, [pathname, refresh]);

  useEffect(() => {
    let lastRefresh = 0;
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastRefresh > 5000) {
        lastRefresh = Date.now();
        refresh();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  useEffect(() => {
    if (!loading && user && mainRef.current) {
      animate(mainRef.current, {
        opacity: [0, 1],
        translateY: ['20px', '0px'],
        duration: 600,
        ease: 'outExpo',
      });
    }
  }, [loading, user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const storagePercent = Math.round((Number(user.storageUsed) / Number(user.storageLimit)) * 100);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Top nav */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/projects" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold text-gray-900 dark:text-white">
              Vibe<span className="text-emerald-500">Hosting</span>
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-700 rounded-full px-1.5 py-0.5 leading-none">Beta</span>
          </Link>

          <nav className="flex items-center gap-1">
            <Link
              href="/projects"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950 transition-colors"
            >
              <FolderOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Проекты</span>
            </Link>
            <Link
              href="/domains"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950 transition-colors"
            >
              <Globe className="w-4 h-4" />
              <span className="hidden sm:inline">Домены</span>
            </Link>
            <Link
              href="/billing"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950 transition-colors"
            >
              <CreditCard className="w-4 h-4" />
              <span className="hidden sm:inline">Тариф</span>
            </Link>
            <Link
              href="/settings"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950 transition-colors"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Настройки</span>
            </Link>
            {user.isAdmin && (
              <Link
                href="/admin"
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-amber-600 hover:text-amber-700 hover:bg-amber-50 transition-colors"
              >
                <Shield className="w-4 h-4" />
                <span className="hidden sm:inline">Админ</span>
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-4">
            <ThemeToggle />
            <a
              href="https://t.me/suuportvibebot"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-gray-500 dark:text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950 transition-colors"
              title="Поддержка"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Поддержка</span>
            </a>

            {/* Plan badge */}
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              user.plan === 'PRO'
                ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
            }`}>
              {user.plan}
            </span>

            {/* Storage bar */}
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-20 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.min(storagePercent, 100)}%` }}
                />
              </div>
              <span className="text-xs text-gray-400">{storagePercent}%</span>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-red-500 transition-colors"
              aria-label="Выйти из аккаунта"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Email verification banner */}
      {user.emailVerified === false && (
        <div className="bg-amber-50 dark:bg-amber-950 border-b border-amber-200 dark:border-amber-700">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>Подтвердите email для полного доступа</span>
            </div>
            <Link
              href="/verify-email"
              className="text-sm font-medium text-amber-700 dark:text-amber-300 hover:text-amber-900 bg-amber-100 dark:bg-amber-900 hover:bg-amber-200 dark:hover:bg-amber-800 px-3 py-1 rounded-lg transition-colors whitespace-nowrap"
            >
              Подтвердить
            </Link>
          </div>
        </div>
      )}

      <main ref={mainRef} className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 opacity-0">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </main>

      <ToastContainer />
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardShell>{children}</DashboardShell>
    </AuthProvider>
  );
}
