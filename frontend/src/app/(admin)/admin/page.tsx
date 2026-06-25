'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Users, FolderOpen, Rocket, HardDrive, TrendingUp, Crown, Loader2, Wrench,
  RefreshCw, Globe, FileText, AlertCircle, Cpu, MemoryStick, Database, Server,
} from 'lucide-react';
import { api, type AdminStats } from '@/lib/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: typeof Users; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <span className="text-sm text-gray-400">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

function TimelineChart({ data, dataKey, color, title }: {
  data: any[]; dataKey: string; color: string; title: string;
}) {
  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
      <h3 className="text-sm font-medium text-gray-300 mb-4">{title}</h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="date"
              stroke="#6b7280"
              tick={{ fontSize: 11 }}
              tickFormatter={(v: string) => v.slice(5)}
            />
            <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#9ca3af' }}
              itemStyle={{ color }}
            />
            <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ProgressBar({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Cpu }) {
  const color = value < 60 ? 'bg-emerald-500' : value < 80 ? 'bg-yellow-500' : 'bg-red-500';
  const textColor = value < 60 ? 'text-emerald-400' : value < 80 ? 'text-yellow-400' : 'text-red-400';
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-300">{label}</span>
        </div>
        <span className={`text-sm font-medium ${textColor}`}>{value}%</span>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function PM2Card({ proc }: { proc: { name: string; status: string; cpu: number; memory: number; restarts: number; uptime: number } }) {
  const statusColor = proc.status === 'online' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400';
  const uptimeStr = proc.uptime
    ? (() => {
        const ms = Date.now() - proc.uptime;
        const h = Math.floor(ms / 3600000);
        const d = Math.floor(h / 24);
        if (d > 0) return `${d}d ${h % 24}h`;
        const m = Math.floor((ms % 3600000) / 60000);
        return `${h}h ${m}m`;
      })()
    : '-';
  const memMB = (proc.memory / 1024 / 1024).toFixed(0);

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-white">{proc.name}</span>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor}`}>{proc.status}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <span className="text-gray-500">Uptime</span>
          <div className="text-gray-300 font-medium">{uptimeStr}</div>
        </div>
        <div>
          <span className="text-gray-500">Memory</span>
          <div className="text-gray-300 font-medium">{memMB} MB</div>
        </div>
        <div>
          <span className="text-gray-500">Restarts</span>
          <div className="text-gray-300 font-medium">{proc.restarts}</div>
        </div>
      </div>
    </div>
  );
}

interface SystemInfo {
  cpu: { cores: number; load: number[]; avgLoad: number };
  ram: { total: number; free: number; used: number; usedPercent: number };
  disk: { total: string; used: string; available: string; usePercent: string };
  uptime: number;
  pm2: { name: string; status: string; cpu: number; memory: number; restarts: number; uptime: number }[];
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [maintenance, setMaintenance] = useState(false);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);

  const loadData = useCallback(async () => {
    const [s, t, m, sys] = await Promise.all([
      api.getAdminStats(),
      api.getAdminTimeline(30).catch(() => []),
      api.getMaintenanceStatus().catch(() => ({ enabled: false })),
      api.getAdminSystem().catch(() => null),
    ]);
    setStats(s);
    setTimeline(t);
    setMaintenance(m.enabled);
    setSystem(sys);
  }, []);

  useEffect(() => {
    loadData()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadData();
    } catch { /* ignore */ }
    setRefreshing(false);
  };

  const toggleMaintenance = async () => {
    const next = !maintenance;
    if (next && !window.confirm('Все пользователи потеряют доступ к API. Продолжить?')) return;
    setMaintenanceLoading(true);
    try {
      const res = await api.setMaintenance(next);
      setMaintenance(res.enabled);
    } catch { /* ignore */ }
    setMaintenanceLoading(false);
  };

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

  const conversionRate = stats.users.total > 0 ? Math.round(stats.users.pro / stats.users.total * 100) : 0;
  const diskPercent = system?.disk.usePercent ? parseInt(system.disk.usePercent) || 0 : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Панель администратора</h1>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-300 hover:text-white hover:border-gray-600 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Обновить
        </button>
      </div>

      <div className={`flex items-center justify-between rounded-xl border p-4 mb-6 ${maintenance ? 'bg-red-900/30 border-red-700' : 'bg-gray-800 border-gray-700'}`}>
        <div className="flex items-center gap-3">
          <Wrench className={`w-5 h-5 ${maintenance ? 'text-red-400' : 'text-gray-400'}`} />
          <div>
            <span className="text-sm font-medium text-white">Режим обслуживания</span>
            <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${maintenance ? 'bg-red-500/20 text-red-400' : 'bg-gray-700 text-gray-400'}`}>
              {maintenance ? 'Включён' : 'Выключен'}
            </span>
          </div>
        </div>
        <button
          onClick={toggleMaintenance}
          disabled={maintenanceLoading}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            maintenance
              ? 'bg-gray-600 hover:bg-gray-500 text-white'
              : 'bg-red-600 hover:bg-red-500 text-white'
          } disabled:opacity-50`}
        >
          {maintenanceLoading ? 'Загрузка...' : maintenance ? 'Выключить' : 'Включить'}
        </button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={Users}
          label="Пользователи"
          value={stats.users.total}
          sub={`+${stats.users.newToday} сегодня / +${stats.users.newMonth} за месяц`}
          color="bg-blue-500"
        />
        <StatCard
          icon={Crown}
          label="PRO-подписки"
          value={stats.users.pro}
          sub={`${conversionRate}% конверсия`}
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
        <StatCard
          icon={Crown}
          label="Подписки"
          value={stats.subscriptions.active}
          sub="активных"
          color="bg-emerald-600"
        />
        <StatCard
          icon={Globe}
          label="Домены"
          value={stats.domains.total}
          sub="всего привязано"
          color="bg-blue-600"
        />
        <StatCard
          icon={FileText}
          label="Формы"
          value={stats.forms.total}
          sub="заявок получено"
          color="bg-amber-600"
        />
        <StatCard
          icon={AlertCircle}
          label="Ошибки деплоя"
          value={stats.errors.deploys}
          sub="всего с ошибками"
          color="bg-red-500"
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-8">
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
            <div className="flex justify-between">
              <span className="text-gray-400">Конверсия FREE -&gt; PRO</span>
              <span className="text-white font-medium">{conversionRate}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Забанено</span>
              <span className="text-white font-medium">{stats.users.banned}</span>
            </div>
          </div>
        </div>
      </div>

      {timeline.length > 0 && (
        <div className="grid sm:grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          <TimelineChart
            data={timeline}
            dataKey="registrations"
            color="#10b981"
            title="Регистрации за 30 дней"
          />
          <TimelineChart
            data={timeline}
            dataKey="deploys"
            color="#3b82f6"
            title="Деплои за 30 дней"
          />
          <TimelineChart
            data={timeline}
            dataKey="payments"
            color="#f59e0b"
            title="Платежи за 30 дней"
          />
        </div>
      )}

      {system && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">System Health</h2>
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 mb-4">
            <div className="grid sm:grid-cols-3 gap-6">
              <ProgressBar label="CPU" value={system.cpu.avgLoad} icon={Cpu} />
              <ProgressBar label="RAM" value={system.ram.usedPercent} icon={MemoryStick} />
              <ProgressBar label="Disk" value={diskPercent} icon={Database} />
            </div>
            <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
              <span>{system.cpu.cores} cores</span>
              <span>{(system.ram.total / 1024 / 1024 / 1024).toFixed(1)} GB RAM</span>
              <span>Disk: {system.disk.used} / {system.disk.total}</span>
              <span>Uptime: {Math.floor(system.uptime / 86400)}d {Math.floor((system.uptime % 86400) / 3600)}h</span>
            </div>
          </div>

          {system.pm2.length > 0 && (
            <div className="grid sm:grid-cols-3 gap-4">
              {system.pm2.map((proc) => (
                <PM2Card key={proc.name} proc={proc} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
