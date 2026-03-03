'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthProvider, useAuth } from '@/lib/auth';
import { Zap, Shield, Users, FolderOpen, BarChart3, LogOut, Loader2, AlertTriangle } from 'lucide-react';

function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (!user.isAdmin) {
        router.push('/projects');
      } else {
        setChecked(true);
      }
    }
  }, [loading, user, router]);

  if (loading || !checked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-bold">
                Vibe<span className="text-emerald-400">Admin</span>
              </span>
            </Link>
            <Shield className="w-4 h-4 text-amber-400" />
          </div>

          <nav className="flex items-center gap-1">
            <Link href="/admin" className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-emerald-400 hover:bg-gray-700/50 transition-colors">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Дашборд</span>
            </Link>
            <Link href="/admin/users" className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-emerald-400 hover:bg-gray-700/50 transition-colors">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Юзеры</span>
            </Link>
            <Link href="/admin/projects" className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-emerald-400 hover:bg-gray-700/50 transition-colors">
              <FolderOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Проекты</span>
            </Link>
            <Link href="/admin/reports" className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-amber-400 hover:bg-gray-700/50 transition-colors">
              <AlertTriangle className="w-4 h-4" />
              <span className="hidden sm:inline">Жалобы</span>
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/projects" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
              ← Dashboard
            </Link>
            <button onClick={() => { logout(); router.push('/'); }} className="text-gray-500 hover:text-red-400 transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AdminShell>{children}</AdminShell>
    </AuthProvider>
  );
}
