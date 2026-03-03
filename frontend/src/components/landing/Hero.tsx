'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, ArrowRight, Check } from 'lucide-react';
import { animate } from 'animejs';

export function Hero() {
  const heroRef = useRef<HTMLDivElement>(null);
  const uploadRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [dragOver, setDragOver] = useState(false);
  const [uploaded, setUploaded] = useState(false);

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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    setUploaded(true);
    setTimeout(() => router.push('/register'), 1200);
  };

  return (
    <section className="relative min-h-[85vh] flex items-center justify-center pt-20 pb-16 overflow-hidden">
      {/* Soft background */}
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-50/40 via-white to-white" />

      <div ref={heroRef} className="relative z-10 max-w-2xl mx-auto px-6 text-center">
        {/* Title */}
        <h1 className="hero-animate opacity-0 text-4xl md:text-6xl font-extrabold tracking-tight text-gray-900 mb-4 leading-[1.1]">
          Запустите сайт
          <br />
          <span className="bg-gradient-to-r from-emerald-500 to-green-500 bg-clip-text text-transparent">
            за 30 секунд
          </span>
        </h1>

        <p className="hero-animate opacity-0 text-lg text-gray-500 mb-10 max-w-md mx-auto leading-relaxed">
          Перетащите файлы — получите ссылку. Бесплатно.
        </p>

        {/* Upload zone — main CTA */}
        <div
          ref={uploadRef}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => router.push('/register')}
          className={`hero-animate opacity-0 relative rounded-2xl border-2 border-dashed p-12 md:p-16 transition-all cursor-pointer group ${
            uploaded
              ? 'border-emerald-400 bg-emerald-50'
              : dragOver
              ? 'border-emerald-400 bg-emerald-50/50 scale-[1.02]'
              : 'border-gray-300 bg-white hover:border-emerald-400 hover:bg-emerald-50/30'
          }`}
        >
          {uploaded ? (
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center mb-4">
                <Check className="w-8 h-8 text-white" />
              </div>
              <p className="text-emerald-700 font-semibold text-lg">Файлы приняты!</p>
              <p className="text-emerald-600 text-sm mt-1">Переходим к регистрации...</p>
            </div>
          ) : (
            <>
              <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-emerald-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Upload className="w-8 h-8 text-emerald-500" />
              </div>
              <p className="text-gray-800 font-semibold text-xl mb-2">
                Перетащите сайт сюда
              </p>
              <p className="text-sm text-gray-400 mb-6">
                ZIP-архив, HTML-файл или папку с проектом
              </p>
              <div className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/25 group-hover:shadow-xl">
                Начать бесплатно
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
              <div className="flex items-center justify-center gap-3 mt-6 text-xs text-gray-400">
                <span className="px-2.5 py-1 rounded-md bg-gray-100">HTML</span>
                <span className="px-2.5 py-1 rounded-md bg-gray-100">React</span>
                <span className="px-2.5 py-1 rounded-md bg-gray-100">Vue</span>
                <span className="px-2.5 py-1 rounded-md bg-gray-100">Vite</span>
                <span className="px-2.5 py-1 rounded-md bg-gray-100">Next.js</span>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
