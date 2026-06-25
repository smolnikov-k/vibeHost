'use client';

import { Upload, Link as LinkIcon, Globe } from 'lucide-react';
import { useStaggerReveal } from '@/lib/useAnimate';

const steps = [
  {
    icon: Upload,
    title: 'Загрузите',
    description: 'Перетащите файлы вашего сайта — ZIP, HTML или папку с проектом.',
    color: 'from-emerald-400 to-emerald-500',
  },
  {
    icon: LinkIcon,
    title: 'Получите ссылку',
    description: 'Сайт появится по адресу yoursite.hostingvibe.ru за несколько секунд.',
    color: 'from-green-400 to-green-500',
  },
  {
    icon: Globe,
    title: 'Готово!',
    description: 'Поделитесь ссылкой или подключите свой домен.',
    color: 'from-emerald-500 to-green-600',
  },
];

export function HowItWorks() {
  const staggerRef = useStaggerReveal();

  return (
    <section id="how" className="py-24 bg-gray-50/50 dark:bg-gray-800/50">
      <div className="max-w-5xl mx-auto px-6">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 dark:text-white mb-4">
          Как это работает
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-center mb-16 max-w-xl mx-auto">
          Три шага — и ваш сайт доступен всему миру
        </p>

        <div ref={staggerRef} className="grid md:grid-cols-3 gap-8">
          {steps.map((step, i) => (
            <div
              key={i}
              className="relative bg-white dark:bg-gray-900 rounded-2xl p-8 border border-gray-100 dark:border-gray-700 shadow-sm dark:shadow-gray-900/20 hover:shadow-md hover:scale-[1.02] transition-all duration-200 group"
            >
              {/* Step number */}
              <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-emerald-500 text-white text-sm font-bold flex items-center justify-center shadow-md">
                {i + 1}
              </div>

              <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform shadow-sm`}>
                <step.icon className="w-7 h-7 text-white" />
              </div>

              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{step.title}</h3>
              <p className="text-gray-500 dark:text-gray-400 leading-relaxed">{step.description}</p>

              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-1/2 -right-4 w-8 border-t-2 border-dashed border-emerald-200" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
