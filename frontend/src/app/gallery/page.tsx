'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Search, Eye, Heart, ExternalLink, Zap, Tag, ChevronLeft, ChevronRight,
  Loader2, Sparkles, ArrowUpDown, Flag, X,
} from 'lucide-react';
import { animate } from 'animejs';
import { api, type GalleryProject, type GalleryTag } from '@/lib/api';
import { timeAgo } from '@/lib/utils';

const sortOptions = [
  { value: 'newest', label: 'Новые' },
  { value: 'popular', label: 'Популярные' },
  { value: 'views', label: 'Просмотры' },
];

export default function GalleryPage() {
  const [projects, setProjects] = useState<GalleryProject[]>([]);
  const [tags, setTags] = useState<GalleryTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('newest');
  const [activeTag, setActiveTag] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [likingSlug, setLikingSlug] = useState<string | null>(null);
  const [reportSlug, setReportSlug] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('SPAM');
  const [reportMessage, setReportMessage] = useState('');
  const [reportSending, setReportSending] = useState(false);
  const [reportResult, setReportResult] = useState('');
  const gridRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  const loadProjects = useCallback(async (p: number, q: string, s: string, t: string) => {
    setLoading(true);
    try {
      const data = await api.getGallery({
        q: q || undefined,
        sort: s,
        tag: t || undefined,
        page: p,
      });
      setProjects(data.projects);
      setTotalPages(data.pagination.totalPages);
      setTotal(data.pagination.total);

      // Animate cards
      if (gridRef.current) {
        const cards = gridRef.current.querySelectorAll('[data-card]');
        if (cards.length > 0) {
          animate(Array.from(cards) as HTMLElement[], {
            opacity: [0, 1],
            translateY: ['16px', '0px'],
            delay: (_el: unknown, i: number) => i * 60,
            duration: 400,
            ease: 'outCubic',
          });
        }
      }
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    api.getGalleryTags().then(setTags).catch(() => {});
  }, []);

  useEffect(() => {
    loadProjects(page, query, sort, activeTag);
  }, [page, sort, activeTag, loadProjects]); // query handled via debounce

  const handleSearch = (value: string) => {
    setQuery(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setPage(1);
      loadProjects(1, value, sort, activeTag);
    }, 400);
  };

  const handleSortChange = (s: string) => {
    setSort(s);
    setPage(1);
  };

  const handleTagClick = (tag: string) => {
    const next = activeTag === tag ? '' : tag;
    setActiveTag(next);
    setPage(1);
  };

  const handleLike = async (e: React.MouseEvent, slug: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (likingSlug) return;
    setLikingSlug(slug);
    try {
      const result = await api.toggleLike(slug);
      setProjects(prev => prev.map(p =>
        p.slug === slug ? { ...p, likes: result.likes, isLiked: result.liked } : p
      ));
    } catch {
      // Not logged in or error — redirect to login
    } finally {
      setLikingSlug(null);
    }
  };

  const handleReport = async () => {
    if (!reportSlug) return;
    setReportSending(true);
    setReportResult('');
    try {
      const res = await api.reportProject(reportSlug, reportReason, reportMessage || undefined);
      setReportResult(res.message);
      setTimeout(() => {
        setReportSlug(null);
        setReportResult('');
        setReportMessage('');
        setReportReason('SPAM');
      }, 2000);
    } catch {
      setReportResult('Ошибка при отправке жалобы');
    } finally {
      setReportSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold text-gray-900">
              Vibe<span className="text-emerald-500">Hosting</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-gray-600 hover:text-emerald-600 transition-colors"
            >
              Войти
            </Link>
            <Link
              href="/register"
              className="text-sm px-4 py-1.5 rounded-lg bg-emerald-500 text-white font-medium hover:bg-emerald-600 transition-colors"
            >
              Начать бесплатно
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Hero */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center justify-center gap-2">
            <Sparkles className="w-7 h-7 text-emerald-500" />
            Галерея проектов
          </h1>
          <p className="text-gray-500 text-sm">
            {total > 0 ? `${total} публичных проектов` : 'Публичные проекты пользователей VibeHosting'}
          </p>
        </div>

        {/* Search + Sort */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Поиск по названию или описанию..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-sm bg-white"
            />
          </div>

          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
            {sortOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleSortChange(opt.value)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  sort === opt.value
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {opt.value === sort && <ArrowUpDown className="w-3 h-3" />}
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <Tag className="w-4 h-4 text-gray-400 shrink-0" />
            {tags.slice(0, 15).map((tag) => (
              <button
                key={tag.name}
                onClick={() => handleTagClick(tag.name)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  activeTag === tag.name
                    ? 'bg-emerald-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-emerald-50 hover:text-emerald-700'
                }`}
              >
                {tag.name}
                <span className="ml-1 opacity-60">{tag.count}</span>
              </button>
            ))}
            {activeTag && (
              <button
                onClick={() => handleTagClick(activeTag)}
                className="text-xs text-gray-400 hover:text-gray-600 ml-1"
              >
                сбросить
              </button>
            )}
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20">
            <Sparkles className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">
              {query || activeTag ? 'Ничего не найдено' : 'Пока нет публичных проектов'}
            </p>
          </div>
        ) : (
          <div ref={gridRef} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <a
                key={project.id}
                href={`https://${project.slug}.hostingvibe.ru`}
                target="_blank"
                rel="noopener noreferrer"
                data-card
                className="group bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all p-5 opacity-0 block"
              >
                {/* Preview placeholder */}
                <div className="w-full h-32 rounded-lg bg-gradient-to-br from-gray-50 to-gray-100 mb-4 flex items-center justify-center overflow-hidden group-hover:from-emerald-50 group-hover:to-green-50 transition-colors">
                  <span className="text-2xl font-bold text-gray-200 group-hover:text-emerald-200 transition-colors">
                    {project.slug}
                  </span>
                </div>

                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-gray-900 text-sm truncate flex-1">
                    {project.title}
                  </h3>
                  <ExternalLink className="w-3.5 h-3.5 text-gray-300 group-hover:text-emerald-400 transition-colors shrink-0 mt-0.5" />
                </div>

                {project.description && (
                  <p className="text-xs text-gray-400 mb-3 line-clamp-2">
                    {project.description}
                  </p>
                )}

                {project.tags.length > 0 && (
                  <div className="flex items-center gap-1 mb-3 flex-wrap">
                    {project.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>{project.user?.displayName || 'Аноним'}</span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {project.views}
                    </span>
                    <button
                      onClick={(e) => handleLike(e, project.slug)}
                      disabled={likingSlug === project.slug}
                      className={`flex items-center gap-1 hover:text-rose-500 transition-colors ${
                        project.isLiked ? 'text-rose-500' : ''
                      }`}
                    >
                      <Heart className={`w-3 h-3 ${project.isLiked ? 'fill-current' : ''}`} />
                      {project.likes}
                    </button>
                    {project.publishedAt && (
                      <span>{timeAgo(project.publishedAt)}</span>
                    )}
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setReportSlug(project.slug); }}
                      className="text-gray-300 hover:text-red-400 transition-colors"
                      title="Пожаловаться"
                    >
                      <Flag className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg bg-white border border-gray-200 text-gray-500 hover:border-emerald-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-500 px-3">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-lg bg-white border border-gray-200 text-gray-500 hover:border-emerald-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Report modal */}
      {reportSlug && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setReportSlug(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Пожаловаться</h3>
              <button onClick={() => setReportSlug(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {reportResult ? (
              <p className="text-sm text-emerald-600 py-4 text-center">{reportResult}</p>
            ) : (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Причина</label>
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none text-sm"
                  >
                    <option value="SPAM">Спам</option>
                    <option value="MALWARE">Вредоносный контент</option>
                    <option value="PHISHING">Фишинг</option>
                    <option value="ILLEGAL">Нелегальный контент</option>
                    <option value="COPYRIGHT">Нарушение авторских прав</option>
                    <option value="OTHER">Другое</option>
                  </select>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Комментарий (необязательно)</label>
                  <textarea
                    value={reportMessage}
                    onChange={(e) => setReportMessage(e.target.value)}
                    rows={3}
                    maxLength={1000}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none text-sm resize-none"
                    placeholder="Опишите проблему..."
                  />
                </div>
                <button
                  onClick={handleReport}
                  disabled={reportSending}
                  className="w-full py-2.5 rounded-lg bg-red-500 text-white font-medium text-sm hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {reportSending ? 'Отправляем...' : 'Отправить жалобу'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
