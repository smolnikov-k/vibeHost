'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowLeft, Clock, Eye, User, Calendar, Share2,
  Link2, Check, BookOpen, Zap,
} from 'lucide-react';
import { animate } from 'animejs';
import { pluralize } from '@/lib/utils';
import type { BlogArticle, BlogListResponse } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

interface Props {
  article: BlogArticle;
}

export function ArticleContent({ article }: Props) {
  const [copied, setCopied] = useState(false);
  const [related, setRelated] = useState<BlogListResponse['articles']>([]);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      animate(contentRef.current, {
        opacity: [0, 1],
        translateY: ['20px', '0px'],
        duration: 600,
        ease: 'outExpo',
      });
    }
  }, []);

  // Fetch related articles
  useEffect(() => {
    if (article.tags.length === 0) return;
    const firstTag = article.tags[0];
    fetch(`${API_URL}/blog?tag=${encodeURIComponent(firstTag)}&limit=4`)
      .then(r => r.json())
      .then((data: BlogListResponse) => {
        setRelated(data.articles.filter(a => a.slug !== article.slug).slice(0, 3));
      })
      .catch(() => {});
  }, [article.slug, article.tags]);

  const articleUrl = `https://hostingvibe.ru/blog/${article.slug}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(articleUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  };

  const shareLinks = [
    {
      name: 'Telegram',
      href: `https://t.me/share/url?url=${encodeURIComponent(articleUrl)}&text=${encodeURIComponent(article.title)}`,
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
        </svg>
      ),
    },
    {
      name: 'VK',
      href: `https://vk.com/share.php?url=${encodeURIComponent(articleUrl)}&title=${encodeURIComponent(article.title)}`,
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M15.684 0H8.316C1.592 0 0 1.592 0 8.316v7.368C0 22.408 1.592 24 8.316 24h7.368C22.408 24 24 22.408 24 15.684V8.316C24 1.592 22.391 0 15.684 0zm3.692 17.123h-1.744c-.66 0-.864-.525-2.05-1.727-1.033-1-1.49-1.135-1.744-1.135-.356 0-.458.102-.458.593v1.575c0 .424-.135.678-1.253.678-1.846 0-3.896-1.118-5.335-3.202C4.624 10.857 4.03 8.57 4.03 8.096c0-.254.102-.491.593-.491h1.744c.44 0 .61.203.78.678.847 2.489 2.27 4.673 2.862 4.673.22 0 .322-.102.322-.66V9.721c-.068-1.186-.695-1.287-.695-1.71 0-.204.17-.407.44-.407h2.744c.373 0 .508.203.508.643v3.473c0 .372.17.508.271.508.22 0 .407-.136.813-.542 1.254-1.406 2.15-3.574 2.15-3.574.119-.254.305-.491.745-.491h1.744c.525 0 .644.27.525.644-.22 1.017-2.354 4.031-2.354 4.031-.186.305-.254.44 0 .78.186.254.796.779 1.203 1.253.745.847 1.32 1.558 1.473 2.05.17.49-.085.744-.576.744z" />
        </svg>
      ),
    },
  ];

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
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
              href="/blog"
              className="text-sm text-gray-600 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
            >
              Все статьи
            </Link>
          </div>
        </div>
      </header>

      <div ref={contentRef} className="max-w-3xl mx-auto px-6 py-8 opacity-0">
        {/* Back link */}
        <Link
          href="/blog"
          className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Назад к статьям
        </Link>

        {/* Cover image */}
        {article.coverImage && (
          <div className="aspect-video w-full rounded-xl overflow-hidden mb-6">
            <img
              src={article.coverImage}
              alt={article.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Title */}
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
          {article.title}
        </h1>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mb-4">
          {article.author.displayName && (
            <span className="flex items-center gap-1">
              <User className="w-4 h-4" />
              {article.author.displayName}
            </span>
          )}
          {article.publishedAt && (
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {formatDate(article.publishedAt)}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {article.readTime} мин
          </span>
          <span className="flex items-center gap-1">
            <Eye className="w-4 h-4" />
            {article.viewCount} {pluralize(article.viewCount, 'просмотр', 'просмотра', 'просмотров')}
          </span>
        </div>

        {/* Tags */}
        {article.tags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap mb-8">
            {article.tags.map((tag) => (
              <Link
                key={tag}
                href={`/blog?tag=${encodeURIComponent(tag)}`}
                className="text-xs px-2 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors"
              >
                {tag}
              </Link>
            ))}
          </div>
        )}

        {/* Content */}
        {article.content && (
          <div className="prose-article mb-10">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => (
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-8 mb-4">{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mt-7 mb-3">{children}</h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mt-6 mb-2">{children}</h3>
                ),
                p: ({ children }) => (
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">{children}</p>
                ),
                a: ({ href, children }) => (
                  <a
                    href={href}
                    className="text-emerald-600 dark:text-emerald-400 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {children}
                  </a>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 mb-4 space-y-1">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-inside text-gray-700 dark:text-gray-300 mb-4 space-y-1">{children}</ol>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-emerald-300 dark:border-emerald-600 pl-4 italic text-gray-600 dark:text-gray-400 my-4">
                    {children}
                  </blockquote>
                ),
                code: ({ className, children }) => {
                  const isBlock = className?.includes('language-');
                  if (isBlock) {
                    return (
                      <code className="block bg-gray-100 dark:bg-gray-800 rounded-lg p-4 font-mono text-sm text-gray-800 dark:text-gray-200 overflow-x-auto my-4">
                        {children}
                      </code>
                    );
                  }
                  return (
                    <code className="bg-gray-100 dark:bg-gray-800 rounded px-1.5 py-0.5 font-mono text-sm text-gray-800 dark:text-gray-200">
                      {children}
                    </code>
                  );
                },
                pre: ({ children }) => (
                  <pre className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 overflow-x-auto my-4 text-sm">
                    {children}
                  </pre>
                ),
                img: ({ src, alt }) => (
                  <img
                    src={src}
                    alt={alt || ''}
                    className="rounded-xl max-w-full my-4"
                    loading="lazy"
                  />
                ),
                table: ({ children }) => (
                  <div className="overflow-x-auto my-4">
                    <table className="w-full border-collapse border border-gray-200 dark:border-gray-700 text-sm">
                      {children}
                    </table>
                  </div>
                ),
                thead: ({ children }) => (
                  <thead className="bg-gray-50 dark:bg-gray-800">{children}</thead>
                ),
                th: ({ children }) => (
                  <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-200">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-gray-600 dark:text-gray-300">{children}</td>
                ),
                tr: ({ children }) => (
                  <tr className="even:bg-gray-50 dark:even:bg-gray-800">{children}</tr>
                ),
                hr: () => <hr className="border-gray-200 dark:border-gray-700 my-6" />,
              }}
            >
              {article.content}
            </ReactMarkdown>
          </div>
        )}

        {/* Share buttons */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mb-10">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-1.5">
            <Share2 className="w-4 h-4" />
            Поделиться
          </p>
          <div className="flex items-center gap-2">
            {shareLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-emerald-50 dark:hover:bg-emerald-950 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                title={link.name}
              >
                {link.icon}
              </a>
            ))}
            <button
              onClick={handleCopyLink}
              className="p-2.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-emerald-50 dark:hover:bg-emerald-950 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
              title="Скопировать ссылку"
            >
              {copied ? <Check className="w-5 h-5 text-emerald-500" /> : <Link2 className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Related articles */}
        {related.length > 0 && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Похожие статьи</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {related.map((a) => (
                <Link
                  key={a.id}
                  href={`/blog/${a.slug}`}
                  className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-700 transition-all overflow-hidden"
                >
                  {a.coverImage ? (
                    <div className="aspect-video w-full overflow-hidden">
                      <img
                        src={a.coverImage}
                        alt={a.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video w-full bg-gradient-to-br from-emerald-50 to-green-100 dark:from-emerald-950 dark:to-green-900 flex items-center justify-center">
                      <BookOpen className="w-8 h-8 text-emerald-300" />
                    </div>
                  )}
                  <div className="p-3">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2 group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors">
                      {a.title}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-400 mt-2">
                      <span>{a.readTime} мин</span>
                      <span>{a.viewCount} {pluralize(a.viewCount, 'просмотр', 'просмотра', 'просмотров')}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
