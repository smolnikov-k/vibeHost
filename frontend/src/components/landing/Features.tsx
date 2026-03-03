'use client';

import { useScrollReveal, useStaggerReveal } from '@/lib/useAnimate';
import {
  Pencil, QrCode, Lock, BarChart3, Globe, Zap,
  Shield, MessageCircle, History, ArrowRight,
  Users, FileCode, Download,
} from 'lucide-react';
import Link from 'next/link';

const mainFeatures = [
  {
    icon: MessageCircle,
    title: 'Формы → Telegram',
    description: 'Любая форма на сайте автоматически отправляет заявки в Telegram. Не нужен бекенд, не нужен код — всё работает из коробки.',
    color: 'from-blue-400 to-indigo-500',
    badge: 'Хит',
  },
  {
    icon: Pencil,
    title: 'Визуальный редактор',
    description: 'Кликните на любой элемент — измените текст, цвет, размер или картинку прямо в браузере. Без знания кода. Изменения сохраняются мгновенно.',
    color: 'from-purple-400 to-purple-500',
    badge: 'Популярное',
  },
  {
    icon: BarChart3,
    title: 'Яндекс.Метрика + цели',
    description: 'Укажите номер счётчика — Метрика подключится автоматически. Цели на отправку форм настраиваются без кода за пару кликов.',
    color: 'from-amber-400 to-orange-500',
    badge: 'Новое',
  },
  {
    icon: QrCode,
    title: 'QR-коды',
    description: 'Генерируйте QR-код для любого сайта одним кликом. Идеально для визиток, флаеров и презентаций. Скачивайте в PNG.',
    color: 'from-emerald-400 to-green-500',
    badge: null,
  },
];

const moreFeatures = [
  { icon: Globe, label: 'Свой домен + SSL' },
  { icon: Zap, label: 'Публикация за 30 сек' },
  { icon: Shield, label: 'Бесплатный HTTPS' },
  { icon: Lock, label: 'Защита паролем' },
  { icon: History, label: 'Версии и откат' },
  { icon: Users, label: 'Командный доступ' },
  { icon: FileCode, label: 'React / Vue / Vite' },
  { icon: Download, label: 'Скачать ZIP обратно' },
];

export function Features() {
  const titleRef = useScrollReveal();
  const staggerRef = useStaggerReveal();
  const moreRef = useStaggerReveal();

  return (
    <section id="features" className="py-24">
      <div className="max-w-5xl mx-auto px-6">
        <div ref={titleRef}>
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-4">
            Сила интернета,<br />удобная для каждого
          </h2>
          <p className="text-gray-500 text-center mb-16 max-w-xl mx-auto">
            Всё что нужно — от загрузки до аналитики. Работает из коробки.
          </p>
        </div>

        {/* Main feature cards - 2x2 grid with big cards */}
        <div ref={staggerRef} className="grid md:grid-cols-2 gap-6 mb-10">
          {mainFeatures.map((feature) => (
            <div
              key={feature.title}
              className="relative bg-white rounded-2xl border border-gray-100 p-7 hover:shadow-xl hover:border-emerald-100 transition-all group overflow-hidden"
            >
              {feature.badge && (
                <span className="absolute top-4 right-4 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-xs font-semibold border border-emerald-100">
                  {feature.badge}
                </span>
              )}
              <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform shadow-sm`}>
                <feature.icon className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{feature.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{feature.description}</p>

              {/* Decorative gradient */}
              <div className={`absolute -bottom-8 -right-8 w-32 h-32 rounded-full bg-gradient-to-br ${feature.color} opacity-5 blur-2xl group-hover:opacity-10 transition-opacity`} />
            </div>
          ))}
        </div>

        {/* More features - compact grid */}
        <div className="bg-gray-50/50 rounded-2xl border border-gray-100 p-8">
          <h3 className="text-lg font-bold text-gray-900 text-center mb-6">
            И ещё множество возможностей
          </h3>
          <div ref={moreRef} className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {moreFeatures.map((f) => (
              <div
                key={f.label}
                className="flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-100 hover:border-emerald-200 transition-colors"
              >
                <f.icon className="w-5 h-5 text-emerald-500 shrink-0" />
                <span className="text-sm text-gray-700 font-medium">{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-8">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 text-emerald-600 font-semibold text-sm hover:text-emerald-700 transition-colors group"
          >
            Попробовать все возможности бесплатно
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>
    </section>
  );
}
