'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, ChevronLeft, ChevronRight, Loader2, Crown, Shield, ExternalLink, Download, Ban } from 'lucide-react';
import { api, type AdminUser } from '@/lib/api';

const selectClass = "px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded-lg text-gray-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500";

export default function AdminUsersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [plan, setPlan] = useState(searchParams.get('plan') || '');
  const [banned, setBanned] = useState(searchParams.get('banned') || '');
  const [sort, setSort] = useState(searchParams.get('sort') || 'newest');
  const [exporting, setExporting] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const updateUrl = useCallback((p: number, q: string, pl: string, b: string, s: string) => {
    const sp = new URLSearchParams();
    if (p > 1) sp.set('page', String(p));
    if (q) sp.set('q', q);
    if (pl) sp.set('plan', pl);
    if (b) sp.set('banned', b);
    if (s && s !== 'newest') sp.set('sort', s);
    const qs = sp.toString();
    router.replace(`/admin/users${qs ? `?${qs}` : ''}`, { scroll: false });
  }, [router]);

  const load = useCallback(async (p: number, q: string, pl: string, b: string, s: string) => {
    setLoading(true);
    try {
      const data = await api.getAdminUsers({
        page: p,
        q: q || undefined,
        plan: pl || undefined,
        banned: b || undefined,
        sort: s || undefined,
      });
      setUsers(data.users);
      setTotalPages(data.pagination.totalPages);
      setTotal(data.pagination.total);
    } catch { /* */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    load(page, query, plan, banned, sort);
    updateUrl(page, query, plan, banned, sort);
  }, [page, plan, banned, sort, load, updateUrl]);

  const handleSearch = () => { setPage(1); load(1, query, plan, banned, sort); updateUrl(1, query, plan, banned, sort); };

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      load(1, val, plan, banned, sort);
      updateUrl(1, val, plan, banned, sort);
    }, 300);
  };

  const handleExport = async () => {
    setExporting(true);
    try { await api.exportAdminUsers(); } catch { /* */ }
    setExporting(false);
  };

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function formatSize(bytes: number) {
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Пользователи ({total})</h1>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Поиск по email или имени..."
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 outline-none"
          />
        </div>
        <button onClick={handleSearch} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors">
          Найти
        </button>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gray-700 text-gray-200 text-sm font-medium hover:bg-gray-600 disabled:opacity-50 transition-colors"
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Экспорт CSV
        </button>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <select value={plan} onChange={(e) => { setPlan(e.target.value); setPage(1); }} className={selectClass}>
          <option value="">Тариф: Все</option>
          <option value="FREE">FREE</option>
          <option value="PRO">PRO</option>
        </select>
        <select value={banned} onChange={(e) => { setBanned(e.target.value); setPage(1); }} className={selectClass}>
          <option value="">Статус: Все</option>
          <option value="false">Активные</option>
          <option value="true">Заблокированные</option>
        </select>
        <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} className={selectClass}>
          <option value="newest">Новые</option>
          <option value="oldest">Старые</option>
          <option value="storage">По хранилищу</option>
          <option value="projects">По проектам</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
        </div>
      ) : (
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400">
                <th className="px-4 py-3 text-left font-medium">Email</th>
                <th className="px-4 py-3 text-left font-medium">Имя</th>
                <th className="px-4 py-3 text-center font-medium">Тариф</th>
                <th className="px-4 py-3 text-center font-medium">Проекты</th>
                <th className="px-4 py-3 text-right font-medium">Хранилище</th>
                <th className="px-4 py-3 text-right font-medium">Дата рег.</th>
                <th className="px-4 py-3 text-right font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-3 text-gray-200">
                    <div className="flex items-center gap-2">
                      {u.email}
                      {u.isAdmin && <Shield className="w-3.5 h-3.5 text-amber-400" />}
                      {u.isBanned && <Ban className="w-3.5 h-3.5 text-red-400" />}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{u.displayName || '\u2014'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                      u.plan === 'PRO' ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-700 text-gray-400'
                    }`}>
                      {u.plan === 'PRO' && <Crown className="w-3 h-3" />}
                      {u.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-300">{u._count.projects}</td>
                  <td className="px-4 py-3 text-right text-gray-400">
                    {formatSize(u.storageUsed)} / {formatSize(u.storageLimit)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">{formatDate(u.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/users/${u.id}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
                    >
                      Подробнее <ExternalLink className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Пользователи не найдены</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:border-emerald-500 disabled:opacity-30 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-500 px-3">{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:border-emerald-500 disabled:opacity-30 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
