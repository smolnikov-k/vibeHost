'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Search, Eye, Clock, ChevronLeft, ChevronRight,
  Loader2, BookOpen, Tag, Zap,
} from 'lucide-react';
import { animate } from 'animejs';
import { api, type BlogListResponse, type BlogTag } from '@/lib/api';
import { timeAgo, pluralize } from '@/lib/utils';

export default function BlogPage() {
  const [articles, setArticles] = useState<BlogListResponse['articles']>([]);
  const [tags, setTags] = useState<BlogTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  const loadArticles = useCallback(async (p: number, q: string, t: string) => {
    setLoading(true);
    try {
      const data = await api.getBlogArticles({
        page: p,
        search: q || undefined,
        tag: t || undefined,
      });
      setArticles(data.articles);
      setTotalPages(data.pagination.totalPages);
      setTotal(data.pagination.total);
      if (tags.length === 0 && data.tags) {
        setTags(data.tags);
      }
    } catch {
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, [tags.length]);

  useEffect(() => {
    if (!loading && gridRef.current) {
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
  }, [loading, articles.length]);

  useEffect(() => {
    api.getBlogTags().then(setTags).catch(() => {});
  }, []);

  useEffect(() => {
    loadArticles(page, query, activeTag);
  }, [page, activeTag, loadArticles]); // query handled via debounce

  const handleSearch = (value: string) => {
    setQuery(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setPage(1);
      loadArticles(1, value, activeTag);
    }, 400);
  };

  const handleTagClick = (tag: string) => {
    const next = activeTag === tag ? '' : tag;
    setActiveTag(next);
    setPage(1);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold text-gray-900 dark:text-white">
              Vibe<span className="text-emerald-500">Hosting</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-gray-600 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center justify-center gap-2">
            <BookOpen className="w-7 h-7 text-emerald-500" />
            Блог VibeHosting
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {total > 0
              ? `${total} ${pluralize(total, 'статья', 'статьи', 'статей')} о веб-разработке и хостинге`
              : 'Статьи о веб-разработке, хостинге и создании сайтов'}
          </p>
        </div>

        {/* Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Поиск по названию..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-sm bg-white dark:bg-gray-800 dark:text-white"
            />
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
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-emerald-50 dark:hover:bg-emerald-950 hover:text-emerald-700 dark:hover:text-emerald-300'
                }`}
              >
                {tag.name}
                <span className="ml-1 opacity-60">{tag.count}</span>
              </button>
            ))}
            {activeTag && (
              <button
                onClick={() => handleTagClick(activeTag)}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 ml-1"
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
        ) : articles.length === 0 ? (
          <div className="text-center py-20">
            <BookOpen className="w-12 h-12 text-gray-200 dark:text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {query || activeTag ? 'Ничего не найдено' : 'Пока нет статей'}
            </p>
          </div>
        ) : (
          <div ref={gridRef} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {articles.map((article) => (
              <Link
                key={article.id}
                href={`/blog/${article.slug}`}
                data-card
                className="group bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-700 hover:scale-[1.02] transition-all opacity-0 block overflow-hidden"
              >
                {/* Cover image */}
                {article.coverImage ? (
                  <div className="aspect-video w-full overflow-hidden">
                    <img
                      src={article.coverImage}
                      alt={article.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                ) : (
                  <div className="aspect-video w-full bg-gradient-to-br from-emerald-50 to-green-100 dark:from-emerald-950 dark:to-green-900 flex items-center justify-center group-hover:from-emerald-100 group-hover:to-green-200 dark:group-hover:from-emerald-900 dark:group-hover:to-green-800 transition-colors">
                    <BookOpen className="w-10 h-10 text-emerald-300" />
                  </div>
                )}

                <div className="p-5">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 line-clamp-2 group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors">
                    {article.title}
                  </h3>

                  {article.excerpt && (
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">
                      {article.excerpt}
                    </p>
                  )}

                  {/* Tags */}
                  {article.tags.length > 0 && (
                    <div className="flex items-center gap-1 mb-3 flex-wrap">
                      {article.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Meta */}
                  <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-400">
                    {article.publishedAt && (
                      <span>{timeAgo(article.publishedAt)}</span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {article.readTime} мин
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {article.viewCount} {pluralize(article.viewCount, 'просмотр', 'просмотра', 'просмотров')}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-emerald-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-500 dark:text-gray-400 px-3">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-emerald-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
