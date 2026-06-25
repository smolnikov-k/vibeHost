'use client';

import { useEffect, useRef, useState, useId } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, ArrowRight, Check, FileCode, Image, Code2, FileText } from 'lucide-react';
import { animate } from 'animejs';

const fileTabs = [
  { id: 'html', label: 'Сайты', icon: FileCode },
  { id: 'images', label: 'Изображения', icon: Image },
  { id: 'code', label: 'Код', icon: Code2 },
  { id: 'docs', label: 'Документы', icon: FileText },
];

const examples = [
  { label: 'Лендинг', emoji: '🚀' },
  { label: 'Портфолио', emoji: '🎨' },
  { label: 'Презентация', emoji: '📊' },
  { label: 'Веб-приложение', emoji: '⚡' },
  { label: 'Резюме', emoji: '📄' },
];

export function Hero() {
  const heroRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [dragOver, setDragOver] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [activeTab, setActiveTab] = useState('html');
  const [subdomain, setSubdomain] = useState('');
  const dropzoneHintId = useId();

  useEffect(() => {
    if (heroRef.current) {
      const els = heroRef.current.querySelectorAll('.hero-animate');
      animate(Array.from(els) as HTMLElement[], {
        opacity: [0, 1],
        translateY: ['20px', '0px'],
        duration: 700,
        delay: (_el: unknown, i: number) => 100 + i * 120,
        ease: 'outExpo',
      });
    }
  }, []);

  const registerUrl = () => {
    const params = new URLSearchParams();
    if (subdomain) params.set('slug', subdomain);
    const qs = params.toString();
    return `/register${qs ? `?${qs}` : ''}`;
  };

  const goToRegister = () => {
    router.push(registerUrl());
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    setUploaded(true);
    setTimeout(() => router.push(registerUrl()), 1200);
  };

  const handleDropzoneKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      goToRegister();
    }
  };

  return (
    <section className="relative min-h-[90vh] flex items-center justify-center pt-20 pb-16 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-50/40 via-white to-white dark:from-gray-900/40 dark:via-gray-900 dark:to-gray-900" />
      {/* Decorative blobs */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-emerald-200/20 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-green-200/20 rounded-full blur-3xl" />

      <div ref={heroRef} className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        {/* Badge */}
        <div className="hero-animate opacity-0 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950 border border-emerald-100 dark:border-emerald-800 text-sm text-emerald-700 dark:text-emerald-300 mb-6">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Бесплатный хостинг — серверы в России
        </div>

        {/* Title */}
        <h1 className="hero-animate opacity-0 text-4xl md:text-6xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-4 leading-[1.1]">
          Самый простой способ
          <br />
          <span className="bg-gradient-to-r from-emerald-500 to-green-500 bg-clip-text text-transparent">
            разместить сайт в интернете
          </span>
        </h1>

        {/* Subtitle */}
        <p className="hero-animate opacity-0 text-gray-500 dark:text-gray-400 text-lg max-w-xl mx-auto mb-8">
          Перетащите файлы — получите ссылку. Без кода, без настроек, без DevOps.
          <br />
          <span className="text-gray-400 dark:text-gray-400 text-base">Бесплатно. Серверы в России. Результат через 30 секунд.</span>
        </p>

        {/* Upload widget */}
        <div className="hero-animate opacity-0 max-w-xl mx-auto">
          {/* Subdomain preview */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="flex items-center bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2.5 shadow-sm dark:shadow-gray-900/20 w-full max-w-sm">
              <input
                type="text"
                value={subdomain}
                onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                maxLength={63}
                placeholder="ваш-сайт"
                aria-label="Поддомен для вашего сайта"
                title="Только латиница, цифры и дефис"
                className="flex-1 text-sm text-gray-700 dark:text-gray-200 outline-none bg-transparent min-w-0 font-mono"
              />
              <span className="text-sm text-gray-400 dark:text-gray-400 shrink-0 font-mono">.hostingvibe.ru</span>
            </div>
          </div>

          {/* File type tabs */}
          <div className="flex items-center justify-center gap-1 mb-3">
            {fileTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={goToRegister}
            onKeyDown={handleDropzoneKeyDown}
            role="button"
            tabIndex={0}
            aria-label="Открыть регистрацию и загрузить сайт"
            aria-describedby={dropzoneHintId}
            className={`relative rounded-2xl border-2 border-dashed p-6 sm:p-10 md:p-14 transition-all cursor-pointer group focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 focus-visible:border-emerald-400 ${
              uploaded
                ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950'
                : dragOver
                  ? 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/50 scale-[1.02]'
                  : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 hover:border-emerald-400 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/30'
            }`}
          >
            {uploaded ? (
              <div className="flex flex-col items-center" aria-live="polite">
                <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center mb-4">
                  <Check className="w-8 h-8 text-white" />
                </div>
                <p className="text-emerald-700 dark:text-emerald-300 font-semibold text-lg">Файлы приняты!</p>
                <p className="text-emerald-600 dark:text-emerald-400 text-sm mt-1">Переходим к регистрации...</p>
              </div>
            ) : (
              <>
                <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Upload className="w-7 h-7 text-emerald-500" />
                </div>
                <p className="text-gray-800 dark:text-gray-100 font-semibold text-lg mb-1">Перетащите файлы сюда</p>
                <p id={dropzoneHintId} className="text-sm text-gray-400 dark:text-gray-400 mb-5">
                  ZIP/TAR.GZ архив или ссылку на GitHub. Нажмите Enter или пробел для перехода к регистрации.
                </p>
                <div className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/25 group-hover:shadow-xl">
                  Загрузить файл
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </>
            )}
          </div>

          {/* Example templates */}
          <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
            <span className="text-xs text-gray-400 dark:text-gray-400">или попробуйте:</span>
            {examples.map((ex) => (
              <button
                key={ex.label}
                onClick={goToRegister}
                className="px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-300 hover:border-emerald-200 dark:hover:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950 hover:text-emerald-700 dark:hover:text-emerald-300 transition-all"
              >
                {ex.emoji} {ex.label}
              </button>
            ))}
          </div>

          {/* Tech badges */}
          <div className="flex items-center justify-center gap-2 mt-5 flex-wrap">
            {['HTML', 'React', 'Vue', 'Next.js', 'Vite', 'Astro', 'Svelte'].map((tech) => (
              <span key={tech} className="px-2.5 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-xs text-gray-400 dark:text-gray-400">
                {tech}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
