'use client';

import { useScrollReveal } from '@/lib/useAnimate';
import { Shield, Server, CreditCard, Users } from 'lucide-react';

export function SocialProof() {
  const ref = useScrollReveal();

  return (
    <section className="py-10">
      <div className="max-w-4xl mx-auto px-6" ref={ref}>
        <div className="flex items-center justify-center gap-8 md:gap-14 flex-wrap text-sm text-gray-500">
          <span className="flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-500" />
            <span className="font-semibold text-gray-700">500+</span> пользователей
          </span>
          <span className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-500" />
            Бесплатный SSL
          </span>
          <span className="flex items-center gap-2">
            <Server className="w-4 h-4 text-emerald-500" />
            Серверы в России
          </span>
          <span className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-emerald-500" />
            Без привязки карты
          </span>
        </div>
      </div>
    </section>
  );
}
