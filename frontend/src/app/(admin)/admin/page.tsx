'use client';

import { useEffect, useState } from 'react';
import { Users, FolderOpen, Rocket, HardDrive, TrendingUp, Crown, Loader2 } from 'lucide-react';
import { api, type AdminStats } from '@/lib/api';

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: typeof Users; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-4.5 h-4.5 text-white" />
        </div>
        <span className="text-sm text-gray-400">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAdminStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
      </div>
    );
  }

  if (!stats) {
    return <div className="text-center py-20 text-gray-500">Ошибка загрузки статистики</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Панель администратора</h1>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={Users}
          label="Пользователи"
          value={stats.users.total}
          sub={`+${stats.users.recentWeek} за неделю`}
          color="bg-blue-500"
        />
        <StatCard
          icon={Crown}
          label="PRO-подписки"
          value={stats.users.pro}
          sub={`${stats.users.total > 0 ? Math.round(stats.users.pro / stats.users.total * 100) : 0}% конверсия`}
          color="bg-amber-500"
        />
        <StatCard
          icon={FolderOpen}
          label="Проекты"
          value={stats.projects.total}
          sub={`${stats.projects.live} live`}
          color="bg-emerald-500"
        />
        <StatCard
          icon={Rocket}
          label="Деплои"
          value={stats.deploys.recentWeek}
          sub="за последнюю неделю"
          color="bg-purple-500"
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
          <div className="flex items-center gap-2 mb-4">
            <HardDrive className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-300">Хранилище</span>
          </div>
          <div className="text-3xl font-bold text-white mb-1">{stats.storage.totalMB} МБ</div>
          <div className="text-xs text-gray-500">
            {stats.projects.sitesOnDisk} сайтов на диске
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-300">Средние показатели</span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Проектов / юзер</span>
              <span className="text-white font-medium">
                {stats.users.total > 0 ? (stats.projects.total / stats.users.total).toFixed(1) : '0'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Размер / проект</span>
              <span className="text-white font-medium">
                {stats.projects.total > 0 ? Math.round(stats.storage.totalMB / stats.projects.total) : 0} МБ
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
