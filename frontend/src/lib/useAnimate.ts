'use client';

import { useEffect, useRef } from 'react';
import { animate } from 'animejs';

export function useScrollReveal(options?: { delay?: number; distance?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.style.opacity = '0';
    el.style.transform = `translateY(${options?.distance || '40px'})`;
    el.style.transition = 'none';

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          animate(el, {
            opacity: [0, 1],
            translateY: [options?.distance || '40px', '0px'],
            duration: 800,
            delay: options?.delay || 0,
            ease: 'outExpo',
          });
          observer.unobserve(el);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [options?.delay, options?.distance]);

  return ref;
}

export function useStaggerReveal() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const children = el.children;
    for (let i = 0; i < children.length; i++) {
      (children[i] as HTMLElement).style.opacity = '0';
      (children[i] as HTMLElement).style.transform = 'translateY(30px)';
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          animate(Array.from(children) as HTMLElement[], {
            opacity: [0, 1],
            translateY: ['30px', '0px'],
            duration: 600,
            delay: (_el: unknown, i: number) => i * 100,
            ease: 'outExpo',
          });
          observer.unobserve(el);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return ref;
}
