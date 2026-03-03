'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { X, Upload, Pencil, Share2, ArrowRight, Rocket } from 'lucide-react';
import { animate } from 'animejs';

const ONBOARDING_KEY = 'vibe_onboarding_done';

const steps = [
  {
    icon: Upload,
    title: 'Загрузите сайт',
    description: 'ZIP-архив или ссылка на GitHub-репозиторий — сайт будет онлайн через 30 секунд на yoursite.hostingvibe.ru.',
    tip: 'Поддерживаются HTML, CSS, JS, React, Vue, Astro и другие статические сайты. Сборка (npm build) запускается автоматически.',
    color: 'from-emerald-400 to-green-500',
  },
  {
    icon: Pencil,
    title: 'Редактируйте прямо в браузере',
    description: 'Визуальный редактор: кликните на любой элемент на сайте — измените текст, картинку, стили или скройте блок.',
    tip: 'Все изменения применяются мгновенно без повторной загрузки файлов.',
    color: 'from-blue-400 to-indigo-500',
  },
  {
    icon: Share2,
    title: 'Поделитесь с миром',
    description: 'QR-код для мгновенного доступа, защита паролем, контроль версий с откатом в один клик.',
    tip: 'На PRO-тарифе можно подключить свой домен с автоматическим SSL-сертификатом.',
    color: 'from-purple-400 to-pink-500',
  },
];

export function OnboardingModal({ show }: { show: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const overlayRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (show && !localStorage.getItem(ONBOARDING_KEY)) {
      setOpen(true);
    }
  }, [show]);

  useEffect(() => {
    if (open && overlayRef.current && cardRef.current) {
      animate(overlayRef.current, { opacity: [0, 1], duration: 300, ease: 'outQuad' });
      animate(cardRef.current, {
        opacity: [0, 1],
        scale: [0.95, 1],
        duration: 400,
        ease: 'outExpo',
      });
    }
  }, [open]);

  useEffect(() => {
    if (open && contentRef.current) {
      animate(contentRef.current, {
        opacity: [0, 1],
        translateX: ['20px', '0px'],
        duration: 350,
        ease: 'outExpo',
      });
    }
  }, [step, open]);

  const close = () => {
    localStorage.setItem(ONBOARDING_KEY, '1');
    if (overlayRef.current && cardRef.current) {
      animate(overlayRef.current, { opacity: 0, duration: 200, ease: 'inQuad' });
      animate(cardRef.current, {
        opacity: 0,
        scale: 0.95,
        duration: 200,
        ease: 'inQuad',
        onComplete: () => setOpen(false),
      });
    } else {
      setOpen(false);
    }
  };

  const next = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      close();
      router.push('/projects/new');
    }
  };

  if (!open) return null;

  const current = steps[step];
  const Icon = current.icon;
  const isLast = step === steps.length - 1;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4 opacity-0"
      onClick={(e) => { if (e.target === overlayRef.current) close(); }}
    >
      <div ref={cardRef} className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden opacity-0">
        {/* Header */}
        <div className={`relative bg-gradient-to-br ${current.color} px-6 pt-6 pb-8`}>
          <button
            onClick={close}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
          <div className="flex items-center gap-2 text-white/80 text-sm font-medium mb-4">
            <Rocket className="w-4 h-4" />
            Добро пожаловать в VibeHosting!
          </div>
          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-3">
            <Icon className="w-7 h-7 text-white" />
          </div>
          {/* Step dots */}
          <div className="flex gap-1.5 absolute bottom-3 right-6">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step ? 'w-6 bg-white' : 'w-1.5 bg-white/40'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div ref={contentRef}>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {step + 1}. {current.title}
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed mb-3">
              {current.description}
            </p>
            <p className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3">
              💡 {current.tip}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between mt-6">
            <button
              onClick={close}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Пропустить
            </button>
            <button
              onClick={next}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-white font-medium text-sm hover:bg-emerald-600 transition-colors shadow-sm"
            >
              {isLast ? (
                <>
                  Создать сайт
                  <Rocket className="w-4 h-4" />
                </>
              ) : (
                <>
                  Далее
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
