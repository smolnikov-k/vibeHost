'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Zap, Menu, X } from 'lucide-react';
import { animate } from 'animejs';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

const NAV_SECTIONS = [
  { id: 'features', label: 'Возможности' },
  { id: 'how', label: 'Как работает' },
  { id: 'pricing', label: 'Тарифы' },
  { id: 'faq', label: 'FAQ' },
] as const;

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeSection, setActiveSection] = useState<string>('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 20);
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(docHeight > 0 ? Math.min(window.scrollY / docHeight, 1) : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: 0 },
    );
    for (const { id } of NAV_SECTIONS) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (headerRef.current) {
      animate(headerRef.current, {
        opacity: [0, 1],
        translateY: ['-20px', '0px'],
        duration: 600,
        ease: 'outExpo',
      });
    }
  }, []);

  const navLinkClass = useCallback(
    (id: string) =>
      `text-sm transition-colors ${
        activeSection === id
          ? 'text-emerald-600 dark:text-emerald-400 font-medium'
          : 'text-gray-600 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400'
      }`,
    [activeSection],
  );

  return (
    <>
      {/* Scroll progress bar */}
      <div
        className="fixed top-0 left-0 h-0.5 bg-gradient-to-r from-emerald-400 to-green-500 z-[60] transition-[width] duration-150"
        style={{ width: `${scrollProgress * 100}%` }}
      />

      <header
        ref={headerRef}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg shadow-sm dark:shadow-gray-900/20 border-b border-gray-100 dark:border-gray-700'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900 dark:text-white">
              Vibe<span className="text-emerald-500">Hosting</span>
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-700 rounded-full px-1.5 py-0.5 leading-none">Beta</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {NAV_SECTIONS.map(({ id, label }) => (
              <a key={id} href={`#${id}`} className={navLinkClass(id)}>
                {label}
              </a>
            ))}
            <Link href="/blog" className="text-sm text-gray-600 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
              Блог
            </Link>
            <Link href="/gallery" className="text-sm text-gray-600 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
              Галерея
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/login"
              className="hidden sm:block text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
            >
              Войти
            </Link>
            <Link
              href="/register"
              className="text-sm font-medium px-4 py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-sm dark:shadow-gray-900/20"
            >
              Начать бесплатно
            </Link>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-1 text-gray-600 dark:text-gray-300"
              aria-label="Меню"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu — full-screen overlay */}
        {mobileOpen && (
          <div className="md:hidden fixed inset-0 top-16 bg-white dark:bg-gray-900 z-40 px-6 py-6 space-y-1 overflow-y-auto">
            <a href="#features" onClick={() => setMobileOpen(false)} className="block text-base text-gray-700 dark:text-gray-200 py-3 border-b border-gray-100 dark:border-gray-700">Возможности</a>
            <a href="#how" onClick={() => setMobileOpen(false)} className="block text-base text-gray-700 dark:text-gray-200 py-3 border-b border-gray-100 dark:border-gray-700">Как работает</a>
            <a href="#pricing" onClick={() => setMobileOpen(false)} className="block text-base text-gray-700 dark:text-gray-200 py-3 border-b border-gray-100 dark:border-gray-700">Тарифы</a>
            <a href="#faq" onClick={() => setMobileOpen(false)} className="block text-base text-gray-700 dark:text-gray-200 py-3 border-b border-gray-100 dark:border-gray-700">FAQ</a>
            <Link href="/blog" onClick={() => setMobileOpen(false)} className="block text-base text-gray-700 dark:text-gray-200 py-3 border-b border-gray-100 dark:border-gray-700">Блог</Link>
            <Link href="/gallery" onClick={() => setMobileOpen(false)} className="block text-base text-gray-700 dark:text-gray-200 py-3 border-b border-gray-100 dark:border-gray-700">Галерея</Link>
            <Link href="/login" onClick={() => setMobileOpen(false)} className="block text-base text-gray-700 dark:text-gray-200 py-3 border-b border-gray-100 dark:border-gray-700">Войти</Link>
            <div className="flex items-center gap-2 py-3 border-b border-gray-100 dark:border-gray-700">
              <span className="text-base text-gray-700 dark:text-gray-200">Тема</span>
              <ThemeToggle />
            </div>
            <Link
              href="/register"
              onClick={() => setMobileOpen(false)}
              className="block text-center mt-4 text-sm font-medium px-4 py-3 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
            >
              Начать бесплатно
            </Link>
          </div>
        )}
      </header>
    </>
  );
}
