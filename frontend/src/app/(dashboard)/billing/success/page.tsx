'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { animate } from 'animejs';
import { CheckCircle, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_MS = 30000;

export default function BillingSuccessPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const [planReady, setPlanReady] = useState(false);

  useEffect(() => {
    if (containerRef.current) {
      animate(containerRef.current, {
        opacity: [0, 1],
        scale: [0.95, 1],
        duration: 500,
        ease: 'outExpo',
      });
    }

    let cancelled = false;
    const startTime = Date.now();

    async function pollStatus() {
      while (!cancelled && Date.now() - startTime < MAX_POLL_MS) {
        try {
          const status = await api.getBillingStatus();
          if (status.plan === 'PRO' || (status.subscription && status.subscription.status === 'ACTIVE')) {
            setPlanReady(true);
            // Refresh AuthContext so all pages see updated plan
            await refresh();
            setTimeout(() => {
              if (!cancelled) router.push('/billing');
            }, 1500);
            return;
          }
        } catch {
          // Ignore polling errors
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }

      // Timed out waiting for webhook — redirect anyway, refresh context
      if (!cancelled) {
        await refresh();
        router.push('/billing');
      }
    }

    void pollStatus();

    return () => { cancelled = true; };
  }, [router, refresh]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div ref={containerRef} className="text-center opacity-0">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
          <CheckCircle className="w-9 h-9 text-emerald-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Оплата прошла!</h1>
        {planReady ? (
          <p className="text-emerald-600 dark:text-emerald-400 font-medium mb-1">План обновлён! Перенаправляем...</p>
        ) : (
          <>
            <p className="text-gray-500 dark:text-gray-400 mb-1 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Обновляем ваш план...
            </p>
            <p className="text-sm text-gray-400">Обычно это занимает несколько секунд</p>
          </>
        )}
      </div>
    </div>
  );
}
