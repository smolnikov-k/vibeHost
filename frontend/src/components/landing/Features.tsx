'use client';

import { useStaggerReveal } from '@/lib/useAnimate';
import { Shield, BarChart3, Pencil, Globe, Lock, Zap } from 'lucide-react';

const features = [
  {
    icon: Zap,
    title: 'Мгновенная публикация',
    description: 'Загрузите ZIP или HTML — сайт появится в интернете за 30 секунд. Автоматическая сборка React, Vue, Vite.',
    color: 'from-emerald-400 to-green-500',
  },
  {
    icon: Shield,
    title: 'Бесплатный SSL',
    description: 'HTTPS включён по умолчанию для всех сайтов. Защищённое соединение без дополнительных настроек.',
    color: 'from-blue-400 to-blue-500',
  },
  {
    icon: Pencil,
    title: 'Визуальный редактор',
    description: 'Кликните на любой элемент — измените текст, картинку или стиль. Без знания кода.',
    color: 'from-purple-400 to-purple-500',
  },
  {
    icon: BarChart3,
    title: 'Аналитика просмотров',
    description: 'Отслеживайте посещаемость, популярные страницы и источники трафика в реальном времени.',
    color: 'from-orange-400 to-orange-500',
  },
  {
    icon: Globe,
    title: 'Свой домен',
    description: 'Подключите собственный домен с автоматическим SSL-сертификатом. Одна DNS-запись — и готово.',
    color: 'from-cyan-400 to-cyan-500',
  },
  {
    icon: Lock,
    title: 'Сбор заявок',
    description: 'Формы на вашем сайте отправляют заявки прямо в Telegram. Никакого бэкенда не нужно.',
    color: 'from-rose-400 to-rose-500',
  },
];

export function Features() {
  const staggerRef = useStaggerReveal();

  return (
    <section id="features" className="py-24">
      <div className="max-w-5xl mx-auto px-6">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-4">
          Всё что нужно для вашего сайта
        </h2>
        <p className="text-gray-500 text-center mb-16 max-w-xl mx-auto">
          Мощные инструменты — простой интерфейс. Работает из коробки.
        </p>

        <div ref={staggerRef} className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg hover:border-emerald-100 transition-all group"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm`}>
                <feature.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{feature.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
