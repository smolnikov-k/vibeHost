'use client';

import { useScrollReveal } from '@/lib/useAnimate';
import { Shield, Server, CreditCard } from 'lucide-react';

export function SocialProof() {
  const ref = useScrollReveal();

  return (
    <section className="py-8">
      <div className="max-w-2xl mx-auto px-6" ref={ref}>
        <div className="flex items-center justify-center gap-6 md:gap-10 flex-wrap text-sm text-gray-500">
          <span className="flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-emerald-500" />
            Бесплатный SSL
          </span>
          <span className="flex items-center gap-1.5">
            <Server className="w-4 h-4 text-emerald-500" />
            Серверы в России
          </span>
          <span className="flex items-center gap-1.5">
            <CreditCard className="w-4 h-4 text-emerald-500" />
            Без привязки карты
          </span>
        </div>
      </div>
    </section>
  );
}
