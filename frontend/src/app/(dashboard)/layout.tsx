'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthProvider, useAuth } from '@/lib/auth';
import { Zap, FolderOpen, Settings, LogOut, Loader2, CreditCard, Globe, Shield } from 'lucide-react';

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
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
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/projects" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold text-gray-900">
              Vibe<span className="text-emerald-500">Hosting</span>
            </span>
          </Link>

          <nav className="flex items-center gap-1">
            <Link
              href="/projects"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
            >
              <FolderOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Проекты</span>
            </Link>
            <Link
              href="/domains"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
            >
              <Globe className="w-4 h-4" />
              <span className="hidden sm:inline">Домены</span>
            </Link>
            <Link
              href="/billing"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
            >
              <CreditCard className="w-4 h-4" />
              <span className="hidden sm:inline">Тариф</span>
            </Link>
            <Link
              href="/settings"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
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
            {/* Plan badge */}
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              user.plan === 'PRO'
                ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white'
                : 'bg-gray-100 text-gray-500'
            }`}>
              {user.plan}
            </span>

            {/* Storage bar */}
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-20 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.min(storagePercent, 100)}%` }}
                />
              </div>
              <span className="text-xs text-gray-400">{storagePercent}%</span>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-red-500 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {children}
      </main>
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
