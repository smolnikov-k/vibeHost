'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { animate } from 'animejs';
import { CheckCircle } from 'lucide-react';

export default function BillingSuccessPage() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      animate(containerRef.current, {
        opacity: [0, 1],
        scale: [0.95, 1],
        duration: 500,
        ease: 'outExpo',
      });
    }

    const timer = setTimeout(() => {
      router.push('/billing');
    }, 3000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div ref={containerRef} className="text-center opacity-0">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
          <CheckCircle className="w-9 h-9 text-emerald-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Оплата прошла!</h1>
        <p className="text-gray-500 mb-1">Ваш план обновляется...</p>
        <p className="text-sm text-gray-400">Перенаправляем на страницу тарифа через 3 секунды</p>
      </div>
    </div>
  );
}
