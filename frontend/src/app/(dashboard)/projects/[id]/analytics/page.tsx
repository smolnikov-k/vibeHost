'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, BarChart3, Eye, TrendingUp, Globe, ExternalLink,
  Loader2, Calendar,
} from 'lucide-react';
import { api, type AnalyticsSummary } from '@/lib/api';

export default function AnalyticsPage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [projectTitle, setProjectTitle] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [analytics, pData] = await Promise.all([
        api.getProjectAnalytics(id, days),
        api.getProject(id),
      ]);
      setData(analytics);
      setProjectTitle(pData.title);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [id, days]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Не удалось загрузить аналитику</p>
      </div>
    );
  }

  const maxViews = Math.max(...data.viewsByDay.map(d => d.count), 1);

  return (
    <div>
      <Link
        href={`/projects/${id}`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-emerald-600 transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        {projectTitle || 'Назад к проекту'}
      </Link>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-emerald-500" />
          Аналитика
        </h1>
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                days === d ? 'bg-emerald-50 text-emerald-700' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {d}д
            </button>
          ))}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Всего', value: data.views.total, icon: Eye },
          { label: 'Сегодня', value: data.views.today, icon: TrendingUp },
          { label: 'Неделя', value: data.views.week, icon: Calendar },
          { label: 'Месяц', value: data.views.month, icon: BarChart3 },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className="w-4 h-4 text-emerald-500" />
              <span className="text-xs text-gray-500">{stat.label}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value.toLocaleString('ru-RU')}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Просмотры по дням</h2>
        {data.viewsByDay.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">Нет данных за этот период</p>
        ) : (
          <div className="flex items-end gap-1 h-40">
            {data.viewsByDay.map((day) => {
              const height = Math.max((day.count / maxViews) * 100, 2);
              return (
                <div
                  key={day.date}
                  className="flex-1 group relative"
                  title={`${day.date}: ${day.count}`}
                >
                  <div
                    className="bg-emerald-400 hover:bg-emerald-500 rounded-t transition-colors mx-auto"
                    style={{ height: `${height}%`, minWidth: '4px', maxWidth: '24px' }}
                  />
                  <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-10">
                    {day.date}: {day.count}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top pages */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Globe className="w-4 h-4 text-emerald-500" />
            Популярные страницы
          </h2>
          {data.topPages.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">Нет данных</p>
          ) : (
            <div className="space-y-2">
              {data.topPages.map((p) => (
                <div key={p.path} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 truncate flex-1 mr-4 font-mono text-xs">{p.path}</span>
                  <span className="text-gray-400 text-xs shrink-0">{p.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top referrers */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ExternalLink className="w-4 h-4 text-emerald-500" />
            Источники трафика
          </h2>
          {data.topReferrers.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">Нет данных</p>
          ) : (
            <div className="space-y-2">
              {data.topReferrers.map((r) => (
                <div key={r.referrer} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 truncate flex-1 mr-4 text-xs">{r.referrer}</span>
                  <span className="text-gray-400 text-xs shrink-0">{r.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
