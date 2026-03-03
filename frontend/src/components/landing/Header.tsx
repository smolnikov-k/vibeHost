'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Zap, Menu, X } from 'lucide-react';
import { animate } from 'animejs';

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
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

  return (
    <header
      ref={headerRef}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/90 backdrop-blur-md shadow-sm border-b border-gray-100'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold text-gray-900">
            Vibe<span className="text-emerald-500">Hosting</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm text-gray-600 hover:text-emerald-600 transition-colors">
            Возможности
          </a>
          <a href="#how" className="text-sm text-gray-600 hover:text-emerald-600 transition-colors">
            Как работает
          </a>
          <a href="#pricing" className="text-sm text-gray-600 hover:text-emerald-600 transition-colors">
            Тарифы
          </a>
          <a href="#faq" className="text-sm text-gray-600 hover:text-emerald-600 transition-colors">
            FAQ
          </a>
          <Link href="/gallery" className="text-sm text-gray-600 hover:text-emerald-600 transition-colors">
            Галерея
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden sm:block text-sm font-medium text-gray-700 hover:text-emerald-600 transition-colors"
          >
            Войти
          </Link>
          <Link
            href="/register"
            className="text-sm font-medium px-4 py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-sm"
          >
            Начать бесплатно
          </Link>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-1 text-gray-600"
            aria-label="Меню"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-6 py-4 space-y-3 shadow-lg">
          <a href="#features" onClick={() => setMobileOpen(false)} className="block text-sm text-gray-600 py-2">Возможности</a>
          <a href="#how" onClick={() => setMobileOpen(false)} className="block text-sm text-gray-600 py-2">Как работает</a>
          <a href="#pricing" onClick={() => setMobileOpen(false)} className="block text-sm text-gray-600 py-2">Тарифы</a>
          <a href="#faq" onClick={() => setMobileOpen(false)} className="block text-sm text-gray-600 py-2">FAQ</a>
          <Link href="/gallery" onClick={() => setMobileOpen(false)} className="block text-sm text-gray-600 py-2">Галерея</Link>
          <Link href="/login" onClick={() => setMobileOpen(false)} className="block text-sm text-gray-600 py-2">Войти</Link>
        </div>
      )}
    </header>
  );
}
