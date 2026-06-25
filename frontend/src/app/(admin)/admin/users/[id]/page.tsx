'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Loader2, Crown, Shield, Ban, HardDrive, Mail, Calendar, Globe,
} from 'lucide-react';
import { api } from '@/lib/api';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [storageInput, setStorageInput] = useState('');
  const [confirmPlan, setConfirmPlan] = useState(false);
  const [confirmBan, setConfirmBan] = useState(false);

  const userId = params.id as string;

  useEffect(() => {
    api.getAdminUserDetail(userId)
      .then((data) => {
        setUser(data);
        setStorageInput(String(Math.round(Number(data.storageLimit) / 1024 / 1024)));
      })
      .catch(() => router.push('/admin/users'))
      .finally(() => setLoading(false));
  }, [userId, router]);

  const handleTogglePlan = async () => {
    if (!user) return;
    setUpdating(true);
    try {
      const newPlan = user.plan === 'PRO' ? 'FREE' : 'PRO';
      await api.updateAdminUser(userId, { plan: newPlan });
      const updated = await api.getAdminUserDetail(userId);
      setUser(updated);
      setStorageInput(String(Math.round(Number(updated.storageLimit) / 1024 / 1024)));
    } catch { /* */ }
    setUpdating(false);
    setConfirmPlan(false);
  };

  const handleToggleBan = async () => {
    if (!user) return;
    setUpdating(true);
    try {
      await api.updateAdminUser(userId, { isBanned: !user.isBanned });
      const updated = await api.getAdminUserDetail(userId);
      setUser(updated);
    } catch { /* */ }
    setUpdating(false);
    setConfirmBan(false);
  };

  const handleStorageChange = async () => {
    const bytes = parseInt(storageInput, 10) * 1024 * 1024;
    if (isNaN(bytes) || bytes < 0) return;
    setUpdating(true);
    try {
      await api.updateAdminUser(userId, { storageLimit: bytes });
      const updated = await api.getAdminUserDetail(userId);
      setUser(updated);
    } catch { /* */ }
    setUpdating(false);
  };

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function formatSize(bytes: number) {
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
    return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <div className="text-center py-20 text-gray-500">Пользователь не найден</div>;
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/users" className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:border-emerald-500 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            {user.email}
            {user.isAdmin && <Shield className="w-4 h-4 text-amber-400" />}
            {user.isBanned && <Ban className="w-4 h-4 text-red-400" />}
          </h1>
          {user.displayName && <p className="text-sm text-gray-400">{user.displayName}</p>}
        </div>
      </div>

      {/* Info cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Crown className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-gray-400">Тариф</span>
          </div>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
            user.plan === 'PRO' ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-700 text-gray-400'
          }`}>
            {user.plan}
          </span>
        </div>
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <HardDrive className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-gray-400">Хранилище</span>
          </div>
          <span className="text-sm text-white">{formatSize(user.storageUsed)} / {formatSize(user.storageLimit)}</span>
        </div>
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-gray-400">Зарегистрирован</span>
          </div>
          <span className="text-sm text-white">{formatDate(user.createdAt)}</span>
        </div>
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Mail className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-gray-400">Email подтверждён</span>
          </div>
          <span className={`text-sm font-medium ${user.emailVerified ? 'text-emerald-400' : 'text-red-400'}`}>
            {user.emailVerified ? 'Да' : 'Нет'}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 mb-8">
        <h3 className="text-sm font-medium text-gray-300 mb-4">Действия</h3>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setConfirmPlan(true)}
            disabled={updating}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-50 transition-colors"
          >
            {user.plan === 'PRO' ? 'Перевести на FREE' : 'Перевести на PRO'}
          </button>
          <button
            onClick={() => setConfirmBan(true)}
            disabled={updating}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
              user.isBanned
                ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                : 'bg-red-600 text-white hover:bg-red-500'
            }`}
          >
            {user.isBanned ? 'Разбанить' : 'Забанить'}
          </button>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={storageInput}
              onChange={(e) => setStorageInput(e.target.value)}
              className="w-24 px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-sm text-white focus:border-emerald-500 outline-none"
              placeholder="МБ"
            />
            <span className="text-xs text-gray-500">МБ</span>
            <button
              onClick={handleStorageChange}
              disabled={updating}
              className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50 transition-colors"
            >
              Сохранить лимит
            </button>
          </div>
        </div>
      </div>

      {/* Projects */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden mb-8">
        <div className="px-4 py-3 border-b border-gray-700">
          <h3 className="text-sm font-medium text-gray-300">Проекты ({user.projects?.length || 0})</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400">
              <th className="px-4 py-2 text-left font-medium">Slug</th>
              <th className="px-4 py-2 text-left font-medium">Название</th>
              <th className="px-4 py-2 text-center font-medium">Статус</th>
              <th className="px-4 py-2 text-right font-medium">Размер</th>
              <th className="px-4 py-2 text-right font-medium">Создан</th>
            </tr>
          </thead>
          <tbody>
            {user.projects?.map((p: any) => (
              <tr key={p.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="px-4 py-2 text-emerald-400">{p.slug}</td>
                <td className="px-4 py-2 text-gray-200">{p.title}</td>
                <td className="px-4 py-2 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    p.status === 'LIVE' ? 'bg-emerald-500/20 text-emerald-400' :
                    p.status === 'ERROR' ? 'bg-red-500/20 text-red-400' :
                    'bg-gray-700 text-gray-400'
                  }`}>{p.status}</span>
                </td>
                <td className="px-4 py-2 text-right text-gray-400">{formatSize(p.sizeBytes)}</td>
                <td className="px-4 py-2 text-right text-gray-500">{formatDate(p.createdAt)}</td>
              </tr>
            ))}
            {(!user.projects || user.projects.length === 0) && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">Нет проектов</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Recent deploys */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden mb-8">
        <div className="px-4 py-3 border-b border-gray-700">
          <h3 className="text-sm font-medium text-gray-300">Последние деплои</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400">
              <th className="px-4 py-2 text-left font-medium">Проект</th>
              <th className="px-4 py-2 text-center font-medium">Версия</th>
              <th className="px-4 py-2 text-center font-medium">Статус</th>
              <th className="px-4 py-2 text-right font-medium">Дата</th>
            </tr>
          </thead>
          <tbody>
            {user.recentDeploys?.map((d: any) => (
              <tr key={d.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="px-4 py-2 text-emerald-400">{d.project?.slug}</td>
                <td className="px-4 py-2 text-center text-gray-300">v{d.version}</td>
                <td className="px-4 py-2 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    d.status === 'LIVE' ? 'bg-emerald-500/20 text-emerald-400' :
                    d.status === 'FAILED' ? 'bg-red-500/20 text-red-400' :
                    'bg-gray-700 text-gray-400'
                  }`}>{d.status}</span>
                </td>
                <td className="px-4 py-2 text-right text-gray-500">{formatDate(d.createdAt)}</td>
              </tr>
            ))}
            {(!user.recentDeploys || user.recentDeploys.length === 0) && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-500">Нет деплоев</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Subscription */}
      {user.subscription && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 mb-8">
          <h3 className="text-sm font-medium text-gray-300 mb-3">Подписка</h3>
          <div className="grid sm:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Статус: </span>
              <span className={`font-medium ${
                user.subscription.status === 'ACTIVE' ? 'text-emerald-400' :
                user.subscription.status === 'CANCELLED' ? 'text-red-400' :
                'text-amber-400'
              }`}>{user.subscription.status}</span>
            </div>
            <div>
              <span className="text-gray-400">Период: </span>
              <span className="text-white">{user.subscription.billingPeriod} мес.</span>
            </div>
            {user.subscription.currentPeriodEnd && (
              <div>
                <span className="text-gray-400">Окончание: </span>
                <span className="text-white">{formatDate(user.subscription.currentPeriodEnd)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Domains */}
      {user.domains && user.domains.length > 0 && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
          <h3 className="text-sm font-medium text-gray-300 mb-3">Домены</h3>
          <div className="space-y-2">
            {user.domains.map((d: any) => (
              <div key={d.id} className="flex items-center gap-3 text-sm">
                <Globe className="w-4 h-4 text-gray-500" />
                <span className="text-white">{d.hostname}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  d.verified ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-700 text-gray-400'
                }`}>{d.verified ? 'Verified' : 'Pending'}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  d.sslStatus === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' :
                  d.sslStatus === 'FAILED' ? 'bg-red-500/20 text-red-400' :
                  'bg-amber-500/20 text-amber-400'
                }`}>SSL: {d.sslStatus}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmPlan}
        onConfirm={handleTogglePlan}
        onCancel={() => setConfirmPlan(false)}
        title="Сменить тариф"
        message={`Переключить план на ${user.plan === 'PRO' ? 'FREE' : 'PRO'}?`}
        confirmLabel="Переключить"
        variant="warning"
        loading={updating}
      />

      <ConfirmDialog
        isOpen={confirmBan}
        onConfirm={handleToggleBan}
        onCancel={() => setConfirmBan(false)}
        title={user.isBanned ? 'Разбанить пользователя' : 'Забанить пользователя'}
        message={user.isBanned ? 'Разбанить этого пользователя?' : 'Забанить этого пользователя?'}
        confirmLabel={user.isBanned ? 'Разбанить' : 'Забанить'}
        variant={user.isBanned ? 'default' : 'danger'}
        loading={updating}
      />
    </div>
  );
}
