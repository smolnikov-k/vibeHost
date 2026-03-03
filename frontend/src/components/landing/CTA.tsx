'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useScrollReveal } from '@/lib/useAnimate';

export function CTA() {
  const ref = useScrollReveal();

  return (
    <section className="py-24">
      <div className="max-w-3xl mx-auto px-6" ref={ref}>
        <div className="rounded-2xl bg-emerald-500 p-10 md:p-14 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
            Готовы запустить свой сайт?
          </h2>
          <p className="text-emerald-100 text-lg mb-8">
            Бесплатно. Без карты. Результат через 30 секунд.
          </p>
          <Link
            href="/register"
            className="group inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white text-emerald-600 font-bold text-lg hover:bg-emerald-50 transition-all shadow-md hover:-translate-y-0.5"
          >
            Попробовать бесплатно
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>
    </section>
  );
}
